<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	// A breadcrumb is a pure render of a trail — no event, no state, no $bindable.
	// The root is a <nav>, so the generic element attribute set is the right base
	// (id/aria-*/data-*/role flow in typed for free), the same base pattern
	// StatusTag/FilterStrip used. Imports nothing — self-contained, back to the
	// B.1–B.9 discipline after B.10's one-off <Button> composition.
	type Crumb = { label: string; href?: string };

	type BreadcrumbProps = HTMLAttributes<HTMLElement> & {
		trail: Crumb[]; // segments in order; the LAST is the current page
	};

	let {
		// class is destructured out of ...rest and re-merged onto the root <nav>, so
		// a caller's layout class (the Epic 03 breadcrumb-strip row rhythm) APPENDS
		// to the base class rather than clobbering it (the set-wide B.6 decision).
		class: className,
		trail,
		...rest
	}: BreadcrumbProps = $props();
</script>

<nav class="breadcrumb {className ?? ''}" aria-label="Breadcrumb" {...rest}>
	<ol>
		{#each trail as crumb, i (i)}
			<li>
				{#if i > 0}<span class="sep" aria-hidden="true">›</span>{/if}
				<!-- isLast beats href: the last entry is ALWAYS the current page, a
				     non-link <span aria-current="page"> even if it carries an href. -->
				{#if i === trail.length - 1}
					<span class="current" aria-current="page">{crumb.label}</span>
				{:else if crumb.href}
					<a class="crumb" href={crumb.href}>{crumb.label}</a>
				{:else}
					<span class="crumb">{crumb.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	/* Spacing-agnostic: this primitive is the crumb CHAIN, not the breadcrumb STRIP
	   row. The reference's padding:16px/border-bottom hairline/max-width:1280px is
	   page chrome owned by the Epic 03 screen (Book Detail C.4 / Import C.7 /
	   Settings C.9), applied via the merged class — never baked in here. So no outer
	   padding, no bottom border, no max-width, no background. The 10px gap is a
	   hardcoded literal (there is no --space-10, the B.4–B.10 sub-token precedent);
	   flex-wrap lets a long chain drop to a second line instead of overflowing. */
	.breadcrumb ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		/* Uppercase is CSS-only — the DOM keeps the author's case so a screen reader
		   announces "Libraries", not the shouted caps (the MonoKicker rule). Weight
		   400 matches the two mono references + MonoKicker md (scoped decision). */
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.92px;
		text-transform: uppercase;
	}

	.breadcrumb li {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}

	/* Both the <a> and the hrefless <span> ancestor label are Caption Gray; only the
	   <a> recolors on hover. */
	.crumb {
		color: var(--caption-gray);
		text-decoration: none;
	}

	.sep {
		color: var(--caption-gray);
		user-select: none;
	}

	.current {
		color: var(--page-ink);
	}

	a.crumb {
		transition: color 150ms linear;
	}

	a.crumb:hover {
		color: var(--link-blue);
	}

	/* The editorial double-rule focus shared by Button/Input/AppNav (DESIGN.md §4):
	   a 2px outset, no glow. Keyboard users must see focus on the crumb links. */
	a.crumb:focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}
</style>
