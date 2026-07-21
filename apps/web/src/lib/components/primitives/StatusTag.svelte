<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	// A status tag is inert text, so the generic element attribute set is the right
	// base: id/title/aria-*/data-*/role flow in typed for free (the same base pattern
	// Input used with HTMLInputAttributes, EditorialTable with HTMLTableAttributes).
	type StatusTagProps = HTMLAttributes<HTMLSpanElement> & {
		variant?: 'default' | 'inverted' | 'muted' | 'striped';
		progress?: number; // 0–100; renders the ink-stain fill
		children?: Snippet; // the label text — the CALLER authors the whole string
	};

	let {
		// class is destructured out of ...rest and re-merged onto the <span>, so a
		// caller's layout class APPENDS to the base classes rather than clobbering
		// them (the design-system-wide B.6 decision, applies to B.7–B.12).
		class: className,
		variant = 'default',
		progress,
		children,
		...rest
	}: StatusTagProps = $props();

	// Gate on finiteness, never on truthiness: progress={0} is falsy, and a
	// queued-at-0% tag must still render its zero-width fill. Anything non-finite
	// — NaN, Infinity, a JSON "62", a bare `progress` attribute — renders NO fill
	// at all: an empty stain on a 62%-done upload lies, an absent one is visibly
	// wrong. TypeScript guards the typed path; a live poll feed is the untyped one.
	const hasProgress = $derived(Number.isFinite(progress));

	// Clamped, not trusted: a >100 value must never paint a fill wider than the
	// tag. overflow:hidden clips it visually, but the clamp is the contract — and
	// the only part jsdom can actually see.
	const pct = $derived(
		progress !== undefined && Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0
	);
</script>

<span class="status-tag {variant} {className ?? ''}" {...rest}>
	{#if hasProgress}<span class="fill" style="width: {pct}%"></span>{/if}
	<!-- .label is unconditional: one DOM shape for every variant, and it always
	     carries the z-index that keeps the text above the absolute .fill. -->
	<span class="label">{@render children?.()}</span>
</span>

<style>
	/* Square, flat, palette-only (DESIGN.md §5/§7) — this component exists to kill
	   the rounded-full colored pill, so radius 0 is pinned locally (override-proof)
	   and there is no box-shadow (§6) and no transition (§7 — motion is minimal;
	   Svelte reactivity alone moves the fill when progress bumps).
	   inline-flex + centering realizes the epic AC's "22px tall, 8px horizontal"
	   literally; the HTML references disagree with each other on the box model
	   (padding 4px 8px WITH a height vs padding 3px 8px with none), so the AC wins.
	   Background is transparent, NOT paper-white: these tags sit in EditorialTable
	   cells whose rows paint a warm tone on hover, and a white tag would punch a
	   hole in the hovered row. */
	.status-tag {
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		position: relative; /* the .fill's containing block */
		/* position:relative alone leaves z-index:auto, so .label's z-index would
		   compete in the ANCESTOR stacking context — a tag in a table cell could
		   paint over a later drawer or dropdown. isolate keeps the fill/label
		   ordering strictly internal. */
		isolation: isolate;
		overflow: hidden; /* clips the fill to the tag box */
		height: 22px;
		padding: 0 8px;
		border: 2px solid var(--page-ink);
		border-radius: 0;
		background: transparent;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: var(--page-ink);
		white-space: nowrap;
	}

	/* No .default rule: the base block IS the default treatment. The class is still
	   emitted, as a test hook and a caller-side state hook. The 1.0px tracking above
	   is a fourth mono value with no home in MonoKicker's sm/md/ribbon table
	   (1.1/0.92/1.2px), which is why the type is hardcoded here rather than composed.
	   Uppercase stays CSS-only — the DOM keeps the author's case so a screen reader
	   announces "Uploading · 62%", not the shouted caps. */

	/* DONE in the import queue: printerly success is an inversion, never green. */
	.inverted {
		background: var(--page-ink);
		color: var(--paper-white);
	}

	/* QUEUED: off-ink, waiting. */
	.muted {
		border-color: var(--caption-gray);
		color: var(--caption-gray);
	}

	/* DUPLICATE ("already on file") is muted PLUS the hatch, not the hatch alone —
	   the four variants are one exclusive enum, so this cannot lean on .muted also
	   being applied. background-COLOR stays transparent so a hovered table row still
	   reads through the stripes.
	   The repeating-linear-gradient is an epic-required exception (07-import.md's
	   striped DUPLICATE state), NOT drift — DESIGN.md §"Gradient System"/§7 ban
	   gradients outright. Same sanctioned-exception flag EditorialTable carries for
	   its one off-palette hover; do not "fix" it away. */
	.striped {
		border-color: var(--caption-gray);
		color: var(--caption-gray);
		background-image: repeating-linear-gradient(135deg, var(--hairline-tint) 0 4px, transparent 4px 8px);
	}

	/* The "ink stain": a 10%-opacity ink wash under the label, width-bound to
	   progress. opacity on a solid token, never an rgba() literal — that is how the
	   zero-hex-literal rule survives contact with "10% of Page Ink". */
	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--page-ink);
		opacity: 0.1;
		z-index: 0;
		pointer-events: none;
	}

	.label {
		position: relative;
		z-index: 1;
	}
</style>
