import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import HardRule from '../HardRule.svelte';
import HardRuleHarness from './HardRuleHarness.svelte';

// jsdom does no layout and does not compute scoped <style>, so we assert the
// weight->element+class mapping (the testable proxy) — never computed
// width/height/color/font. The actual §6 pixels/fills are a visual-check item.
describe('HardRule', () => {
	test('default weight is an <hr> carrying the "rule" class', () => {
		const { container } = render(HardRule);
		const el = container.querySelector('.hard-rule');
		expect(el?.tagName).toBe('HR');
		expect(el?.classList.contains('rule')).toBe(true);
	});

	test('weight="hairline" renders an <hr> with the hairline class', () => {
		const { container } = render(HardRule, { weight: 'hairline' });
		const el = container.querySelector('.hard-rule');
		expect(el?.tagName).toBe('HR');
		expect(el?.classList.contains('hairline')).toBe(true);
	});

	test('weight="bracket" renders an <hr> with the bracket class', () => {
		const { container } = render(HardRule, { weight: 'bracket' });
		const el = container.querySelector('.hard-rule');
		expect(el?.tagName).toBe('HR');
		expect(el?.classList.contains('bracket')).toBe(true);
	});

	test('non-ribbon weights expose no role or aria-label, even when ariaLabel is passed', () => {
		const { container } = render(HardRule, { weight: 'rule', ariaLabel: 'ignored' });
		const el = container.querySelector('.hard-rule');
		expect(el?.tagName).toBe('HR');
		expect(el?.hasAttribute('role')).toBe(false);
		expect(el?.hasAttribute('aria-label')).toBe(false);
	});

	test('weight="ribbon" renders a <div role="separator"> with aria-label, not an <hr>', () => {
		const { container } = render(HardRule, { weight: 'ribbon', ariaLabel: 'Most Popular' });
		const el = container.querySelector('.hard-rule');
		expect(el?.tagName).toBe('DIV');
		expect(el?.getAttribute('role')).toBe('separator');
		expect(el?.getAttribute('aria-label')).toBe('Most Popular');
	});

	test('ribbon with no ariaLabel emits no aria-label attribute', () => {
		const { container } = render(HardRule, { weight: 'ribbon' });
		const el = container.querySelector('.hard-rule');
		expect(el?.tagName).toBe('DIV');
		expect(el?.hasAttribute('aria-label')).toBe(false);
	});

	test('ribbon renders its slotted label text inside .ribbon-text', () => {
		const { container } = render(HardRuleHarness);
		expect(container.querySelector('.ribbon-text')?.textContent).toBe('Most Popular');
	});
});
