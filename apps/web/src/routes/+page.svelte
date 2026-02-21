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
				<form method="POST" action="/logout">
					<Button type="submit" variant="ghost" size="sm">Sign out</Button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-12">
		<h1 class="text-3xl font-bold tracking-tight">Your Library</h1>
		<p class="mt-2 text-muted-foreground">
			No libraries yet — they'll appear here once you create one.
		</p>
	</main>
</div>
