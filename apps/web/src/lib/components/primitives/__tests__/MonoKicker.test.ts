import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MonoKicker from '../MonoKicker.svelte';
import MonoKickerHarness from './MonoKickerHarness.svelte';

// jsdom does no layout and does not compute scoped <style>, so we assert the
// size/tone -> class mapping (the testable proxy for "computed styles match the
// variant") and DOM case preservation (the proxy for "text-transform: uppercase
// is applied") — never computed text-transform/font-size/letter-spacing/color,
// which jsdom returns empty and gives false greens/reds (the B.4 trap). The real
// §3 caps/px/fills are a visual-check item.
describe('MonoKicker', () => {
	test('defaults to a <span> carrying the "md" and "ink" classes', () => {
		const { container } = render(MonoKicker);
		const el = container.querySelector('.mono-kicker');
		expect(el?.tagName).toBe('SPAN');
		expect(el?.classList.contains('md')).toBe(true);
		expect(el?.classList.contains('ink')).toBe(true);
	});

	// Explicit md/ink (not only via the default render) proves the variant->class
	// mapping is real rather than the default leaking through. Each variant test
	// also asserts the *other* size/tone classes are absent, so a default-leak
	// refactor (e.g. class="mono-kicker md {size}") can't ride along undetected.
	test('size="md" carries the md class and no other size class', () => {
		const { container } = render(MonoKicker, { size: 'md' });
		const el = container.querySelector('.mono-kicker');
		expect(el?.classList.contains('md')).toBe(true);
		expect(el?.classList.contains('sm')).toBe(false);
		expect(el?.classList.contains('ribbon')).toBe(false);
	});

	test('size="sm" carries the sm class and not md', () => {
		const { container } = render(MonoKicker, { size: 'sm' });
		const el = container.querySelector('.mono-kicker');
		expect(el?.classList.contains('sm')).toBe(true);
		expect(el?.classList.contains('md')).toBe(false);
	});

	test('size="ribbon" carries the ribbon class and not md', () => {
		const { container } = render(MonoKicker, { size: 'ribbon' });
		const el = container.querySelector('.mono-kicker');
		expect(el?.classList.contains('ribbon')).toBe(true);
		expect(el?.classList.contains('md')).toBe(false);
	});

	test('tone="ink" carries the ink class and no other tone class', () => {
		const { container } = render(MonoKicker, { tone: 'ink' });
		const el = container.querySelector('.mono-kicker');
		expect(el?.classList.contains('ink')).toBe(true);
		expect(el?.classList.contains('caption')).toBe(false);
		expect(el?.classList.contains('paper')).toBe(false);
	});

	test('tone="caption" carries the caption class and not ink', () => {
		const { container } = render(MonoKicker, { tone: 'caption' });
		const el = container.querySelector('.mono-kicker');
		expect(el?.classList.contains('caption')).toBe(true);
		expect(el?.classList.contains('ink')).toBe(false);
	});

	test('tone="paper" carries the paper class and not ink', () => {
		const { container } = render(MonoKicker, { tone: 'paper' });
		const el = container.querySelector('.mono-kicker');
		expect(el?.classList.contains('paper')).toBe(true);
		expect(el?.classList.contains('ink')).toBe(false);
	});

	// AC7 — the reason this primitive exists: uppercasing is CSS-only, so the DOM
	// text node keeps the author's original casing for screen readers. The harness
	// fixture is intentionally MIXED case ("3 Hours Ago") so this fails for any JS
	// case transform — .toUpperCase() ("3 HOURS AGO") OR .toLowerCase() ("3 hours
	// ago") — not only uppercasing.
	test('preserves original DOM casing (CSS-only uppercase, not JS)', () => {
		const { container } = render(MonoKickerHarness);
		expect(container.querySelector('.mono-kicker')?.textContent).toBe('3 Hours Ago');
	});
});
