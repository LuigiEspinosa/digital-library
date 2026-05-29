import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import UtilityBar from '../UtilityBar.svelte';
import UtilityBarHarness from './UtilityBarHarness.svelte';

describe('UtilityBar', () => {
	test('renders all breadcrumb segments in array order', () => {
		const breadcrumb = ['Cuatro Library', 'Libraries', 'Sci-Fi'];
		const { container } = render(UtilityBar, { breadcrumb });

		const crumbs = [...container.querySelectorAll('.crumb')].map((el) => el.textContent);
		expect(crumbs).toEqual(breadcrumb);
	});

	test('puts a · separator between segments (count === segments - 1)', () => {
		const breadcrumb = ['Cuatro Library', 'Libraries', 'Sci-Fi'];
		const { container } = render(UtilityBar, { breadcrumb });

		const seps = [...container.querySelectorAll('[aria-hidden="true"]')];
		expect(seps.length).toBe(breadcrumb.length - 1);
		expect(seps.every((s) => s.textContent === '·')).toBe(true);
	});

	test('a single-segment breadcrumb renders no separators', () => {
		const { container } = render(UtilityBar, { breadcrumb: ['Cuatro Library'] });
		expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
	});

	test('renders rightSlot content into the right region', () => {
		const { container } = render(UtilityBarHarness, { breadcrumb: ['Cuatro Library'] });

		const links = [...container.querySelectorAll('.utility-right a')];
		expect(links.length).toBe(2);
		expect(links.map((a) => a.textContent?.trim())).toEqual(['Settings', 'Log out']);
	});
});
