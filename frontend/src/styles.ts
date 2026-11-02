import { css } from "lit";

// Shared styles. They use Home Assistant's theme variables, so the panel and
// the card follow the user's theme and dark mode.
export const sharedStyles = css`
	:host {
		color: var(--primary-text-color);
		font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, sans-serif));
	}

	a {
		color: var(--primary-color);
	}

	.secondary {
		color: var(--secondary-text-color);
	}
`;
