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
	transferBusy:
		"Files can't be played, edited, reordered or deleted until the transfer is done.",
	readingFiles: "Reading the Skelly's files…",
	readingBusy:
		"Files can't be played, edited, reordered or deleted until the Skelly's files have been read.",
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
	edit: "Edit",
	// Play order
	columnEnabledTitle: "In the play order",
	enabledLabel: (name: string) => `Play ${name} in the play order`,
	enableTitle: "Add to the play order, at the end",
	disableTitle: "Take out of the play order",
	lastEnabled: "At least one file must stay in the play order",
	namelessFile: "A file without a name can't be put in the play order",
	namelessInOrder:
		"This file has no name, so the Skelly can't order it: any change to the play order takes it out",
	dragTitle: "Drag to change the play order",
	orderSaving: "Saving the play order…",
	orderFailed: (message: string) =>
		`Couldn't change the play order: ${message}`,
	// Edit dialog
	editTitle: (name: string) => `Edit ${name}`,
	editEye: "Eye icon",
	editAllTitle: "Everything moves; turns the single parts off",
	editBrightness: "Brightness",
	editColor: "Color",
	editEffect: "Effect",
	editSpeed: "Effect speed",
	editColorCycle: "Color cycle",
	editPreview: "Preview",
	editPreviewTitle: "Play the file with its saved settings",
	editNothing: "Nothing changed yet",
	editChanged:
		"This file's settings changed on the Skelly since you opened it.",
	editReload: "Use the new settings",
	editGone: "This file is no longer on the Skelly.",
	editDisconnected: "The Skelly is not connected, so changes can't be saved.",
	editWaiting: "Waiting for the Skelly's files…",
	editFailed: (message: string) => `Couldn't save: ${message}`,
	editFailedFor: (name: string, message: string) =>
		`Couldn't save ${name}: ${message}`,
	save: "Save",
	saving: "Saving…",
	saved: (name: string) => `Saved ${name}`,
	// Add file
	addFile: "Add file",
	addFileTitle: "Send a new file to the Skelly",
	addBusy: "A file is being sent to the Skelly",
	addDisconnected: "The Skelly is not connected, so files can't be added.",
	addDialogTitle: "Add a file",
	tabUpload: "Upload",
	tabMedia: "Media library",
	tabUrl: "URL",
	filenameLabel: "Name on the Skelly",
	filenameEmpty: "Enter a name",
	filenameSlash: "The name can't contain /",
	filenameLong: (max: number) =>
		`The name can be at most ${max} characters long, .mp3 included`,
	filenameReplaces:
		"Will replace the existing file; its lights, eye and movement settings are kept.",
	uploadChoose: "Choose an audio file, or drop one here",
	uploadChosen: (name: string, size: string) => `${name} (${size})`,
	uploadType: "That isn't an audio file.",
	uploadName:
		"Home Assistant doesn't take file names with ~, .. or slashes. Rename the file first.",
	uploadRefused: "Home Assistant refused the file or its name.",
	uploadSize: (max: string) =>
		`The file is larger than ${max}, the most Home Assistant takes.`,
	uploadNoFolder:
		"Home Assistant has no local media folder to upload to. Pick a file from the media library or enter a URL instead.",
	uploadSaved:
		"Uploaded files are kept in Media › My media › skelly_ultra, so you can send them again from the media library.",
	uploadNotAllowed: "Only administrators can upload files.",
	uploadTooLarge: "Home Assistant refused the file as too large.",
	uploadFailed: (message: string) => `Couldn't upload the file: ${message}`,
	uploading: "Uploading…",
	urlLabel: "Address of an audio file",
	urlInvalid: "Enter an address that starts with http:// or https://",
	mediaHome: "Media",
	mediaUp: "Back",
	mediaEmpty: "No folders or audio files here.",
	mediaLoading: "Loading…",
	mediaFailed: (message: string) => `Couldn't open the folder: ${message}`,
	mediaPick: "Pick an audio file",
	send: "Send",
	sendFailed: (name: string, message: string) =>
		`Couldn't send ${name}: ${message}`,
	sent: (name: string) => `Sent ${name} to the Skelly`,
	playNow: "Play",
	// Transfer settings
	transferSettings: "Transfer settings",
	chunkOverride: "Override chunk size",
	chunkAuto: (bytes: number | null) =>
		bytes === null
			? "Automatic: set by the connection once the Skelly is connected"
			: `Automatic: ${bytes} bytes, set by the connection`,
	chunkUnit: "bytes",
	chunkSmall: (bytes: number) =>
		`Chunks of ${bytes} bytes make transfers slow. An override of 250 is usually much faster; if transfers then fail, go lower.`,
	smallChunksNotice: (bytes: number) =>
		`Files are sent in chunks of ${bytes} bytes, which makes transfers slow. You can override the chunk size under Add file › Transfer settings.`,
	bitrateOverride: "Override bitrate",
	bitrateDefault: (bitrate: string) => `Automatic: ${bitrate}`,
	settingsNotApplied:
		"The Skelly didn't take the change. Check that it's connected.",
	settingsFailed: (message: string) =>
		`Couldn't change the transfer settings: ${message}`,
	// Delete confirmation
	deleteTitle: "Delete file?",
	deleteMessage: (name: string) =>
		`Delete ${name} from the Skelly? This can't be undone.`,
	cancel: "Cancel",
	cardName: "Skelly Ultra",
	cardDescription:
		"Shows a Skelly's status, says text through it and plays its files.",
} as const;
