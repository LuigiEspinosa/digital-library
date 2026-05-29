import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Footer from '../Footer.svelte';

const REPO_URL = 'https://github.com/LuigiEspinosa/digital-library';

describe('Footer', () => {
	test('wordmark is the fixed CUATRO LIBRARY text and not a link', () => {
		const { container } = render(Footer, { isAdmin: false });
		const wordmark = container.querySelector('.wordmark');

		expect(wordmark?.textContent).toBe('CUATRO LIBRARY');
		expect(wordmark?.tagName).not.toBe('A');
		expect(wordmark?.getAttribute('href')).toBe(null);
	});

	test('default (no props) shows GITHUB · DOCS — two links, one separator, no ADMIN', () => {
		const { container } = render(Footer, {});

		const labels = [...container.querySelectorAll('.footer-links a')].map((a) => a.textContent?.trim());
		expect(labels).toEqual(['GITHUB', 'DOCS']);

		const seps = [...container.querySelectorAll('.footer-links [aria-hidden="true"]')];
		expect(seps.length).toBe(1);
		expect(seps.every((s) => s.textContent === '·')).toBe(true);
	});

	test('isAdmin: false shows exactly GITHUB · DOCS', () => {
		const { container } = render(Footer, { isAdmin: false });

		const labels = [...container.querySelectorAll('.footer-links a')].map((a) => a.textContent?.trim());
		expect(labels).toEqual(['GITHUB', 'DOCS']);
		expect(container.querySelectorAll('.footer-links [aria-hidden="true"]').length).toBe(1);
	});

	test('isAdmin: true shows GITHUB · DOCS · ADMIN — three links, two separators', () => {
		const { container } = render(Footer, { isAdmin: true });

		const labels = [...container.querySelectorAll('.footer-links a')].map((a) => a.textContent?.trim());
		expect(labels).toEqual(['GITHUB', 'DOCS', 'ADMIN']);
		expect(container.querySelectorAll('.footer-links [aria-hidden="true"]').length).toBe(2);
	});

	test('GITHUB anchor points at the canonical repo URL', () => {
		const { container } = render(Footer, { isAdmin: true });

		const github = [...container.querySelectorAll('.footer-links a')].find(
			(a) => a.textContent?.trim() === 'GITHUB'
		);
		expect(github?.getAttribute('href')).toBe(REPO_URL);
	});

	test('GITHUB is external — target="_blank" + rel="noopener noreferrer"', () => {
		const { container } = render(Footer, { isAdmin: true });

		const github = [...container.querySelectorAll('.footer-links a')].find(
			(a) => a.textContent?.trim() === 'GITHUB'
		);
		expect(github?.getAttribute('target')).toBe('_blank');
		expect(github?.getAttribute('rel')).toBe('noopener noreferrer');
	});

	test('internal DOCS/ADMIN links use provisional hrefs and carry no target/rel', () => {
		const { container } = render(Footer, { isAdmin: true });
		const byLabel = (label: string) =>
			[...container.querySelectorAll('.footer-links a')].find((a) => a.textContent?.trim() === label);

		const docs = byLabel('DOCS');
		expect(docs?.getAttribute('href')).toBe('/docs');
		expect(docs?.getAttribute('target')).toBe(null);
		expect(docs?.getAttribute('rel')).toBe(null);

		const admin = byLabel('ADMIN');
		expect(admin?.getAttribute('href')).toBe('/admin');
		expect(admin?.getAttribute('target')).toBe(null);
		expect(admin?.getAttribute('rel')).toBe(null);
	});

	test('toggling isAdmin reconciles the link/separator set (2 ↔ 3)', async () => {
		const { container, rerender } = render(Footer, { isAdmin: false });

		const labels = () =>
			[...container.querySelectorAll('.footer-links a')].map((a) => a.textContent?.trim());
		const sepCount = () =>
			container.querySelectorAll('.footer-links [aria-hidden="true"]').length;

		expect(labels()).toEqual(['GITHUB', 'DOCS']);
		expect(sepCount()).toBe(1);

		await rerender({ isAdmin: true });
		expect(labels()).toEqual(['GITHUB', 'DOCS', 'ADMIN']);
		expect(sepCount()).toBe(2);

		await rerender({ isAdmin: false });
		expect(labels()).toEqual(['GITHUB', 'DOCS']);
		expect(sepCount()).toBe(1);
	});
});
