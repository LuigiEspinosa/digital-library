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
	/* transition lists ONLY background-color + color — never `all`: the 2px border
	   must stay constant through the hover inversion (DESIGN.md §4 "no easing on
	   the rule"). No box-shadow anywhere (§6 — no elevation). */
	.btn {
		font-family: var(--font-sans);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		border-radius: 0;
		cursor: pointer;
		text-decoration: none;
		transition:
			background-color 150ms linear,
			color 150ms linear;
	}

	/* The solid UI buttons share the §4 "Button Label" type + the §6 level-3 2px
	   hard border; primary and inverted are exact hover-mirrors with a constant
	   black border (the bg/text just swap). */
	.primary,
	.inverted {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		border: 2px solid var(--wired-black);
	}

	.primary {
		background: var(--paper-white);
		color: var(--wired-black);
	}

	.primary:not(.is-disabled):hover {
		background: var(--wired-black);
		color: var(--paper-white);
	}

	.inverted {
		background: var(--wired-black);
		color: var(--paper-white);
	}

	.inverted:not(.is-disabled):hover {
		background: var(--paper-white);
		color: var(--wired-black);
	}

	/* Padding is solid-button-only; tertiary keeps padding:0, so `size` is a no-op
	   on it. md (14x24 → ~44px tall) is the §7 WCAG-AAA target from the epic AC;
	   sm/lg bracket it proportionally. Font stays 16/700 across sizes. */
	.primary.sm,
	.inverted.sm {
		padding: 10px 16px;
	}

	.primary.md,
	.inverted.md {
		padding: 14px 24px;
	}

	.primary.lg,
	.inverted.lg {
		padding: 18px 32px;
	}

	/* Tertiary is editorial inline link text (§4 "editorial linking, not UI"), not
	   a UI label: regular weight, no caps, caption-gray with a persistent underline
	   that only recolors to link-blue on hover. */
	.tertiary {
		padding: 0;
		border: 0;
		background: transparent;
		font-size: 16px;
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
		color: var(--caption-gray);
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.tertiary:not(.is-disabled):hover {
		color: var(--link-blue);
	}

	/* Disabled (both branches) is inert to pointer interaction — shadcn parity
	   (disabled:pointer-events-none). The native <button disabled> is already
	   click-blocked; this neutralizes the hrefless disabled <a> too. */
	.btn.is-disabled {
		pointer-events: none;
	}

	/* Disabled stays in-palette: caption-gray border + text, no hover (the hover
	   rules already gate on :not(.is-disabled)). NOT #a0aec0 (out-of-palette). */
	.primary.is-disabled,
	.inverted.is-disabled {
		border-color: var(--caption-gray);
		color: var(--caption-gray);
		cursor: default;
	}

	.tertiary.is-disabled {
		color: var(--caption-gray);
		cursor: default;
	}

	/* The editorial focus outline (same as AppNav's wordmark, B.7 <Input> will
	   match): a 2px outset, no glow ring, no border recolor. :focus-visible so it
	   shows for keyboard users without firing on mouse click; :not(.is-disabled)
	   keeps a disabled (programmatically focusable) <a> from painting an active ring. */
	.btn:not(.is-disabled):focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}
</style>
