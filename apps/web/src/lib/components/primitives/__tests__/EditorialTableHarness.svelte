<script lang="ts">
	import EditorialTable from '../EditorialTable.svelte';

	// Snippet slots can't be passed through a .ts props object, so the harness owns
	// fixed head/body content and forwards everything else (dense/rowHover/class/rest)
	// to EditorialTable via {...props} — a small evolution of the fixed B.4/B.5/B.6
	// harnesses, which hardcoded their single slot.
	let props = $props();
</script>

<EditorialTable {...props}>
	{#snippet head()}
		<tr><th>Name</th><th>Created</th></tr>
	{/snippet}
	{#snippet body()}
		<tr><td>The Garage Shelf</td><td>Jan 04 2026</td></tr>
		<tr><td>Comics</td><td>Feb 18 2026</td></tr>
		<tr><td>Reference</td><td>Feb 22 2026</td></tr>
	{/snippet}
</EditorialTable>
