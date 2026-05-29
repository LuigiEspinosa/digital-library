<script lang="ts">
  import '@fontsource/playfair-display/400.css';
  import '@fontsource/source-serif-4/400.css';
  import '@fontsource/source-serif-4/400-italic.css';
  import '@fontsource/inter/400.css';
  import '@fontsource/inter/700.css';
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/800.css';

  import { onNavigate, afterNavigate } from '$app/navigation';
  import { gsap } from 'gsap';
  import './layout.css';

  let { children } = $props();

  let pageEl = $state<HTMLElement | null>(null);

  onNavigate(() => {
    if (!pageEl) return;
    return new Promise<void>((resolve) => {
      gsap.to(pageEl, {
        opacity: 0,
        y: -8,
        duration: 0.18,
        ease: 'power1.in',
        onComplete: resolve,
      });
    });
  });

  afterNavigate(() => {
    if (!pageEl) return;
    gsap.fromTo(pageEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
  });
</script>

<div bind:this={pageEl}>
  {@render children()}
</div>
