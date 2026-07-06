import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EditorialTableHarness from './EditorialTableHarness.svelte';

// jsdom does no layout and does not compute scoped or :global <style>, so the
// 2px/1px cell borders, the ribbon-mono header type, the :last-child closer, the
// warm/strict :hover fill and the dense padding are all visual-check items — never
// asserted here (getComputedStyle returns empty → false greens/reds). What IS
// testable: the semantic table frame, the caller-authored head/body slot content,
// the dense/row-hover-strict class hooks, class merge and rest passthrough.
describe('EditorialTable', () => {
	test('renders a single semantic table.editorial-table with one thead and one tbody', () => {
		const { container } = render(EditorialTableHarness);
		expect(container.querySelectorAll('table.editorial-table').length).toBe(1);
		expect(container.querySelectorAll('thead').length).toBe(1);
		expect(container.querySelectorAll('tbody').length).toBe(1);
	});

	test('renders the caller-authored header cells with case preserved in the DOM', () => {
		const { container } = render(EditorialTableHarness);
		const ths = container.querySelectorAll('thead th');
		expect(ths.length).toBe(2);
		expect(ths[0].textContent).toContain('Name');
		expect(ths[1].textContent).toContain('Created');
	});

	test('renders the caller-authored body rows and cells', () => {
		const { container } = render(EditorialTableHarness);
		expect(container.querySelectorAll('tbody tr').length).toBe(3);
		expect(container.querySelectorAll('tbody td').length).toBe(6);
		expect(container.querySelector('tbody tr')?.textContent).toContain('The Garage Shelf');
	});

	test('dense=true adds the dense class hook', () => {
		const { container } = render(EditorialTableHarness, { dense: true });
		expect(container.querySelector('table.editorial-table')?.classList.contains('dense')).toBe(true);
	});

	test('default render carries no dense class', () => {
		const { container } = render(EditorialTableHarness);
		expect(container.querySelector('table.editorial-table')?.classList.contains('dense')).toBe(false);
	});

	test("rowHover='strict' adds the row-hover-strict class hook", () => {
		const { container } = render(EditorialTableHarness, { rowHover: 'strict' });
		expect(
			container.querySelector('table.editorial-table')?.classList.contains('row-hover-strict')
		).toBe(true);
	});

	test("rowHover='warm' and the default add no row-hover-strict class (warm is class-less by design)", () => {
		const { container: warm } = render(EditorialTableHarness, { rowHover: 'warm' });
		expect(
			warm.querySelector('table.editorial-table')?.classList.contains('row-hover-strict')
		).toBe(false);
		const { container: def } = render(EditorialTableHarness);
		expect(
			def.querySelector('table.editorial-table')?.classList.contains('row-hover-strict')
		).toBe(false);
	});

	test('a caller class merges with editorial-table instead of clobbering it', () => {
		const { container } = render(EditorialTableHarness, { class: 'mt-4' });
		const el = container.querySelector('table');
		expect(el?.classList.contains('mt-4')).toBe(true);
		expect(el?.classList.contains('editorial-table')).toBe(true);
	});

	test('rest props (aria-label, data-testid) pass through to the table', () => {
		const { container } = render(EditorialTableHarness, {
			'aria-label': 'Libraries',
			'data-testid': 'tbl'
		});
		const el = container.querySelector('table.editorial-table');
		expect(el?.getAttribute('aria-label')).toBe('Libraries');
		expect(el?.getAttribute('data-testid')).toBe('tbl');
	});

	test('defaults do not leak: a bare render has neither dense nor row-hover-strict', () => {
		const { container } = render(EditorialTableHarness);
		const el = container.querySelector('table.editorial-table');
		expect(el?.classList.contains('dense')).toBe(false);
		expect(el?.classList.contains('row-hover-strict')).toBe(false);
	});
});
