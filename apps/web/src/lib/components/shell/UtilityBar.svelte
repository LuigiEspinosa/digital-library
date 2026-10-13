<script lang="ts">
	import type { Snippet } from 'svelte';

	let { breadcrumb, rightSlot }: { breadcrumb: string[]; rightSlot?: Snippet } = $props();
</script>

<div class="utility-bar">
	<div class="utility-left">
		{#each breadcrumb as seg, i}
			<span class="crumb">{seg}</span>
			{#if i < breadcrumb.length - 1}
				<span class="sep" aria-hidden="true">·</span>
			{/if}
		{/each}
	</div>
	<div class="utility-right">
		{@render rightSlot?.()}
	</div>
</div>

<style>
	/* The session strip on the page ground with a hairline beneath, never a filled band.
	   Metadata reads as a § 7 Label; every control in the slot is a § 1b Link with the
	   --tap box on the element itself. */
	.utility-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-md);
		width: 100%;
		min-height: var(--tap);
		box-sizing: border-box;
		padding: 0 var(--s-lg);
		border-bottom: var(--stroke-hair) solid var(--token-border);
		color: var(--token-text-secondary);
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
	}

	.utility-left {
		display: flex;
		align-items: center;
		min-width: 0;
		overflow: hidden;
	}

	/* A long crumb ellipsizes visually; the full string stays in the DOM. */
	.utility-left .crumb {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.utility-left .sep {
		flex: 0 0 auto;
		margin: 0 var(--s-xs);
		user-select: none;
	}

	.utility-right {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: var(--s-lg);
	}

	/* Slot content is the caller's, so it is reached through :global(). Every direct
	   child is an item: the email span, the Admin link and the sign-out form. */
	.utility-right > :global(*) {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		color: var(--token-text);
	}

	.utility-right :global(a),
	.utility-right :global(button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--tap);
		min-width: var(--tap);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: var(--token-text);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--token-border-interactive);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
	}

	.utility-right :global(a:hover),
	.utility-right :global(button:hover) {
		text-decoration-color: var(--token-accent-hover);
	}
</style>
