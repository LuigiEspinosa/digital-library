<script lang="ts">
	import { onNavigate, afterNavigate } from "$app/navigation";
	import { gsap } from "gsap";
	import "./layout.css";

	let { children } = $props();

	let pageEl = $state<HTMLElement | null>(null);

	onNavigate(() => {
		if (!pageEl) return;
		return new Promise<void>((resolve) => {
			gsap.to(pageEl, {
				opacity: 0,
				y: -8,
				duration: 0.18,
				ease: "power1.in",
				onComplete: resolve,
			});
		});
	});

	afterNavigate(() => {
		if (!pageEl) return;
		gsap.fromTo(
			pageEl,
			{ opacity: 0, y: 8 },
			{ opacity: 1, y: 0, duration: 0.28, ease: "power2.out" },
		);
	});
</script>

<div bind:this={pageEl}>
	{@render children()}
</div>
