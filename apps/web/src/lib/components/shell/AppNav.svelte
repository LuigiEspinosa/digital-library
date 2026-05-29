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
	.app-nav {
		width: 100%;
		height: 64px;
		background: var(--paper-white);
		border-bottom: 1px solid var(--hairline-tint);
		border-radius: 0;
	}

	.app-nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1280px;
		height: 100%;
		margin: 0 auto;
		padding: 0 var(--space-24);
		box-sizing: border-box;
	}

	/* Brand mark: deliberately keeps --page-ink on hover (no link-blue swap, no
	   underline) — DESIGN.md §4 "logo never recolored". Keyboard focus is the only
	   interactive cue, so resist adding the app-wide link hover here. */
	.wordmark {
		font-family: var(--font-display);
		font-size: 24px;
		color: var(--page-ink);
		text-decoration: none;
		white-space: nowrap;
	}

	.wordmark:focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}

	.app-nav-right {
		display: flex;
		align-items: center;
		gap: var(--space-12);
	}
</style>
