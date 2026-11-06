// HA's own toast, at the bottom of the screen, with a button if given
export function showToast(
	from: HTMLElement,
	message: string,
	action?: { text: string; action: () => void },
	duration?: number,
): void {
	// An action can end after the element left the page: HA's root shows it then
	const target: EventTarget = from.isConnected
		? from
		: (document.querySelector("home-assistant") ?? from);
	target.dispatchEvent(
		new CustomEvent("hass-notification", {
			detail: {
				message,
				...(action ? { action } : {}),
				...(duration ? { duration } : {}),
			},
			bubbles: true,
			composed: true,
		}),
	);
}

// Goes to a page of HA's frontend without reloading it, like HA's own links
export function navigate(path: string): void {
	history.pushState(null, "", path);
	window.dispatchEvent(
		new CustomEvent("location-changed", { detail: { replace: false } }),
	);
}
