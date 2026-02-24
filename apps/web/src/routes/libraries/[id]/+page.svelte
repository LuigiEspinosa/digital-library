<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import gsap from "gsap";
	import type { ActionData, PageData } from "./$types";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { build } from "vite";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const FORMAT_COLORS: Record<string, string> = {
		epub: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
		pdf: "bg-red-500/10 text-red-700 dark:text-red-400",
		cbz: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
		cbr: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
	};

	let uploading = $state(false);
	let showUpload = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let searchInput = $state(data.filters.q ?? "");

	function buildUrl(
		updates: Record<string, string | number | string[] | undefined | null>,
	): string {
		const params = new URLSearchParams();
		const next = { ...data.filters, ...updates };

		if (next.q) params.set("q", next.q as string);
		if (next.format) params.set("format", next.format as string);
		if (next.author) params.set("author", next.author as string);
		if (next.series) params.set("series", next.series as string);
		if (next.language) params.set("language", next.language as string);
		const tags = next.tags as string[] | undefined;
		if (tags?.length) params.set("tags", tags.join(","));
		if (next.sort && next.sort !== "title") params.set("sort", next.sort as string);
		if (next.order && next.order !== "asc") params.set("order", next.order as string);
		if (next.view && next.view !== "grid") params.set("view", next.view as string);
		const p = typeof next.page === "number" ? next.page : data.filters.page;
		if (p && p > 1) params.set("page", String(p));

		const str = params.toString();
		return str ? `?${str}` : "?";
	}

	function setFilter(key: string, value: string | null) {
		goto(buildUrl({ [key]: value ?? undefined, page: 1 }), { keepFocus: true });
	}

	function toggleTag(tag: string) {
		const current = data.filters.tags ?? [];
		const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
		goto(buildUrl({ tags: next.length ? next : undefined, page: 1 }), { keepFocus: true });
	}

	function submitSearch() {
		goto(buildUrl({ q: searchInput || undefined, page: 1 }), { keepFocus: true });
	}

	function clearFilters() {
		searchInput = "";
		goto(`?view=${data.filters.view}`);
	}

	const hasActiveFilters = $derived(
		!!(
			data.filters.q ||
			data.filters.format ||
			data.filters.author ||
			data.filters.series ||
			data.filters.language ||
			data.filters.tags?.length
		),
	);

	const totalPages = $derived(Math.ceil(data.total / data.pageSize));

	function paginationPages(current: number, total: number): (number | "...")[] {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		const pages: (number | "...")[] = [1];
		if (current > 3) pages.push("...");
		for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
			pages.push(i);
		}
		if (current < total - 2) pages.push("...");
		pages.push(total);
		return pages;
	}

	onMount(() => {
		if (data.books.length > 0) {
			gsap.from(".book-card", {
				opacity: 0,
				y: 24,
				duration: 0.4,
				stagger: 0.04,
				ease: "power2.out",
				clearProps: "all",
			});
		}
	});
</script>

