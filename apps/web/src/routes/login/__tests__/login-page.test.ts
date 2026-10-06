import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import LoginPage from '../+page.svelte';

// Resolved in two steps on purpose: a literal `new URL('../+page.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects. Converting
// import.meta.url first keeps this a plain filesystem read.
const pageSource = join(dirname(fileURLToPath(import.meta.url)), '../+page.svelte');

// This file lives in __tests__/ rather than beside the route as +page.test.ts:
// that filename is picked up by svelte-kit sync as a route file and breaks it
// (Epic 01 A.4 lost a test to it). A subdirectory holding no +page.* declares
// no route.
//
// jsdom does no layout and does not compute Svelte scoped <style>, so the 440px
// column, the 64px wordmark, the 48/56px heights, the 2px rules, the ::after
// underline, the focus double-rule and the hover inversion are visual-check
// items — asserting them here would pass vacuously (getComputedStyle returns
// empty). What IS testable: structure, the form contract, the copy, and — for
// the palette/no-chrome ACs — the route source itself (second describe).
describe('/login page', () => {
	const errorForm = { error: 'Invalid email or password', email: 'luigi@pharosgraph.com' };

	test('renders no error block when the action returned nothing', () => {
		const { container } = render(LoginPage, { form: null });
		expect(container.querySelector('.error-block')).toBeNull();
	});

	test('renders the form-level error block with role="alert" when the action failed', () => {
		const { container } = render(LoginPage, { form: errorForm });
		const block = container.querySelector('.error-block');
		expect(block).not.toBeNull();
		expect(block?.getAttribute('role')).toBe('alert');
		expect(block?.querySelector('.error-message')?.textContent).toBe('Invalid email or password');
	});

	// This pins the ROUTE's own error block only. The matching guard on the B.7
	// primitive's internal block lives in Input.test.ts — the login page never passes
	// errorText, so Input.svelte's block renders in no test in this file.
	// Text is author-cased; .mono-kicker uppercases in CSS.
	test('the Error kicker is a MonoKicker at the ribbon size', () => {
		const { container } = render(LoginPage, { form: errorForm });
		const kicker = container.querySelector('.error-block .mono-kicker');
		expect(kicker?.textContent).toBe('Error');
		expect(kicker?.classList.contains('ribbon')).toBe(true);
		expect(kicker?.classList.contains('sm')).toBe(false);
	});

	test('the email value is repopulated from the failed submission', () => {
		const { container } = render(LoginPage, { form: errorForm });
		const email = container.querySelector<HTMLInputElement>('input[name="email"]');
		expect(email?.value).toBe('luigi@pharosgraph.com');
	});

	// Regression guard on AC1: the rebuild is visual only — the POST contract the
	// untouched +page.server.ts reads must survive it.
	test('keeps the POST form contract the server action reads', () => {
		const { container } = render(LoginPage, { form: null });
		const form = container.querySelector('form');
		expect(form?.getAttribute('method')?.toUpperCase()).toBe('POST');

		const email = form?.querySelector('input[name="email"][type="email"][required]');
		expect(email).not.toBeNull();
		expect(email?.getAttribute('autocomplete')).toBe('email');
		expect(email?.getAttribute('placeholder')).toBe('you@example.com');

		const password = form?.querySelector('input[name="password"][type="password"][required]');
		expect(password).not.toBeNull();
		expect(password?.getAttribute('autocomplete')).toBe('current-password');

		const submit = form?.querySelector('button[type="submit"]');
		expect(submit?.textContent?.trim()).toBe('Sign In');
	});

	// Both fields are labeled by the B.7 Input, and neither carries a field-level
	// error — the message renders once, above the fields (AC7). Labels are
	// author-cased in markup; Input's .label uppercases them in CSS.
	test('labels both fields and never duplicates the error under them', () => {
		const { container } = render(LoginPage, { form: errorForm });
		const labels = [...container.querySelectorAll('label')].map((l) => l.textContent);
		expect(labels).toEqual(['Email', 'Password']);
		expect(container.querySelectorAll('.error-block')).toHaveLength(1);
		expect(container.querySelectorAll('.error-message')).toHaveLength(1);
	});

	test('renders the kicker, wordmark, deck and helper copy', () => {
		const { container } = render(LoginPage, { form: null });
		const text = container.textContent ?? '';
		expect(text).toContain('Cuatro Library · Est. 2026');
		expect(text).toContain('A private catalog of the books you already own.');
		expect(text).toContain('Accounts are invitation-only. Contact the administrator for access.');

		const lines = [...container.querySelectorAll('h1 .line')].map((l) => l.textContent?.trim());
		expect(lines).toEqual(['Cuatro', 'Library']);
	});

	test('the floor ribbon carries the copy and the only link on the page', () => {
		const { container } = render(LoginPage, { form: null });
		const floor = container.querySelector('.floor');
		expect(floor?.textContent).toContain('Cuatro Library');
		expect(floor?.textContent).toContain('© 2026');

		const admin = floor?.querySelector('a[href="/admin"]');
		expect(admin?.textContent).toBe('Admin');
		expect(container.querySelectorAll('a')).toHaveLength(1);

		// Separators are decorative — the B.1/B.3 convention.
		const seps = [...(floor?.querySelectorAll('[aria-hidden="true"]') ?? [])];
		expect(seps).toHaveLength(2);
		for (const sep of seps) expect(sep.textContent).toBe('·');
	});

	// Negative: a presence-only suite stays green through a shadcn relapse.
	test('renders no shadcn/off-system chrome classes', () => {
		const { container } = render(LoginPage, { form: errorForm });
		const offSystem = [...container.querySelectorAll('*')].filter((el) =>
			/rounded-|shadow-|bg-muted|destructive/.test(el.getAttribute('class') ?? '')
		);
		expect(offSystem).toHaveLength(0);
	});
});

