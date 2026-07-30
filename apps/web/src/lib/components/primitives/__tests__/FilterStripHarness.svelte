<script lang="ts">
	import FilterStrip from '../FilterStrip.svelte';

	// A Snippet can't be passed through a .ts props object, so the harness supplies a
	// fixed `trailing` snippet and forwards everything else (options/value/onChange/
	// ...) via {...props} — the B.8/B.9 prop-forwarding shape. Naming the child
	// snippet `trailing` binds it to the `trailing` prop.
	let props = $props();
</script>

<FilterStrip {...props}>
	{#snippet trailing()}<span data-testid="search-slot">SEARCH</span>{/snippet}
</FilterStrip>
