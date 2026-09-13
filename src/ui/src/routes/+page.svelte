<script lang="ts">
	import AboutIcon from '$lib/components/AboutIcon.svelte';

	const faqs = [
		{
			q: 'Do I need an account?',
			a: 'No. You can use the photobooth and download your photos without creating an account. An account is only needed if you want to save your photos online.'
		},
		{
			q: 'Are my photos uploaded?',
			a: "Guest photos stay in your browser while you're using the photobooth. They are only uploaded when you explicitly choose to save a finished photo to your account."
		},
		{
			q: 'Do I need to install anything?',
			a: 'No. Chewables runs directly in your web browser.'
		},
		{
			q: 'Why does Chewables need camera access?',
			a: 'Camera access is required so the browser can take photos from your webcam.'
		},
		{
			q: 'How many photos does each session take?',
			a: 'That depends on the frame you choose. Some frames require three photos, while others require four or more.'
		},
		{
			q: 'Can I download my photo without an account?',
			a: 'Yes. You can download the finished image without signing in.'
		},
		{
			q: 'Can I delete photos I saved?',
			a: 'Yes. Saved photos can be deleted from your account.'
		},
		{
			q: 'What happens if I refresh or close the page?',
			a: 'Unsaved photos from your current session may be lost because they are kept in your browser rather than permanently stored.'
		},
		{
			q: 'Are my saved photos private?',
			a: 'Saved photos are associated with your account and should only be accessible to you.'
		},
		{
			q: 'What browsers are supported?',
			a: 'Chewables works best in modern browsers that support webcam access and the required browser APIs.'
		}
	];

	let openFaq = $state(-1);
</script>

<svelte:head>
	<title>Chewables</title>
	<meta
		name="description"
		content="Chewables is a privacy-conscious photobooth. Pick a frame, take photos with your camera, and download the result. Accounts are optional for saving photos to a gallery."
	/>
</svelte:head>

