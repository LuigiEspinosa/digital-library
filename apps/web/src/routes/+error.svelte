<script lang="ts">
	import { page } from '$app/state';
</script>

<h1>{page.status}</h1>
<p>{page.error?.message}</p>

<style>
	h1 {
		margin: 0;
		padding: var(--s-2xl) var(--page-pad) 0;
		font-family: var(--f-display);
		font-size: var(--t-display);
		font-weight: var(--w-black);
		line-height: var(--lh-display);
		letter-spacing: var(--tr-display);
		color: var(--token-text);
	}

	p {
		margin: var(--s-md) 0 0;
		padding: 0 var(--page-pad);
		font-size: var(--t-sm);
		line-height: var(--lh-body);
		color: var(--token-text-secondary);
	}
</style>
