<script lang="ts">
	import type { LayoutData } from "./$types";
	import { Button } from "$lib/components/ui/button";

	let { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();
</script>

<div class="min-h-screen bg-background">
	<header class="border-b">
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
			<div class="flex items-center gap-2 text-sm">
				<a href="/" class="font-semibold tracking-tight">📚 Library</a>
				<span class="text-muted-foreground">/</span>
				<span class="font-medium">Admin</span>
				<span class="text-muted-foreground">/</span>

				<nav class="flex items-center gap-4">
					<a
						href="/admin/users"
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						Users
					</a>
					<a
						href="/admin/libraries"
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						Libraries
					</a>
				</nav>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-sm text-muted-foreground">{data.user?.email}</span>
				<form method="POST" action="/logout">
					<Button type="submit" variant="ghost" size="sm">Sign out</Button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-8">
		{@render children()}
	</main>
</div>
