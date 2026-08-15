<script lang="ts">
	import UtilityBar from '../UtilityBar.svelte';

	// `session` renders the real Epic 03 shape — a plain <span>, an <a> and a
	// <form><button> — which is what proves the divider/layout rules reach every
	// child type and not just anchors. The default two-link slot is kept so the
	// original all-anchors case stays covered.
	let { breadcrumb, session = false }: { breadcrumb: string[]; session?: boolean } = $props();
</script>

{#if session}
	<UtilityBar {breadcrumb}>
		{#snippet rightSlot()}
			<span>luigi@pharosgraph.com</span>
			<a href="/admin/libraries">Admin</a>
			<form method="POST" action="/logout"><button type="submit">Sign out</button></form>
		{/snippet}
	</UtilityBar>
{:else}
	<UtilityBar {breadcrumb}>
		{#snippet rightSlot()}
			<a href="/settings">Settings</a>
			<a href="/logout">Log out</a>
		{/snippet}
	</UtilityBar>
{/if}
