<script lang="ts">
	import type { Snippet } from 'svelte';

	let { size = 'md', tone = 'ink', children }: {
		size?: 'sm' | 'md' | 'ribbon';
		tone?: 'ink' | 'caption' | 'paper';
		children?: Snippet;
	} = $props();
</script>

<span class="mono-kicker {size} {tone}">{@render children?.()}</span>

<style>
	/* RESTYLE-SPEC.md § 7 Label. Uppercasing is CSS-only on purpose: the DOM text keeps
	   the author's casing, so a screen reader never reads shouted caps. */
	.mono-kicker {
		font-family: var(--f-mono);
		font-weight: var(--w-regular);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}

	.sm {
		font-size: var(--t-3xs);
	}

	.md {
		font-size: var(--t-2xs);
	}

	.ribbon {
		font-size: var(--t-3xs);
		font-weight: var(--w-bold);
	}

	.ink,
	.paper {
		color: var(--token-text);
	}

	.caption {
		color: var(--token-text-secondary);
	}
</style>
