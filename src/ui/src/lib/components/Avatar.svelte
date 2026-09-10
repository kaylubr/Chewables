<script lang="ts">
	let {
		image,
		username,
		size = '2.25rem',
		alt = username,
	}: {
		image?: string | null;
		username: string;
		size?: string;
		alt?: string;
	} = $props();

	const initials = $derived(username.trim().slice(0, 2).toUpperCase() || '?');
</script>

{#if image}
	<img class="avatar" src={image} {alt} style:width={size} style:height={size} />
{:else}
	<span class="avatar avatar-initials" aria-hidden="true" style:width={size} style:height={size}>
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
		font-size: 0.9rem;
		line-height: 1;
		color: var(--ember);
		background: var(--mustard);
	}
</style>