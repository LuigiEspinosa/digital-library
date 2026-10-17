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
	/* 100vh first, then 100dvh: on mobile 100vh is the large viewport. The layout
	   wrapper is a plain non-flex div, so the full-height column is this route's job. */
	.picker {
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
		padding: var(--s-2xl) var(--s-lg) var(--s-xl);
		box-sizing: border-box;
	}

	/* The bar uppercases everything it holds; an address reads better as written.
	   Qualified with the element so the mobile display: none below wins outright. */
	span.session-email {
		text-transform: none;
		letter-spacing: normal;
	}

	/* ---- Page head ---- */

	.page-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding-bottom: var(--s-xl);
	}

	.hero {
		margin: var(--s-xs) 0 0;
		font-family: var(--f-display);
		font-size: var(--t-display);
		font-weight: var(--w-black);
		line-height: var(--lh-display);
		letter-spacing: var(--tr-display);
		text-transform: uppercase;
		color: var(--token-text);
	}

	.hero .ul {
		display: inline-block;
		padding-bottom: var(--s-xs);
		border-bottom: var(--stroke-hair) solid var(--token-border-interactive);
	}

	.deck {
		margin: var(--s-md) 0 0;
		max-width: var(--measure);
		font-family: var(--f-body);
		font-size: var(--t-base);
		line-height: var(--lh-lede);
		color: var(--token-text-secondary);
	}

	/* ---- Rows, RESTYLE-SPEC.md § 2 ----
	   Each row is one destination, so the whole row is its link. The grid places the
	   cells by area; the DOM order (ordinal, kicker, name, description, counts) is
	   untouched. .mid is display: contents so its three children are grid items. */

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.rows li + li {
		border-top: var(--stroke-hair) solid var(--token-border);
	}

	.row {
		display: grid;
		gap: var(--s-2xs) var(--s-md);
		padding-block: var(--s-md);
		padding-inline: 0;
		align-items: start;
		grid-template-columns: 1fr auto;
		grid-template-areas:
			'name   num'
			'desc   desc'
			'kicker kicker'
			'meta   meta';
		color: inherit;
		text-decoration: none;
	}

	.mid {
		display: contents;
	}

	.mid > :global(.mono-kicker) {
		grid-area: kicker;
	}

	.num {
		grid-area: num;
		align-self: start;
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-meta);
		font-variant-numeric: tabular-nums;
		color: var(--token-text-secondary);
	}

	/* The row name is the primary Link's text: the emphasis underline in accent,
	   recoloured on hover, and nothing else changes. */
	.name {
		grid-area: name;
		justify-self: start;
		font-family: var(--f-display);
		font-size: var(--t-base);
		font-weight: var(--w-bold);
		font-stretch: 85%;
		line-height: var(--lh-heading);
		letter-spacing: var(--tr-name);
		text-transform: uppercase;
		color: var(--token-text);
		text-decoration: underline;
		text-decoration-color: var(--token-accent);
		text-decoration-thickness: var(--stroke-emphasis);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
		overflow-wrap: anywhere;
	}

	.row:hover .name {
		text-decoration-color: var(--token-accent-hover);
	}

	.desc {
		grid-area: desc;
		max-width: var(--measure);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text-secondary);
	}

	.meta {
		grid-area: meta;
		display: flex;
		flex-wrap: wrap;
		column-gap: var(--s-md);
		row-gap: var(--s-2xs);
	}

	@media (min-width: 760px) {
		.row {
			grid-template-columns: minmax(12ch, 3fr) minmax(0, 5fr) auto;
			grid-template-areas:
				'name   desc num'
				'kicker meta num';
			column-gap: var(--s-lg);
		}
	}

	/* ---- Empty state ---- */

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: var(--measure);
		padding: var(--s-xl) 0;
	}

	.empty-headline {
		margin: var(--s-sm) 0 0;
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

	@media (max-width: 759px) {
		/* No room for breadcrumb, address and two controls at 360; the address is the
		   one item that is not a control. */
		span.session-email {
			display: none;
		}
	}
</style>
