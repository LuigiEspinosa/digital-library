<script lang="ts">
	import StatusTag from '../StatusTag.svelte';

	// The label is a Snippet and can't be passed through a .ts props object, so the
	// harness owns fixed label text and forwards everything else (variant/progress/
	// class/rest) via {...props} — the B.8 prop-forwarding harness shape.
	let props = $props();
</script>

<StatusTag {...props}>Uploading · 62%</StatusTag>
