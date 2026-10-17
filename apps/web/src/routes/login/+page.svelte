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
		/* dvh, with the vh fallback first for browsers that lack it: on mobile 100vh is
		   the large viewport, so the floor would sit below the fold on first paint. */
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--s-2xl) var(--page-pad);
	}

	.column {
		width: 440px;
		max-width: 100%;
	}

	/* The page's one display line (§ 6). */
	.wordmark {
		margin: var(--s-xs) 0 0;
		font-family: var(--f-display);
		font-size: var(--t-display);
		font-weight: var(--w-black);
		line-height: var(--lh-display);
		letter-spacing: var(--tr-display);
		text-transform: uppercase;
		color: var(--token-text);
	}

	.line {
		display: block;
	}

	/* inline-block so the hairline stops at the word's last glyph. */
	.underlined {
		display: inline-block;
		padding-bottom: var(--s-xs);
		border-bottom: var(--stroke-hair) solid var(--token-border-interactive);
	}

	.deck {
		margin: var(--s-md) 0 0;
		max-width: var(--measure);
		font-family: var(--f-body);
		font-size: var(--t-base);
		line-height: var(--lh-lede);
		color: var(--token-text-secondary);
	}

	.rule {
		margin: var(--s-lg) 0 var(--s-xl);
	}

	/* The form-level message: text in a Boundary box, no ground, no colour (S-4). */
	.error-block {
		box-sizing: border-box;
		border: var(--stroke-boundary) solid var(--token-border-interactive);
		padding: var(--s-sm) var(--s-md);
		margin-bottom: var(--s-lg);
	}

	.error-message {
		margin: var(--s-2xs) 0 0;
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text);
	}

	/* A class passed into a child component lands on its element with that component's
	   scope, so the layout of <Input> and <Button> reaches through :global(). */
	.column :global(.field-gap) {
		margin-top: var(--s-md);
	}

	.column :global(.signin) {
		width: 100%;
		margin-top: var(--s-lg);
	}

	.helper {
		margin: var(--s-lg) 0 0;
		font-family: var(--f-body);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text-secondary);
	}

	/* The floor: a hairline above, metadata as a Label, the one link a § 1b Link. */
	.floor {
		width: 100%;
		min-height: var(--tap);
		box-sizing: border-box;
		padding: 0 var(--page-pad);
		border-top: var(--stroke-hair) solid var(--token-border);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		font-family: var(--f-mono);
		font-size: var(--t-2xs);
		line-height: var(--lh-label);
		letter-spacing: var(--tr-label);
		text-transform: uppercase;
		color: var(--token-text-secondary);
	}

	.floor .sep {
		margin: 0 var(--s-xs);
		user-select: none;
	}

	.floor a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--tap);
		min-width: var(--tap);
		color: var(--token-text);
		text-decoration: underline;
		text-decoration-color: var(--token-border-interactive);
		text-decoration-thickness: var(--stroke-hair);
		text-underline-offset: var(--s-2xs);
		transition: text-decoration-color var(--dur-micro) var(--ease-toggle);
	}

	.floor a:hover {
		text-decoration-color: var(--token-accent-hover);
	}
</style>
