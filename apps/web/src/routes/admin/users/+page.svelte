<script lang="ts">
	import { enhance } from "$app/forms";
	import type { ActionData, PageData } from "./$types";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showCreate = $state(false);

	$effect(() => {
		if (form?.success) showCreate = false;
	});
</script>

<svelte:head>
	<title>Users — Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Users</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.users.length} account{data.users.length === 1 ? "" : "s"}
			</p>
		</div>
		<Button
			onclick={() => (showCreate = !showCreate)}
			variant={showCreate ? "outline" : "default"}
			size="sm"
		>
			{showCreate ? "Cancel" : "Add user"}
		</Button>
	</div>

	{#if showCreate}
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-sm font-semibold">New user</h2>

			{#if form?.createError}
				<div
					class="mb-4 rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					role="alert"
				>
					{form.createError}
				</div>
			{/if}

			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="text"
							name="email"
							value={form?.email ?? ""}
							placeholder="user@example.com"
							required
						/>
					</div>
					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input
							id="password"
							type="password"
							name="password"
							placeholder="Min. 8 characters"
							minlength={8}
							required
						/>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<input
						id="is_admin"
						type="checkbox"
						name="is_admin"
						class="h-4 w-4 rounded border-border accent-primary"
					/>
					<Label for="is_admin" class="font-normal">Grant admin privileges</Label>
				</div>

				<Button type="submit" size="sm">Create user</Button>
			</form>
		</div>
	{/if}

	{#if form?.deleteError}
		<div
			class="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			role="alert"
		>
			{form.deleteError}
		</div>
	{/if}

	<div class="rounded-lg border">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b bg-muted/50">
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.id)}
					<tr class="border-b last:border-0 hover:bg-muted/30">
						<td class="px-4 py-3 font-medium">{user.email}</td>
						<td class="px-4 py-3">
							<span
								class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {user.is_admin
									? 'bg-primary/10 text-primary'
									: 'bg-muted text-muted-foreground'}"
							>
								{user.is_admin ? "Admin" : "User"}
							</span>
						</td>
						<td class="px-4 py-3 text-muted-foreground">
							{new Date(user.created_at).toLocaleDateString()}
						</td>
						<td class="px-4 py-3 text-right">
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="userId" value={user.id} />
								<Button
									type="submit"
									variant="ghost"
									size="sm"
									class="text-destructive hover:bg-destructive/10 hover:text-destructive"
									onclick={(e) => {
										if (!confirm(`Delete ${user.email}?`)) e.preventDefault();
									}}
								>
									Delete
								</Button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
