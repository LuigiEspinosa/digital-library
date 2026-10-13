import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// cuatro-portfolio Story 8.2: the token contract adoption and the restyle floor, held on
// the source. The floor's own checks (F-1 to F-12) are measured in a browser; this file
// keeps the parts a source read can see from drifting back.
const lib = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(lib, '..');
const read = (p: string) => readFileSync(join(src, p), 'utf8');

// Every component and route a Visitor reaches through the demo sign-in, plus /login
// and the error page. /admin and the reader are below the floor.
const FLOOR = [
	'lib/components/primitives/Button.svelte',
	'lib/components/primitives/Input.svelte',
	'lib/components/primitives/MonoKicker.svelte',
	'lib/components/primitives/HardRule.svelte',
	'lib/components/primitives/RoundIconButton.svelte',
	'lib/components/primitives/FilterStrip.svelte',
	'lib/components/shell/AppNav.svelte',
	'lib/components/shell/UtilityBar.svelte',
	'lib/components/shell/Footer.svelte',
	'routes/login/+page.svelte',
	'routes/logout/+page.svelte',
	'routes/+error.svelte',
	'routes/+page.svelte',
	'routes/libraries/[id]/+page.svelte',
	'routes/libraries/[id]/books/[bookId]/+page.svelte'
];

const styleOf = (p: string) => (read(p).match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('the vendored contract', () => {
	const folder = join(lib, 'cuatro-contracts');
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [relative(folder, join(dir, n)).replace(/\\/g, '/')]));

	test('is the nine contract files under cuatro-contracts/, named exactly', () => {
		expect(files(folder).sort()).toEqual([
			'fonts.css',
			'fonts/OFL-bricolage-grotesque.txt',
			'fonts/OFL-geist-mono.txt',
			'fonts/OFL-geist.txt',
			'fonts/bricolage-grotesque-latin.woff2',
			'fonts/geist-latin.woff2',
			'fonts/geist-mono-latin.woff2',
			'tailwind.css',
			'tokens.css'
		]);
		expect(readFileSync(join(folder, 'tokens.css'), 'utf8').split('\n')[1]).toMatch(/Contract v2\.0\.0/);
	});

	test('layout.css imports the plain pair and applies the hand-fixes in order, unlayered', () => {
		const css = read('routes/layout.css');
		const at = (s: string) => css.indexOf(s);
		expect(at("@import '../lib/cuatro-contracts/tokens.css';")).toBeGreaterThan(at("@import 'tailwindcss';"));
		expect(at("@import '../lib/cuatro-contracts/fonts.css';")).toBeGreaterThan(at("@import '../lib/cuatro-contracts/tokens.css';"));
		const order = [':root {\n  color-scheme: dark;', '::selection {\n  background-color: var(--token-accent);', ':focus-visible {\n  outline: var(--stroke-focus) solid var(--token-focus);', 'button {\n  border-radius: var(--r-none);'];
		const positions = order.map(at);
		for (const p of positions) expect(p).toBeGreaterThan(at('@layer base'));
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
		expect(css).toMatch(/:focus-visible \{[^}]*outline-offset: var\(--focus-offset\);[^}]*border-radius: var\(--r-hair\);/);
	});
});

describe('the floor, read off each source', () => {
	test.each(FLOOR)('%s: no ground on a control, no shadow, no gradient, square, ring never removed', (p) => {
		const css = styleOf(p);
		for (const m of css.matchAll(/background(?:-color)?\s*:\s*([^;}]+)/g)) {
			expect(['transparent', 'none', 'var(--token-bg)'], `${p}: background ${m[1]}`).toContain(m[1].trim());
		}
		expect(css).not.toMatch(/box-shadow|gradient\(/);
		for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)) expect(['0', 'var(--r-none)']).toContain(m[1].trim());
		expect(css).not.toMatch(/outline\s*:\s*(none|0)\b/);
		expect(css).not.toMatch(/transition(-property)?\s*:\s*[^;]*\b(all|outline)\b/);
		expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/);
	});

	test('no floor source writes Tailwind palette or shadow utilities', () => {
		for (const p of FLOOR) expect(read(p), p).not.toMatch(/\b(bg|text|border)-(stone|white|black|emerald|red|amber|orange)\b|\bshadow-|\brounded-/);
	});
});
