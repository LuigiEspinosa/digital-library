<script lang="ts">
	let { isAdmin = false }: { isAdmin?: boolean } = $props();

	const links = $derived([
		{ label: 'GITHUB', href: 'https://github.com/LuigiEspinosa/digital-library', external: true },
		{ label: 'DOCS', href: '/docs', external: false },
		...(isAdmin ? [{ label: 'ADMIN', href: '/admin', external: false }] : [])
	]);
</script>

<div class="footer">
	<p class="wordmark">CUATRO LIBRARY</p>
	<div class="footer-links">
		{#each links as link, i}
			<a
				href={link.href}
				target={link.external ? '_blank' : undefined}
				rel={link.external ? 'noopener noreferrer' : undefined}>{link.label}</a>
			{#if i < links.length - 1}
				<span class="sep" aria-hidden="true">·</span>
			{/if}
		{/each}
	</div>
</div>

<style>
	.footer {
		width: 100%;
		border-top: var(--stroke-hair) solid var(--token-border);
		padding: var(--s-xl) var(--s-lg);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.wordmark {
		margin: 0;
		font-family: var(--f-display);
		font-size: var(--t-lg);
		font-weight: var(--w-black);
		font-stretch: 75%;
		letter-spacing: var(--tr-heading);
		line-height: var(--lh-heading);
		color: var(--token-text);
	}

	.footer-links {
		margin-top: var(--s-sm);
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		column-gap: var(--s-lg);
	}

	/* § 1b secondary Links: the --tap box on the anchor, the underline on its text. */
	.footer-links a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--tap);
		min-width: var(--tap);
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text-secondary);
		text-decoration: underline;
		text-decoration-color: var(--token-border-interactive);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
	}

	.footer-links a:hover {
		text-decoration-color: var(--token-accent-hover);
	}

	.footer-links .sep {
		color: var(--token-text-secondary);
		user-select: none;
	}
</style>
