<script lang="ts">
	// No data needed here — this layout only provides the <slot />.
	// Child pages receive their own typed data from their load functions.
	// User session is available to child pages via parent() in their load fns.
</script>

<slot />