// The jsdom substitute for the missing visual-verification harness: the only
// thing in the repo that goes red when someone reintroduces a shadow, a rounded
// corner, red, or a shadcn import on this screen.
describe('/login source guard', () => {
	// Comments are stripped first — the prose names the forbidden colors and would
	// false-red the scans on their own rationale.
	// The line-comment strip is anchored to the start of a line: an unanchored
	// /\/\/[^\n]*/g also eats the tail of any line holding a `//` in real content
	// (an href="https://…", a url(//cdn…)), which would silently blank that line
	// for every scan below and make the whole guard pass vacuously.
	const src = readFileSync(pageSource, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
		.replace(/<!--[\s\S]*?-->/g, ' ') // <!-- html -->
		.replace(/^\s*\/\/[^\n]*/gm, ' '); // // line

	test('no hex literals', () => {
		expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
	});

	// Gradients are in here because AC10 requires "zero gradients" and nothing else
	// checks for one: a linear-gradient() built entirely from allowed var() tokens
	// passes the hex, named-color and allowlist scans untouched.
	test('no color functions and no gradients', () => {
		expect(
			src.match(
				/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|(linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient)\s*\(/gi
			)
		).toBeNull();
	});

	// The (?<![\w-]) / (?![\w-]) fences keep --wired-black from tripping "black".
	test('no chromatic named colors', () => {
		expect(
			src.match(
				/(?<![\w-])(red|green|blue|orange|yellow|purple|pink|gray|grey|black|white|cyan|magenta|teal|navy|olive|maroon|silver|gold|crimson|hotpink)(?![\w-])/gi
			)
		).toBeNull();
	});

	// Derived from tokens.css rather than hand-copied: a hardcoded subset false-reds
	// the legitimate --space-1/4/12/40/48 the design system already defines, and a
	// false red is what gets a guard deleted rather than fixed. "In-system" is
	// exactly "defined in tokens.css", so that file is the right source of truth.
	test('every var(--…) names a token defined in tokens.css', () => {
		const tokensCss = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '../../../lib/tokens.css'),
			'utf8'
		);
		const defined = [...tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]);
		expect(defined.length).toBeGreaterThan(0);

		const used = [...src.matchAll(/var\(\s*(--[\w-]+)/gi)].map((m) => m[1]);
		// Guard the guard: an off-palette rewrite that empties the scan must fail,
		// not pass vacuously.
		expect(used.length).toBeGreaterThan(0);
		for (const t of used) expect(defined).toContain(t);
	});

	// text-shadow / drop-shadow() / transition-property are the synonyms the original
	// three regexes missed — each re-admits exactly what DESIGN.md §6/§7 forbids.
	// The radius scan stops at ; or } so a final declaration with no trailing
	// semicolon can't slip past.
	test('flat by religion: no shadow, no radius other than 0, no transition: all', () => {
		expect(src.match(/box-shadow|text-shadow|drop-shadow\s*\(/gi)).toBeNull();
		const radii = [...src.matchAll(/border-radius\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim());
		for (const r of radii) expect(r).toBe('0');
		expect(src.match(/transition(-property)?\s*:\s*all/gi)).toBeNull();
	});

	// B.0 progress guard: this route dropped its four shadcn imports and must not
	// grow them back (7 importer files → 6).
	test('imports nothing from $lib/components/ui', () => {
		expect(src.match(/\$lib\/components\/ui/g)).toBeNull();
	});

	test('carries no dark: variant and no off-system utility classes', () => {
		expect(src.match(/\bdark:/g)).toBeNull();
		expect(src.match(/rounded-|shadow-|bg-muted|destructive/g)).toBeNull();
	});
});
