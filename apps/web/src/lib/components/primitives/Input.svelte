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
			<MonoKicker size="ribbon" tone="ink">ERROR</MonoKicker>
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

	/* § 7 Label above the field, uppercased in CSS only. */
	.label {
		margin-bottom: var(--s-xs);
		font-family: var(--f-mono);
		font-size: var(--t-3xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text-secondary);
	}

	/* § 9 Field: the page ground, never a lighter fill; rest and hover are identical;
	   focus is the standard ring alone. */
	.field {
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap);
		padding: var(--s-xs) var(--s-sm);
		background: var(--token-bg);
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		border-radius: var(--r-none);
		font-family: var(--f-body);
		font-size: var(--t-sm);
		color: var(--token-text);
	}

	.field::placeholder {
		color: var(--token-text-secondary);
	}

	/* Read-only takes § 9's disabled treatment; it stays focusable, so it keeps the ring. */
	.field.is-readonly {
		border-color: var(--token-border);
		color: var(--token-text-secondary);
	}

	/* S-4: the message is text, adjacent and associated; no ground, no colour. */
	.error-block {
		margin-top: var(--s-xs);
		box-sizing: border-box;
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		padding: var(--s-sm) var(--s-md);
	}

	.error-message {
		margin: var(--s-2xs) 0 0;
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text);
	}

	.helper {
		margin: var(--s-xs) 0 0;
	}

	.helper-sans {
		font-family: var(--f-body);
		font-size: var(--t-xs);
		color: var(--token-text-secondary);
	}
</style>
