/**
 * Constants and Configuration
 * Central location for all application constants, UUIDs, and configuration values
 */

// BLE Service UUIDs
export const BLE_CONFIG = {
  SERVICE_UUID: '0000ae00-0000-1000-8000-00805f9b34fb',
  WRITE_UUID: '0000ae01-0000-1000-8000-00805f9b34fb',
  NOTIFY_UUID: '0000ae02-0000-1000-8000-00805f9b34fb',
};

// LocalStorage Keys
export const STORAGE_KEYS = {
  RISK_ACK: 'skelly_ack_v2',
  ADV_RAW: 'skelly_adv_raw',
  ADV_FEDC: 'skelly_adv_fedc',
};

// Protocol Padding Defaults (bytes)
export const PADDING = {
  DEFAULT: 8,
};

// File Transfer Configuration
export const TRANSFER_CONFIG = {
  MTU_SIZE: 512,
  MTU_OVERHEAD: 12, // BLE (3) + command (2) + safety margin (7)
  CHUNK_SIZE: 500,  // MTU - overhead for reliable transmission
  CHUNK_DELAY_MS: 50,
  EDIT_CHUNK_DELAY_MS: 12,
};

// Timeout Values (milliseconds)
export const TIMEOUTS = {
  ACK: 3000,
  ACK_LONG: 5000,
  FILE_TRANSFER: 240000,
  FILE_LIST: 6000,
  CONNECTION: 5000,
};

// Audio Configuration
export const AUDIO_CONFIG = {
  LONG_TRACK_LIMIT_SECONDS: 30,
  TARGET_SAMPLE_RATE: 8000,
  TARGET_CHANNELS: 1, // mono
  DEFAULT_MP3_KBPS: 32,
  MP3_ENCODE_BLOCK_SIZE: 1152,
};

// Movement Bitfield Definitions
export const MOVEMENT_BITS = {
  HEAD: 0b001,   // bit 0
  ARM: 0b010,    // bit 1
  TORSO: 0b100,  // bit 2
  ALL_ON: 255,   // special value for all movements enabled
};

// BLE Command Tags
export const COMMANDS = {
  // File Transfer
  START_TRANSFER: 'C0',    // Initialize file transfer
  CHUNK_DATA: 'C1',        // Send data chunk
  END_TRANSFER: 'C2',      // End file transfer
  CONFIRM_TRANSFER: 'C3',  // Confirm file transfer
  CANCEL: 'C4',            // Cancel transfer
  RESUME: 'C5',            // Resume transfer
  PLAY_PAUSE: 'C6',        // Play/pause file
  DELETE: 'C7',            // Delete file
  
  // Device Queries
  QUERY_PARAMS: 'E0',      // Query device parameters
  QUERY_LIVE: 'E1',        // Query live status
  QUERY_VOLUME: 'E5',      // Query volume
  QUERY_BT_NAME: 'E6',     // Query Bluetooth name
  QUERY_FILES: 'D0',       // Query file list
  QUERY_ORDER: 'D1',       // Query play order
  QUERY_CAPACITY: 'D2',    // Query storage capacity
  
  // Media Controls
  SET_VOLUME: 'FA',        // Set volume (0-255)
  MEDIA_PLAY: 'FC',        // Play media (payload: 01)
  MEDIA_PAUSE: 'FC',       // Pause media (payload: 00)
  ENABLE_CLASSIC_BT: 'FD', // Enable classic Bluetooth audio, aka live mode (payload: 01)
  
  // Lighting
  SET_MODE: 'F2',          // Set effect mode (1=static, 2=strobe, 3=pulsing)
  SET_BRIGHTNESS: 'F3',    // Set brightness (0-255)
  SET_RGB: 'F4',           // Set RGB color (with optional loop for color cycling)
  SET_SPEED: 'F6',         // Set effect speed (for strobe/pulsing)
  
  // Appearance
  SET_EYE: 'F9',           // Set eye icon
  SET_MOVEMENT: 'CA',      // Set movement animation
};

// Response Prefixes
export const RESPONSES = {
  DEVICE_PARAMS: 'BBE0',     // Device parameters response
  LIVE_STATUS: 'BBE1',       // Live status response
  CAPACITY: 'BBD2',          // Capacity response
  ORDER: 'BBD1',             // Play order response
  FILE_INFO: 'BBD0',         // File info response
  VOLUME: 'BBE5',            // Volume response
  BT_NAME: 'BBE6',           // BT name response
  ENABLE_CLASSIC_BT: 'BBFD', // Enable classic BT response

  TRANSFER_START: 'BBC0',    // Transfer start ACK
  CHUNK_DROPPED: 'BBC1',     // Chunk dropped (resend request)
  TRANSFER_END: 'BBC2',      // Transfer end ACK
  CONFIRM_TRANSFER_ACK: 'BBC3', // Confirm transfer ACK
  CANCEL_ACK: 'BBC4',        // Cancel ACK
  RESUME_ACK: 'BBC5',        // Resume ACK
  PLAY_ACK: 'BBC6',          // Play/pause ACK
  DELETE_ACK: 'BBC7',        // Delete ACK
  FORMAT_ACK: 'BBC8',        // Format ACK

  KEEPALIVE: 'FEDC',         // Keepalive packet
};

// Lighting Modes
export const LIGHTING_MODES = {
  STATIC: 1,
  STROBE: 2,
  PULSING: 3,
};

// Warning Messages
export const WARNINGS = {
  LONG_TRACK: 'Uploading a track longer than 30 seconds is experimental, please proceed with caution.',
  SLOW_UPLOAD: 'File uploads can take several minutes due to Bluetooth limitations. The device may appear frozen during this time but is still transferring data.',
};

// Log CSS Classes
export const LOG_CLASSES = {
  NORMAL: '',
  WARNING: 'warn',
  TX: 'tx',
  RX: 'rx',
};

// Default Values
export const DEFAULTS = {
  CHANNEL_COUNT: 6,
  TARGET_CHANNEL: 'FF', // All channels
  VOLUME: 0,
  BRIGHTNESS: 255,
  COLOR_RED: 255,
  COLOR_GREEN: 0,
  COLOR_BLUE: 0,
  EYE_ICON: 1,
  LIGHTING_MODE: LIGHTING_MODES.STATIC,
  SPEED: 0,
};

// File name marker in protocol
export const PROTOCOL_MARKERS = {
  FILENAME: '5C55', // UTF16LE filename marker
};
