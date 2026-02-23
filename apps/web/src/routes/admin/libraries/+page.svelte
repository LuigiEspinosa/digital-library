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
	<title>Libraries - Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Libraries</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.libraries.length} librar{data.libraries.length === 1 ? "y" : "ies"}
			</p>
		</div>
		<Button
			onclick={() => (showCreate = !showCreate)}
			variant={showCreate ? "outline" : "default"}
			size="sm"
		>
			{showCreate ? "Cancel" : "New library"}
		</Button>
	</div>

	{#if showCreate}
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-sm font-semibold">New library</h2>

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
						<Label for="name">Name</Label>
						<Input
							id="name"
							name="name"
							value={form?.name ?? ""}
							placeholder="e.g. Science Fiction"
							required
						/>
					</div>
					<div class="space-y-2">
						<Label for="description">
							Description <span class="font-normal text-muted-foreground">(optional)</span>
						</Label>
						<Input
							id="description"
							name="description"
							value={form?.description ?? ""}
							placeholder="Short description"
						/>
					</div>
				</div>
				<Button type="submit" size="sm">Create</Button>
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
		{#if data.libraries.length === 0}
			<div class="px-4 py-12 text-center text-sm text-muted-foreground">
				No libraries yet. Create one to get started.
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b bg-muted/50">
						<th class="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
						<th class="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
						<th class="px-4 py-3 text-left font-medium text-muted-foreground">Users</th>
						<th class="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.libraries as lib (lib.id)}
						<tr class="border-b last:border-0 hover:bg-muted/30">
							<td class="px-4 py-3 font-medium">
								<a href="/admin/libraries/{lib.id}" class="hover:underline">{lib.name}</a>
							</td>
							<td class="px-4 py-3 text-muted-foreground">{lib.description ?? "-"}</td>
							<td class="px-4 py-3 text-muted-foreground">{lib.user_count}</td>
							<td class="px-4 py-3 text-muted-foreground">
								{new Date(lib.created_at).toLocaleDateString()}
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-2">
									<a href="/admin/libraries/{lib.id}">
										<Button variant="ghost" size="sm">Edit</Button>
									</a>
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={lib.id} />
										<Button
											type="submit"
											variant="ghost"
											size="sm"
											class="text-destructive hover:bg-destructive/10 hover:text-destructive"
											onclick={(e) => {
												if (!confirm(`Delete "${lib.name}"? This removes all books inside it.`))
													e.preventDefault();
											}}
										>
											Delete
										</Button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
