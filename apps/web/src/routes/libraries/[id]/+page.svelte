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
				{#each data.books as book (book.id)}
					{@const year = publicationYear(book.published_at)}
					{@const progress = progressLabel(book)}
					<article class="tile">
						<!-- tabindex/aria-hidden: the title link below is the real one. Two
						     links to the same href would be two tab stops and two identical
						     announcements. -->
						<a class="cover-link" href={bookHref(book.id)} tabindex="-1" aria-hidden="true">
							{#if book.coverUrl}
								<div class="cover">
									<img src={book.coverUrl} alt="" loading="lazy" width="200" height="300" />
								</div>
							{:else}
								<!-- RESTYLE-SPEC.md § 10: a missing image is the bordered box, empty, at
								     the cover's aspect ratio. No placeholder, icon or text; the name and
								     the format render beneath it. -->
								<div class="cover fallback"></div>
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

						<!-- RESTYLE-SPEC.md § 5: the reading state is told by structure as well as by
						     its word. Unread is a dashed border, Reading a solid one, Finished a solid
						     one with the 4px square. -->
						<p class="progress" class:unread={progress === 'Unread'} class:finished={progress === 'Finished'}>
							<MonoKicker size="md" tone="ink">{progress}</MonoKicker>
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
	/* 100vh first, then 100dvh: on mobile 100vh is the large viewport. */
	.grid-page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.column {
		flex: 1;
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
		padding: var(--s-xl) var(--s-lg);
		box-sizing: border-box;
	}

	/* The bar uppercases everything; an address reads better as written. Qualified with
	   the element so the mobile display: none below wins outright. */
	span.session-email {
		text-transform: none;
		letter-spacing: normal;
	}

	/* ---- Page head ---- */

	.page-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding-bottom: var(--s-lg);
	}

	.hero {
		margin: var(--s-2xs) 0 0;
		font-family: var(--f-display);
		font-size: var(--t-display);
		font-weight: var(--w-black);
		line-height: var(--lh-display);
		letter-spacing: var(--tr-display);
		text-transform: uppercase;
		color: var(--token-text);
		overflow-wrap: anywhere;
	}

	.deck {
		margin: var(--s-xs) 0 0;
		max-width: var(--measure);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text-secondary);
	}

	/* ---- Filter strip ---- */

	.strip-row {
		padding: var(--s-lg) 0;
	}

	.search {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: var(--s-lg);
		min-width: min(440px, 100%);
	}

	/* A § 9 Field. Its name is aria-label, as before: a visible label would be a field
	   appearing (Story 8.1's DW-344 is the same finding there). */
	.search input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap);
		box-sizing: border-box;
		padding: var(--s-xs) var(--s-sm);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		border-radius: var(--r-none);
		background: var(--token-bg);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		color: var(--token-text);
	}

	.search input::placeholder {
		color: var(--token-text-secondary);
	}

	.search-go {
		display: inline-flex;
	}

	/* ---- Result bar ---- */

	.resultbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-sm) var(--s-lg);
		padding: var(--s-xs) 0 var(--s-lg);
	}

	.resultbar-right {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-lg);
	}

	.sort {
		display: inline-flex;
		align-items: center;
		gap: var(--s-sm);
	}

	/* A native <select> as a § 9 Field, the caret a text glyph inside the box. */
	.sort-box {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.sort-box select {
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		min-width: 160px;
		min-height: var(--tap);
		box-sizing: border-box;
		padding: var(--s-xs) calc(var(--s-sm) * 2 + 1ch) var(--s-xs) var(--s-sm);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		border-radius: var(--r-none);
		background: var(--token-bg);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		color: var(--token-text);
		cursor: pointer;
	}

	.sort-box select option {
		color: var(--token-text);
		background: var(--token-bg);
	}

	.sort-caret {
		position: absolute;
		right: var(--s-sm);
		color: var(--token-text-secondary);
		pointer-events: none;
	}

	/* ---- Upload (admin) ---- */

	.upload-body {
		padding: var(--s-lg) 0;
	}

	.upload-result {
		margin-bottom: var(--s-md);
		padding: var(--s-sm) var(--s-md);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
	}

	.upload-message {
		margin: var(--s-2xs) 0 0;
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text);
	}

	.upload-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-lg);
	}

	.upload-form input {
		flex: 1;
		min-height: var(--tap);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		color: var(--token-text);
	}

	.upload-note {
		margin: var(--s-sm) 0 0;
	}

	/* ---- The cover grid, RESTYLE-SPEC.md § 10 Media ----
	   The one place the row discipline gives way: the image is the content. The tile is
	   not a card (no ground, no radius, no shadow, no box), separation is the gap, and
	   the border sits on the image box, which reserves its 2:3 space before it loads. */

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--s-md);
		padding-top: var(--s-lg);
	}

	.tile {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cover-link {
		display: block;
		text-decoration: none;
	}

	.cover {
		display: block;
		box-sizing: border-box;
		width: 100%;
		aspect-ratio: 2 / 3;
		border: var(--stroke-hair) solid var(--token-border);
		border-radius: var(--r-none);
	}

	.cover img {
		display: block;
		width: 100%;
		height: 100%;
		max-width: 100%;
		object-fit: cover;
	}

	.kicker {
		margin-top: var(--s-xs);
	}

	/* The name, at --t-sm in --token-text, is the tile's primary Link: the emphasis
	   underline on its text, recoloured on hover, the --tap height on the anchor. */
	.title {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		min-height: var(--tap);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-label);
		color: var(--token-text);
		text-decoration: underline;
		text-decoration-color: var(--token-accent);
		text-decoration-thickness: var(--stroke-emphasis);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
		overflow-wrap: anywhere;
	}

	.title:hover {
		text-decoration-color: var(--token-accent-hover);
	}

	.author {
		margin: 0;
		font-family: var(--f-body);
		font-size: var(--t-xs);
		line-height: var(--lh-label);
		color: var(--token-text-secondary);
	}

	.progress {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: var(--s-2xs);
		margin: var(--s-2xs) 0 0;
		padding: var(--s-2xs) var(--s-xs);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		border-radius: var(--r-none);
	}

	.progress.unread {
		border-style: dashed;
	}

	/* The 4px square at --r-none, in the text's colour: the one ground in the system
	   that is a mark rather than a surface (Story 8.1's .ct-dot). */
	.progress.finished::before {
		content: '';
		flex: none;
		width: var(--s-2xs);
		height: var(--s-2xs);
		background-color: var(--token-text);
	}

	.tile-remove {
		margin-top: auto;
		padding-top: var(--s-xs);
	}

	/* ---- Empty states, § 8: one line in the list's place; no illustration ---- */

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: var(--measure);
		padding: var(--s-xl) 0;
	}

	.empty-headline {
		margin: var(--s-xs) 0 0;
		font-family: var(--f-display);
		font-size: var(--t-md);
		font-weight: var(--w-bold);
		font-stretch: 85%;
		line-height: var(--lh-heading);
		letter-spacing: var(--tr-heading);
		text-transform: uppercase;
		color: var(--token-text);
	}

	.empty-body {
		margin: var(--s-sm) 0 0;
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text-secondary);
	}

	.empty-cta {
		margin-top: var(--s-lg);
	}

	/* ---- Pagination: Controls and a Label ---- */

	.pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--s-lg);
		padding: var(--s-xl) 0;
	}

	.page-indicator {
		text-align: center;
	}

	@media (max-width: 759px) {
		span.session-email {
			display: none;
		}

		.column :global(.strip) {
			flex-wrap: wrap;
		}

		.search {
			min-width: 100%;
		}
	}
</style>
