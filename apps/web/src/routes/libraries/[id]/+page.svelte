<script lang="ts">
	import { enhance } from "$app/forms";
	import type { ActionData, PageData } from "./$types";
	import { Button } from "$lib/components/ui/button";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const FORMAT_COLORS: Record<string, string> = {
		epub: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
		pdf: "bg-red-500/10 text-red-700 dark:text-red-400",
		cbz: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
		cbr: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
	};

	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	function handleSubmitStart() {
		uploading = true;
	}

	function handleSubmitEnd() {
		uploading = false;
		if (fileInput) fileInput.value = "";
	}
</script>

<svelte:head>
	<title>{data.library.name} — Library</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<header class="border-b">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground">← Libraries</a>
			<span class="text-muted-foreground">/</span>
			<span class="text-sm font-medium">{data.library.name}</span>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-10 space-y-10">
		<!-- Upload section -->
		<section class="rounded-lg border bg-card p-6">
			<h2 class="mb-1 text-sm font-semibold">Upload a book</h2>
			<p class="mb-4 text-xs text-muted-foreground">Supported formats: EPUB, PDF, CBZ, CBR</p>

			{#if form?.uploaded}
				<div
					class="mb-4 rounded border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
					role="status"
				>
					Uploaded: <strong>{form.book.title}</strong>
				</div>
			{/if}

			{#if form?.duplicate}
				<div
					class="mb-4 rounded border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400"
					role="status"
				>
					Already in library: <strong>{form.book.title}</strong>
				</div>
			{/if}

			{#if form?.error}
				<div
					class="mb-4 rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					role="alert"
				>
					{form.error}
				</div>
			{/if}

			<form
				method="POST"
				action="?/upload"
				enctype="multipart/form-data"
				use:enhance={() => {
					handleSubmitStart();
					return async ({ update }) => {
						await update();
						handleSubmitEnd();
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
					{uploading ? "Uploading…" : "Upload"}
				</Button>
			</form>
		</section>

		<!-- Book list -->
		<section>
			<h2 class="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
				{data.books.length}
				{data.books.length === 1 ? "book" : "books"}
			</h2>

			{#if data.books.length === 0}
				<p class="text-muted-foreground text-sm">No books yet. Upload one above.</p>
			{:else}
				<div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{#each data.books as book (book.id)}
						<div class="group rounded-lg border bg-card overflow-hidden shadow-sm">
							<!-- Cover -->
							<div class="aspect-2/3 bg-muted flex items-center justify-center">
								{#if book.coverUrl}
									<img
										src={book.coverUrl}
										alt={book.title}
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{:else}
									<span class="text-2xl text-muted-foreground/30 select-none">
										{book.format.toUpperCase()}
									</span>
								{/if}
							</div>

							<!-- Info -->
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
								<form method="POST" action="?/delete" use:enhance>
									<input type="hidden" name="bookId" value={book.id} />
									<button type="submit" class="mt-2 text-[10px] text-destructive hover:underline">
										Delete
									</button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</main>
</div>
