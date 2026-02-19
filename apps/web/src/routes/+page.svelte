<script lang="ts">
	import { enhance } from "$app/forms";
	import type { ActionData } from "./$types";

	export let form: ActionData;
</script>

<svelte:head>
	<title>Cuatro Digital Library</title>
</svelte:head>

<main class="login-wrap">
	<div class="login-card">
		<h1>📚 Library</h1>
		<p class="subtitle">Sign in to your account</p>

		{#if form?.error}
			<div class="error" role="alert">{form.error}</div>
		{/if}

		<form method="POST" use:enhance>
			<label>
				Email
				<input type="email" name="email" value={form?.email ?? ""} required autocomplete="email" />
			</label>

			<label>
				Password
				<input
					type="password"
					name="password"
					required
					autocomplete="current-password"
					minlength="1"
				/>
			</label>

			<button type="submit">Sign in</button>
		</form>
	</div>
</main>

<style>
	.login-wrap {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f5f0;
		font-family: system-ui, sans-serif;
	}

	.login-card {
		background: white;
		padding: 2.5rem;
		border-radius: 12px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
		width: 100%;
		max-width: 400px;
	}

	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
	}

	.subtitle {
		margin: 0 0 1.5rem;
		color: #666;
		font-size: 0.95rem;
	}

	.error {
		background: #fff0f0;
		border: 1px solid #ffcccc;
		color: #cc0000;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: #333;
	}

	input {
		padding: 0.6rem 0.8rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		outline: none;
		transition: border-color 0.15s;
	}

	input:focus {
		border-color: #555;
	}

	button {
		margin-top: 0.5rem;
		padding: 0.7rem;
		background: #1a1a1a;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	button:hover {
		background: #333;
	}
</style>
