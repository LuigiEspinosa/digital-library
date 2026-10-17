import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import UtilityBar from '../UtilityBar.svelte';
import UtilityBarHarness from './UtilityBarHarness.svelte';

// Two-step resolution: a literal new URL('../UtilityBar.svelte', import.meta.url)
// is Vite's asset-URL pattern and gets rewritten to an http:// path.
const componentSource = join(dirname(fileURLToPath(import.meta.url)), '../UtilityBar.svelte');

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

	// Truncation is a visual measure only: the ellipsis is painted by CSS, so the
	// full name must still reach the DOM for a screen reader to announce it.
	test('a very long segment still reaches the DOM in full', () => {
		const long =
			'The Complete Annotated Reference Shelf Of Extremely Long Library Names And Other Curiosities';
		const { container } = render(UtilityBar, {
			breadcrumb: ['Cuatro Library', 'Libraries', long]
		});

		const crumbs = [...container.querySelectorAll('.crumb')].map((el) => el.textContent);
		expect(crumbs.at(-1)).toBe(long);
	});

	test('renders rightSlot content into the right region', () => {
		const { container } = render(UtilityBarHarness, { breadcrumb: ['Cuatro Library'] });

		const links = [...container.querySelectorAll('.utility-right a')];
		expect(links.length).toBe(2);
		expect(links.map((a) => a.textContent?.trim())).toEqual(['Settings', 'Log out']);
	});

	test('accepts a mixed span / anchor / form-button right slot', () => {
		const { container } = render(UtilityBarHarness, {
			breadcrumb: ['Cuatro Library', 'Libraries'],
			session: true
		});

		const right = container.querySelector('.utility-right');
		const children = [...(right?.children ?? [])].map((el) => el.tagName.toLowerCase());
		expect(children).toEqual(['span', 'a', 'form']);

		expect(right?.querySelector('span')?.textContent).toBe('luigi@pharosgraph.com');
		expect(right?.querySelector('a[href="/admin/libraries"]')?.textContent).toBe('Admin');

		const form = right?.querySelector('form[action="/logout"]');
		expect(form?.getAttribute('method')?.toUpperCase()).toBe('POST');
		expect(form?.querySelector('button[type="submit"]')?.textContent).toBe('Sign out');
	});
});

// jsdom computes no Svelte scoped <style> and cannot see a ::before at all, so the
// divider is asserted on the component SOURCE. Without this, the selector fix is
// pinned by nothing and a revert leaves the whole suite green — the exact trap
// that swallowed the C.1 Input.svelte edit.
describe('UtilityBar divider source guard', () => {
	// Comments are stripped first: the rationale comment in the component names the
	// old `a + a` selector, and would false-red the scan on its own explanation.
	const src = readFileSync(componentSource, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/^\s*\/\/[^\n]*/gm, ' ');

	// Story 8.2: the bar is the page ground on a hairline; items are set apart by the
	// sibling gap, so no divider pseudo-element (and no alpha rule) remains.
	test('items are separated by the sibling gap, not a divider', () => {
		expect(src).toMatch(/\.utility-right\s*\{[^}]*gap:\s*var\(--s-lg\)/);
		expect(src.match(/::before|rgba\(/g)).toBeNull();
		expect(src).toMatch(/\.utility-bar\s*\{[^}]*border-bottom:\s*var\(--stroke-hair\) solid var\(--token-border\)/);
		expect(src.match(/\.utility-bar\s*\{[^}]*background/)).toBeNull();
	});

	test('the item layout rule targets every direct child of the right region', () => {
		expect(src).toMatch(/\.utility-right\s*>\s*:global\(\s*\*\s*\)\s*\{/);
	});

	test('hover recolor stays scoped to interactive children', () => {
		expect(src).toMatch(/:global\(\s*a:hover\s*\)/);
		expect(src).toMatch(/:global\(\s*button:hover\s*\)/);
		// A blanket `> * :hover` would light up the email span under the cursor.
		expect(src.match(/\.utility-right\s*>\s*:global\(\s*\*\s*\):hover/)).toBeNull();
	});

	test('a slotted submit button is reset to look like the other items', () => {
		const buttonRule = src.match(/\.utility-right\s*:global\(\s*button\s*\)\s*\{([^}]*)\}/)?.[1];
		expect(buttonRule).toBeTruthy();
		expect(buttonRule).toMatch(/border\s*:\s*0/);
		expect(buttonRule).toMatch(/background\s*:\s*none/);
		expect(buttonRule).toMatch(/font\s*:\s*inherit/);
		expect(buttonRule).toMatch(/cursor\s*:\s*pointer/);
		// The button centers itself rather than resolving height: 100% against a UA
		// inline-block box — the flex centering on the item rule lands on the <form>.
		expect(buttonRule).toMatch(/display\s*:\s*inline-flex/);
		expect(buttonRule).toMatch(/align-items\s*:\s*center/);
	});

	// The --tap box sits on the control itself, so the sign-out button inside its <form>
	// is as large a target as the Admin link beside it.
	test('every slotted control carries the --tap box on both axes', () => {
		const rule = src.match(/\.utility-right\s*:global\(\s*a\s*\),\s*\.utility-right\s*:global\(\s*button\s*\)\s*\{([^}]*)\}/)?.[1];
		expect(rule).toBeTruthy();
		expect(rule).toMatch(/min-height:\s*var\(--tap\)/);
		expect(rule).toMatch(/min-width:\s*var\(--tap\)/);
	});

	// C.3 puts the first USER-SUPPLIED segment in the breadcrumb (a library name).
	// jsdom paints no ellipsis, so these four rules are pinned on the source or a
	// revert leaves the whole suite green — the C.1/C.2 trap, third time around.
	test('a long crumb ellipsizes instead of compressing the session strip', () => {
		const crumbRule = src.match(/\.utility-left\s+\.crumb\s*\{([^}]*)\}/)?.[1];
		expect(crumbRule).toBeTruthy();
		expect(crumbRule).toMatch(/text-overflow:\s*ellipsis/);
		expect(crumbRule).toMatch(/overflow:\s*hidden/);
		expect(crumbRule).toMatch(/white-space:\s*nowrap/);
		expect(crumbRule).toMatch(/min-width:\s*0/);

		// The crumb can only shrink if its container clips and the separators do not.
		expect(src).toMatch(/\.utility-left\s*\{[^}]*overflow:\s*hidden/);
		expect(src).toMatch(/\.utility-left\s+\.sep\s*\{[^}]*flex:\s*0\s+0\s+auto/);
	});

	test('the session strip refuses to shrink', () => {
		expect(src).toMatch(/\.utility-right\s*\{[^}]*flex-shrink:\s*0/);
	});
});
