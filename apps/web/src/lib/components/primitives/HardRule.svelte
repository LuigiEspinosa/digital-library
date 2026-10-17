<script lang="ts">
	import type { Snippet } from 'svelte';

	let { weight = 'rule', ariaLabel, children }: {
		weight?: 'hairline' | 'rule' | 'bracket' | 'ribbon';
		ariaLabel?: string;
		children?: Snippet;
	} = $props();
</script>

{#if weight === 'ribbon'}
	<div class="hard-rule ribbon" role="separator" aria-label={ariaLabel}>
		<span class="ribbon-text">{@render children?.()}</span>
	</div>
{:else}
	<hr class="hard-rule {weight}" />
{/if}

<style>
	/* § 3: every weight is the 1px opaque Hairline; a rule divides and carries no meaning. */
	.hard-rule {
		border: 0;
		margin: 0;
		border-radius: var(--r-none);
	}

	hr.hard-rule {
		width: 100%;
		border-top: var(--stroke-hair) solid var(--token-border);
	}

	/* The ribbon is a § 7 Section label on its hairline, not a filled band. */
	.ribbon {
		width: 100%;
		display: flex;
		align-items: center;
		padding: var(--s-xs) 0;
		box-sizing: border-box;
		border-bottom: var(--stroke-hair) solid var(--token-border);
	}

	.ribbon-text {
		font-family: var(--f-mono);
		font-size: var(--t-3xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text-secondary);
	}
</style>
