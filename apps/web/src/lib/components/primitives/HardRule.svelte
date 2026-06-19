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
	/* Reset the UA <hr> default border + ~8px margins first; without it the 1px
	   weights render doubled and won't match DESIGN.md §6. */
	.hard-rule {
		border: 0;
		margin: 0;
		border-radius: 0;
	}

	hr.hard-rule {
		width: 100%;
	}

	.hairline {
		border-top: 1px solid var(--hairline-tint);
	}

	.rule {
		border-top: 1px solid var(--wired-black);
	}

	.bracket {
		border-top: 2px solid var(--wired-black);
	}

	.ribbon {
		width: 100%;
		height: 36px;
		background: var(--wired-black);
		display: flex;
		align-items: center;
		padding: 0 var(--space-24);
		box-sizing: border-box;
	}

	/* The ribbon label is this component's own element, so the §3 Section Ribbon
	   type flows into it directly — no :global (unlike the slot links in
	   UtilityBar/AppNav, which are caller-authored). */
	.ribbon-text {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--paper-white);
	}
</style>
