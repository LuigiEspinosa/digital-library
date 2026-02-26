<script lang="ts">
	import { onMount, onDestroy, tick } from "svelte";
	import type { PDFDocumentProxy } from "pdfjs-dist";
	import type { Book } from "@digital-library/shared";
	import { readingPosition } from "$lib/stores/readingPosition";
	import { clampPage, computeScale, zoomOutStep, zoomInStep, type FitMode } from "./pdfUtils";
	import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

	interface Props {
		book: Book;
		initialPage?: number;
		onProgress?: (position: string) => void;
	}

	let { book, initialPage = 1, onProgress }: Props = $props();

	// DOM refs
	let containerEl = $state<HTMLDivElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let textLayerEl = $state<HTMLDivElement | null>(null);

	// PDF internals (not reactive - no template binding needed)
	let pdfDoc: PDFDocumentProxy | null = null;
	let pdfjsLib: typeof import("pdfjs-dist") | null = null;

	// UI state
	let currentPage = $state(1);
	let totalPages = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let rendering = $state(false);

	// Zoom / fit state
	let fitMode = $state<FitMode>("fit-width");
	let customScale = $state(1.0);
	let currentScale = $state(1.0);

	// Page input editing
	let pageInput = $state("1");
	let editingPage = $state(false);

	// Progress debounce
	const SAVE_DEBOUNCE_MS = 1000;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	// Render cancellation: bump this counter to abort in-flight renders
	let renderGen = 0;

	// ResizeObserver instance
	let resizeObserver: ResizeObserver | null = null;

	// ---- Progress Helpers ----
	function scheduleSave(page: number) {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => onProgress?.(String(page)), SAVE_DEBOUNCE_MS);
	}

	function flushSave() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		onProgress?.(String(currentPage));
	}

	// ---- Rendering ----
	async function renderPage(pageNum: number) {
		if (!pdfDoc || !pdfjsLib || !canvasEl || !textLayerEl || !containerEl) return;

		const gen = ++renderGen;
		rendering = true;

		try {
			const page = await pdfDoc.getPage(pageNum);
			if (gen !== renderGen) return;

			// Natural viewport at scale 1 gives us the page's instrinsic pixel size
			const naturalVp = page.getViewport({ scale: 1 });

			// Toolbar is 44px tall; substract it so fit-page fills visible area
			const usableH = containerEl.clientHeight - 44;

			const scale = computeScale(
				fitMode,
				containerEl.clientWidth,
				usableH,
				naturalVp.width,
				naturalVp.height,
				customScale,
			);
			currentScale = Math.round(scale * 100) / 100;

			const viewport = page.getViewport({ scale });

			// Resize and paint the canvas
			const ctx = canvasEl.getContext("2d");
			if (!ctx) return;
			canvasEl.width = viewport.width;
			canvasEl.height = viewport.height;
			await page.render({ canvasContext: ctx, viewport }).promise;
			if (gen !== renderGen) return;

			// Text selection layer
			textLayerEl.replaceChildren();
			textLayerEl.style.width = `${viewport.width}px`;
			textLayerEl.style.height = `${viewport.height}px`;

			const textLayer = new pdfjsLib.TextLayer({
				textContentSource: page.streamTextContent(),
				container: textLayerEl,
				viewport,
			});
			await textLayer.render();
		} finally {
			if (gen === renderGen) rendering = false;
		}
	}

	// ---- Navigation ----
	function goToPage(n: number) {
		if (!pdfDoc || n < 1 || n > totalPages) return;
		currentPage = n;
		readingPosition.setPosition(book.id, String(n));
		scheduleSave(n);
		renderPage(n);
	}

	function prevPage() {
		goToPage(currentPage - 1);
	}

	function nextPage() {
		goToPage(currentPage + 1);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (editingPage) return;
		if (e.key === "ArrowRight" || e.key === "ArrowDown") nextPage();
		else if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevPage();
	}

	function handlePageInputKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			const n = parseInt(pageInput, 10);
			if (Number.isFinite(n)) goToPage(n);
			editingPage = false;
		} else if (e.key === "Escape") {
			pageInput = String(currentPage);
			editingPage = false;
		}
	}

	// ---- Zoom ----
	function setFitMode(mode: FitMode) {
		fitMode = mode;
		renderPage(currentPage);
	}

	function zoomOut() {
		const next = zoomOutStep(currentScale);
		if (next === null) return;
		fitMode = "custom";
		customScale = next;
		currentScale = next;
		renderPage(currentPage);
	}

	function zoomIn() {
		const next = zoomInStep(currentScale);
		if (next === null) return;
		fitMode = "custom";
		customScale = next;
		currentScale = next;
		renderPage(currentPage);
	}

	// Keep page input label in sync unless the user is editing it
	$effect(() => {
		if (!editingPage) pageInput = String(currentPage);
	});

	// ---- Lifecycle ----
	onMount(async () => {
		try {
			const pdfjs = await import("pdfjs-dist");
			pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
			pdfjsLib = pdfjs;

			const res = await fetch(`/api/books/${book.id}/file`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
			const buffer = await res.arrayBuffer();

			const doc = await pdfjs.getDocument({ data: buffer }).promise;
			pdfDoc = doc;
			totalPages = doc.numPages;
			currentPage = clampPage(initialPage, doc.numPages);

			loading = false;
			await tick(); // let Svelte commit the DOM Update

			await renderPage(currentPage);

			// Set up ResizeObserver only after the first render so it never races with it
			// Watch container size for fit-width / fit-page recalculation
			if (containerEl) {
				resizeObserver = new ResizeObserver(() => {
					if (fitMode !== "custom") renderPage(currentPage);
				});
				resizeObserver.observe(containerEl);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to load PDF.";
			loading = false;
		}
	});

	onDestroy(() => {
		flushSave();
		resizeObserver?.disconnect();
		pdfDoc?.destroy();
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<div bind:this={containerEl} class="relative flex h-full w-full flex-col">
	<!-- Scrollable page area -->
	<div class="flex flex-1 justify-center overflow-auto">
		<div class="flex min-h-full items-start justify-center p-6">
			<!-- Canvas + text layer wrapper. shadow-xl gives the "page on desk" look. -->
			<div
				class="relative inline-block shadow-xl transition-opacity duration-150"
				class:opacity-0={loading || !!error}
			>
				<canvas bind:this={canvasEl}></canvas>
				<div bind:this={textLayerEl} class="textLayer"></div>
			</div>
		</div>
	</div>

	<!-- Bottom toolbar -->
	{#if !loading && !error}
		<div
			class="relative z-10 flex shrink-0 items-center justify-between gap-3 px-4 py-1.5 text-xs"
			style="
        border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background-color: color-mix(in srgb, currentColor 4%, transparent);
      "
		>
			<!-- Page navigation -->
			<div class="flex items-center gap-1.5">
				<button
					onclick={prevPage}
					disabled={currentPage <= 1}
					class="flex h-7 w-7 items-center justify-center rounded opacity-60 transition-opacity hover:opacity-100 disabled:opacity-20"
					aria-label="Previous page"
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
				</button>

				<div class="flex items-center gap-1.5">
					<div class="flex items-center gap-1 opacity-70">
						{#if editingPage}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								autofocus
								type="text"
								bind:value={pageInput}
								onkeydown={handlePageInputKeydown}
								onblur={() => {
									editingPage = false;
									pageInput = String(currentPage);
								}}
								class="w-10 rounded horder bg-transparent px-1 py-0.5 text-center text-xs"
								style="border-color: color-mix(in srgb, currentColor 35%, transparent);"
							/>
						{:else}
							<button
								onclick={() => {
									editingPage = true;
								}}
								class="rounded px-1.5 py-0.5 transition-opacity hover:opacity-100"
								aria-label="Go to page"
							>
								{currentPage}
							</button>
						{/if}
						<span class="opacity-40"></span>
						<span>{totalPages}</span>
					</div>

					<button
						onclick={nextPage}
						disabled={currentPage >= totalPages}
						class="flex h-7 w-7 items-center justify-center rounded opacity-60 transition-opacity hover:opacity-100 disabled:opacity-20"
						aria-label="Next page"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-4 w-4"
						>
							<path d="M9 18l6-6-6-6" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Zoom controls -->
			<div class="flex items-center gap-1">
				{#each ["fit-width", "fit-page"] as const as mode}
					<button
						onclick={() => setFitMode(mode)}
						class="rounded px-2 py-1 text-xs transition-all"
						style="
              opacity: {fitMode === mode ? 1 : 0.45};
              outline: {fitMode === mode
							? '1px solid color-mix(in srgb, currentColor 40%, transparent)'
							: 'none'};
              border-radius: 4px;
            "
						aria-label={mode === "fit-width" ? "Fit to width" : "Fit full page"}
					>
						{mode === "fit-width" ? "Width" : "Page"}
					</button>
				{/each}

				<button
					onclick={zoomOut}
					disabled={zoomOutStep(currentScale) === null}
					class="flex h-7 w-7 items-center justify-center rounded text-base font-medium opacity-60 transition-opacity hover:opacity-100 disabled:opacity-20"
					aria-label="Zoom out"
				>
					-
				</button>

				<span class="w-11 text-center opacity-60">{Math.round(currentScale * 100)}%</span>

				<button
					onclick={zoomIn}
					disabled={zoomInStep(currentScale) === null}
					class="flex h-7 w-7 items-center justify-center rounded text-base font-medium opacity-60 transition-opacity hover:opacity-100 disabled:opacity-20"
					aria-label="Zoom in"
				>
					+
				</button>
			</div>
		</div>
	{/if}

	<!-- Loading spinner -->
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

<style>
	/**
  * Text layer: invisible spans positioned over the canvas so the browser
  * can handle text selection and copy/paster natively.
  * Using :global because pdfjs-dist injects these class names at runtime.
  */
	:global(.textLayer) {
		position: absolute;
		inset: 0;
		overflow: hidden;
		line-height: 1;
		user-select: text;
		cursor: text;
		/* Pointer events only on the text spans, not the gap between them */
	}

	:global(.textLayer span),
	:global(.textLayer br) {
		color: transparent;
		position: absolute;
		white-space: pre;
		cursor: text;
		transform-origin: 0% 0%;
		pointer-events: auto;
	}

	:global(.textLayer ::selection) {
		background-color: rgba(0, 102, 204, 0.25);
	}
</style>
