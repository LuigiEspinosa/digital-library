<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTableAttributes } from 'svelte/elements';

	// Only head/body/dense/rowHover are added; id/aria-*/data-*/… flow in typed for
	// free from HTMLTableAttributes (the same base pattern Input used with
	// HTMLInputAttributes).
	type EditorialTableProps = HTMLTableAttributes & {
		head: Snippet; // caller authors the <tr><th>…</th></tr> header row
		body: Snippet; // caller authors the <tr><td>…</td></tr> body rows
		dense?: boolean;
		rowHover?: 'warm' | 'strict';
	};

	let {
		// class is destructured out of ...rest and re-merged onto the <table>, so a
		// caller's layout class APPENDS to the base class rather than clobbering it
		// (the design-system-wide B.6 decision, applies to B.7–B.12).
		class: className,
		head,
		body,
		dense = false,
		rowHover = 'warm',
		...rest
	}: EditorialTableProps = $props();
</script>

<table
	class="editorial-table {className ?? ''}"
	class:dense
	class:row-hover-strict={rowHover === 'strict'}
	{...rest}
>
	<thead>{@render head?.()}</thead>
	<tbody>{@render body?.()}</tbody>
</table>

<style>
	/* Square, flat, full-bleed (DESIGN.md §5/§7): border-collapse so the cell borders
	   below collapse into single hairlines, radius 0 pinned override-proof, and no
	   box-shadow anywhere (§6 — flat by religion). */
	.editorial-table {
		width: 100%;
		border-collapse: collapse;
		border-radius: 0;
	}

	/* The <tr>/<th>/<td> are CALLER-authored slot content (they live in the head/body
	   snippets, not this file), so Svelte's scope hash never reaches them — :global is
	   required, exactly like UtilityBar/AppNav's :global(a). Every rule is scoped under
	   .editorial-table so it can't leak to a sibling table; and the child combinators below (> thead/tbody > tr > td, anchored on the component-owned thead/tbody) keep it from leaking into a table nested inside a cell. This is the
	   deliberate inverse of the B.3–B.7 component-owned "no :global" reflex. */

	/* Header: the §3 Section Ribbon metric (mono 12/700/1.2px, page-ink) applied as
	   CSS — the caller writes plain <th>NAME</th> and text-transform shouts it, so no
	   per-cell <MonoKicker> (byte-identical result without pushing composition onto
	   every caller). The 2px black bottom is the §6 level-3 border seating the header. */
	.editorial-table > thead > :global(tr) > :global(th) {
		text-align: left;
		padding: 18px 16px;
		border-bottom: 2px solid var(--wired-black);
		border-radius: 0;
		background: var(--paper-white);
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--page-ink);
	}

	/* Dividers live on the cells, not the row: under border-collapse that is the
	   cross-browser-robust choice (reference parity). Every body row gets a 1px
	   hairline; the last row's cells get a 1px black rule to CLOSE the table
	   (§6 level-2 structural rule). */
	.editorial-table > tbody > :global(tr) > :global(td) {
		padding: 18px 16px;
		border-bottom: 1px solid var(--hairline-tint);
		border-radius: 0;
		vertical-align: middle;
	}

	.editorial-table > tbody > :global(tr:last-child) > :global(td) {
		border-bottom: 1px solid var(--wired-black);
	}

	/* Warm hover (default): #f7f7f4 is the ONE sanctioned off-palette value (AC1) —
	   the near-paper warm tone 05-admin.md + the epic AC name for the row hover.
	   Hardcoded (there is no --hover token) and gated behind the default
	   rowHover="warm"; this is an epic-required exception, NOT palette drift. Painted
	   on the row's <td>s so the whole row lights up under collapse. */
	.editorial-table:not(.row-hover-strict) > tbody > :global(tr:hover) > :global(td) {
		background: #f7f7f4;
	}

	/* Strict hover: palette-only fallback (a black top rule, no fill) for a screen
	   that must stay strictly in the six-color palette. */
	.editorial-table.row-hover-strict > tbody > :global(tr:hover) > :global(td) {
		border-top: 1px solid var(--wired-black);
	}

	/* Dense: tighter cells for high-row-count tables (the Import queue). */
	.editorial-table.dense > thead > :global(tr) > :global(th),
	.editorial-table.dense > tbody > :global(tr) > :global(td) {
		padding: 14px 12px;
	}
</style>
