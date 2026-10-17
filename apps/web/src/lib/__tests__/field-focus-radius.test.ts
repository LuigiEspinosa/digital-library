// @vitest-environment node
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// cuatro-portfolio RESTYLE-SPEC.md § 4 and § 9, I-11: a field's focus ring takes no radius. Read off a
// real browser's computed style, on bare fields with no rule of their own, so a field stays square
// because layout.css says so at the focused state, never because a scoped rule out-ranks the ring.
const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tokens = readFileSync(join(src, 'lib/cuatro-contracts/tokens.css'), 'utf8');
const layout = readFileSync(join(src, 'routes/layout.css'), 'utf8');
// The unlayered hand-fix rules are plain CSS; what precedes them is Tailwind's input syntax.
const handFixes = layout.slice(layout.indexOf('/* The hand-fix lines'));

// The file input is left out: whether it is a § 9 field is open (RESTYLE-SPEC.md § Open for the
// Operator, Q-2). The button is the control whose ring keeps --r-hair, so the fields' 0px is seen to
// come from the field rule and not from a ring that draws no radius at all.
const MARKUP = `
  <input id="text" type="text"><input id="search" type="search"><input id="password" type="password">
  <input id="checkbox" type="checkbox"><select id="select"><option>a</option></select>
  <textarea id="textarea"></textarea><button id="button">b</button>`;
const FIELDS = ['text', 'search', 'password', 'checkbox', 'select', 'textarea'];

test('every field is square while it holds keyboard focus, and a control keeps the ring radius (I-11)', async () => {
	expect(handFixes.startsWith('/* The hand-fix lines')).toBe(true);
	// The workstation's and the CI runner's installed Chrome; no browser is downloaded.
	const browser = await chromium.launch({ channel: 'chrome' });
	try {
		const page = await browser.newPage();
		await page.setContent(`<style>${tokens}\n${handFixes}</style>${MARKUP}`);
		const read: Record<string, { visible: boolean; radius: string }> = {};
		for (let i = 0; i < FIELDS.length + 1; i++) {
			await page.keyboard.press('Tab');
			const at = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement;
				return { id: el.id, visible: el.matches(':focus-visible'), radius: getComputedStyle(el).borderTopLeftRadius };
			});
			read[at.id] = { visible: at.visible, radius: at.radius };
		}
		for (const id of FIELDS) expect(read[id], id).toEqual({ visible: true, radius: '0px' });
		expect(read.button).toEqual({ visible: true, radius: '2px' });
	} finally {
		await browser.close();
	}
}, 30_000);
