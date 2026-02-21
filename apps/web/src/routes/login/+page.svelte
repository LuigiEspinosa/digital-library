<script lang="ts">
	import { enhance } from "$app/forms";
	import type { ActionData } from "./$types";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign In - Library</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center bg-muted/40 px-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl">Library</Card.Title>
			<Card.Description>Sign in to your account</Card.Description>
		</Card.Header>

		<Card.Content>
			{#if form?.error}
				<div
					class="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					role="alert"
				>
					{form.error}
				</div>
			{/if}

			<form method="POST" use:enhance class="space-y-4">
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						type="email"
						name="email"
						value={form?.email ?? ""}
						required
						autocomplete="email"
						placeholder="you@example.com"
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						type="password"
						name="password"
						required
						autocomplete="current-password"
						minlength={1}
					/>
				</div>

				<Button type="submit" class="w-full">Sign in</Button>
			</form>
		</Card.Content>
	</Card.Root>
</main>
