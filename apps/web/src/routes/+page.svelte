<script lang="ts">
	import type { PageData } from './$types';
	import UtilityBar from '$lib/components/shell/UtilityBar.svelte';
	import AppNav from '$lib/components/shell/AppNav.svelte';
	import Footer from '$lib/components/shell/Footer.svelte';
	import HardRule from '$lib/components/primitives/HardRule.svelte';
	import MonoKicker from '$lib/components/primitives/MonoKicker.svelte';
	import Button from '$lib/components/primitives/Button.svelte';
	import RoundIconButton from '$lib/components/primitives/RoundIconButton.svelte';
	import {
		pad2,
		collectionCountLabel,
		bookCountLabel,
		readerCountLabel,
		vibeTag,
		relative
	} from '$lib/utils/editorial-format';

	let { data }: { data: PageData } = $props();

	const libraries = $derived(data.libraries);
	const isAdmin = $derived(data.user?.is_admin ?? false);

	// Every stamp comes from the same SQLite column in the same
	// 'YYYY-MM-DD HH:MM:SS' shape, so a lexicographic max is a chronological max
	// and no parsing is needed to pick the newest.
	const latestImport = $derived(
		relative(
			libraries
				.map((library) => library.last_import_at)
				.filter((stamp): stamp is string => Boolean(stamp))
				.sort()
				.at(-1)
		)
	);
</script>

<svelte:head>
	<title>Cuatro Library</title>
</svelte:head>

