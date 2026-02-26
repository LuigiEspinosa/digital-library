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

	const FORMAT_COLORS: Record<string, string> = {
		epub: "bg-emerald-100 text-emerald-800",
		pdf: "bg-red-100 text-red-800",
		cbz: "bg-amber-100 text-amber-800",
		cbr: "bg-orange-100 text-orange-800",
	};

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

<div class="min-h-screen bg-stone-50">
	<header class="border-b border-stone-200 bg-white px-6 py-4">
		<nav class="flex items-center gap-2 text-sm text-stone-500">
			<a href="/" class="transition-colors hover:text-stone-800">Libraries</a>
			<span>/</span>
			<a href="/libraries/{data.library.id}" class="transition-colors hover:text-stone-800">
				{data.library.name}
			</a>
			<span>/</span>
			<span class="max-w-xs truncate font-medium text-stone-800">{data.book.title}</span>
		</nav>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-10">
		<div class="flex gap-10">
			<aside bind:this={coverEl} class="w-48 shrink-0">
				{#if data.book.coverUrl}
					<img
						src={data.book.coverUrl}
						alt="Cover of {data.book.title}"
						class="w-full rounded-lg object-cover shadow-md"
					/>
				{:else}
					<div class="flex aspect-2/3 w-full items-center justify-center rounded-lg bg-stone-200">
						<span class="text-xs uppercase tracking-wide text-stone-400">No cover</span>
					</div>
				{/if}

				<div class="mt-4">
					<a
						href="/libraries/{data.library.id}/books/{data.book.id}/read"
						class="block w-full rounded-lg bg-stone-800 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-stone-700"
					>
						Read
					</a>
				</div>
			</aside>

			<section bind:this={metaEl} class="min-w-0 flex-1">
				<div class="flex flex-wrap items-start gap-3">
					<h1 class="text-2xl font-bold leading-tight text-stone-900">{data.book.title}</h1>
					<span
						class="mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase
                {FORMAT_COLORS[data.book.format] ?? 'bg-stone-100 text-stone-700'}"
					>
						{data.book.format}
					</span>
				</div>

				{#if data.book.author}
					<p class="mt-1 text-base text-stone-500">{data.book.author}</p>
				{/if}

				{#if data.book.description}
					<p class="mt-4 text-sm leading-relaxed text-stone-700">{data.book.description}</p>
				{/if}

				<dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
					{#if data.book.series}
						<div>
							<dt class="text-xs uppercase tracking-wide text-stone-400">Series</dt>
							<dd class="mt-0.5 text-stone-800">
								{data.book.series}{data.book.series_idx != null ? ` #${data.book.series_idx}` : ""}
							</dd>
						</div>
					{/if}

					{#if data.book.published_at}
						<div>
							<dt class="text-xs uppercase tracking-wide text-stone-400">Published</dt>
							<dd class="mt-0.5 text-stone-800">{data.book.published_at}</dd>
						</div>
					{/if}

					{#if data.book.isbn}
						<div>
							<dt class="text-xs uppercase tracking-wide text-stone-400">ISBN</dt>
							<dd class="mt-0.5 font-mono text-stone-800">{data.book.isbn}</dd>
						</div>
					{/if}

					{#if data.book.language}
						<div>
							<dt class="text-xs uppercase tracking-wide text-stone-400">Language</dt>
							<dd class="mt-0.5 uppercase text-stone-800">{data.book.language}</dd>
						</div>
					{/if}

					{#if data.book.page_count}
						<div>
							<dt class="text-xs uppercase tracking-wide text-stone-400">Pages</dt>
							<dd class="mt-0.5 text-stone-800">{data.book.page_count}</dd>
						</div>
					{/if}

					{#if data.book.file_size}
						<div>
							<dt class="text-xs uppercase tracking-wide text-stone-400">File size</dt>
							<dd class="mt-0.5 text-stone-800">{formatFileSize(data.book.file_size)}</dd>
						</div>
					{/if}
				</dl>

				{#if data.book.tags && data.book.tags.length > 0}
					<div class="mt-6">
						<p class="mb-2 text-xs uppercase tracking-wide text-stone-400">Tags</p>
						<div class="flex flex-wrap gap-2">
							{#each data.book.tags as tag}
								<a
									href={tagHref(tag)}
									class="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 transition-colors hover:bg-stone-200"
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
