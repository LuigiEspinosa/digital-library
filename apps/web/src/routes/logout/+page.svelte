<script lang="ts">
	import type { PageData } from "./$types";
	export let data: PageData;
</script>

<svelte:head>
	<title>Digital Library</title>
</svelte:head>

<main class="logout">
	<h1>Digital Library</h1>

	{#if data.user}
		<p>
			Signed in as <strong>{data.user.email}</strong>
			{#if data.user.is_admin}<span class="role">(admin)</span>{/if}
		</p>
		<form method="POST" action="/logout">
			<button type="submit">Sign out</button>
		</form>
	{:else}
		<p><a href="/login">Sign in</a></p>
	{/if}
</main>

<style>
	.logout {
		max-width: var(--measure);
		margin: 0 auto;
		padding: var(--s-2xl) var(--page-pad);
	}

	h1 {
		margin: 0;
		font-family: var(--f-display);
		font-size: var(--t-xl);
		font-weight: var(--w-black);
		line-height: var(--lh-heading);
		letter-spacing: var(--tr-heading);
		text-transform: uppercase;
	}

	p {
		margin: var(--s-md) 0 0;
		font-size: var(--t-sm);
		line-height: var(--lh-body);
	}

	.role {
		color: var(--token-text-secondary);
	}

	form {
		margin-top: var(--s-lg);
	}

	/* § 1 Control */
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--tap);
		min-width: var(--tap);
		padding: var(--s-xs) var(--s-md);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		background: transparent;
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text);
		cursor: pointer;
		transition: border-color var(--dur-micro) var(--ease-toggle);
	}

	button:hover {
		border-color: var(--token-accent-hover);
	}

	/* § 1b in-prose Link */
	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		min-width: var(--tap);
		color: var(--token-text);
		text-decoration: underline;
		text-decoration-color: var(--token-accent);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
	}
</style>
