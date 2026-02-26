<script lang="ts">
	import type { Book } from "@digital-library/shared";
	import EpubReader from "./EpubReader.svelte";
	import PdfReader from "./PdfReader.svelte";
	import { parseStoredPage } from "./pdfUtils";

	interface Props {
		book: Book;
		initialCfi?: string | null;
		onProgress?: (position: string) => void;
	}

	let { book, initialCfi = null, onProgress }: Props = $props();
</script>

{#if book.format === "epub"}
	<EpubReader {book} {initialCfi} {onProgress} />
{:else if book.format === "pdf"}
	<PdfReader {book} initialPage={parseStoredPage(initialCfi)} {onProgress} />
{:else if book.format === "cbz" || book.format === "cbr"}
	<div class="flex h-full items-center justify-center">
		<p class="text-sm opacity-50">Comic Reader - Coming soon!</p>
	</div>
{:else}
	<div class="flex h-full items-center justify-center">
		<p class="text-sm opacity-50">Unsupported format: {book.format}</p>
	</div>
{/if}
