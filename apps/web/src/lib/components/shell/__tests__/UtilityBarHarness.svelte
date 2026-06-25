<script lang="ts">
	import UtilityBar from '../UtilityBar.svelte';

	let { breadcrumb }: { breadcrumb: string[] } = $props();
</script>

<UtilityBar {breadcrumb}>
	{#snippet rightSlot()}
		<a href="/settings">Settings</a>
		<a href="/logout">Log out</a>
	{/snippet}
</UtilityBar>
