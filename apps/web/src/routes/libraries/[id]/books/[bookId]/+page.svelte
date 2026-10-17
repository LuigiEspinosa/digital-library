<script lang="ts">
	import { onMount } from "svelte";
	import gsap from "gsap";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let coverEl = $state<HTMLElement | null>(null);
	let metaEl = $state<HTMLElement | null>(null);

	onMount(() => {
		if (coverEl) {
			gsap.from(coverEl, { x: -40, opacity: 0, duration: 0.4, ease: "power2.out" });
		}
		if (metaEl) {
			gsap.from(metaEl, { x: 40, opacity: 0, duration: 0.4, ease: "power2.out", delay: 0.08 });
		}
	});

	function formatFileSize(bytes: number): string {
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function tagHref(tag: string): string {
		return `/libraries/${data.library.id}?tags=${encodeURIComponent(tag)}`;
	}
</script>

<svelte:head>
	<title>{data.book.title} - {data.library.name}</title>
</svelte:head>

<div class="book-page">
	<header class="crumbs">
		<nav class="crumbs-nav">
			<a href="/" class="crumb-link">Libraries</a>
			<span class="crumb-sep">/</span>
			<a href="/libraries/{data.library.id}" class="crumb-link">
				{data.library.name}
			</a>
			<span class="crumb-sep">/</span>
			<span class="crumb-current">{data.book.title}</span>
		</nav>
	</header>

	<main class="book-main">
		<div class="book-layout">
			<aside bind:this={coverEl} class="book-aside">
				{#if data.book.coverUrl}
					<img
						src={data.book.coverUrl}
						alt="Cover of {data.book.title}"
						class="cover-img"
						width="200"
						height="300"
					/>
				{:else}
					<div class="cover-empty">
						<span class="cover-empty-text">No cover</span>
					</div>
				{/if}

				<div class="read-row">
					<a
						href="/libraries/{data.library.id}/books/{data.book.id}/read"
						class="read-control"
					>
						Read
					</a>
				</div>
			</aside>

			<section bind:this={metaEl} class="book-meta">
				<div class="title-row">
					<h1 class="book-title">{data.book.title}</h1>
					<span class="format-mark">
						{data.book.format}
					</span>
				</div>

				{#if data.book.author}
					<p class="book-author">{data.book.author}</p>
				{/if}

				{#if data.book.description}
					<p class="book-desc">{data.book.description}</p>
				{/if}

				<dl class="facts">
					{#if data.book.series}
						<div>
							<dt class="fact-label">Series</dt>
							<dd class="fact-value">
								{data.book.series}{data.book.series_idx != null ? ` #${data.book.series_idx}` : ""}
							</dd>
						</div>
					{/if}

					{#if data.book.published_at}
						<div>
							<dt class="fact-label">Published</dt>
							<dd class="fact-value">{data.book.published_at}</dd>
						</div>
					{/if}

					{#if data.book.isbn}
						<div>
							<dt class="fact-label">ISBN</dt>
							<dd class="fact-value mono">{data.book.isbn}</dd>
						</div>
					{/if}

					{#if data.book.language}
						<div>
							<dt class="fact-label">Language</dt>
							<dd class="fact-value upper">{data.book.language}</dd>
						</div>
					{/if}

					{#if data.book.page_count}
						<div>
							<dt class="fact-label">Pages</dt>
							<dd class="fact-value">{data.book.page_count}</dd>
						</div>
					{/if}

					{#if data.book.file_size}
						<div>
							<dt class="fact-label">File size</dt>
							<dd class="fact-value">{formatFileSize(data.book.file_size)}</dd>
						</div>
					{/if}
				</dl>

				{#if data.book.tags && data.book.tags.length > 0}
					<div class="tags">
						<p class="fact-label">Tags</p>
						<div class="tag-list">
							{#each data.book.tags as tag}
								<a
									href={tagHref(tag)}
									class="tag-link"
								>
									{tag}
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		</div>
	</main>
</div>

<style>
	/* RESTYLE-SPEC.md: the page ground, hairline rules, § 10 for the cover, § 1 for Read,
	   § 1b for every other link, § 7 labels over the facts. Markup order is unchanged. */
	.book-page {
		min-height: 100vh;
		min-height: 100dvh;
	}

	.crumbs {
		border-bottom: var(--stroke-hair) solid var(--token-border);
		padding: 0 var(--s-lg);
	}

	.crumbs-nav {
		display: flex;
		align-items: center;
		gap: var(--s-xs);
		min-width: 0;
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text-secondary);
	}

	.crumb-link {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		min-height: var(--tap);
		min-width: var(--tap);
		color: var(--token-text);
		text-decoration: underline;
		text-decoration-color: var(--token-border-interactive);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
	}

	.crumb-link:hover,
	.tag-link:hover {
		text-decoration-color: var(--token-accent-hover);
	}

	.crumb-current {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.book-main {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--s-xl) var(--s-lg);
	}

	.book-layout {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-xl);
	}

	.book-aside {
		width: 12rem;
		flex-shrink: 0;
	}

	.cover-img,
	.cover-empty {
		display: block;
		box-sizing: border-box;
		width: 100%;
		height: auto;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border: var(--stroke-hair) solid var(--token-border);
		border-radius: var(--r-none);
	}

	.cover-empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cover-empty-text,
	.fact-label {
		margin: 0;
		font-family: var(--f-mono);
		font-size: var(--t-3xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text-secondary);
	}

	.read-row {
		margin-top: var(--s-md);
	}

	.read-control {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap);
		padding: var(--s-xs) var(--s-md);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text);
		text-decoration: none;
		transition: border-color var(--dur-micro) var(--ease-toggle);
	}

	.read-control:hover {
		border-color: var(--token-accent-hover);
	}

	.book-meta {
		flex: 1;
		min-width: min(100%, 16rem);
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--s-sm);
	}

	.book-title {
		margin: 0;
		font-family: var(--f-display);
		font-size: var(--t-xl);
		font-weight: var(--w-black);
		line-height: var(--lh-heading);
		letter-spacing: var(--tr-heading);
		text-transform: uppercase;
		color: var(--token-text);
		overflow-wrap: anywhere;
	}

	/* The format is metadata, not a state: a Boundary box around a Label, no hue. */
	.format-mark {
		flex-shrink: 0;
		padding: var(--s-2xs) var(--s-xs);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		font-family: var(--f-mono);
		font-size: var(--t-3xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text);
	}

	.book-author {
		margin: var(--s-xs) 0 0;
		font-size: var(--t-base);
		color: var(--token-text-secondary);
	}

	.book-desc {
		margin: var(--s-md) 0 0;
		max-width: var(--measure);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text);
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-sm) var(--s-lg);
		margin: var(--s-lg) 0 0;
	}

	.fact-value {
		margin: var(--s-2xs) 0 0;
		font-size: var(--t-sm);
		color: var(--token-text);
		overflow-wrap: anywhere;
	}

	.fact-value.mono {
		font-family: var(--f-mono);
		font-variant-numeric: tabular-nums;
	}

	.fact-value.upper {
		text-transform: uppercase;
	}

	.tags {
		margin-top: var(--s-lg);
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		column-gap: var(--s-lg);
	}

	.tag-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		min-width: var(--tap);
		font-size: var(--t-sm);
		color: var(--token-text-secondary);
		text-decoration: underline;
		text-decoration-color: var(--token-border-interactive);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
	}
</style>
