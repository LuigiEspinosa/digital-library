import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Input from '../Input.svelte';

// jsdom does no layout and does not compute scoped <style>, so the 48px height, 2px
// square border, :focus-visible outline, readonly border-color swap and placeholder
// color are visual-check items — never asserted here (getComputedStyle returns empty
// → false greens/reds, the B.4/B.5/B.6 trap). What IS testable: class mapping (proxy
// for styling), element type, attributes, input.value and textContent. No user-event
// is installed, so the two-way bind:value round-trip is a manual check too.
describe('Input', () => {
	test('renders a label whose `for` matches the input `id`', () => {
		const { container } = render(Input, { label: 'Email' });
		const label = container.querySelector('label')!;
		const input = container.querySelector('input.field')!;
		expect(label.textContent).toContain('Email');
		expect(label.getAttribute('for')).toBeTruthy();
		expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
	});

	// Covers the `fieldId = $derived(id ?? uid)` branch — the fallback-only tests never
	// pass `id`, so without this a regression that dropped the `id` prop stays green.
	test('a caller-supplied `id` wins over the generated uid on both input and label', () => {
		const { container } = render(Input, { label: 'Email', id: 'custom-id' });
		const label = container.querySelector('label')!;
		const input = container.querySelector('input.field')!;
		expect(input.getAttribute('id')).toBe('custom-id');
		expect(label.getAttribute('for')).toBe('custom-id');
	});

	test('field defaults to type="text"', () => {
		const { container } = render(Input, { label: 'X' });
		expect(container.querySelector('input.field')?.getAttribute('type')).toBe('text');
	});

	test('type passes through to the input', () => {
		const { container } = render(Input, { label: 'Password', type: 'password' });
		expect(container.querySelector('input.field')?.getAttribute('type')).toBe('password');
	});

	test('placeholder passes through', () => {
		const { container } = render(Input, { label: 'Email', placeholder: 'you@example.com' });
		expect(container.querySelector('input.field')?.getAttribute('placeholder')).toBe('you@example.com');
	});

	test('bindable value reflects on initial render', () => {
		const { container } = render(Input, { label: 'Email', value: 'luigi@pharosgraph.com' });
		expect((container.querySelector('input.field') as HTMLInputElement).value).toBe('luigi@pharosgraph.com');
	});

	test('readonly sets the native attribute and the is-readonly class', () => {
		const { container } = render(Input, { label: 'Email', readonly: true });
		const input = container.querySelector('input.field')!;
		expect(input.hasAttribute('readonly')).toBe(true);
		expect(input.classList.contains('is-readonly')).toBe(true);
	});

	// The editable negative proves the omit-when-false attr + that the styling hook
	// doesn't leak (a default-readonly refactor can't ride along silently).
	test('editable field omits readonly and the is-readonly class', () => {
		const { container } = render(Input, { label: 'Email' });
		const input = container.querySelector('input.field')!;
		expect(input.hasAttribute('readonly')).toBe(false);
		expect(input.classList.contains('is-readonly')).toBe(false);
	});

	test('helper (sans default) renders text with no error block and no mono kicker', () => {
		const { container } = render(Input, { label: 'X', helperText: 'Optional field' });
		const helper = container.querySelector('.helper');
		expect(helper?.textContent).toContain('Optional field');
		expect(helper?.classList.contains('helper-sans')).toBe(true);
		expect(container.querySelector('.error-block')).toBeNull();
		expect(container.querySelector('.mono-kicker')).toBeNull();
	});

	test('helper (mono) composes MonoKicker with case-preserved text + caption tone', () => {
		const { container } = render(Input, { label: 'X', helperText: 'READ-ONLY', helperMode: 'mono' });
		const kicker = container.querySelector('.mono-kicker');
		expect(kicker).not.toBeNull();
		expect(kicker?.textContent).toBe('READ-ONLY');
		expect(kicker?.classList.contains('caption')).toBe(true);
		expect(container.querySelector('.helper-sans')).toBeNull();
	});

	test('error renders the block, the ERROR kicker, the message, and aria-invalid', () => {
		const { container } = render(Input, { label: 'Email', errorText: 'Incorrect email or password.' });
		const block = container.querySelector('.error-block');
		expect(block).not.toBeNull();
		expect(block?.querySelector('.mono-kicker')?.textContent).toBe('ERROR');
		expect(block?.querySelector('.error-message')?.textContent).toContain('Incorrect email or password.');
		expect(container.querySelector('input.field')?.getAttribute('aria-invalid')).toBe('true');
	});

	test('errorText takes precedence over helperText (only one block renders)', () => {
		const { container } = render(Input, { label: 'Email', errorText: 'X', helperText: 'Y' });
		expect(container.querySelector('.error-block')).not.toBeNull();
		expect(container.querySelector('.helper')).toBeNull();
		expect(container.textContent).not.toContain('Y');
	});

	test('aria-describedby points at the error block id', () => {
		const { container } = render(Input, { label: 'Email', errorText: 'Bad' });
		const input = container.querySelector('input.field')!;
		const block = container.querySelector('.error-block')!;
		expect(block.getAttribute('id')).toBeTruthy();
		expect(input.getAttribute('aria-describedby')).toBe(block.getAttribute('id'));
	});

	test('aria-describedby points at the helper block id', () => {
		const { container } = render(Input, { label: 'Email', helperText: 'Hint' });
		const input = container.querySelector('input.field')!;
		const helper = container.querySelector('.helper')!;
		expect(helper.getAttribute('id')).toBeTruthy();
		expect(input.getAttribute('aria-describedby')).toBe(helper.getAttribute('id'));
	});

	test('aria-describedby and aria-invalid are absent with neither helper nor error', () => {
		const { container } = render(Input, { label: 'Email' });
		const input = container.querySelector('input.field')!;
		expect(input.hasAttribute('aria-describedby')).toBe(false);
		expect(input.hasAttribute('aria-invalid')).toBe(false);
	});

	test('a caller class merges onto the .input-field root', () => {
		const { container } = render(Input, { label: 'X', class: 'mt-4' });
		expect(container.querySelector('.input-field')?.classList.contains('mt-4')).toBe(true);
	});

	test('rest props (e.g. name) pass through to the input', () => {
		const { container } = render(Input, { label: 'Email', name: 'email' });
		expect(container.querySelector('input.field')?.getAttribute('name')).toBe('email');
	});
});
