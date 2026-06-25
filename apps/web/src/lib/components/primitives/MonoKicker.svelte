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
	/* Uppercasing is CSS-only on purpose: the DOM text node keeps the author's
	   original casing, so a screen reader announces "3 hours ago" rather than the
	   shouted caps. Never .toUpperCase() in JS — that is the bug this primitive
	   exists to prevent (DESIGN.md §3: mono is always uppercase). */
	.mono-kicker {
		font-family: var(--font-mono);
		font-weight: 400;
		text-transform: uppercase;
	}

	/* Sizes hardcoded per DESIGN.md §3 (Timestamp/Meta, Eyebrow/Kicker, Section
	   Ribbon rows). The --type-kicker-* tokens look apt but are dead in the
	   codebase; hardcoding keeps the table symmetric and `ribbon` byte-identical
	   to HardRule's .ribbon-text (so Epic 03 can compose this in there later). */
	.sm {
		font-size: 12px;
		line-height: 1.33;
		letter-spacing: 1.1px;
	}

	.md {
		font-size: 13px;
		line-height: 1.23;
		letter-spacing: 0.92px;
	}

	/* font-weight 700 re-declared after the base 400: equal specificity, so source
	   order wins. The base 400 also defends sm/md against a bold context (B.8 <th>). */
	.ribbon {
		font-size: 12px;
		line-height: 1;
		letter-spacing: 1.2px;
		font-weight: 700;
	}

	.ink {
		color: var(--page-ink);
	}

	.caption {
		color: var(--caption-gray);
	}

	.paper {
		color: var(--paper-white);
	}
</style>
