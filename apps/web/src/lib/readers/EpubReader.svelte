<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type { Rendition } from "epubjs";
	import type { Book } from "@digital-library/shared";
	import { userSettings } from "$lib/stores/userSettings";
	import { readingPosition } from "$lib/stores/readingPosition";

	interface Props {
		book: Book;
		initialCfi?: string | null;
		onProgress?: (cfi: string) => void;
	}

	let { book, initialCfi = null, onProgress }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let rendition = $state<Rendition | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	// Plain variable, not $state - only used internally, never rendered
	let currentCfi: string | null = initialCfi;

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	const SAVE_DEBOUNCE_MS = 2000;

	// CSS inject into the epub.js iframe per theme.
	// !important is needed because EPUB stylesheets often use high-specificity rules.
	const THEMES = {
		light: {
			"body, html": {
				"background-color": "#ffffff !important",
				color: "#1a1a1a !important",
			},
			a: { color: "#2563eb !important" },
			"a:visited": { color: "#7c3aed !important" },
		},
		sepia: {
			"body, html": {
				"background-color": "#f4ecd8 !important",
				color: "#3c2f2f !important",
			},
			a: { color: "#7c4f28 !important" },
			"a:visited": { color: "#5c3010 !important" },
		},
		dark: {
			"body, html": {
				"background-color": "#1c1c1e !important",
				color: "#e0d7c8 !important",
			},
			a: { color: "#8ab4f8 !important" },
			"a:visited": { color: "#c5a8e8 !important" },
		},
	};

	function scheduleSave(cfi: string) {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => onProgress?.(cfi), SAVE_DEBOUNCE_MS);
	}

	function flushSave() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		if (currentCfi) onProgress?.(currentCfi);
	}

	onMount(async () => {
		try {
			// Dynamic import - epub.js accesses window/document on import, must be client-only
			const { default: ePub } = await import("epubjs");

			// Fetch EPUB ourselves so we can control auth. epub.js's internal XHR does not send cookies
			const res = await fetch(`/api/books/${book.id}/file`, { credentials: "include" });
			if (!res.ok) throw new Error(`Failed to load book (${res.status})`);
			const buffer = await res.arrayBuffer();

			// epubjs types only declare string for the first arg, but ArrayBuffer works at runtime
			const epubBook = ePub(buffer as unknown as string);

			const _rendition = epubBook.renderTo(container!, {
				width: "100%",
				height: "100%",
				flow: "paginated",
				spread: "none",
			});

			// Register all themes once. Select and overrides happen in the $effect below
			_rendition.themes.register("light", THEMES.light);
			_rendition.themes.register("sepia", THEMES.sepia);
			_rendition.themes.register("dark", THEMES.dark);
			_rendition.themes.select($userSettings.theme);
			_rendition.themes.override("font-size", `${$userSettings.fontSize}px`);
			_rendition.themes.override("font-family", $userSettings.fontFamily);
			_rendition.themes.override("line-height", String($userSettings.lineHeight));

			// Pass undefined (not null) so epub.js starts from the beginning when no CFI exists
			await _rendition.display(initialCfi ?? undefined);
			loading = false;

			_rendition.on("relocated", (location: { start: { cfi: string } }) => {
				const cfi = location.start.cfi;
				currentCfi = cfi;
				readingPosition.setPosition(book.id, cfi);
				scheduleSave(cfi);
			});

			// Keyboard events from inside the iframe are proxied by epub.js
			_rendition.on("keyup", (e: KeyboardEvent) => {
				if (e.key === "ArrowRight") _rendition.next();
				else if (e.key === "ArrowLeft") _rendition.prev();
			});

			// Set reactive state last. Triggers the $effect below to run once with full state
			rendition = _rendition;
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to load book.";
			loading = false;
		}
	});

	// Re-applies every time rendition becomes available OR any setting changes.
	// Runs twice on initial load (harmless - applying setyles is idempotent).
	$effect(() => {
		if (!rendition) return;
		rendition.themes.select($userSettings.theme);
		rendition.themes.override("font-size", `${$userSettings.fontSize}px`);
		rendition.themes.override("font-family", $userSettings.fontFamily);
		rendition.themes.override("line-height", String($userSettings.lineHeight));
	});

	onDestroy(() => {
		flushSave(); // Persist position bfore teardown
		rendition?.destroy();
	});

	// Handle keyboard when the outer page (not the epub iframe) has focus
	function handleKeyDown(e: KeyboardEvent) {
		if (!rendition) return;
		if (e.key === "ArrowRight") rendition.next();
		else if (e.key === "ArrowLeft") rendition.prev();
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="relative h-full w-full">
	<!-- epub.js mounts into this container and creates its own iframe -->
	<div
		bind:this={container}
		class="h-full w-full transition-opacity duration-300"
		class:opacity-0={loading || !!error}
	></div>

	<!-- Invisible click zones sit as siblings, absolutely positioned over the side margins.
	epub.js renders EPUB content in the center; the outer 15% on each side stays empty. -->
	{#if rendition}
		<button
			class="absolute inset-y-0 left-0 w-[15%] cursor-w-resize focus:outline-none"
			aria-label="Previous page"
			onclick={() => rendition?.prev()}
		></button>
		<button
			class="absolute inset-y-0 right-0 w-[15%] cursor-e-resize focus:outline-none"
			aria-label="Next page"
			onclick={() => rendition?.next()}
		></button>
	{/if}

	{#if loading}
		<div class="absolute inset-0 flex items-center justify-center">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-30"
			></div>
		</div>
	{/if}

	{#if error}
		<div class="absolute inset-0 flex items-center justify-center px-8 text-center">
			<p class="text-sm opacity-60">{error}</p>
		</div>
	{/if}
</div>
