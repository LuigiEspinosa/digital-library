<script lang="ts">
	import type { PageData } from "./$types";
	import { Button } from "$lib/components/ui/button";

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Library</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<header class="border-b">
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
			<span class="font-semibold tracking-tight">Library</span>
			<div class="flex items-center gap-4">
				<span class="text-sm text-muted-foreground">{data.user?.email}</span>

				{#if data.user?.is_admin}
					<a href="/admin/libraries">
						<Button variant="outline" size="sm">Admin</Button>
					</a>
				{/if}

				<form method="POST" action="/logout">
					<Button type="submit" variant="ghost" size="sm">Sign out</Button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-12">
		<h1 class="text-3xl font-bold tracking-tight">Your Libraries</h1>

		{#if data.libraries.length === 0}
			<p class="mt-4 text-muted-foreground">No libraries available yet.</p>
		{:else}
			<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.libraries as library}
					<div class="rounded-lg border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold">{library.name}</h2>
						{#if library.description}
							<p class="mt-1 text-sm text-muted-foreground">{library.description}</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>
