<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type { PageData } from "./$types";
	import Reader from "$lib/readers/Reader.svelte";
	import { userSettings } from "$lib/stores/userSettings";
	import type { ReaderTheme } from "$lib/stores/userSettings";

	let { data }: { data: PageData } = $props();

	let settingsOpen = $state(false);
	let headerVisible = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	const THEME_BG: Record<ReaderTheme, string> = {
		light: "#ffffff",
		sepia: "#f4ecd8",
		dark: "#1c1c1e",
	};

	const THEME_FG: Record<ReaderTheme, string> = {
		light: "#1a1a1a",
		sepia: "#3c2f2f",
		dark: "#e0d7c8",
	};

	const FONT_OPTIONS: Array<{ label: string; value: string }> = [
		{ label: "Serif", value: "Georgia, serif" },
		{ label: "Sans", value: "system-ui, sans-serif" },
		{ label: "Mono", value: "ui-monospace, monospace" },
	];

	const LINE_HEIGHT_OPTIONS: Array<{ label: string; value: number }> = [
		{ label: "Tight", value: 1.3 },
		{ label: "Normal", value: 1.6 },
		{ label: "Relaxed", value: 2.0 },
	];

	let bg = $derived(THEME_BG[$userSettings.theme]);
	let fg = $derived(THEME_FG[$userSettings.theme]);

	function showHeader() {
		headerVisible = true;
		if (hideTimer) clearTimeout(hideTimer);
		if (!settingsOpen) {
			hideTimer = setTimeout(() => {
				headerVisible = false;
			}, 3000);
		}
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
		if (settingsOpen) {
			if (hideTimer) clearTimeout(hideTimer);
			headerVisible = true;
		} else {
			showHeader();
		}
	}

	onMount(() => {
		hideTimer = setTimeout(() => {
			headerVisible = false;
		}, 3000);
	});

	onDestroy(() => {
		if (hideTimer) clearTimeout(hideTimer);
	});

	async function saveProgress(cfi: string) {
		await fetch(`/api/books/${data.book.id}/progress`, {
			method: "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ position: cfi }),
		});
	}
</script>

<svelte:head>
	<title>{data.book.title}</title>
</svelte:head>

<div
	class="relative flex h-screen flex-col overflow-hidden transition-colors duration-300"
	style="background-color: {bg}; color: {fg};"
	onmousemove={showHeader}
	ontouchstart={showHeader}
	role="main"
>
	<!-- Auto-hiding header -->
	<header
		class="relative z-10 flex items-center gap-4 px-4 py-3 transition-opacity duration-300"
		style="border-bottom: 1px soldi color-mix(in srgb, currentColor 12%, transparent);"
		class:opacity-0={!headerVisible}
		class:pointer-events-none={!headerVisible}
	>
		<a
			href="/libraries/{data.library.id}/books/{data.book.id}"
			class="flex shrink-0 items-center gap-1.5 text-sm opacity-60 transition-opacity hover:opacity-0=100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="h-4 w-4"
			>
				<path d="M15 18l-6-6 6-6" />
			</svg>
			Back
		</a>

		<p class="min-w-0 flex-1 truncate text-center text-sm font-medium opacity-70">
			{data.book.title}
		</p>

		<button
			onclick={toggleSettings}
			class="flex shrink-0 items-center gap-1.5 text-sm opacity-60 transition-opacity hover:opacity-100"
			aria-label="Reader settings"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="h-4 w-4"
			>
				<circle cx="12" cy="12" r="3" />
				<path
					d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.8 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
				/>
			</svg>
		</button>
	</header>

	<!-- Reader fills remaining height -->
	<div class="flex-1 overflow-hidden">
		<Reader book={data.book} initialCfi={data.initialCfi} onProgress={saveProgress} />
	</div>

	<!-- Settings backdrop -->
	{#if settingsOpen}
		<button
			class="absolute inset-0 z-20 cursor-default focus:online-none"
			onclick={toggleSettings}
			aria-label="Close settings"
			tabindex="-1"
		></button>
	{/if}

	<!-- Settings panel - slide in from right -->
	<div
		class="absolute inset-y-0 right-0 z-30 w-72 overflow-y-auto shadow-2xl transition-transform duration-300"
		style="background-color: {bg}; border-left 1px solid color-mix(in srgb, currentColor 15%, transparent);"
		class:translate-x-full={!settingsOpen}
	>
		<div class="p-6">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xs font-semibold uppercase tracking-widest opacity-50">Settigns</h2>
				<button
					onclick={toggleSettings}
					class="opacity-50 transition-opacity hover:opacity-100"
					aria-label="Close settings"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-4 w-4"
					>
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Theme -->
			<div class="mb-6">
				<p class="mb-2.5 text-xs uppercase tracking-widest opacity-50">Theme</p>
				<div class="flex gap-2">
					{#each ["light", "sepia", "dark"] as const as theme}
						<button
							onclick={() => userSettings.set("theme", theme)}
							class="flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-all"
							style="
                background-color: {THEME_BG[theme]}; 
                color: {THEME_FG[theme]}; 
                border-color: {$userSettings.theme === theme
								? fg
								: 'color-mix(in srgb, currentColor 20%, transparent)'}; 
                box-shadow: {$userSettings.theme === theme ? `0 0 0 1px ${fg}` : 'none'};
              "
						>
							{theme}
						</button>
					{/each}
				</div>
			</div>

			<!-- Font size -->
			<div class="mb-6">
				<p class="mb-2.5 text-xs uppercase tracking-widest opacity-50">Font size</p>
				<div class="flex items-center gap-2">
					<button
						onclick={() => userSettings.set("fontSize", Math.max(12, $userSettings.fontSize - 2))}
						class="flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium opacity-60 transition-opacity hover:opacity-100"
						style="border-color: color-mix(in srgb, currentColor 20%, transparent);"
						aria-label="Decrease font size"
					>
						A-
					</button>
					<span class="flex-1 text-center text-sm opacity-60">{$userSettings.fontSize}px</span>
					<button
						onclick={() => userSettings.set("fontSize", Math.min(28, $userSettings.fontSize + 2))}
						class="flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium opacity-60 transition-opacity hover:opacity-100"
						style="border-color: color-mix(in srgb, currentColor 20%, transparent);"
						aria-label="Increase font size"
					>
						A+
					</button>
				</div>
			</div>

			<!-- Font family -->
			<div class="mb-6">
				<p class="mb-2.5 text-xs uppercase tracking-widest opacity-50">Font</p>
				<div class="flex gap-2">
					{#each FONT_OPTIONS as opt}
						<button
							onclick={() => userSettings.set("fontFamily", opt.value)}
							class="flex-1 rounded-lg border py-2 text-xs transition-all"
							style="
                font-family: : {opt.value};
                border-color: {$userSettings.fontFamily === opt.value
								? fg
								: 'color-mix(in srgb, currentColor 20%, transparent'};
                opacity: {$userSettings.fontFamily === opt.value ? 1 : 0.6};
              "
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Line height -->
			<div>
				<p class="mb-2.5 text-xs uppercase tracking-widest opacity-50">Spacing</p>
				<div class="flex gap-2">
					{#each LINE_HEIGHT_OPTIONS as opt}
						<button
							onclick={() => userSettings.set("lineHeight", opt.value)}
							class="flex-1 rounded-lg border py-2 text-xs transition-all"
							style="
                border-color: {$userSettings.lineHeight === opt.value
								? fg
								: 'color-mix(in srgb, currentColor 20%, transparent'};
                opacity: {$userSettings.lineHeight === opt.value ? 1 : 0.6};
              "
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
