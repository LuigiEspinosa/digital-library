import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Button from '../Button.svelte';
import ButtonHarness from './ButtonHarness.svelte';

// jsdom does no layout and does not compute scoped <style>, so the variant/size
// styling, hover color-swap, 2px border, focus outline and disabled gray are
// visual-check items — never asserted here (getComputedStyle returns empty →
// false greens/reds). What IS testable: class mapping (proxy for styling) plus
// element type, attributes and click behavior.
describe('Button', () => {
	test('defaults: <button> carrying primary + md, type="button"', () => {
		const { container } = render(Button);
		const el = container.querySelector('.btn');
		expect(el?.tagName).toBe('BUTTON');
		expect(el?.classList.contains('primary')).toBe(true);
		expect(el?.classList.contains('md')).toBe(true);
		expect(el?.getAttribute('type')).toBe('button');
	});

	test('variant="inverted" maps to the inverted class, not primary', () => {
		const { container } = render(Button, { variant: 'inverted' });
		const el = container.querySelector('.btn');
		expect(el?.classList.contains('inverted')).toBe(true);
		expect(el?.classList.contains('primary')).toBe(false);
	});

	test('variant="tertiary" maps to the tertiary class', () => {
		const { container } = render(Button, { variant: 'tertiary' });
		expect(container.querySelector('.btn')?.classList.contains('tertiary')).toBe(true);
	});

	test('explicit variant="primary" maps to the primary class (not just the default)', () => {
		const { container } = render(Button, { variant: 'primary' });
		expect(container.querySelector('.btn')?.classList.contains('primary')).toBe(true);
	});

	test('size="sm" and size="lg" map to their classes', () => {
		const { container: sm } = render(Button, { size: 'sm' });
		expect(sm.querySelector('.btn')?.classList.contains('sm')).toBe(true);
		const { container: lg } = render(Button, { size: 'lg' });
		expect(lg.querySelector('.btn')?.classList.contains('lg')).toBe(true);
	});

	test('href renders an <a> with that href; no href renders a <button>', () => {
		const { container: withHref } = render(Button, { href: '/x' });
		const a = withHref.querySelector('.btn');
		expect(a?.tagName).toBe('A');
		expect(a?.getAttribute('href')).toBe('/x');

		const { container: noHref } = render(Button);
		expect(noHref.querySelector('.btn')?.tagName).toBe('BUTTON');
	});

	test('disabled <button> is click-blocked and carries the disabled attribute', () => {
		const onclick = vi.fn();
		const { container } = render(Button, { onclick, disabled: true });
		const btn = container.querySelector('button')!;
		btn.click();
		expect(onclick).not.toHaveBeenCalled();
		expect(btn.hasAttribute('disabled')).toBe(true);
	});

	test('enabled <button> fires its onclick exactly once', () => {
		const onclick = vi.fn();
		const { container } = render(Button, { onclick });
		container.querySelector('button')!.click();
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	test('disabled <a> drops href and gets role="link" + aria-disabled + tabindex="-1"', () => {
		const { container } = render(Button, { href: '/x', disabled: true });
		const a = container.querySelector('a')!;
		expect(a.hasAttribute('href')).toBe(false);
		expect(a.getAttribute('role')).toBe('link');
		expect(a.getAttribute('aria-disabled')).toBe('true');
		expect(a.getAttribute('tabindex')).toBe('-1');
	});

	test('enabled <a> keeps href and omits role/aria-disabled/tabindex', () => {
		const { container } = render(Button, { href: '/x' });
		const a = container.querySelector('a')!;
		expect(a.getAttribute('href')).toBe('/x');
		expect(a.hasAttribute('role')).toBe(false);
		expect(a.hasAttribute('aria-disabled')).toBe(false);
		expect(a.hasAttribute('tabindex')).toBe(false);
	});

	test('type="submit" passes through to the <button>', () => {
		const { container } = render(Button, { type: 'submit' });
		expect(container.querySelector('button')?.getAttribute('type')).toBe('submit');
	});

	test('rest props (e.g. data-testid) pass through to the rendered element', () => {
		const { container } = render(Button, { 'data-testid': 'go' });
		expect(container.querySelector('.btn')?.getAttribute('data-testid')).toBe('go');
	});

	test('a caller class merges with the base classes instead of clobbering them', () => {
		const { container } = render(Button, { class: 'mt-4' });
		const el = container.querySelector('.btn');
		expect(el?.classList.contains('mt-4')).toBe(true);
		expect(el?.classList.contains('primary')).toBe(true);
		expect(el?.classList.contains('md')).toBe(true);
	});

	test('renders its slotted label text', () => {
		const { container } = render(ButtonHarness);
		expect(container.querySelector('.btn')?.textContent).toContain('Subscribe');
	});
});
