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
	unavailable:
		"The Skelly is not connected. These are the last known files; refresh once it's back.",
	reloadingNotice:
		"The integration is reloading. The files show again once it's back.",
	noDeviceId:
		"This Skelly has no device in Home Assistant, so its files can't be played or deleted here.",
	// Header
	freeSpace: (free: string) => `${free} free`,
	freeSpaceUnknown: "Free space unknown",
	fileCount: (count: number) => (count === 1 ? "1 file" : `${count} files`),
	refresh: "Refresh",
	refreshTitle: "Read the file list from the Skelly again",
	refreshFailed: (message: string) => `Couldn't refresh the files: ${message}`,
	details: "Details",
	detailsTitle: "Show the file index and cluster of each file",
	// Transfer bar
	transferSending: (name: string | null) =>
		name ? `Sending ${name}` : "Sending a file",
	transferCancel: "Cancel",
	transferCancelling: "Cancelling…",
	transferCancelFailed: (message: string) =>
		`Couldn't cancel the transfer: ${message}`,
	transferBusy: "Files can't be played or deleted until the transfer is done.",
	transferFailed: (name: string | null, error: string | null) =>
		`Sending ${name ?? "the file"} failed${error ? `: ${error}` : "."}`,
	transferCancelled: (name: string | null) =>
		`Sending ${name ?? "the file"} was cancelled.`,
	// File table
	noFiles: "There are no files on the Skelly.",
	columnPosition: "#",
	columnName: "Name",
	columnMovement: "Movement",
	columnEye: "Eye",
	columnIndex: "Index",
	columnCluster: "Cluster",
	columnActions: "Actions",
	notInOrder: "Not in the play order",
	positionTitle: (position: number) => `Plays as number ${position}`,
	noMovement: "No movement",
	lightTitle: (
		label: string,
		mode: string,
		rgb: [number, number, number],
		brightness: number,
		colorCycle: boolean,
	) =>
		`${label}: ${mode}, ${
			colorCycle ? "color cycle" : `RGB ${rgb.join(", ")}`
		}, brightness ${brightness}`,
	lightOff: (label: string) => `${label}: off`,
	play: "Play",
	stop: "Stop",
	delete: "Delete",
	moreActions: "More actions",
	playing: "Playing",
	playFailed: (name: string, message: string) =>
		`Couldn't play ${name}: ${message}`,
	stopFailed: (name: string, message: string) =>
		`Couldn't stop ${name}: ${message}`,
	deleteFailed: (name: string, message: string) =>
		`Couldn't delete ${name}: ${message}`,
	deleted: (name: string) => `Deleted ${name}`,
	// Delete confirmation
	deleteTitle: "Delete file?",
	deleteMessage: (name: string) =>
		`Delete ${name} from the Skelly? This can't be undone.`,
	cancel: "Cancel",
	cardName: "Skelly Ultra",
	cardDescription:
		"Shows a Skelly's status, says text through it and plays its files.",
} as const;
