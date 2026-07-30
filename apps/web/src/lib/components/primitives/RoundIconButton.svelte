<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// A round icon button is a pure render of icon/active/aria-label — no event, no
	// state, no $bindable. The root is always a <button> (these are UI controls, not
	// links: no href, so no anchor intersection like Button's HTMLButtonAttributes &
	// HTMLAnchorAttributes). Imports nothing — the self-contained B.1–B.9/B.11
	// discipline; the three glyphs are inlined here via an exclusive {#if} switch,
	// matching how the HTML references inline them (a shared <Icon> is a later story).
	type IconName = 'search' | 'account' | 'settings';

	// Intersecting HTMLButtonAttributes' optional 'aria-label'?: string | null with a
	// required string narrows it to non-optional: an icon-only button (no text) can
	// never typecheck without an accessible name. A JS/untyped caller is caught by the
	// runtime dev-guard below.
	type RoundIconButtonProps = HTMLButtonAttributes & {
		icon: IconName;
		active?: boolean;
		'aria-label': string;
	};

	let {
		// class is destructured out of ...rest and re-merged onto the root <button>, so
		// a caller's layout class (the Epic 03 nav-cell rhythm) APPENDS to the base
		// class rather than clobbering it (the set-wide B.6 decision).
		class: className,
		icon,
		active = false,
		// aria-label is destructured OUT of ...rest so the guarded aria-label={ariaLabel}
		// below is authoritative — a stray rest value can't silently drop it.
		'aria-label': ariaLabel,
		...rest
	}: RoundIconButtonProps = $props();

	// The icon is decorative (aria-hidden), so a missing or empty aria-label leaves an
	// unnamed control — a real a11y hole the TS type can't stop a JS caller (or a
	// dropping {...spread}) from shipping. import.meta.env.DEV is true under
	// vitest/dev/svelte-check and dead-code-eliminated from the prod build, so this
	// throws loudly where it's caught and costs nothing in production. !ariaLabel?.trim()
	// catches undefined/null, '', AND a whitespace-only label — all three are empty to
	// assistive tech, so all three are as broken as a missing name (and this avoids the
	// B.4 aria-label='' smell). This is a one-time mount-side invariant, NOT reactive —
	// reading the prop here is deliberate, so silence svelte-check's
	// state_referenced_locally (the Input.svelte:38 trap; here the initial value IS what
	// we want to check, so no $derived).
	// svelte-ignore state_referenced_locally
	if (import.meta.env.DEV && !ariaLabel?.trim()) {
		throw new Error(
			'<RoundIconButton> requires a non-empty `aria-label` (the icon is decorative and carries no accessible name).'
		);
	}
</script>

<button
	type="button"
	class="round-icon-btn {className ?? ''}"
	class:active
	aria-label={ariaLabel}
	{...rest}
>
	{#if icon === 'search'}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="square"
			aria-hidden="true"
			focusable="false"
		>
			<circle cx="11" cy="11" r="7" />
			<line x1="20" y1="20" x2="16.5" y2="16.5" />
		</svg>
	{:else if icon === 'account'}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="square"
			aria-hidden="true"
			focusable="false"
		>
			<circle cx="12" cy="9" r="4" />
			<path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" />
		</svg>
	{:else}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="square"
			aria-hidden="true"
			focusable="false"
		>
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19 12a7 7 0 0 0-.1-1.2l2.1-1.6-2-3.5-2.5.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.4a7 7 0 0 0-2 1.2l-2.5-.9-2 3.5 2.1 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2L3 14.8l2 3.5 2.5-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.4a7 7 0 0 0 2-1.2l2.5.9 2-3.5-2.1-1.6c.1-.4.1-.8.1-1.2z"
			/>
		</svg>
	{/if}
</button>

<style>
	/* The ONE sanctioned non-zero radius (DESIGN.md §5 — 50% only on round icon
	   buttons): the single circular shape on a logged-in page, the inverse of every
	   square sibling. box-sizing:border-box holds the outer box at 40px whether the
	   border is 1px (rest) or 2px (active). transition is color ONLY — the icon
	   recolors on hover, nothing else moves: no fill flip, no lift, no shadow (the
	   epic AC overrides the reference .icon-btn's black-fill hover; DESIGN.md §6/§7). */
	.round-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--caption-gray);
		border-radius: 50%;
		background: transparent;
		color: var(--page-ink);
		cursor: pointer;
		transition: color 150ms linear;
	}

	/* Settings promotes the account button to a 2px ink ring. */
	.round-icon-btn.active {
		border: 2px solid var(--wired-black);
	}

	/* Hover recolors the currentColor icon stroke to Link Blue — no background, no
	   border-color change, no transform (the AC deviation from the reference fill). */
	.round-icon-btn:hover {
		color: var(--link-blue);
	}

	.round-icon-btn svg {
		display: block;
		width: 16px;
		height: 16px;
	}

	/* The editorial double-rule focus shared by Button/Input/AppNav/Breadcrumb
	   (DESIGN.md §4): a 2px outset, no glow. */
	.round-icon-btn:focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}
</style>
