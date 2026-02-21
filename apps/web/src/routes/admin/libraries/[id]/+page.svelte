<script lang="ts">
	import { enhance } from "$app/forms";
	import type { ActionData, PageData } from "./$types";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let libraryUserIds = $derived(new Set(data.libraryUsers.map((u) => u.id)));
	let availableUsers = $derived(data.allUsers.filter((u) => !libraryUserIds.has(u.id)));
</script>

<svelte:head>
	<title>{data.library.name} — Admin</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<a href="/admin/libraries" class="text-sm text-muted-foreground hover:text-foreground">
			← Libraries
		</a>
		<h1 class="mt-2 text-2xl font-bold tracking-tight">{data.library.name}</h1>
	</div>

	<!-- Edit details -->
	<div class="rounded-lg border bg-card p-6">
		<h2 class="mb-4 text-sm font-semibold">Details</h2>

		{#if form?.updateError}
			<div
				class="mb-4 rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
				role="alert"
			>
				{form.updateError}
			</div>
		{/if}
		{#if form?.updateSuccess}
			<div
				class="mb-4 rounded border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
				role="status"
			>
				Saved.
			</div>
		{/if}

		<form method="POST" action="?/update" use:enhance class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input id="name" name="name" value={data.library.name} required />
				</div>
				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Input id="description" name="description" value={data.library.description ?? ""} />
				</div>
			</div>
			<Button type="submit" size="sm">Save</Button>
		</form>
	</div>

	<!-- ACL -->
	<div class="rounded-lg border bg-card p-6">
		<h2 class="mb-4 text-sm font-semibold">Users with access</h2>

		{#if form?.grantError || form?.revokeError}
			<div
				class="mb-4 rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
				role="alert"
			>
				{form?.grantError ?? form?.revokeError}
			</div>
		{/if}

		{#if availableUsers.length > 0}
			<form method="POST" action="?/grant" use:enhance class="mb-6 flex items-end gap-3">
				<div class="flex-1 space-y-2">
					<Label for="userId">Add user</Label>
					<select
						id="userId"
						name="userId"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						{#each availableUsers as user (user.id)}
							<option value={user.id}>{user.email}{user.is_admin ? " (admin)" : ""}</option>
						{/each}
					</select>
				</div>
				<Button type="submit" size="sm">Grant access</Button>
			</form>
		{/if}

		{#if data.libraryUsers.length === 0}
			<p class="text-sm text-muted-foreground">No users have access yet.</p>
		{:else}
			<div class="rounded-lg border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b bg-muted/50">
							<th class="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
							<th class="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
							<th class="px-4 py-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.libraryUsers as user (user.id)}
							<tr class="border-b last:border-0 hover:bg-muted/30">
								<td class="px-4 py-3">{user.email}</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {user.is_admin
											? 'bg-primary/10 text-primary'
											: 'bg-muted text-muted-foreground'}"
									>
										{user.is_admin ? "Admin" : "User"}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<form method="POST" action="?/revoke" use:enhance>
										<input type="hidden" name="userId" value={user.id} />
										<Button
											type="submit"
											variant="ghost"
											size="sm"
											class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										>
											Revoke
										</Button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
