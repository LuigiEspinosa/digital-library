<script lang="ts">
	import type { Snippet } from 'svelte';

	let { rightSlot }: { rightSlot?: Snippet } = $props();
</script>

<div class="app-nav">
	<div class="app-nav-inner">
		<a class="wordmark" href="/">CUATRO LIBRARY</a>
		<div class="app-nav-right">
			{@render rightSlot?.()}
		</div>
	</div>
</div>

<style>
	/* The page ground with a hairline beneath, never a band. */
	.app-nav {
		width: 100%;
		border-bottom: var(--stroke-hair) solid var(--token-border);
	}

	.app-nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-lg);
		max-width: 1280px;
		min-height: calc(var(--tap) + 2 * var(--s-xs));
		margin: 0 auto;
		padding: 0 var(--s-lg);
		box-sizing: border-box;
	}

	/* The wordmark keeps its colour on hover: the ring is its only interactive cue. */
	.wordmark {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		font-family: var(--f-display);
		font-size: var(--t-md);
		font-weight: var(--w-black);
		font-stretch: 75%;
		letter-spacing: var(--tr-heading);
		line-height: var(--lh-heading);
		color: var(--token-text);
		text-decoration: none;
		white-space: nowrap;
	}

	.app-nav-right {
		display: flex;
		align-items: center;
		gap: var(--s-lg);
	}
</style>
