<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	// href/type/disabled flow from the Button & Anchor attribute intersection (the
	// exact typing the shadcn button passes today); only variant/size/children are added.
	type ButtonProps = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			variant?: 'primary' | 'inverted' | 'tertiary';
			size?: 'sm' | 'md' | 'lg';
			children?: Snippet;
		};

	let {
		// class is destructured out of ...rest and re-merged onto the element below,
		// so a caller's layout class APPENDS to the base classes instead of clobbering.
		class: className,
		variant = 'primary',
		size = 'md',
		href = undefined,
		// Default 'button': a bare <button> is type="submit" and would submit any
		// enclosing form on click; callers opt into type="submit" explicitly.
		type = 'button',
		disabled = false,
		children,
		...rest
	}: ButtonProps = $props();
</script>

{#if href}
	<!-- A disabled <a> has no native disabled: drop href, keep role="link" so the
	     disabled state attaches to a real role, mark aria-disabled, drop it from the
	     tab order; .is-disabled adds pointer-events:none in CSS (:disabled only
	     matches <button>). -->
	<a
		class="btn {variant} {size} {className ?? ''}"
		class:is-disabled={disabled}
		href={disabled ? undefined : href}
		role={disabled ? 'link' : undefined}
		aria-disabled={disabled || undefined}
		tabindex={disabled ? -1 : undefined}
		{...rest}>{@render children?.()}</a
	>
{:else}
	<button class="btn {variant} {size} {className ?? ''}" class:is-disabled={disabled} {type} {disabled} {...rest}>
		{@render children?.()}
	</button>
{/if}

<style>
	/* RESTYLE-SPEC.md § 1 Control: no filled control anywhere, so primary and inverted
	   are one treatment. Hover recolours the border and nothing else; the border colour
	   is the only transition. The focus ring is layout.css's unlayered :focus-visible. */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: var(--tap);
		min-width: var(--tap);
		padding: var(--s-xs) var(--s-md);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		border-radius: var(--r-none);
		background: transparent;
		color: var(--token-text);
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		font-weight: var(--w-regular);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
		transition: border-color var(--dur-micro) var(--ease-toggle);
	}

	.btn:not(.is-disabled):hover {
		border-color: var(--token-accent-hover);
	}

	/* Current (a pressed segment): the emphasis underline, never a fill. */
	.btn[aria-pressed='true'] {
		text-decoration: underline;
		text-decoration-color: var(--token-accent);
		text-decoration-thickness: var(--stroke-emphasis);
		text-underline-offset: var(--s-2xs);
	}

	/* Tertiary is a § 1b secondary Link: unboxed, a hairline underline that recolours
	   on hover, and the --tap box on the element itself. */
	.tertiary {
		min-width: var(--tap);
		padding: 0;
		border: 0;
		color: var(--token-text-secondary);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		letter-spacing: var(--tr-body);
		text-transform: none;
		text-decoration: underline;
		text-decoration-color: var(--token-border-interactive);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
	}

	.tertiary:not(.is-disabled):hover {
		text-decoration-color: var(--token-accent-hover);
	}

	/* A forced disabled (§ 1): hairline border, secondary label, never opacity. */
	.btn.is-disabled {
		pointer-events: none;
		cursor: default;
		border-color: var(--token-border);
		color: var(--token-text-secondary);
	}

	.tertiary.is-disabled {
		text-decoration-color: var(--token-border);
	}
</style>
