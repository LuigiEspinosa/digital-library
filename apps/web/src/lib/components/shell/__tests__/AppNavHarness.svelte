<script lang="ts">
	import AppNav from '../AppNav.svelte';
</script>

<AppNav>
	{#snippet rightSlot()}
		<button type="button">Search</button>
		<button type="button">Account</button>
	{/snippet}
</AppNav>
