// All UI text, in one place so it can be translated later. English only for now.

export const strings = {
	panelTitle: "Skelly",
	openSidebar: "Open the sidebar",
	greeting: (name: string) => `Hello, ${name}!`,
	placeholder: "The Skelly file manager is coming soon.",
	cardName: "Skelly Ultra",
	cardDescription:
		"Shows a Skelly's status, says text through it and plays its files.",
} as const;
