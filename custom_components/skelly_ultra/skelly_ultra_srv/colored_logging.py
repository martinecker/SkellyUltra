"""Colored logging formatter for terminal output."""

import logging


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color-coded log levels."""

    # ANSI color codes
    RESET = "\033[0m"
    BOLD = "\033[1m"
    WHITE = "\033[97m"  # Bright white

    # Level colors (similar to Home Assistant style)
    COLORS = {
        logging.DEBUG: "\033[36m",  # Cyan
        logging.INFO: "\033[32m",  # Green
        logging.WARNING: "\033[33m",  # Yellow
        logging.ERROR: "\033[31m",  # Red
        logging.CRITICAL: "\033[1;31m",  # Bold Red
    }

    def format(self, record: logging.LogRecord) -> str:
        """Format the log record with colors.

        Args:
            record: The log record to format

        Returns:
            Formatted and colored log string
        """
        # Get the color for this level
        color = self.COLORS.get(record.levelno, self.RESET)

        # Color the level name
        level_color = f"{color}{self.BOLD}{record.levelname}{self.RESET}"

        # Store original levelname and replace with colored version
        original_levelname = record.levelname
        record.levelname = level_color

        # Format the message using parent formatter
        formatted = super().format(record)

        # Restore original levelname
        record.levelname = original_levelname

        # Color the timestamp (date and time) at the beginning in white
        # The format is: "YYYY-MM-DD HH:MM:SS [name] LEVEL - message"
        # We want to color just the timestamp part (up to the first space after the time)
        # Find the end of timestamp (first space after HH:MM:SS)
        parts = formatted.split(" ", 2)
        if len(parts) >= 3:
            # parts[0] = date, parts[1] = time, parts[2] = rest
            timestamp = f"{parts[0]} {parts[1]}"
            rest = parts[2]
            formatted = f"{self.WHITE}{timestamp}{self.RESET} {rest}"

        return formatted


def setup_colored_logging(level: int = logging.INFO) -> None:
    """Set up colored logging for the application.

    Args:
        level: The logging level to use
    """
    # Create colored formatter
    formatter = ColoredFormatter(
        fmt="%(asctime)s [%(name)s] %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler with colored formatter
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
