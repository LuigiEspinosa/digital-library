<script lang="ts">
	import type { PageData } from "./$types";
	export let data: PageData;
</script>

<svelte:head>
	<title>Digital Library</title>
</svelte:head>

<main style="font-family: system-ui; max-width: 640px; margin: 4rem auto; padding: 0 1rem;">
	<h1>Digital Library</h1>

	{#if data.user}
		<p>
			Signed in as <strong>{data.user.email}</strong>
			{#if data.user.is_admin}<span style="colors:#888">(admin)</span>{/if}
		</p>
		<form method="POST" action="/logout">
			<button type="submit">Sign out</button>
		</form>
	{:else}
		<p><a href="/login">Sign in</a></p>
	{/if}
</main>
