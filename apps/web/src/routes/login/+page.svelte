<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import MonoKicker from '$lib/components/primitives/MonoKicker.svelte';
	import HardRule from '$lib/components/primitives/HardRule.svelte';
	import Input from '$lib/components/primitives/Input.svelte';
	import Button from '$lib/components/primitives/Button.svelte';

	let { form }: { form: ActionData } = $props();

	// Feeds the submit button only. The fields stay enabled on purpose: B.7 has no
	// disabled treatment, so a native disabled input would render with the full
	// active black border and a live focus outline.
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Cuatro Library · Sign In</title>
</svelte:head>

<!-- min-height lives here, not on the layout: +layout.svelte wraps every page in a
     plain non-flex GSAP <div> that will not stretch this one. -->
<div class="login-page">
	<main class="stage">
		<div class="column">
			<!-- Author-cased on purpose, here and throughout: MonoKicker, Input's label,
			     Button and .floor all uppercase in CSS, so the rendered copy still matches
			     04-login.md §Sample content while the DOM text a screen reader reads keeps
			     its real casing. Never pre-shout a string in markup. -->
			<div>
				<MonoKicker size="md" tone="ink">Cuatro Library · Est. 2026</MonoKicker>
			</div>

			<h1 class="wordmark">
				<span class="line">Cuatro</span>
				<span class="line"><span class="underlined">Library</span></span>
			</h1>

			<p class="deck">A private catalog of the books you already own.</p>

			<div class="rule">
				<HardRule weight="hairline" />
			</div>

			<!-- One message per submission, so it renders once above the fields rather
			     than as an errorText under each one. role="alert" announces it on the
			     server round-trip; the block owns no aria-describedby to double it. -->
			{#if form?.error}
				<div class="error-block" role="alert">
					<MonoKicker size="ribbon" tone="ink">Error</MonoKicker>
					<p class="error-message">{form.error}</p>
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					// finally, not a trailing statement: if update() rejects (a failed goto on
					// the redirect, or invalidateAll throwing) the button would stay disabled
					// with no error shown and no way back short of a reload.
					return async ({ update }) => {
						try {
							await update();
						} finally {
							submitting = false;
						}
					};
				}}
			>
				<Input
					label="Email"
					type="email"
					name="email"
					id="email"
					value={form?.email ?? ''}
					placeholder="you@example.com"
					autocomplete="email"
					required
				/>
				<Input
					label="Password"
					type="password"
					name="password"
					id="password"
					autocomplete="current-password"
					required
					class="field-gap"
				/>
				<Button variant="inverted" type="submit" class="signin" disabled={submitting}>Sign In</Button>
			</form>

			<p class="helper">Accounts are invitation-only. Contact the administrator for access.</p>
		</div>
	</main>

	<footer class="floor">
		<span>Cuatro Library</span>
		<span class="sep" aria-hidden="true">·</span>
		<span>© 2026</span>
		<span class="sep" aria-hidden="true">·</span>
		<a href="/admin">Admin</a>
	</footer>
</div>

<style>
	.login-page {
		/* dvh, with the vh fallback first for browsers that lack it: on mobile Safari
		   and Chrome 100vh is the *large* viewport, so with the URL bar on screen the
		   floor ribbon would sit below the fold on first paint. */
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--paper-white);
	}

	.stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-64) var(--space-32);
	}

	.column {
		width: 440px;
		max-width: 100%;
	}

	.wordmark {
		margin: var(--space-8) 0 0;
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.5px;
		color: var(--page-ink);
	}

	.line {
		display: block;
	}

	/* inline-block so the rule stops at the word's last glyph rather than running the
	   column width; a text-decoration cannot hit the 2px/8px spec reliably. */
	.underlined {
		position: relative;
		display: inline-block;
		padding-bottom: 8px;
	}

	.underlined::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: var(--wired-black);
	}

	.deck {
		margin: var(--space-16) 0 0;
		font-family: var(--font-serif);
		font-size: 19px;
		font-style: italic;
		line-height: 1.47;
		letter-spacing: 0.108px;
		color: var(--caption-gray);
	}

	.rule {
		margin: var(--space-24) 0 var(--space-32);
	}

	/* Deliberately matches B.7's internal error treatment so the design system has one
	   error look: paper ground, 2px black frame, no red, no icon, no dismiss. */
	.error-block {
		box-sizing: border-box;
		background: var(--paper-white);
		border: 2px solid var(--wired-black);
		border-radius: 0;
		padding: 14px 16px;
		margin-bottom: var(--space-24);
	}

	.error-message {
		margin: 6px 0 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.5;
		color: var(--page-ink);
	}

	/* A class passed into a child component lands on that component's element and
	   carries its scoping hash, not this route's — so the sizing of <Input> and
	   <Button> has to reach through :global(). */
	.column :global(.field-gap) {
		margin-top: var(--space-16);
	}

	.column :global(.signin) {
		width: 100%;
		height: 56px;
		margin-top: var(--space-24);
	}

	.helper {
		margin: var(--space-24) 0 0;
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.45;
		color: var(--caption-gray);
	}

	/* The one centered thing on the page. In normal flow as the last flex child, so
	   the flex:1 stage pins it to the viewport floor without position: fixed. */
	.floor {
		width: 100%;
		height: 44px;
		background: var(--page-ink);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 400;
		letter-spacing: 0.92px;
		text-transform: uppercase;
		color: var(--paper-white);
	}

	.floor .sep {
		margin: 0 var(--space-8);
		user-select: none;
	}

	.floor a {
		color: inherit;
		text-decoration: none;
		transition: color 150ms linear;
	}

	.floor a:hover {
		color: var(--link-blue);
	}

	@media (max-width: 767px) {
		.stage {
			padding: var(--space-32) var(--space-24);
		}
	}
</style>