<main class="landing">
	<section class="hero" aria-labelledby="hero-heading">
		<div class="hero-inner">
			<h1 class="marquee" id="hero-heading">
				Make the moment yours.
			</h1>
			<p class="lede">
				A photobooth in your browser. Pick a frame, take a few shots, keep the strip.
			</p>
			<a class="cta" href="/photobooth/frame">
				Start the photobooth
			</a>
		</div>
	</section>

	<section class="process" aria-labelledby="process-heading">
		<div class="process-inner">
			<div class="process-head">
				<h2 id="process-heading" class="section-title">How it works</h2>
				<p class="process-intro">Three steps, all in your browser. No app, no upload until you choose to save.</p>
			</div>
			<ol class="steps">
				<li>
					<h3>Choose a frame</h3>
					<p>Each frame needs a set number of photos.</p>
				</li>
				<li>
					<h3>Take the photos</h3>
					<p>The camera counts you down between each shot.</p>
				</li>
				<li>
					<h3>Download it</h3>
					<p>Your finished photo is composed in your browser. Download it, or save it to your gallery if you want to keep it.</p>
				</li>
			</ol>
		</div>
	</section>

	<section class="faq" id="faq" aria-labelledby="faq-heading">
		<div class="faq-inner">
			<h2 id="faq-heading" class="section-title">FAQs</h2>
			<div class="accordion">
				{#each faqs as faq, i}
					<div class="faq-item" class:open={openFaq === i}>
						<h3>
							<button
								type="button"
								class="faq-question"
								id="faq-button-{i}"
								aria-expanded={openFaq === i}
								aria-controls="faq-panel-{i}"
								onclick={() => (openFaq = openFaq === i ? -1 : i)}
							>
								<span>{faq.q}</span>
								<span class="faq-icon" aria-hidden="true"></span>
							</button>
						</h3>
						<div class="faq-panel" id="faq-panel-{i}" role="region" aria-labelledby="faq-button-{i}">
							<div class="faq-panel-inner">
								<p>{faq.a}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="about" id="about" aria-labelledby="about-heading">
		<div class="about-inner">
			<h2 id="about-heading" class="section-title">About</h2>

			<div class="about-bottom">
				<div class="about-description">
					<p>
						Chewables is a simple photobooth. You pick a frame, take a few
						photos with your camera, and get a finished picture you can
						download. If you make an account, you can also save your pictures
						here and come back to them later.
					</p>
				</div>
				<ul class="about-links">
					<li>
						<a href="mailto:kbreyes.dev@gmail.com">
							<AboutIcon icon="mail" />
							<span>Contact us</span>
						</a>
					</li>
					<li>
						<a href="https://github.com/kaylubr/chewables">
							<AboutIcon icon="github" />
							<span>GitHub</span>
						</a>
					</li>
					<li>
						<a href="/report">
							<AboutIcon icon="report" />
							<span>Report an issue</span>
						</a>
					</li>
				</ul>
			</div>
		</div>
	</section>
</main>

<style>
	.landing {
		font-family: var(--font-ui);
		color: var(--charcoal);
		background: var(--paper);
	}
	.hero {
		background: var(--crimson);
		color: #fff;
		padding: 2rem;
	}
	.hero-inner {
		display: grid;
		justify-items: center;
		gap: 1.5rem;
		max-width: 72rem;
		margin: 0 auto;
		padding: 4rem 1.5rem 4rem;
		text-align: center;
	}
	.marquee {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(3.6rem, 12vw, 8rem);
		line-height: 0.95;
		letter-spacing: -0.03em;
		color: var(--mustard);
		text-wrap: balance;
		user-select: none;
		max-width: none;
		margin: 0;
	}
	.lede {
		font-size: clamp(var(--text-base), 2.4vw, var(--text-lg));
		text-align: center;
		line-height: var(--leading-normal);
		font-weight: 700;
		color: #fff;
		max-width: 38rem;
		margin: 0;
	}
	@media (min-width: 900px) {
		.hero-inner {
			justify-items: start;
			text-align: left;
		}
		.lede {
			text-align: left;
		}
	}
	.cta {
		display: inline-block;
		box-sizing: border-box;
		max-width: 100%;
		background: transparent;
		color: var(--mustard);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: clamp(var(--text-xs), 0.5vw + 0.65rem, var(--text-sm));
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
		padding: clamp(1.15rem, 1vw + 0.9rem, 1.4rem) clamp(1.3rem, 2.5vw + 0.8rem, 2rem);
		border-radius: 9999px;
		text-decoration: none;
		border: solid 2px var(--mustard);
		margin-top: 2rem;
	}
	.cta:hover {
		background: var(--mustard-deep);
		color: var(--charcoal);
	}
	.process,
	.faq {
		background: var(--paper);
	}
	.about {
		background: var(--crimson);
		color: var(--mustard);
	}
	.about .section-title {
		color: var(--mustard);
	}
	.process-inner,
	.faq-inner,
	.about-inner {
		max-width: 72rem;
		margin: 0 auto;
		padding: 4rem 1.5rem;
		color: var(--crimson);
	}
	.about-inner {
		color: var(--mustard);
	}
	.about-bottom {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3rem;
		align-items: start;
	}
	.about-description {
		max-width: 40ch;
	}
	.about-description p {
		margin: 0;
		color: var(--mustard);
		font-size: clamp(var(--text-base), 0.5rem + 0.6vw, var(--text-lg));
		line-height: var(--leading-relaxed);
	}
	.faq {
		border-top: 1px solid var(--line);
		scroll-margin-top: 6.5rem;
	}
	.about {
		scroll-margin-top: 6.5rem;
	}
	.faq-inner,
	.about-inner {
		max-width: 56rem;
	}
	.section-title {
		font-weight: 700;
		font-size: clamp(var(--text-xl), 3.5vw, var(--text-3xl));
		letter-spacing: -0.01em;
		margin: 0 0 1.25rem;
		color: var(--charcoal);
		text-align: left;
	}
	.process-inner {
		max-width: 72rem;
		margin: 0 auto;
		padding: 4rem 1.5rem;
		color: var(--crimson);
		display: grid;
		gap: 2rem;
	}
	.process-intro {
		margin: 0;
		max-width: 32ch;
		color: var(--ink-soft);
		font-size: clamp(var(--text-base), 1.2vw, var(--text-lg));
		line-height: var(--leading-normal);
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.steps li {
		padding: 1.4rem 0;
		border-top: 1px solid var(--line);
	}
	.steps h3 {
		font-weight: 700;
		font-size: clamp(var(--text-base), 1.8vw, var(--text-lg));
		margin: 0 0 0.35rem;
		color: var(--charcoal);
	}
	.steps p {
		margin: 0;
		color: var(--ink-soft);
		font-size: clamp(var(--text-sm), 1.1vw, var(--text-base));
		line-height: var(--leading-normal);
		max-width: var(--measure);
	}
	@media (min-width: 900px) {
		.process-inner {
			grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr);
			gap: 4rem;
			align-items: start;
		}
		.steps li:first-child {
			border-top: none;
			padding-top: 0;
		}
	}
	.accordion {
		display: grid;
		gap: 0.75rem;
	}
	.faq-item {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 0.5rem;
	}
	.faq-question {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 1.3rem;
		background: none;
		border: none;
		font-family: var(--font-ui);
		font-size: var(--text-lg);
		font-weight: 700;
		text-align: left;
		color: var(--charcoal);
		cursor: pointer;
		border-radius: 0.5rem;
	}
	.faq-question:hover {
		color: var(--crimson);
	}
	.faq-icon {
		position: relative;
		width: 1rem;
		height: 1rem;
		flex: none;
		color: var(--crimson);
	}
	.faq-icon::before,
	.faq-icon::after {
		content: '';
		position: absolute;
		background: currentColor;
		border-radius: 1px;
		transition: transform 0.2s ease;
	}
	.faq-icon::before {
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		transform: translateY(-50%);
	}
	.faq-icon::after {
		top: 0;
		bottom: 0;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
	}
	.faq-item.open .faq-icon::after {
		transform: translateX(-50%) scaleY(0);
	}
	.faq-panel {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.28s ease;
	}
	.faq-item.open .faq-panel {
		grid-template-rows: 1fr;
	}
	.faq-panel-inner {
		overflow: hidden;
	}
	.faq-panel p {
		margin: 0;
		padding: 0 1.3rem 1.2rem;
		color: var(--ink-soft);
		font-size: var(--text-base);
		line-height: var(--leading-normal);
		max-width: var(--measure);
	}
	.about-links {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.85rem;
	}
	.about-links a {
		font-family: var(--font-ui);
		font-size: clamp(var(--text-xs), 0.45rem + 0.5vw, var(--text-base));
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 600;
		color: var(--mustard);
		text-decoration: none;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}
	.about-links a:hover {
		color: #fff;
		text-decoration: underline;
	}
	@media (max-width: 780px) {
		.marquee {
			font-size: clamp(3rem, 15vw, 6rem);
		}
		.about-bottom {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
	}
</style>
