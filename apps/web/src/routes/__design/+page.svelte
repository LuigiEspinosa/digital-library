<script lang="ts">
	// * /__design is a developer smoke surface for the WIRED token layer
	// * (stories 01.A.1 + 01.A.2 + 01.A.3). It is gated to dev-only by the
	// * sibling +page.server.ts and is scheduled for deletion at the close
	// * of Epic 01. If anything renders wrong here, the bug is in the
	// * token layer, not in a product component.

	type Swatch = {
		name: string;
		hex: string;
		// * `border` carries the slate-200 hairline only on Paper White, so
		// * the swatch is visible against the bg-white page canvas.
		bg: string;
		border?: string;
	};

	const swatches: Swatch[] = [
		{ name: 'Paper White', hex: '#ffffff', bg: 'bg-white', border: 'border border-slate-200' },
		{ name: 'WIRED Black', hex: '#000000', bg: 'bg-black' },
		{ name: 'Page Ink', hex: '#1a1a1a', bg: 'bg-ink' },
		{ name: 'Caption Gray', hex: '#757575', bg: 'bg-caption' },
		{ name: 'Hairline Tint', hex: '#e2e8f0', bg: 'bg-slate-200' },
		{ name: 'Link Blue', hex: '#057dbc', bg: 'bg-link' }
	];
</script>

<div class="mx-auto max-w-[1280px] px-4 py-12 md:px-6 lg:px-16">
	<header class="mb-12 border-b-2 border-black pb-4">
		<p class="font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
			DEV ONLY · EPIC 01 SMOKE SURFACE
		</p>
		<h1 class="font-display text-[48px] leading-[1.05] tracking-[-0.5px] text-ink">
			Design system smoke page
		</h1>
	</header>

	<section class="mb-16">
		<p class="mb-4 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
			§2 PALETTE · SIX TOKENS
		</p>
		<div class="flex flex-wrap gap-6">
			{#each swatches as swatch (swatch.hex)}
				<div class="flex flex-col gap-1">
					<div class="h-[120px] w-[120px] {swatch.bg} {swatch.border ?? ''}"></div>
					<span class="font-mono text-[13px] uppercase tracking-[0.92px] text-ink">
						{swatch.hex}
					</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="mb-16 flex flex-col gap-8">
		<p class="font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
			§3 TYPE · FIVE ROLES
		</p>

		<div>
			<p class="mb-1 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				HERO · 64PX PLAYFAIR
			</p>
			<p class="font-display text-[64px] leading-[1.05] tracking-[-0.5px] text-ink">
				AI's New Editorial Voice
			</p>
		</div>

		<div>
			<p class="mb-1 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				SECTION · 26PX PLAYFAIR
			</p>
			<p class="font-display text-[26px] leading-[1.18] text-ink">Most Popular This Week</p>
		</div>

		<div>
			<p class="mb-1 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				BODY · 16PX SOURCE SERIF 4
			</p>
			<p class="font-serif text-[16px] leading-[1.5] tracking-[0.09px] text-ink">
				The newsroom is now an editor and a thousand machines, each one rewriting yesterday's
				lede before the coffee finishes brewing.
			</p>
		</div>

		<div>
			<p class="mb-1 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				UI · 16PX INTER 700
			</p>
			<p class="font-sans text-[16px] font-bold leading-[1.25] tracking-[0.3px] text-ink">
				SUBSCRIBE
			</p>
		</div>

		<div>
			<p class="mb-1 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				KICKER · 13PX JETBRAINS MONO
			</p>
			<p class="font-mono text-[13px] uppercase leading-[1.23] tracking-[0.92px] text-ink">
				GEAR · 4 HOURS AGO
			</p>
		</div>
	</section>

	<section class="flex flex-col gap-8">
		<p class="font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
			§6 DEPTH · RULE WEIGHTS
		</p>

		<div>
			<p class="mb-2 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				LEVEL 3 · 2PX SOLID BLACK
			</p>
			<hr class="m-0 w-full border-0 border-t-2 border-black" />
		</div>

		<div>
			<p class="mb-2 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				LEVEL 1 · 1PX HAIRLINE TINT
			</p>
			<hr class="m-0 w-full border-0 border-t border-slate-200" />
		</div>

		<div>
			<p class="mb-2 font-mono text-[11px] uppercase tracking-[1.1px] text-caption">
				LEVEL 4 · BLACK RIBBON BAR
			</p>
			<!-- ! Ribbon label uses font-mono regular weight (400), not 700.
			     ! @fontsource/jetbrains-mono ships only 400 and 800 in apps/web's
			     ! +layout.svelte; using `font-bold` here would render the
			     ! synthetic-bold face (browser-faked) which is visually wrong.
			     ! Track in Epic 02 if a real <Ribbon /> primitive needs the
			     ! 700 weight; see Follow-ups in this delivery's apply checklist. -->
			<div class="flex h-9 w-full items-center bg-black px-6">
				<span class="font-mono text-[12px] uppercase tracking-[1.2px] text-white">
					DESIGN SYSTEM SMOKE
				</span>
			</div>
		</div>
	</section>
</div>
