import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import StatusTagHarness from './StatusTagHarness.svelte';

// Resolved in two steps on purpose: a literal `new URL('../StatusTag.svelte',
// import.meta.url)` is Vite's asset-URL pattern and gets rewritten to an
// http://localhost asset path, which fileURLToPath then rejects. Converting
// import.meta.url first keeps this a plain filesystem read.
const componentSource = join(dirname(fileURLToPath(import.meta.url)), '../StatusTag.svelte');

// jsdom does no layout and does not compute scoped <style>, so the 2px border, the
// 22px box, the inversion, the hatch and the 10% ink wash are visual-check items —
// never asserted here (getComputedStyle returns empty → false greens/reds). What IS
// testable: class mapping (proxy for styling), element structure, label text, the
// INLINE fill width, and — for the palette AC — the component source itself.
describe('StatusTag', () => {
	test('defaults: a <span class="status-tag"> carrying the default variant', () => {
		const { container } = render(StatusTagHarness);
		const el = container.querySelector('.status-tag');
		expect(el?.tagName).toBe('SPAN');
		expect(el?.classList.contains('default')).toBe(true);
	});

	test('variant="inverted" maps to the inverted class, not default', () => {
		const { container } = render(StatusTagHarness, { variant: 'inverted' });
		const el = container.querySelector('.status-tag');
		expect(el?.classList.contains('inverted')).toBe(true);
		expect(el?.classList.contains('default')).toBe(false);
	});

	test('variant="muted" maps to the muted class, not default', () => {
		const { container } = render(StatusTagHarness, { variant: 'muted' });
		const el = container.querySelector('.status-tag');
		expect(el?.classList.contains('muted')).toBe(true);
		expect(el?.classList.contains('default')).toBe(false);
	});

	test('variant="striped" maps to the striped class, not default', () => {
		const { container } = render(StatusTagHarness, { variant: 'striped' });
		const el = container.querySelector('.status-tag');
		expect(el?.classList.contains('striped')).toBe(true);
		expect(el?.classList.contains('default')).toBe(false);
	});

	test('explicit variant="default" maps to the default class (not just the implicit default)', () => {
		const { container } = render(StatusTagHarness, { variant: 'default' });
		expect(container.querySelector('.status-tag')?.classList.contains('default')).toBe(true);
	});

	test('.label is present on every render and preserves the authored case', () => {
		const { container } = render(StatusTagHarness);
		const label = container.querySelector('.status-tag .label');
		// CSS does the shouting — the DOM keeps "Uploading" so a screen reader does
		// not announce the caps.
		expect(label?.textContent).toContain('Uploading · 62%');
	});

	test('.label is present even with a progress fill', () => {
		const { container } = render(StatusTagHarness, { progress: 62 });
		expect(container.querySelector('.status-tag .label')).not.toBeNull();
	});

	test('no progress prop renders no .fill', () => {
		const { container } = render(StatusTagHarness);
		expect(container.querySelector('.fill')).toBeNull();
	});

	test('progress renders a .fill at that width', () => {
		const { container } = render(StatusTagHarness, { progress: 62 });
		const fill = container.querySelector('.fill') as HTMLElement | null;
		expect(fill).not.toBeNull();
		expect(fill!.style.width).toBe('62%');
	});

	// The falsy-zero trap: `{#if progress}` would drop the fill for a queued-at-0%
	// tag. This test fails loudly if anyone writes it that way.
	test('progress={0} still renders a .fill, at 0%', () => {
		const { container } = render(StatusTagHarness, { progress: 0 });
		const fill = container.querySelector('.fill') as HTMLElement | null;
		expect(fill).not.toBeNull();
		expect(fill!.style.width).toBe('0%');
	});

	test('progress is clamped at both ends', () => {
		const { container: over } = render(StatusTagHarness, { progress: 140 });
		expect((over.querySelector('.fill') as HTMLElement).style.width).toBe('100%');

		const { container: under } = render(StatusTagHarness, { progress: -5 });
		expect((under.querySelector('.fill') as HTMLElement).style.width).toBe('0%');
	});

	// A non-finite progress renders NO fill — an empty stain on a 62%-done upload
	// lies; an absent one is visibly wrong. This is the deliberate narrowing of the
	// clamp contract (review 2026-07-21): the gate is Number.isFinite, not
	// !== undefined, so NaN/Infinity/"62"/true all suppress the fill.
	test('a non-finite progress renders no fill at all', () => {
		for (const bad of [NaN, Infinity, -Infinity]) {
			const { container } = render(StatusTagHarness, { progress: bad });
			expect(container.querySelector('.fill')).toBeNull();
		}
	});

	// Reactivity guard: hasProgress/pct are $derived, and a de-runing refactor to
	// plain consts (the state_referenced_locally trap Input.svelte:38 documents)
	// would still pass every mount-time assertion above. Rerender with a new
	// progress and confirm the fill width tracks it — this is the only test that
	// would go red if the derivations stopped being reactive.
	test('the fill width reacts to a progress update', async () => {
		const { container, rerender } = render(StatusTagHarness, { progress: 20 });
		expect((container.querySelector('.fill') as HTMLElement).style.width).toBe('20%');
		await rerender({ progress: 80 });
		expect((container.querySelector('.fill') as HTMLElement).style.width).toBe('80%');
	});

	test('the component never builds the percent into the label', () => {
		// progress deliberately DIFFERS from the harness label's 62%: if the
		// component interpolated pct, a "7" would leak into the text. Matching the
		// label to progress (both 62) could not tell "no interpolation" apart from
		// "interpolated the same value" — this value makes the assertion bite.
		const { container } = render(StatusTagHarness, { progress: 7 });
		expect(container.querySelector('.label')?.textContent?.trim()).toBe('Uploading · 62%');
		expect(container.querySelector('.label')?.textContent).not.toContain('7');
	});

	test('a caller class merges with the base classes instead of clobbering them', () => {
		const { container } = render(StatusTagHarness, { class: 'ml-2' });
		const el = container.querySelector('.status-tag');
		expect(el?.classList.contains('ml-2')).toBe(true);
		expect(el?.classList.contains('status-tag')).toBe(true);
		expect(el?.classList.contains('default')).toBe(true);
	});

	test('rest props pass through to the <span>', () => {
		const { container } = render(StatusTagHarness, {
			'data-testid': 'tag',
			title: 'Upload progress'
		});
		const el = container.querySelector('.status-tag');
		expect(el?.getAttribute('data-testid')).toBe('tag');
		expect(el?.getAttribute('title')).toBe('Upload progress');
	});

	// Assert the negatives so a default-leak refactor can't pass silently (B.5/B.6/B.8).
	test('defaults do not leak: no other variant class and no fill', () => {
		const { container } = render(StatusTagHarness);
		const el = container.querySelector('.status-tag')!;
		expect(el.classList.contains('inverted')).toBe(false);
		expect(el.classList.contains('muted')).toBe(false);
		expect(el.classList.contains('striped')).toBe(false);
		expect(container.querySelector('.fill')).toBeNull();
	});

	// The epic AC says "component tests assert no off-palette color". jsdom cannot
	// compute the scoped <style>, so the guard reads the source instead: deterministic,
	// fast, and red the instant someone reaches for #e53e3e, rgba(…), red, or --link-blue.
	test('never introduces a color outside the palette', () => {
		const raw = readFileSync(componentSource, 'utf8');
		// Strip comments FIRST — the prose explains the palette ("never green",
		// "NOT paper-white"), so the checks must see only real code or they'd
		// false-red on their own rationale.
		const src = raw
			.replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
			.replace(/<!--[\s\S]*?-->/g, ' ') // <!-- html -->
			.replace(/\/\/[^\n]*/g, ' '); // // line

		// (1) No hex literals.
		expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();

		// (2) No color functions. rgb/hsl/etc. carry no `#` and no `var(`, so the
		// hex and token checks alone would wave them through — the exact refactor
		// this component avoided (10%-ink via opacity, not rgba()) is the one that
		// must stay caught.
		expect(
			src.match(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/gi)
		).toBeNull();

		// (3) No chromatic named colors. The (?<![\w-]) / (?![\w-]) fences keep
		// `--paper-white`/`--wired-black` from tripping "white"/"black". Colorless
		// keywords (transparent/inherit/currentcolor/none) are deliberately absent —
		// the component legitimately uses `background: transparent`.
		expect(
			src.match(/(?<![\w-])(red|green|blue|orange|yellow|purple|pink|gray|grey|black|white|cyan|magenta|teal|navy|olive|maroon|silver|gold|crimson|hotpink)(?![\w-])/gi)
		).toBeNull();

		// (4) Every var(--…) — including the var(--x, fallback) form the old
		// `\)`-anchored regex missed — must name an allowed token.
		const tokens = [...src.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
		// Guard the guard: if the token scan matches nothing the for-loop is vacuous
		// and this test passes green over an all-off-palette rewrite.
		expect(tokens.length).toBeGreaterThan(0);
		const allowed = ['--page-ink', '--paper-white', '--caption-gray', '--hairline-tint', '--font-mono'];
		for (const t of tokens) expect(allowed).toContain(t);
	});
});
