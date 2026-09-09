/**
 * Client-side toast notifications.
 *
 * Module-scoped runes store so toasts survive SvelteKit client-side navigation
 * (pages push a toast right before goto()). Rendered by <ToastRegion /> in the
 * root layout. Lives only in the browser.
 */
export type ToastKind = 'success' | 'error';

export interface Toast {
	id: number;
	kind: ToastKind;
	message: string;
}

const MAX_TOASTS = 3;

const DISMISS_MS: Record<ToastKind, number> = {
	success: 3000,
	error: 6000,
};

class ToastsStore {
	toasts = $state<Toast[]>([]);
	#nextId = 1;

	/** Push a toast; when the stack is full the oldest one is dropped. */
	push(kind: ToastKind, message: string): number {
		const id = this.#nextId++;
		this.toasts = [...this.toasts, { id, kind, message }];
		if (this.toasts.length > MAX_TOASTS) {
			this.toasts = this.toasts.slice(this.toasts.length - MAX_TOASTS);
		}
		if (typeof window !== 'undefined') {
			window.setTimeout(() => this.dismiss(id), DISMISS_MS[kind]);
		}
		return id;
	}

	success(message: string) {
		return this.push('success', message);
	}

	error(message: string) {
		return this.push('error', message);
	}

	dismiss(id: number) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}
}

export const toastStore = new ToastsStore();
