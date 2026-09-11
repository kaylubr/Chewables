<script lang="ts">
	let {
		image,
		username,
		size = '2.25rem',
		alt = username,
		initialsSize = 'var(--text-sm)',
	}: {
		image?: string | null;
		username: string;
		size?: string;
		alt?: string;
		/** Lets a large avatar scale its initials instead of keeping them tiny. */
		initialsSize?: string;
	} = $props();

	const initials = $derived(username.trim().slice(0, 2).toUpperCase() || '?');
</script>

{#if image}
	<img class="avatar" src={image} {alt} style:width={size} style:height={size} />
{:else}
	<span
		class="avatar avatar-initials"
		aria-hidden="true"
		style:width={size}
		style:height={size}
		style:font-size={initialsSize}
	>
		{initials}
	</span>
{/if}

<style>
	.avatar {
		display: block;
		border-radius: 50%;
		object-fit: cover;
		flex: none;
		background: var(--mustard);
	}

	.avatar-initials {
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-weight: 700;
		line-height: 1;
		color: var(--ember);
		background: var(--mustard);
	}
</style>