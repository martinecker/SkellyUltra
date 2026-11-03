// All UI text, in one place so it can be translated later. English only for now.

export const strings = {
	panelTitle: "Skelly",
	openSidebar: "Open the sidebar",
	greeting: (name: string) => `Hello, ${name}!`,
	device: "Skelly",
	noDevices: "No Skelly is set up, or none is loaded right now.",
	loadingDevices: "Loading your Skellies…",
	devicesFailed: (message: string) => `Couldn't list your Skellies: ${message}`,
	status: {
		idle: "Not connected",
		connecting: "Connecting…",
		live: "Live",
		reloading: "Integration reloading…",
		error: "Error",
	},
	unavailable: "The Skelly is not connected; showing the last known files.",
	// Shown until the file table replaces it
	rawPayloadHeading: "Live data from the Skelly (for testing)",
	cardName: "Skelly Ultra",
	cardDescription:
		"Shows a Skelly's status, says text through it and plays its files.",
} as const;
