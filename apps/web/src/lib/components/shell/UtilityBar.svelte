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
	.utility-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 36px;
		box-sizing: border-box;
		padding: 0 var(--space-24);
		background: var(--wired-black);
		color: var(--paper-white);
		font-family: var(--font-sans);
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.92px;
		border-radius: 0;
	}

	.utility-left {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.utility-left .sep {
		margin: 0 var(--space-8);
		user-select: none;
	}

	.utility-right {
		display: flex;
		align-items: center;
		height: 100%;
	}

	/* Links are authored by the caller via rightSlot, so they live outside this
	   component's scope — target them with :global() inside the scoped wrapper. */
	.utility-right :global(a) {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 100%;
		padding: 0 var(--space-16);
		color: var(--paper-white);
		text-decoration: none;
		transition: color 120ms;
	}

	.utility-right :global(a:first-child) {
		padding-left: 0;
	}

	.utility-right :global(a:last-child) {
		padding-right: 0;
	}

	.utility-right :global(a:hover) {
		color: var(--link-blue);
	}

	.utility-right :global(a + a)::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.3);
	}
</style>
