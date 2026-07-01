<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import MonoKicker from './MonoKicker.svelte';

	// Only label/helperText/errorText/helperMode are added; value/type/placeholder/
	// readonly/id already come typed from HTMLInputAttributes (the same base the
	// shadcn input passes today).
	type InputProps = HTMLInputAttributes & {
		label: string;
		helperText?: string;
		errorText?: string;
		helperMode?: 'sans' | 'mono';
	};

	let {
		// class is destructured out of ...rest and re-merged onto the root wrapper, so
		// a caller's layout class APPENDS to the base class rather than clobbering it
		// (the design-system-wide B.6 decision, applies to B.7–B.12).
		class: className,
		// id is destructured out of ...rest so it can never double-apply or desync the
		// label/aria wiring; a caller-supplied id wins, else the generated uid falls back.
		id,
		label,
		value = $bindable(),
		type = 'text',
		placeholder,
		helperText,
		errorText,
		helperMode = 'sans',
		readonly = false,
		...rest
	}: InputProps = $props();

	// $props.id() (Svelte 5.20+) is SSR-stable and hydration-safe — the right source
	// for a labeled field id that also anchors the helper/error aria-describedby.
	const uid = $props.id();
	// $derived (not a plain const) so a caller id wins reactively; capturing the
	// reactive `id` prop in a plain const trips svelte-check's state_referenced_locally.
	const fieldId = $derived(id ?? uid);
	const describeId = `${uid}-desc`;
</script>

<div class="input-field {className ?? ''}">
	<label class="label" for={fieldId}>{label}</label>
	<input
		class="field"
		class:is-readonly={readonly}
		id={fieldId}
		{type}
		{placeholder}
		bind:value
		readonly={readonly || undefined}
		aria-invalid={errorText ? 'true' : undefined}
		aria-describedby={errorText || helperText ? describeId : undefined}
		{...rest}
	/>
	<!-- errorText wins: the error block OR the helper renders, never both (the epic's
	     "helperText when present and no error"). -->
	{#if errorText}
		<div class="error-block" id={describeId}>
			<MonoKicker size="sm" tone="ink">ERROR</MonoKicker>
			<p class="error-message">{errorText}</p>
		</div>
	{:else if helperText}
		{#if helperMode === 'mono'}
			<p class="helper" id={describeId}><MonoKicker size="sm" tone="caption">{helperText}</MonoKicker></p>
		{:else}
			<p class="helper helper-sans" id={describeId}>{helperText}</p>
		{/if}
	{/if}
</div>

<style>
	.input-field {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		width: 100%;
	}

	/* CSS-only uppercasing (like MonoKicker): a caller may pass EMAIL or Email and the
	   DOM/screen-reader keep the original case. */
	.label {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		color: var(--page-ink);
		margin-bottom: var(--space-8);
	}

	/* border-radius: 0 is already global (layout.css --radius*: 0), but pin it locally
	   so the square corner is override-proof (DESIGN.md §4). No box-shadow (§6). */
	.field {
		box-sizing: border-box;
		width: 100%;
		height: 48px;
		padding: 0 14px;
		background: var(--paper-white);
		border: 2px solid var(--wired-black);
		border-radius: 0;
		font-family: var(--font-sans);
		font-size: 16px;
		color: var(--page-ink);
	}

	.field::placeholder {
		color: var(--caption-gray);
	}

	/* readonly softens the border to caption-gray (08-settings.md) — NOT black, NOT the
	   out-of-palette #a0aec0; editing is blocked by the native readonly attribute. */
	.field.is-readonly {
		border-color: var(--caption-gray);
	}

	/* The editorial focus outline — a 2px outset, no glow ring, no border recolor
	   (identical to Button/AppNav). :focus-visible so it shows for keyboard users only. */
	.field:not(.is-readonly):focus-visible {
		outline: 2px solid var(--wired-black);
		outline-offset: 2px;
	}

	/* readonly inputs stay focusable, so the :not() gate alone isn't enough — suppress
	   the outline explicitly (the epic requires none on read-only fields). */
	.field.is-readonly:focus-visible {
		outline: none;
	}

	/* Printerly, no red: a 2px-black-bordered block (DESIGN.md's #e53e3e is superseded
	   by the epic AC + 04-login.md). The mono ERROR kicker + serif message compose inside. */
	.error-block {
		margin-top: 6px;
		box-sizing: border-box;
		background: var(--paper-white);
		border: 2px solid var(--wired-black);
		padding: 14px 16px;
	}

	.error-message {
		margin: 6px 0 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.5;
		color: var(--page-ink);
	}

	/* margin: 6px 0 0 resets the UA <p> margins and sets the field→helper gap for both
	   modes; the mono variant styles its type via the composed MonoKicker. */
	.helper {
		margin: 6px 0 0;
	}

	.helper-sans {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 400;
		color: var(--caption-gray);
	}
</style>