<div class="picker">
	<UtilityBar breadcrumb={['Cuatro Library', 'Libraries']}>
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
			<MonoKicker size="md" tone="ink">Issue · {collectionCountLabel(libraries.length)}</MonoKicker>
			<h1 class="hero">Your <span class="ul">libraries</span></h1>
			<p class="deck">
				{#if libraries.length === 0}
					No libraries yet.
				{:else if latestImport}
					Pick a collection to browse. The most recent import across everything was {latestImport}.
				{:else}
					Pick a collection to browse.
				{/if}
			</p>
		</header>

		<HardRule weight="bracket" />

		{#if libraries.length > 0}
			<ul class="rows">
				{#each libraries as library, i (library.id)}
					<li>
						<!-- Without an explicit name the accessible name is the whole row —
						     ordinal, vibe tag, description, counts and the decorative middots
						     read out as one link label. -->
						<a class="row" href="/libraries/{library.id}" aria-label={library.name}>
							<span class="num" aria-hidden="true">{pad2(i + 1)}</span>
							<span class="mid">
								<MonoKicker size="md" tone="ink">{vibeTag(library)}</MonoKicker>
								<span class="name">{library.name}</span>
								{#if library.description?.trim()}
									<span class="desc">{library.description}</span>
								{/if}
							</span>
							<span class="meta">
								<MonoKicker size="md" tone="ink">{bookCountLabel(library.book_count)}</MonoKicker>
								{#if library.last_import_at}
									<MonoKicker size="md" tone="caption">Last import · {relative(
											library.last_import_at
										)}</MonoKicker>
								{/if}
								<MonoKicker size="md" tone="caption">{readerCountLabel(
										library.user_count
									)}</MonoKicker>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="empty">
				<MonoKicker size="md" tone="ink">Nothing on file</MonoKicker>
				<!-- An admin reads the unfiltered list, so an empty one means no library
				     exists — telling the administrator to contact the administrator is the
				     one reading of this block that is never true. -->
				{#if isAdmin}
					<h2 class="empty-headline">No libraries have been created yet.</h2>
					<p class="empty-body">
						Create the first collection, then grant accounts access to it. Readers only see
						the libraries they have been granted.
					</p>
				{:else}
					<h2 class="empty-headline">This account has no library access.</h2>
					<p class="empty-body">
						Accounts are invitation-only, and each library is granted separately. Contact the
						administrator to be added to a collection.
					</p>
				{/if}
				{#if isAdmin}
					<div class="empty-cta">
						<Button variant="primary" size="md" href="/admin/libraries">Create a library</Button>
					</div>
				{/if}
			</div>
		{/if}

		<HardRule weight="bracket" />
	</main>

	<Footer {isAdmin} />
</div>

<style>
	/* 100vh first, then 100dvh: on mobile Safari/Chrome 100vh is the LARGE
	   viewport, so with the URL bar on screen the footer starts below the fold.
	   The layout wrapper is a plain non-flex div, so the full-height column is
	   this route's own job. */
	.picker {
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
		/* Bottom padding is load-bearing, not symmetry: once the list is tall enough
		   to fill the viewport the closing 2px bracket butts straight onto the dark
		   footer and stops reading as a rule at all. */
		padding: var(--space-64) var(--space-24) var(--space-48);
		box-sizing: border-box;
	}

	/* The bar uppercases everything it contains, which turns a signed-in address
	   into LUIGI@PHAROSGRAPH.COM. The prompt sets ADMIN and SIGN OUT in caps and
	   leaves the email lowercase; a shouted address is also markedly harder to scan.

	   Qualified with the element on purpose: UtilityBar styles this span through
	   `.utility-right > :global(*)`, which ties on specificity, so a bare class would
	   be decided by stylesheet order — and the mobile `display: none` below has to
	   win outright. */
	span.session-email {
		text-transform: none;
		letter-spacing: normal;
	}

	/* ---- Page head ---- */

	.page-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding-bottom: var(--space-48);
	}

	.hero {
		margin: var(--space-8) 0 0;
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.5px;
		color: var(--page-ink);
		text-align: left;
	}

	/* The rule is measured from the PADDING box, not the baseline, so it lands
	   ~15px under the glyphs. That is the signed-off C.1 appearance — the prompt's
	   "8px below the baseline" is describing this padding value. Do not re-derive. */
	.hero .ul {
		position: relative;
		display: inline-block;
		padding-bottom: var(--space-8);
	}

	.hero .ul::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: var(--wired-black);
	}

	.deck {
		margin: var(--space-16) 0 0;
		max-width: 68ch;
		font-family: var(--font-serif);
		font-size: 19px;
		font-style: italic;
		line-height: 1.47;
		letter-spacing: 0.108px;
		color: var(--caption-gray);
	}

	/* ---- Row list ---- */

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* EVERY row carries both borders from the start, including the first: giving
	   the top border to `li + li` only means hovering row 01 adds a 1px border
	   that nothing compensates for and nudges the whole list down. */
	.rows li {
		border-top: 1px solid transparent;
		border-bottom: 1px solid var(--hairline-tint);
	}

	/* Collapse each row's transparent top border onto the previous row's bottom
	   border so the pair reads as one hairline and the hover swap shifts nothing. */
	.rows li + li {
		margin-top: -1px;
	}

	/* The closing 2px bracket is the terminal rule, so the resting hairline is
	   transparent rather than absent — `border-bottom: 0` has no width for the hover
	   swap to paint, which left the last row bracketed on one edge only. */
	.rows li:last-child {
		border-bottom-color: transparent;
	}

	/* li:hover alone would cover the mouse; :has() is needed for the KEYBOARD arm,
	   since focus lands on the <a> and there is no parent selector for it. */
	.rows li:has(.row:hover),
	.rows li:has(.row:focus-visible) {
		position: relative;
		z-index: 1;
		border-top-color: var(--wired-black);
		border-bottom-color: var(--wired-black);
	}

	.rows li:has(.row:hover) + li,
	.rows li:has(.row:focus-visible) + li {
		border-top-color: var(--wired-black);
	}

	/* Row 01's top edge is already the 2px opening bracket; painting the hover
	   hairline there too stacks 1px under 2px and reads as a single 3px rule. */
	.rows li:first-child:has(.row:hover),
	.rows li:first-child:has(.row:focus-visible) {
		border-top-color: transparent;
	}

	.row {
		display: grid;
		grid-template-columns: 96px 1fr 240px;
		gap: var(--space-24);
		align-items: start;
		padding: var(--space-32) 0;
		color: inherit;
		text-decoration: none;
	}

	.row:focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}

	.num {
		font-family: var(--font-display);
		font-size: 64px;
		line-height: 1;
		letter-spacing: -0.8px;
		color: var(--page-ink);
	}

	/* MonoKicker renders a bare inline <span> and takes no class, so both cells
	   have to stack their own children — otherwise the metadata runs together on
	   one line and every string is right while the layout is wrong. */
	.mid {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}

	.name {
		position: relative;
		display: inline-block;
		margin-top: var(--space-4);
		font-family: var(--font-display);
		font-size: 48px;
		line-height: 1.08;
		letter-spacing: -0.28px;
		color: var(--page-ink);
		transition: color 150ms linear;
		/* A 48px unbroken title (a slug, a long single word) has no break opportunity
		   and would otherwise run straight through the 240px metadata cell. */
		overflow-wrap: anywhere;
	}

	/* Only the name colour eases; the border swap is instant. Never `all`. */
	.row:hover .name,
	.row:focus-visible .name {
		color: var(--link-blue);
	}

	.row:hover .name::after,
	.row:focus-visible .name::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		height: 2px;
		background: var(--link-blue);
	}

	.desc {
		margin-top: var(--space-8);
		max-width: 60ch;
		font-family: var(--font-serif);
		font-size: 19px;
		line-height: 1.47;
		letter-spacing: 0.108px;
		color: var(--caption-gray);
	}

	/* 6px is off the spacing ramp and --space-6 does not exist; a literal is the
	   B.4-B.9 precedent for off-ramp values. Do not add a token for it. */
	.meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		padding-top: 6px;
		line-height: 1.2;
		text-align: right;
	}

	/* ---- Empty state ---- */

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 520px;
		margin: 0 auto;
		padding: 96px 0;
		text-align: center;
	}

	.empty-headline {
		margin: var(--space-16) 0 0;
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
		color: var(--page-ink);
	}

	.empty-cta {
		margin-top: var(--space-24);
	}

	/* ---- Responsive ramp ----
	   These breakpoints and step-downs are the reference C.3-C.9 should copy, but
	   nothing here is inherited: the block lives in this route's scoped <style>, so
	   each screen re-declares it until the ramp is lifted into a shared stylesheet.
	   Mono kickers are absent from every block on purpose: DESIGN.md §8 locks them
	   at 13px and they never scale. */

	@media (max-width: 1023px) {
		.hero {
			font-size: 48px;
			line-height: 1.08;
		}

		.row {
			grid-template-columns: 64px 1fr 200px;
			padding: var(--space-24) 0;
		}

		.num {
			font-size: 48px;
		}

		.name {
			font-size: 36px;
			line-height: 1.14;
		}
	}

	@media (max-width: 767px) {
		.column {
			padding: var(--space-64) var(--space-16) var(--space-32);
		}

		/* The bar has no room for breadcrumb + address + two controls at 375px, and
		   the address is the one item that is not a control. Dropping it keeps Admin
		   and Sign out reachable instead of pushing them off-screen. */
		span.session-email {
			display: none;
		}

		.hero {
			font-size: 40px;
			line-height: 1.12;
		}

		/* Single column: the numeral moves inline above the kicker and the metadata
		   flows below the deck. The hairlines and the hover/focus rule swap live on
		   the <li> and survive the collapse untouched. */
		.row {
			grid-template-columns: 1fr;
			gap: var(--space-8);
		}

		.num {
			font-size: 32px;
		}

		.name {
			font-size: 28px;
			line-height: 1.18;
		}

		.deck,
		.desc {
			font-size: 16px;
		}

		.meta {
			align-items: flex-start;
			text-align: left;
		}
	}
</style>
