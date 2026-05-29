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
		background: var(--page-ink);
		padding: var(--space-48) 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		border-radius: 0;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 32px;
		color: var(--paper-white);
		margin: 0;
	}

	.footer-links {
		margin-top: var(--space-16);
		display: flex;
		align-items: center;
	}

	/* Footer renders its own GITHUB/DOCS/ADMIN anchors, so they sit inside this
	   component's style scope — plain .footer-links a, not the :global() the slot
	   links in UtilityBar/AppNav need. */
	.footer-links a {
		font-family: var(--font-sans);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.92px;
		color: var(--paper-white);
		text-decoration: none;
		transition: color 120ms;
	}

	.footer-links a:hover {
		color: var(--link-blue);
	}

	.footer-links .sep {
		margin: 0 var(--space-8);
		color: var(--paper-white);
		user-select: none;
	}
</style>
