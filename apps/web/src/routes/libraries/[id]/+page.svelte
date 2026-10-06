<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';
	import UtilityBar from '$lib/components/shell/UtilityBar.svelte';
	import AppNav from '$lib/components/shell/AppNav.svelte';
	import Footer from '$lib/components/shell/Footer.svelte';
	import HardRule from '$lib/components/primitives/HardRule.svelte';
	import MonoKicker from '$lib/components/primitives/MonoKicker.svelte';
	import Button from '$lib/components/primitives/Button.svelte';
	import RoundIconButton from '$lib/components/primitives/RoundIconButton.svelte';
	import FilterStrip from '$lib/components/primitives/FilterStrip.svelte';
	import {
		pad2,
		bookCountLabel,
		relative,
		progressLabel,
		formatLabel,
		publicationYear
	} from '$lib/utils/editorial-format';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const library = $derived(data.library);
	const isAdmin = $derived(data.user?.is_admin ?? false);
	const page = $derived(data.filters.page);
	const totalPages = $derived(Math.ceil(data.total / data.pageSize));

	// ---- Sort ----

	const SORT_STORAGE_KEY = 'library-grid-sort';

	// Segment labels, shared with the result bar so the two never drift apart.
	const SEGMENT_LABELS: Record<string, string> = { epub: 'EPUB', pdf: 'PDF', comic: 'Comic' };

	const FORMAT_SEGMENTS = [
		{ value: '', label: 'All formats' },
		{ value: 'epub', label: 'EPUB' },
		{ value: 'pdf', label: 'PDF' },
		{ value: 'comic', label: 'Comic' }
	];

	const SORT_OPTIONS = [
		{ id: 'title-az', label: 'Title A–Z', sort: 'title', order: 'asc' },
		{ id: 'title-za', label: 'Title Z–A', sort: 'title', order: 'desc' },
		{ id: 'author', label: 'Author', sort: 'author', order: 'asc' },
		{ id: 'newest', label: 'Newest', sort: 'created_at', order: 'desc' },
		{ id: 'oldest', label: 'Oldest', sort: 'created_at', order: 'asc' }
	];

	// Derived rather than a $state seeded once: SvelteKit reuses this component
	// across navigations, so a one-shot initial value goes stale after a Back.
	const sortId = $derived(
		SORT_OPTIONS.find((o) => o.sort === data.filters.sort && o.order === data.filters.order)?.id ??
			'title-az'
	);

	// ---- URL building ----

	/**
	 * Every control routes through here. Server defaults (sort=title, order=asc,
	 * page=1) are omitted so a cleared state produces a clean URL, and the
	 * author/series/language/tag params survive even though no control sets them —
	 * a hand-typed or bookmarked filter must outlive a format change.
	 */
	function buildUrl(updates: Record<string, string | number | string[] | null | undefined>): string {
		const params = new URLSearchParams();
		const next = { ...data.filters, ...updates };

		if (next.q) params.set('q', String(next.q));
		if (next.format) params.set('format', String(next.format));
		if (next.author) params.set('author', String(next.author));
		if (next.series) params.set('series', String(next.series));
		if (next.language) params.set('language', String(next.language));
		const tags = next.tags as string[] | undefined;
		if (tags?.length) params.set('tags', tags.join(','));
		if (next.sort && next.sort !== 'title') params.set('sort', String(next.sort));
		if (next.order && next.order !== 'asc') params.set('order', String(next.order));
		const p = typeof next.page === 'number' ? next.page : data.filters.page;
		if (p && p > 1) params.set('page', String(p));

		const str = params.toString();
		return str ? `?${str}` : '?';
	}

	function applyParams(updates: Record<string, string | number | null | undefined>) {
		goto(buildUrl(updates), { keepFocus: true });
	}

	// A real href, so pagination still works with JS off.
	function hrefForPage(n: number): string {
		return buildUrl({ page: n });
	}

	function urlForSort(id: string): string {
		const option = SORT_OPTIONS.find((o) => o.id === id);
		if (!option) return buildUrl({ page: 1 });
		return buildUrl({ sort: option.sort, order: option.order, page: 1 });
	}

	// Storage access throws outright where site data is blocked (sandboxed frames,
	// some private-browsing modes). The stored preference is best-effort; the
	// navigation is not, so neither call site may take the sort control down with it.
	function readStoredSort(): string | null {
		try {
			return localStorage.getItem(SORT_STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function onSortChange(event: Event) {
		const id = (event.currentTarget as HTMLSelectElement).value;
		try {
			localStorage.setItem(SORT_STORAGE_KEY, id);
		} catch {
			// Preference not persisted; the sort itself still applies below.
		}
		goto(urlForSort(id), { keepFocus: true });
	}

	// onMount, never $effect: this must fire exactly once on entry to the route and
	// never react to a later data change, or a Back navigation would re-navigate.
	onMount(() => {
		if (data.sortExplicit) return;
		const saved = readStoredSort();
		if (!saved || saved === 'title-az') return;
		// A tampered value must never reach the server as a sort column.
		if (!SORT_OPTIONS.some((o) => o.id === saved)) return;
		goto(urlForSort(saved), { replaceState: true, noScroll: true, keepFocus: true });
	});

	// ---- Search ----

	let searchTerm = $state('');

	// Mirrors the URL rather than owning it, so the box does not keep a stale term
	// after a Back navigation or a cleared filter.
	$effect(() => {
		searchTerm = data.filters.q ?? '';
	});

	function onSearchSubmit(event: SubmitEvent) {
		event.preventDefault();
		applyParams({ q: searchTerm.trim() || null, page: 1 });
	}

	// Hidden fields for the no-JS GET path only: a GET submission replaces the whole
	// query string, so anything not represented here is dropped. Server defaults are
	// omitted to keep the resulting URL as clean as buildUrl's.
	const searchCarryOver = $derived(
		(
			[
				['format', data.filters.format],
				['author', data.filters.author],
				['series', data.filters.series],
				['language', data.filters.language],
				['tags', data.filters.tags?.length ? data.filters.tags.join(',') : undefined],
				['sort', data.filters.sort !== 'title' ? data.filters.sort : undefined],
				['order', data.filters.order !== 'asc' ? data.filters.order : undefined]
			] as [string, string | undefined][]
		).filter((entry): entry is [string, string] => Boolean(entry[1]))
	);

	// ---- Derived copy ----

	const hasActiveFilters = $derived(
		Boolean(
			data.filters.q ||
				data.filters.format ||
				data.filters.author ||
				data.filters.series ||
				data.filters.language ||
				data.filters.tags?.length
		)
	);

	// Every stamp comes from the same SQLite column in the same
	// 'YYYY-MM-DD HH:MM:SS' shape, so a lexicographic max is a chronological max.
	const lastImport = $derived(
		relative(
			data.books
				.map((book) => book.created_at)
				.filter(Boolean)
				.sort()
				.at(-1)
		)
	);

	const formatClause = $derived(
		data.activeFormat
			? `Format ${SEGMENT_LABELS[data.activeFormat] ?? data.activeFormat}`
			: 'All formats'
	);

	const resultLabel = $derived.by(() => {
		if (data.total === 0) return 'No results';
		const start = (page - 1) * data.pageSize + 1;
		const end = Math.min(page * data.pageSize, data.total);
		const query = data.filters.q ? ` · “${data.filters.q}”` : '';
		return `Showing ${start}–${end} of ${data.total} · ${formatClause}${query}`;
	});

	// ---- Admin affordances ----

	let uploadOpen = $state(false);
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	const onUpload: SubmitFunction = () => {
		uploading = true;
		return async ({ update }) => {
			await update();
			uploading = false;
			if (fileInput) fileInput.value = '';
		};
	};

	// Deleting from a grid tile is one misclick away from losing the file itself.
	function confirmRemove(title: string): SubmitFunction {
		return ({ cancel }) => {
			if (!window.confirm(`Remove “${title}” from the library? This deletes the file.`)) cancel();
		};
	}

	function bookHref(bookId: string): string {
		return `/libraries/${library.id}/books/${bookId}`;
	}
</script>

<svelte:head>
	<title>{library.name} · Cuatro Library</title>
</svelte:head>

<div class="grid-page">
	<UtilityBar breadcrumb={['Cuatro Library', 'Libraries', library.name]}>
		{#snippet rightSlot()}
			<span class="session-email">{data.user?.email}</span>
			{#if isAdmin}
				<a href="/admin/libraries">Admin</a>
			{/if}
			<form method="POST" action="/logout"><button type="submit">Sign out</button></form>
		{/snippet}
	</UtilityBar>

	<AppNav>
		{#snippet rightSlot()}
			<RoundIconButton icon="search" aria-label="Search" />
			<RoundIconButton icon="account" aria-label="Account" />
		{/snippet}
	</AppNav>

	<main class="column">
		<header class="page-head">
			<MonoKicker size="md" tone="ink">Library</MonoKicker>
			<h1 class="hero">{library.name}</h1>
			<p class="deck">
				{bookCountLabel(data.total)}{#if lastImport}<span aria-hidden="true"> · </span>last imported
					{lastImport}{/if}
			</p>
		</header>

		<HardRule weight="bracket" />

		<div class="strip-row">
			<FilterStrip
				class="strip"
				size="sm"
				ariaLabel="Format"
				options={FORMAT_SEGMENTS}
				value={data.activeFormat}
				onChange={(next) => applyParams({ format: next || null, page: 1 })}
			>
				{#snippet trailing()}
					<!-- method="GET" with named fields so Enter still searches with JS off,
					     matching the real hrefs on pagination and Clear filters. A GET
					     submission replaces the whole query string, so every filter that
					     must survive needs a field here; `page` is deliberately absent,
					     since a new search belongs on page 1. -->
					<form class="search" method="GET" onsubmit={onSearchSubmit}>
						<input
							type="search"
							name="q"
							bind:value={searchTerm}
							placeholder="Search titles, authors, tags…"
							aria-label="Search this library"
						/>
						{#each searchCarryOver as [name, value] (name)}
							<input type="hidden" {name} {value} />
						{/each}
						<span class="search-go">
							<Button variant="primary" size="sm" type="submit">Search</Button>
						</span>
					</form>
				{/snippet}
			</FilterStrip>
		</div>

		<div class="resultbar">
			<MonoKicker size="sm" tone="caption">{resultLabel}</MonoKicker>
			<div class="resultbar-right">
				{#if isAdmin}
					<Button variant="tertiary" size="sm" onclick={() => (uploadOpen = !uploadOpen)}>
						{uploadOpen ? 'Close' : 'Upload a file'}
					</Button>
				{/if}
				<span class="sort">
					<label for="library-sort"><MonoKicker size="sm" tone="caption">Sort by</MonoKicker></label>
					<span class="sort-box">
						<select id="library-sort" value={sortId} onchange={onSortChange}>
							{#each SORT_OPTIONS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
						<span class="sort-caret" aria-hidden="true">▾</span>
					</span>
				</span>
			</div>
		</div>

		<HardRule weight="hairline" />

		{#if isAdmin && uploadOpen}
			<section class="upload">
				<HardRule weight="bracket" />
				<div class="upload-body">
					{#if form?.uploaded}
						<div class="upload-result">
							<MonoKicker size="sm" tone="ink">Added</MonoKicker>
							<p class="upload-message">{form.book.title}</p>
						</div>
					{/if}
					{#if form?.duplicate}
						<div class="upload-result">
							<MonoKicker size="sm" tone="ink">Already on file</MonoKicker>
							<p class="upload-message">{form.book.title}</p>
						</div>
					{/if}
					{#if form?.error}
						<div class="upload-result">
							<MonoKicker size="sm" tone="ink">Error</MonoKicker>
							<p class="upload-message">{form.error}</p>
						</div>
					{/if}

					<form
						method="POST"
						action="?/upload"
						enctype="multipart/form-data"
						use:enhance={onUpload}
						class="upload-form"
					>
						<input
							bind:this={fileInput}
							type="file"
							name="file"
							accept=".epub,.pdf,.cbz,.cbr"
							required
						/>
						<Button variant="inverted" size="sm" type="submit" disabled={uploading}>
							{uploading ? 'Uploading' : 'Upload'}
						</Button>
					</form>

					<p class="upload-note">
						<MonoKicker size="sm" tone="caption">Accepts EPUB · PDF · CBZ · CBR</MonoKicker>
					</p>
				</div>
				<HardRule weight="bracket" />
			</section>
		{/if}

		{#if data.total === 0}
			<div class="empty">
				{#if hasActiveFilters}
					<MonoKicker size="md" tone="caption">No results</MonoKicker>
					<h2 class="empty-headline">Nothing matches that query.</h2>
					<p class="empty-body">Try a different title or author, or clear the format filter.</p>
					<div class="empty-cta">
						<Button variant="primary" size="md" href="/libraries/{library.id}">Clear filters</Button>
					</div>
				{:else}
					<MonoKicker size="md" tone="caption">Nothing on file</MonoKicker>
					<h2 class="empty-headline">This library is empty.</h2>
					<p class="empty-body">
						{#if isAdmin}
							Upload a file above, or drop an EPUB, PDF or comic archive into the watched folder.
						{:else}
							No books have been added to this collection yet.
						{/if}
					</p>
				{/if}
			</div>
		{:else}
			<div class="grid">
				{#each data.books as book, i (book.id)}
					{@const year = publicationYear(book.published_at)}
					<article class="tile">
						<!-- tabindex/aria-hidden: the title link below is the real one. Two
						     links to the same href would be two tab stops and two identical
						     announcements. -->
						<a class="cover-link" href={bookHref(book.id)} tabindex="-1" aria-hidden="true">
							{#if book.coverUrl}
								<div class="cover">
									<img src={book.coverUrl} alt="" loading="lazy" />
								</div>
							{:else}
								<div class="cover fallback">
									<!-- Numbered across the whole result set, not the page: a bare
									     index restarts at 01 on page 2 while reading as a catalogue
									     number that should be stable. -->
									<MonoKicker size="sm" tone="paper"
										>{formatLabel(book.format)} · N° {pad2(
											(page - 1) * data.pageSize + i + 1
										)}</MonoKicker
									>
									<span class="fallback-title">{book.title}</span>
									{#if book.author}
										<MonoKicker size="sm" tone="paper">{book.author}</MonoKicker>
									{/if}
								</div>
							{/if}
						</a>

						<div class="kicker">
							<MonoKicker size="md" tone="ink"
								>{formatLabel(book.format)}{year ? ` · ${year}` : ''}</MonoKicker
							>
						</div>

						<a class="title" href={bookHref(book.id)}>{book.title}</a>

						{#if book.author}
							<p class="author">by {book.author}</p>
						{/if}

						<p class="progress">
							<MonoKicker size="md" tone="caption">{progressLabel(book)}</MonoKicker>
						</p>

						{#if isAdmin}
							<form
								method="POST"
								action="?/delete"
								use:enhance={confirmRemove(book.title)}
								class="tile-remove"
							>
								<input type="hidden" name="bookId" value={book.id} />
								<Button variant="tertiary" size="sm" type="submit">Remove</Button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		{#if totalPages > 1}
			<nav class="pagination" aria-label="Pagination">
				<Button variant="primary" size="md" href={hrefForPage(page - 1)} disabled={page <= 1}>
					Prev
				</Button>
				<span class="page-indicator">
					<MonoKicker size="md" tone="ink">Page {pad2(page)} of {pad2(totalPages)}</MonoKicker>
				</span>
				<Button
					variant="primary"
					size="md"
					href={hrefForPage(page + 1)}
					disabled={page >= totalPages}
				>
					Next
				</Button>
			</nav>
		{/if}
	</main>

	<Footer {isAdmin} />
</div>

<style>
	/* 100vh first, then 100dvh: on mobile Safari/Chrome 100vh is the LARGE
	   viewport, so with the URL bar on screen the footer starts below the fold. */
	.grid-page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--paper-white);
	}

	.column {
		flex: 1;
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
		/* Bottom padding is load-bearing, not symmetry: without it the pagination
		   butts straight onto the dark footer. */
		padding: var(--space-48) var(--space-24) var(--space-48);
		box-sizing: border-box;
	}

	/* The bar uppercases everything it contains, which turns a signed-in address
	   into a shouted one. Qualified with the element on purpose: UtilityBar styles
	   this span through `.utility-right > :global(*)`, which ties on specificity,
	   so a bare class would be decided by stylesheet order — and the mobile
	   `display: none` below has to win outright. */
	span.session-email {
		text-transform: none;
		letter-spacing: normal;
	}

	/* ---- Page head ---- */

	.page-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding-bottom: var(--space-32);
	}

	/* No under-word rule here, unlike /login and /: that device singles out one word
	   of a fixed hero phrase, and a variable-length library name has no such word. */
	.hero {
		margin: var(--space-4) 0 0;
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.5px;
		color: var(--page-ink);
		text-align: left;
		/* A long unbroken name at 64px has no break opportunity and would otherwise
		   run straight out of the column. */
		overflow-wrap: anywhere;
	}

	/* 16px non-italic, NOT the 19px italic deck the picker uses: 01-library-grid.md
	   is explicit for this screen and the prompt wins over cross-screen habit. */
	.deck {
		margin: var(--space-8) 0 0;
		max-width: 52ch;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.5;
		letter-spacing: 0.09px;
		color: var(--caption-gray);
	}

	/* ---- Filter strip ---- */

	.strip-row {
		padding: var(--space-24) 0;
	}

	.search {
		display: flex;
		align-items: stretch;
		min-width: 440px;
	}

	/* Hand-rolled rather than <Input>: B.7 requires a visible label stacked above a
	   100%-wide field, which cannot sit inline beside the segments. Metrics match
	   B.7 exactly except the height (44px, so the whole strip is one band). */
	.search input {
		flex: 1;
		height: 44px;
		box-sizing: border-box;
		padding: 0 var(--space-12);
		border: 2px solid var(--wired-black);
		border-radius: 0;
		background: var(--paper-white);
		font-family: var(--font-sans);
		font-size: 16px;
		color: var(--page-ink);
	}

	.search input::placeholder {
		color: var(--caption-gray);
	}

	.search input:focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}

	/* Mirrors FilterStrip's own `.seg-cell:not(:first-child)` collapse so the input
	   and button fuse to one 2px seam. The wrapper span is the mechanism: a class on
	   <Button> lands with BUTTON's scope hash and cannot be reached from here. */
	.search-go {
		margin-left: -2px;
		display: inline-flex;
	}

	/* ---- Result bar ---- */

	.resultbar {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-24);
		padding: var(--space-8) 0 var(--space-24);
	}

	.resultbar-right {
		display: flex;
		align-items: center;
		gap: var(--space-24);
	}

	.sort {
		display: inline-flex;
		align-items: center;
		gap: var(--space-12);
	}

	.sort-box {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 32px;
		box-sizing: border-box;
		padding: 0 28px 0 var(--space-12);
		border: 2px solid var(--wired-black);
	}

	/* A native <select> on purpose: real keyboard support and a real mobile picker.
	   Its popup is UA-rendered and cannot be brought fully onto the palette. */
	.sort-box select {
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		min-width: 140px;
		border: 0;
		background: transparent;
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		color: var(--page-ink);
		cursor: pointer;
	}

	/* Without this the popup inherits the hovered box's colors on Windows/Chromium
	   and renders its own text invisibly. */
	.sort-box select option {
		color: var(--page-ink);
		background: var(--paper-white);
	}

	.sort-caret {
		position: absolute;
		right: var(--space-12);
		color: var(--page-ink);
		pointer-events: none;
	}

	.sort-box:hover {
		background: var(--wired-black);
	}

	.sort-box:hover select,
	.sort-box:hover .sort-caret {
		color: var(--paper-white);
	}

	.sort-box:focus-within {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}

	/* ---- Upload (admin) ---- */

	.upload-body {
		padding: var(--space-24) 0;
	}

	/* The C.1 treatment, identical for all three outcomes — only the kicker word
	   differs. No success/warning/error color anywhere. */
	.upload-result {
		margin-bottom: var(--space-16);
		padding: 14px var(--space-16);
		border: 2px solid var(--wired-black);
		background: var(--paper-white);
	}

	.upload-message {
		margin: var(--space-4) 0 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.5;
		color: var(--page-ink);
	}

	.upload-form {
		display: flex;
		align-items: center;
		gap: var(--space-16);
	}

	/* The native control keeps its UA appearance; building a drop zone is C.7. */
	.upload-form input {
		flex: 1;
		font-family: var(--font-sans);
		font-size: 14px;
		color: var(--page-ink);
	}

	.upload-note {
		margin: var(--space-12) 0 0;
	}

	/* ---- Grid ---- */

	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding-top: var(--space-48);
	}

	/* 16 + 16 = the prompt's 32px horizontal gutter; padding-bottom is the 48px
	   vertical gutter. Grid stretches every tile in a row to the row height, which
	   is what lets the fold span the full row rather than one ragged tile. */
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 0 var(--space-16) var(--space-48);
	}

	/* The printerly column fold: a 1px rule on the LEFT edge of every tile except
	   the first in its row, stopping short of the vertical gutter.

	   Per TILE, not on the grid container: a container pseudo-element cannot know
	   where a wrapped row starts or how tall it is. The epic's Debugging note says
	   otherwise and is wrong. */
	.tile::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: var(--space-48);
		width: 1px;
		background: var(--wired-black);
	}

	/* Every column count's modulus rules live inside a BOUNDED @media block.
	   A media query adds no specificity, so an unbounded `.tile:nth-child(4n + 1)`
	   (0,2,0) outranks any `.tile` reset (0,1,0) a narrower block can write — and
	   `4n + 1` still matches at three columns. Left unbounded, tiles 5, 9, 17 keep
	   the 4-column `display: none` and lose their fold mid-row, and tiles 4, 8, 16
	   keep `padding-right: 0` and lose a gutter. Bounding each modulus is the only
	   form that holds; a reset inside the narrower block cannot win the cascade. */
	@media (min-width: 1280px) {
		.tile:nth-child(4n + 1) {
			padding-left: 0;
		}

		.tile:nth-child(4n) {
			padding-right: 0;
		}

		.tile:nth-child(4n + 1)::before {
			display: none;
		}
	}

	/* ---- Tile content ---- */

	.cover-link {
		display: block;
		text-decoration: none;
	}

	.cover {
		width: 100%;
		aspect-ratio: 2 / 3;
		display: block;
		border-radius: 0;
	}

	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* The prototype's `ink` palette — the only one of its five that is on-system.
	   The other four carry off-palette fills or decorative geometry. */
	.fallback {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-sizing: border-box;
		padding: 18px var(--space-16);
		background: var(--page-ink);
		color: var(--paper-white);
	}

	.fallback-title {
		font-family: var(--font-display);
		font-size: 26px;
		line-height: 1;
		letter-spacing: -0.3px;
		color: var(--paper-white);
		overflow-wrap: anywhere;
	}

	.kicker {
		margin-top: var(--space-12);
	}

	.title {
		margin-top: var(--space-4);
		font-family: var(--font-display);
		font-size: 26px;
		line-height: 1.18;
		letter-spacing: -0.2px;
		color: var(--page-ink);
		text-decoration: none;
		overflow-wrap: anywhere;
		transition: color 150ms linear;
	}

	/* .tile:hover, not .title:hover — hovering the COVER must colour the title too.
	   Only colour transitions; the underline and everything else is instant. */
	.tile:hover .title,
	.tile:focus-within .title {
		color: var(--link-blue);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 4px;
	}

	.title:focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}

	.author {
		margin: 6px 0 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.4;
		color: var(--page-ink);
	}

	.progress {
		margin: var(--space-8) 0 0;
	}

	/* Pins to the bottom of a stretched tile so the control sits on one line across
	   a row of ragged-height tiles. */
	.tile-remove {
		margin-top: auto;
		padding-top: var(--space-12);
	}

	/* ---- Empty states ---- */

	/* 96px has no token; a literal is the B.4-B.9 precedent for off-ramp values. */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 520px;
		margin: 0 auto;
		padding: 96px 0;
		text-align: center;
	}

	/* 26px, not the prototype's 40px: DESIGN.md §3's display ramp has 64 and 26 and
	   no step between them. */
	.empty-headline {
		margin: var(--space-8) 0 0;
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 400;
		line-height: 1.18;
		color: var(--page-ink);
	}

	.empty-body {
		margin: var(--space-12) 0 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.5;
		color: var(--caption-gray);
	}

	.empty-cta {
		margin-top: var(--space-24);
	}

	/* ---- Pagination ---- */

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-24);
		padding: var(--space-48) 0 var(--space-64);
	}

	.page-indicator {
		min-width: 160px;
		text-align: center;
	}

	/* ---- Responsive ramp ----
	   Mono kickers are absent from every block on purpose: DESIGN.md §8 locks them
	   at 13px and they never scale.

	   Each block RE-DECLARES the tile padding and the fold's display before applying
	   its own modulus. `4n + 1` still matches at three columns, so without the reset
	   the folds land in the middle of a row — and no test can see it. */

	@media (min-width: 1024px) and (max-width: 1279px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.tile:nth-child(3n + 1) {
			padding-left: 0;
		}

		.tile:nth-child(3n) {
			padding-right: 0;
		}

		.tile:nth-child(3n + 1)::before {
			display: none;
		}
	}

	/* Two columns and below drop the folds entirely — the epic's verify step 6 is
	   explicit that they appear at >=1024px only, which overrides DESIGN.md §8's
	   "hairlines persist between every column count" for this screen. */
	@media (max-width: 1023px) {
		.hero {
			font-size: 48px;
			line-height: 1.08;
		}

		.grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.tile::before {
			display: none;
		}

		.tile:nth-child(2n + 1) {
			padding-left: 0;
		}

		.tile:nth-child(2n) {
			padding-right: 0;
		}
	}

	@media (max-width: 767px) {
		/* AC16 narrows the horizontal padding only. The bottom 48px is load-bearing
		   at every width: without it the pagination butts onto the dark footer. */
		.column {
			padding: var(--space-48) var(--space-16);
		}

		/* The bar has no room for breadcrumb + address + two controls at 375px, and
		   the address is the one item that is not a control. */
		span.session-email {
			display: none;
		}

		.hero {
			font-size: 40px;
			line-height: 1.12;
		}

		/* :global() is mandatory — a class passed as a prop is rendered inside
		   FilterStrip's template and never receives this route's scoping hash. */
		.column :global(.strip) {
			flex-wrap: wrap;
		}

		.search {
			min-width: 100%;
		}

		.resultbar {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-12);
		}

		.grid {
			grid-template-columns: 1fr;
		}

		.tile {
			padding-left: 0;
			padding-right: 0;
		}

		.title {
			font-size: 22px;
			line-height: 1.2;
		}
	}
</style>