<svelte:head>
	<title>{data.library.name} — Library</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground">Libraries</a>
			<span class="text-muted-foreground">/</span>
			<span class="text-sm font-medium">{data.library.name}</span>
			<div class="ml-auto flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={() => (showUpload = !showUpload)}>
					{showUpload ? "Close" : "Upload"}
				</Button>
				<!-- View toggle -->
				<div class="flex rounded-md border">
					<button
						onclick={() => setFilter("view", "grid")}
						class="flex h-8 w-8 items-center justify-center rounded-l-md transitions-colors {data
							.filters.view === 'grid'
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
						aria-label="Grid view"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
							<rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
						</svg>
					</button>
					<button
						onclick={() => setFilter("view", "list")}
						class="flex h-8 w-8 items-center justify-center rounded-r-md transition-colors {data
							.filters.view === 'list'
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
						aria-label="List view"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
							<line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
							<line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Upload panel -->
	{#if showUpload}
		<div class="border-b bg-muted/30">
			<div class="mx-auto max-w-7xl px-6 py-4 space-y-3">
				{#if form?.uploaded}
					<div
						class="rounded border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-700 dark:text-green-400"
					>
						Uploaded: <strong>{form.book.title}</strong>
					</div>
				{/if}
				{#if form?.duplicate}
					<div
						class="rounded border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400"
					>
						Already in library: <strong>{form.book.title}</strong>
					</div>
				{/if}
				{#if form?.error}
					<div
						class="rounded border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
					>
						{form.error}
					</div>
				{/if}
				<form
					method="POST"
					action="?/upload"
					enctype="multipart/form-data"
					use:enhance={() => {
						uploading = true;
						return async ({ update }) => {
							await update();
							uploading = false;
							if (fileInput) fileInput.value = "";
						};
					}}
					class="flex items-center gap-3"
				>
					<input
						bind:this={fileInput}
						type="file"
						name="file"
						accept=".epub,.pdf,.cbz,.cbr"
						required
						class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
					/>
					<Button type="submit" size="sm" disabled={uploading}>
						{uploading ? "Uploading..." : "Upload"}
					</Button>
				</form>
				<p class="text-xs text-muted-foreground">Supported formats: EPUB, PDF, CBZ, CBR</p>
			</div>
		</div>
	{/if}

	<main class="mx-auto max-w-7xl px-6 py-6 space-y-4">
		<!-- Filter bar -->
		<div class="space-y-3">
			<!-- Search + dropdowns -->
			<div class="flex flex-wrap items-center gap-2">
				<div class="flex min-w-56 flex-1 items-center gap-2">
					<Input
						type="search"
						placeholder="Search title, author, description..."
						value={searchInput}
						oninput={(e) => (searchInput = (e.target as HTMLInputElement).value)}
						onkeydown={(e) => e.key === "Enter" && submitSearch()}
						class="h-8 text-sm"
					/>
					<Button size="sm" variant="secondary" onclick={submitSearch} class="h-8 shrink-0">
						Search
					</Button>
				</div>

				{#if data.filterOptions.authors.length > 0}
					<select
						class="h-8 rounded-md border border-input bg-background px-2 text-sm"
						value={data.filters.author ?? ""}
						onchange={(e) => setFilter("author", (e.target as HTMLSelectElement).value || null)}
					>
						<option value="">All authors</option>
						{#each data.filterOptions.authors as a}
							<option value={a}>{a}</option>
						{/each}
					</select>
				{/if}

				{#if data.filterOptions.series.length > 0}
					<select
						class="h-8 rounded-md border border-input bg-background px-2 text-sm"
						value={data.filters.series ?? ""}
						onchange={(e) => setFilter("series", (e.target as HTMLSelectElement).value || null)}
					>
						<option value="">All series</option>
						{#each data.filterOptions.series as s}
							<option value={s}>{s}</option>
						{/each}
					</select>
				{/if}

				{#if data.filterOptions.languages.length > 0}
					<select
						class="h-8 rounded-md border border-input bg-background px-2 text-sm"
						value={data.filters.language ?? ""}
						onchange={(e) => setFilter("language", (e.target as HTMLSelectElement).value || null)}
					>
						<option value="">All languages</option>
						{#each data.filterOptions.languages as l}
							<option value={l}>{l}</option>
						{/each}
					</select>
				{/if}

				<select
					class="h-8 rounded-md border border-input bg-background px-2 text-sm"
					value="{data.filters.sort},{data.filters.order}"
					onchange={(e) => {
						const [s, o] = (e.target as HTMLSelectElement).value.split(",");
						goto(buildUrl({ sort: s, order: o, page: 1 }), { keepFocus: true });
					}}
				>
					<option value="title,asc">Title A-Z</option>
					<option value="title,desc">Title Z-A</option>
					<option value="author,asc">Author A-Z</option>
					<option value="created_at,desc">Newest first</option>
					<option value="created_at,asc">Oldest first</option>
				</select>

				{#if hasActiveFilters}
					<button
						onclick={clearFilters}
						class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						Clear filters
					</button>
				{/if}
			</div>

			<!-- Format chips -->
			<div class="flex flex-wrap gap-1.5">
				{#each ["", "epub", "pdf", "cbz", "cbr"] as fmt}
					<button
						onclick={() => setFilter("format", fmt || null)}
						class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {(data.filters
							.format ?? '') === fmt
							? 'bg-primary text-primary-foreground'
							: 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
					>
						{fmt === "" ? "All" : fmt.toUpperCase()}
					</button>
				{/each}
			</div>

			<!-- Tag pills -->
			{#if data.filterOptions.tags.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each data.filterOptions.tags as tag}
						{@const active = data.filters.tags?.includes(tag)}
						<button
							onclick={() => toggleTag(tag)}
							class="rounded-full border px-2.5 py-0.5 text-xs transition-colors {active
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border bg-background text-muted-foreground hover:border-primary/50'}"
						>
							{tag}{active ? " x" : ""}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Results count -->
		<div class="flex items-center justify-between">
			<p class="text-xs text-muted-foreground">
				{#if data.total === 0}
					No books found.
				{:else}
					{@const start = (data.filters.page - 1) * data.pageSize + 1}
					{@const end = Math.min(data.filters.page * data.pageSize, data.total)}
					Showing {start}-{end} of {data.total}
					{data.total === 1 ? "book" : "books"}
				{/if}
			</p>
		</div>

		<!-- Book grid -->
		{#if data.books.length === 0}
			<div class="py-24 text-center">
				<p class="text-muted-foreground">
					{hasActiveFilters
						? "No books match the current filters."
						: "Bo books yet. Upload one above."}
				</p>
				{#if hasActiveFilters}
					<button onclick={clearFilters} class="mt-2 text-sm text-primary hover:underline">
						Clear filters
					</button>
				{/if}
			</div>
		{:else if data.filters.view === "grid"}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{#each data.books as book (book.id)}
					<div
						class="book-card group flex flex-col rounded-lg border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md"
					>
						<a href="/libraries/{data.library.id}/books/{book.id}" class="block">
							<div class="aspect-2/3 bg-muted">
								{#if book.coverUrl}
									<img
										src={book.coverUrl}
										alt={book.title}
										class="h-full w-full object-cover transition-opacity group-hover:opacity-90"
										loading="lazy"
									/>
								{:else}
									<div class="flex h-full items-center justify-center">
										<span class="text-2xl font-bold text-muted-foreground/20 select-none">
											{book.format.toUpperCase()}
										</span>
									</div>
								{/if}
							</div>
							<div class="p-3 space-y-1">
								<p class="text-xs font-medium leading-tight line-clamp-2">{book.title}</p>
								{#if book.author}
									<p class="text-xs text-muted-foreground truncate">{book.author}</p>
								{/if}
								<span
									class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium {FORMAT_COLORS[
										book.format
									] ?? 'bg-muted text-muted-foreground'}"
								>
									{book.format.toUpperCase()}
								</span>
							</div>
						</a>
						{#if data.user?.is_admin}
							<div class="mt-auto px-3 pb-3">
								<form method="POST" action="?/delete" use:enhance>
									<input type="hidden" name="bookId" value={book.id} />
									<button type="submit" class="text-[10px] text-destructive hover:underline">
										Delete
									</button>
								</form>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<!-- List view -->
			<div class="divide-y rounded-lg border">
				{#each data.books as book (book.id)}
					<div class="book-card flex items-center gap-4 p-3 hover:bg-muted/30 transition-colors">
						<a
							href="/libraries/{data.library.id}/books/{book.id}"
							class="flex items-center gap-4 flex-1 min-w-0"
						>
							<div class="h-16 w-11 shrink-0 rounded bg-muted overflow-hidden">
								{#if book.coverUrl}
									<img
										src={book.coverUrl}
										alt={book.title}
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{:else}
									<div class="flex h-full items-center justify-center">
										<span class="text-[9px] font-bold text-muted-foreground/30">
											{book.format.toUpperCase()}
										</span>
									</div>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium leading-tight truncate">{book.title}</p>
								{#if book.author}
									<p class="text-xs text-muted-foreground truncate">{book.author}</p>
								{/if}
								{#if book.series}
									<p class="text-xs text-muted-foreground/70 truncate">
										{book.series}{book.series_idx != null ? ` #${book.series_idx}` : ""}
									</p>
								{/if}
							</div>
							<span
								class="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium {FORMAT_COLORS[
									book.format
								] ?? 'bg-muted text-muted-foreground'}"
							>
								{book.format.toUpperCase()}
							</span>
						</a>
						{#if data.user?.is_admin}
							<form method="POST" action="?/delete" use:enhance class="shrink-0">
								<input type="hidden" name="bookId" value={book.id} />
								<button type="submit" class="text-[10px] text-destructive hover:underline"
									>Delete</button
								>
							</form>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-1 pt-4">
				<a
					href={buildUrl({ page: data.filters.page - 1 })}
					class="flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors {data
						.filters.page <= 1
						? 'pointer-events-none opacity-40'
						: 'hover:bg-muted'}"
					aria-disabled={data.filters.page <= 1}
				>
					&#8592;
				</a>
				{#each paginationPages(data.filters.page, totalPages) as p}
					{#if p === "..."}
						<span class="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
							>...</span
						>
					{:else}
						<a
							href={buildUrl({ page: p })}
							class="flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors {p ===
							data.filters.page
								? 'bg-primary text-primary-foreground border-primary'
								: 'hover:bg-muted'}"
						>
							{p}
						</a>
					{/if}
				{/each}
				<a
					href={buildUrl({ page: data.filters.page + 1 })}
					class="flex h-8 w-8 items-center jusitfy-center rounded-md border text-sm transition-colors {data
						.filters.page >= totalPages
						? 'pointer-events-none opacity-40'
						: 'hover:bg-muted'}"
					aria-disabled={data.filters.page >= totalPages}
				>
					&#8594;
				</a>
			</div>
		{/if}
	</main>
</div>
