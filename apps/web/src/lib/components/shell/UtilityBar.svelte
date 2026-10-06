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
		overflow: hidden;
	}

	/* Breadcrumbs carry user-supplied text from Epic 03 C.3 on (a library name), so
	   a long segment must ellipsize rather than compress or displace the session
	   strip on the right. Truncation is VISUAL only — the full string stays in the
	   DOM for a screen reader. */
	.utility-left .crumb {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.utility-left .sep {
		flex: 0 0 auto;
		margin: 0 var(--space-8);
		user-select: none;
	}

	/* Without this the session strip is the flex item that gives way first, so a
	   long crumb pushes Admin / Sign out off the bar instead of truncating itself. */
	.utility-right {
		display: flex;
		align-items: center;
		height: 100%;
		flex-shrink: 0;
	}

	/* Slot content is authored by the caller, so it lives outside this component's
	   scope — target it with :global() inside the scoped wrapper.

	   Every DIRECT CHILD is an item, not just anchors: a real session strip is a
	   <span> (email), an <a> (Admin) and a <form><button> (Sign out), so the older
	   `a` / `a + a` selectors styled one item out of three and drew no divider at
	   all (there is no a+a pair).

	   The <form> is left as the flex item and the <button> inside it is reset to
	   inherit, rather than giving the form `display: contents` — contents would
	   drop the form's own box, taking the padding and the ::before divider with it
	   (pseudo-element generation on a display:contents box is inconsistent across
	   engines), and it would also need a second rule to re-style the button. One
	   uniform item rule keeps the divider math the same for all three shapes. */
	.utility-right > :global(*) {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 100%;
		padding: 0 var(--space-16);
		color: var(--paper-white);
		text-decoration: none;
		transition: color 120ms;
	}

	.utility-right > :global(:first-child) {
		padding-left: 0;
	}

	.utility-right > :global(:last-child) {
		padding-right: 0;
	}

	/* Hover stays scoped to genuinely interactive children: the plain <span>
	   holding the email must not recolor under the cursor. */
	.utility-right :global(a:hover),
	.utility-right :global(button:hover) {
		color: var(--link-blue);
	}

	/* A submit button has to be stripped back to text to sit beside the link.
	   font: inherit does not carry letter-spacing or text-transform, so the bar's
	   uppercase tracking is re-inherited explicitly.

	   Deliberately a DESCENDANT selector, unlike the layout rules above: the button
	   may be the flex item itself or sit one level down inside a <form>, and both
	   shapes need the reset. It carries its own flex centering rather than relying
	   on height: 100% against a UA inline-block box. */
	.utility-right :global(button) {
		display: inline-flex;
		align-items: center;
		height: 100%;
		border: 0;
		background: none;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
		cursor: pointer;
	}

	/* A <form> wrapper is a passthrough box: if it keeps the item padding, that
	   padding is dead space and the sign-out target is ~32px narrower than the
	   Admin link beside it. Move the padding onto the button so the whole item is
	   clickable, and re-apply the edge rules one level down. */
	.utility-right > :global(form) {
		padding: 0;
	}

	.utility-right :global(form > button) {
		padding: 0 var(--space-16);
	}

	.utility-right > :global(form:first-child > button) {
		padding-left: 0;
	}

	.utility-right > :global(form:last-child > button) {
		padding-right: 0;
	}

	.utility-right > :global(* + *)::before {
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
