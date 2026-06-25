import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AppNav from '../AppNav.svelte';
import AppNavHarness from './AppNavHarness.svelte';

describe('AppNav', () => {
	test('renders the wordmark with the text CUATRO LIBRARY', () => {
		const { container } = render(AppNav);
		const wordmark = container.querySelector('.wordmark');
		expect(wordmark?.textContent).toBe('CUATRO LIBRARY');
	});

	test('wordmark is an anchor linking to the library-picker landing (/)', () => {
		const { container } = render(AppNav);
		const wordmark = container.querySelector('a.wordmark');
		expect(wordmark).not.toBeNull();
		expect(wordmark?.getAttribute('href')).toBe('/');
	});

	test('renders rightSlot content into the right region', () => {
		const { container } = render(AppNavHarness);

		const buttons = [...container.querySelectorAll('.app-nav-right button')];
		expect(buttons.length).toBe(2);
		expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Search', 'Account']);
	});
});
