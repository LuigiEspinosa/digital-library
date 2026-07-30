<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import Button from './Button.svelte';

	type FilterOption = { value: string; label: string };

	// HTMLAttributes<HTMLDivElement> base: the strip root is a <div>, so id/aria-*/
	// data-*/role flow in typed for free (the B.7/B.8/B.9 base-pattern choice).
	type FilterStripProps = HTMLAttributes<HTMLDivElement> & {
		options: FilterOption[]; // the segments, in render order
		value?: string; // the active option's value; bindable
		onChange?: (value: string) => void; // fired when the active option CHANGES
		size?: 'sm' | 'md' | 'lg'; // forwarded to every composed <Button>
		ariaLabel?: string; // accessible name for the segmented group
		trailing?: Snippet; // optional right-aligned cluster (Library-Grid search)
	};

	let {
		// class is destructured out of ...rest and re-merged onto the root <div> so a
		// caller's layout class APPENDS instead of clobbering (the set-wide B.6 decision).
		class: className,
		options,
		// $bindable so a caller may `bind:value` OR drive the control purely via onChange.
		value = $bindable(),
		onChange,
		size = 'sm',
		ariaLabel,
		trailing,
		...rest
	}: FilterStripProps = $props();

	// Fire onChange ONLY on an actual change — a re-click of the already-active
	// segment is a no-op (else the Library Grid re-fetches on every idle click).
	// Writing `value` keeps the active segment flipping even when the caller does
	// not bind; strict === (not truthiness) so an empty-string option value is legal.
	function select(next: string) {
		if (next === value) return;
		value = next;
		onChange?.(next);
	}
</script>

<div class="filter-strip {className ?? ''}" {...rest}>
	<div class="seg" role="group" aria-label={ariaLabel}>
		{#each options as opt (opt.value)}
			<div class="seg-cell">
				<Button
					variant={opt.value === value ? 'inverted' : 'primary'}
					{size}
					aria-pressed={opt.value === value}
					onclick={() => select(opt.value)}>{opt.label}</Button
				>
			</div>
		{/each}
	</div>
	{#if trailing}<div class="trailing">{@render trailing()}</div>{/if}
</div>

<style>
	/* Layout-only: every pixel of color, the 2px border and the 150ms hover
	   inversion belong to the composed <Button> (Risk #1 — reinventing them here is
	   the drift this primitive exists to kill). No color, no box-shadow, no
	   transition, no non-zero radius, no Tailwind. */
	.filter-strip {
		display: flex;
		align-items: stretch;
		gap: 24px;
	}

	.seg {
		display: flex;
		align-items: stretch;
	}

	/* Border collapse: pull every cell after the first back over its neighbour's
	   2px border so the two fuse to a single 2px seam (no gap, no doubled 4px line).
	   Collapsed on this FilterStrip-owned wrapper — NOT via a class on <Button> — a
	   scoped class never reaches a child component's root, so it would silently
	   no-op. The seam itself is a visual-check item (jsdom computes no scoped style). */
	.seg-cell:not(:first-child) {
		margin-left: -2px;
	}

	/* Raise the focused cell above its neighbours: the -2px collapse overlaps
	   adjacent cells, and later cells paint last, so an interior segment's 2px
	   focus outline (Button's, offset 2px) would be clipped by the next cell's
	   border/background without a stacking context. */
	.seg-cell:focus-within {
		position: relative;
		z-index: 1;
	}

	.trailing {
		margin-left: auto;
		display: flex;
		align-items: stretch;
	}
</style>
