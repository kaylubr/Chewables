export function downloadDataUrl(dataUrl: string, filename: string): void {
	const a = document.createElement('a');
	a.href = dataUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

export function photoFilename(frameId: string | undefined): string {
	const base = frameId ? frameId.toLowerCase() : 'photo';
	return `chewables-${base}.webp`;
}
