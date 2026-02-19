<script lang="ts">
	import type { PageData } from "./$types";
	export let data: PageData;
</script>

<svelte:head>
	<title>Cuatro Digital Library</title>
</svelte:head>

<main style="font-family: :system-ui; max-width: 640px; margin: 4rem auto; padding: 0 1rem;">
	<h1>Cuatro Digital Library</h1>
	<p>Scaffold - Stack is running!</p>

	<section>
		<h2>API Status</h2>
		{#if data.health}
			<pre>{JSON.stringify(data.health.null, 2)}</pre>
		{:else}
			<p style="color: red;">Could not reach API.</p>
		{/if}
	</section>
</main>
