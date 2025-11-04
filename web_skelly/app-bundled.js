/**
 * Skelly Ultra - Bundled Version
 * All modules combined into a single file for file:// protocol compatibility
 * 
 * Generated: 2025-11-04T07:35:06.798059
 * 
 * This is an automatically generated file.
 * To modify, edit the source modules in js/ and app-modular.js, 
 * then rebuild with: build-bundle.bat (or python3 bundle.py)
 * 
 * Source modules:
 *   - js/constants.js
 *   - js/protocol.js
 *   - js/state-manager.js
 *   - js/ble-manager.js
 *   - js/file-manager.js
 *   - js/protocol-parser.js
 *   - js/edit-modal.js
 *   - app-modular.js
 */

(() => {
  'use strict';

  // ============================================================
  // Constants and Configuration (js/constants.js)
  // ============================================================
/**
 * Constants and Configuration
 * Central location for all application constants, UUIDs, and configuration values
 */

// BLE Service UUIDs
const BLE_CONFIG = {
  SERVICE_UUID: '0000ae00-0000-1000-8000-00805f9b34fb',
  WRITE_UUID: '0000ae01-0000-1000-8000-00805f9b34fb',
  NOTIFY_UUID: '0000ae02-0000-1000-8000-00805f9b34fb',
};

// LocalStorage Keys
const STORAGE_KEYS = {
  RISK_ACK: 'skelly_ack_v2',
  LONG_TRACK_ACK: 'skelly_long_track_ack',
  SLOW_UPLOAD_ACK: 'skelly_slow_upload_ack',
  ADV_RAW: 'skelly_adv_raw',
  ADV_FEDC: 'skelly_adv_fedc',
  ADV_EDIT: 'skelly_adv_edit',
};

// Protocol Padding Defaults (bytes)
const PADDING = {
  DEFAULT: 8,
  QUERY: 8,
  MEDIA: 8,
};

// File Transfer Configuration
const TRANSFER_CONFIG = {
  MTU_SIZE: 512,
  MTU_OVERHEAD: 12, // BLE (3) + command (2) + safety margin (7)
  CHUNK_SIZE: 500,  // MTU - overhead for reliable transmission
  CHUNK_DELAY_MS: 50,
  EDIT_CHUNK_DELAY_MS: 12,
};

// Timeout Values (milliseconds)
const TIMEOUTS = {
  ACK: 3000,
  ACK_LONG: 5000,
  FILE_TRANSFER: 240000,
  FILE_LIST: 6000,
  CONNECTION: 5000,
};

// Audio Configuration
const AUDIO_CONFIG = {
  LONG_TRACK_LIMIT_SECONDS: 30,
  TARGET_SAMPLE_RATE: 8000,
  TARGET_CHANNELS: 1, // mono
  DEFAULT_MP3_KBPS: 32,
  MP3_ENCODE_BLOCK_SIZE: 1152,
};

// Movement Bitfield Definitions
const MOVEMENT_BITS = {
  HEAD: 0b001,   // bit 0
  ARM: 0b010,    // bit 1
  TORSO: 0b100,  // bit 2
  ALL_ON: 255,   // special value for all movements enabled
};

// BLE Command Tags
const COMMANDS = {
  // File Transfer
  START_TRANSFER: 'C0',    // Initialize file transfer
  CHUNK_DATA: 'C1',        // Send data chunk
  END_TRANSFER: 'C2',      // End file transfer
  RENAME: 'C3',            // Rename/commit file
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
  MEDIA_BT: 'FD',          // Bluetooth audio (payload: 01)
  
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
const RESPONSES = {
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
  RENAME_ACK: 'BBC3',        // Rename ACK
  CANCEL_ACK: 'BBC4',        // Cancel ACK
  RESUME_ACK: 'BBC5',        // Resume ACK
  PLAY_ACK: 'BBC6',          // Play/pause ACK
  DELETE_ACK: 'BBC7',        // Delete ACK
  FORMAT_ACK: 'BBC8',        // Format ACK

  KEEPALIVE: 'FEDC',         // Keepalive packet
};

// Lighting Modes
const LIGHTING_MODES = {
  STATIC: 1,
  STROBE: 2,
  PULSING: 3,
};

// Warning Messages
const WARNINGS = {
  LONG_TRACK: 'Uploading a track longer than 30 seconds is experimental, please proceed with caution.',
  SLOW_UPLOAD: 'File uploads can take several minutes due to Bluetooth limitations. The device may appear frozen during this time but is still transferring data.',
};

// Log CSS Classes
const LOG_CLASSES = {
  NORMAL: '',
  WARNING: 'warn',
  TX: 'tx',
  RX: 'rx',
};

// Default Values
const DEFAULTS = {
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
const PROTOCOL_MARKERS = {
  FILENAME: '5C55', // UTF16LE filename marker
};

  // ============================================================
  // Protocol Utilities (js/protocol.js)
  // ============================================================
/**
 * Protocol Utilities
 * Handles BLE protocol encoding/decoding, CRC calculation, and command building
 */

/**
 * Calculate CRC8 checksum for BLE protocol
 * @param {Uint8Array} bytes - Input bytes
 * @returns {string} - 2-character hex string
 */
function crc8(bytes) {
  let crc = 0;
  for (const b of bytes) {
    let x = crc ^ b;
    for (let i = 0; i < 8; i++) {
      x = (x & 1) ? ((x >>> 1) ^ 0x8C) : (x >>> 1);
    }
    crc = x & 0xFF;
  }
  return crc.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string (spaces allowed)
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  if (!hex) return new Uint8Array();
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Hex length must be even');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} u8 - Byte array
 * @returns {string} - Uppercase hex string
 */
function bytesToHex(u8) {
  return Array.from(u8, b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

/**
 * Convert integer to hex string with specified byte length
 * @param {number} n - Integer value
 * @param {number} bytes - Number of bytes
 * @returns {string} - Uppercase hex string
 */
function intToHex(n, bytes) {
  return (n >>> 0).toString(16).toUpperCase().padStart(bytes * 2, '0').slice(-bytes * 2);
}

/**
 * Convert string to UTF16-LE hex representation
 * @param {string} str - Input string
 * @returns {string} - Uppercase hex string
 */
function utf16leHex(str) {
  if (!str) return '';
  let hex = '';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFFFF) {
      const lo = cp & 0xFF;
      const hi = (cp >> 8) & 0xFF;
      hex += lo.toString(16).padStart(2, '0') + hi.toString(16).padStart(2, '0');
    } else {
      // Surrogate pair for characters outside BMP
      const v = cp - 0x10000;
      const hiS = 0xD800 + ((v >> 10) & 0x3FF);
      const loS = 0xDC00 + (v & 0x3FF);
      hex += (hiS & 0xFF).toString(16).padStart(2, '0') + 
             ((hiS >> 8) & 0xFF).toString(16).padStart(2, '0');
      hex += (loS & 0xFF).toString(16).padStart(2, '0') + 
             ((loS >> 8) & 0xFF).toString(16).padStart(2, '0');
    }
  }
  return hex.toUpperCase();
}

/**
 * Decode UTF16-LE bytes to string
 * @param {Uint8Array} u8 - Byte array
 * @returns {string} - Decoded string
 */
function decodeUtf16le(u8) {
  let s = '';
  for (let i = 0; i + 1 < u8.length; i += 2) {
    const lo = u8[i];
    const hi = u8[i + 1];
    const code = (hi << 8) | lo;
    if (code === 0) continue;
    s += String.fromCharCode(code);
  }
  return s;
}

/**
 * Build a BLE command with proper formatting and CRC
 * @param {string} tag - Command tag (2 hex chars)
 * @param {string} payloadHex - Payload as hex string
 * @param {number} minBytes - Minimum payload bytes (for padding)
 * @returns {Uint8Array} - Complete command bytes with CRC
 */
function buildCommand(tag, payloadHex = '', minBytes = PADDING.DEFAULT) {
  const p = (payloadHex || '').replace(/\s+/g, '').toUpperCase();
  const minLen = Math.max(0, (minBytes | 0) * 2);
  const padded = p.length < minLen ? p + '0'.repeat(minLen - p.length) : p;
  const base = 'AA' + tag.toUpperCase() + padded;
  const crcValue = crc8(hexToBytes(base));
  return hexToBytes(base + crcValue);
}

/**
 * Extract ASCII string from hex
 * @param {string} hexString - Hex string
 * @returns {string} - ASCII string (printable chars only)
 */
function getAsciiFromHex(hexString) {
  const clean = hexString.replace(/[^0-9A-F]/gi, '');
  const u8 = hexToBytes(clean);
  let out = '';
  for (const b of u8) {
    if (b >= 32 && b <= 126) {
      out += String.fromCharCode(b);
    }
  }
  return out.trim();
}

/**
 * Build filename payload with marker
 * @param {string} name - Filename
 * @returns {Object} - {nameHex, nameLenHex, fullPayload}
 */
function buildFilenamePayload(name) {
  if (!name || !name.trim()) {
    return {
      nameHex: '',
      nameLenHex: '00',
      fullPayload: '00',
    };
  }
  
  const nameHex = utf16leHex(name.trim());
  const nameLenHex = intToHex((nameHex.length / 2) + 2, 1);
  const fullPayload = nameLenHex + PROTOCOL_MARKERS.FILENAME + nameHex;
  
  return { nameHex, nameLenHex, fullPayload };
}

/**
 * Convert data chunk to hex (no padding)
 * @param {Uint8Array} u8 - Full data
 * @param {number} offset - Start offset
 * @param {number} length - Chunk length
 * @returns {string} - Hex string
 */
function chunkToHex(u8, offset, length) {
  const end = Math.min(offset + length, u8.length);
  const chunk = u8.subarray(offset, end);
  return Array.from(chunk, b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

/**
 * Clamp a number between min and max
 * @param {number} n - Input number
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters
 * @param {string} s - Input string
 * @returns {string} - Escaped string
 */
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));
}

/**
 * Normalize device name for comparison
 * @param {string} s - Device name
 * @returns {string} - Normalized name
 */
function normalizeDeviceName(s) {
  return (s || '').trim().toLowerCase();
}

  // ============================================================
  // State Manager (js/state-manager.js)
  // ============================================================
/**
 * State Manager
 * Centralized application state with observer pattern for reactive updates
 */

/**
 * Application State Manager
 * Manages device status, file list, and transfer state with change notifications
 */
class StateManager {
  constructor() {
    // Device state
    this.device = {
      name: '',
      btName: '',
      connected: false,
      showMode: null,
      channels: [],
      volume: null,
      capacity: null,
      filesReported: null,
      order: null, // Music play order
      pin: null, // Device PIN
    };

    // Live status (action, eye icon, lights)
    this.live = {
      action: null,
      eye: null,
      lights: [],
    };

    // File list state
    this.files = {
      expected: null,
      items: new Map(), // serial -> file object
      activeFetch: false,
      fetchTimer: null,
      afterCompleteSent: false,
    };

    // Transfer state
    this.transfer = {
      inProgress: false,
      cancel: false,
      resumeFrom: null,
      chunks: new Map(), // index -> payload hex
      currentFile: null,
    };

    // Edit modal state
    this.editModal = {
      serial: null,
      cluster: 0,
      name: '',
      eye: 1,
    };

    // Observers: key -> Set of callbacks
    this.observers = new Map();
    
    // Build flag
    this.targetsBuiltFromE0 = false;
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch (e.g., 'device', 'files', 'transfer')
   * @param {Function} callback - Callback function to invoke on changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }
    this.observers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const observers = this.observers.get(key);
      if (observers) {
        observers.delete(callback);
      }
    };
  }

  /**
   * Notify observers of state changes
   * @param {string} key - State key that changed
   */
  notify(key) {
    const observers = this.observers.get(key);
    if (observers) {
      observers.forEach(callback => {
        try {
          callback(this[key]);
        } catch (error) {
          console.error(`Error in observer for ${key}:`, error);
        }
      });
    }
  }

  // === Device State Methods ===

  /**
   * Update device state
   * @param {Object} updates - Partial device state updates
   */
  updateDevice(updates) {
    Object.assign(this.device, updates);
    this.notify('device');
  }

  /**
   * Set connection status
   * @param {boolean} connected - Connection status
   */
  setConnected(connected) {
    this.device.connected = connected;
    this.notify('device');
  }

  /**
   * Update live status
   * @param {Object} updates - Partial live status updates
   */
  updateLive(updates) {
    Object.assign(this.live, updates);
    this.notify('live');
  }

  // === File State Methods ===

  /**
   * Reset file list
   */
  resetFiles() {
    this.files.expected = null;
    this.files.items.clear();
    this.files.activeFetch = false;
    this.files.afterCompleteSent = false;
    if (this.files.fetchTimer) {
      clearTimeout(this.files.fetchTimer);
      this.files.fetchTimer = null;
    }
    this.notify('files');
  }

  /**
   * Add or update a file in the list
   * @param {number} serial - File serial number
   * @param {Object} fileData - File data object
   */
  setFile(serial, fileData) {
    this.files.items.set(serial, fileData);
    this.notify('files');
  }

  /**
   * Get file by serial number
   * @param {number} serial - File serial number
   * @returns {Object|undefined} - File data or undefined
   */
  getFile(serial) {
    return this.files.items.get(serial);
  }

  /**
   * Check if a filename exists on device
   * @param {string} name - Filename to check
   * @returns {Object|null} - File object if found, null otherwise
   */
  hasFileName(name) {
    if (!name) return null;
    const needle = name.trim().toLowerCase();
    for (const file of this.files.items.values()) {
      if ((file.name || '').trim().toLowerCase() === needle) {
        return file;
      }
    }
    return null;
  }

  /**
   * Update file list metadata
   * @param {Object} updates - Updates to files metadata
   */
  updateFilesMetadata(updates) {
    Object.assign(this.files, updates);
    this.notify('files');
  }

  /**
   * Check if file list is complete
   * @returns {boolean}
   */
  isFileListComplete() {
    return this.files.expected !== null && 
           this.files.items.size >= this.files.expected;
  }

  // === Transfer State Methods ===

  /**
   * Start a transfer
   * @param {string} fileName - Name of file being transferred
   */
  startTransfer(fileName) {
    this.transfer.inProgress = true;
    this.transfer.cancel = false;
    this.transfer.resumeFrom = null;
    this.transfer.chunks.clear();
    this.transfer.currentFile = fileName;
    this.notify('transfer');
  }

  /**
   * Cancel transfer
   */
  cancelTransfer() {
    this.transfer.cancel = true;
    this.notify('transfer');
  }

  /**
   * End transfer
   */
  endTransfer() {
    this.transfer.inProgress = false;
    this.transfer.cancel = false;
    this.transfer.currentFile = null;
    this.transfer.chunks.clear();
    this.notify('transfer');
  }

  /**
   * Set resume point for transfer
   * @param {number} index - Chunk index to resume from
   */
  setResumePoint(index) {
    this.transfer.resumeFrom = index;
    this.notify('transfer');
  }

  /**
   * Store a chunk for potential resend
   * @param {number} index - Chunk index
   * @param {string} payload - Chunk payload hex
   */
  storeChunk(index, payload) {
    this.transfer.chunks.set(index, payload);
  }

  /**
   * Get stored chunk
   * @param {number} index - Chunk index
   * @returns {string|undefined} - Chunk payload hex or undefined
   */
  getChunk(index) {
    return this.transfer.chunks.get(index);
  }

  // === Edit Modal State Methods ===

  /**
   * Open edit modal with file data
   * @param {Object} fileData - File data object
   */
  openEditModal(fileData) {
    this.editModal.serial = fileData.serial;
    this.editModal.cluster = fileData.cluster;
    this.editModal.name = fileData.name || '';
    this.editModal.eye = fileData.eye || 1;
    this.notify('editModal');
  }

  /**
   * Update edit modal state
   * @param {Object} updates - Partial edit modal updates
   */
  updateEditModal(updates) {
    Object.assign(this.editModal, updates);
    this.notify('editModal');
  }

  /**
   * Close edit modal
   */
  closeEditModal() {
    this.editModal.serial = null;
    this.notify('editModal');
  }

  // === Utility Methods ===

  /**
   * Get current state snapshot
   * @returns {Object} - Complete state object
   */
  getSnapshot() {
    return {
      device: { ...this.device },
      live: { ...this.live },
      files: {
        ...this.files,
        items: new Map(this.files.items),
      },
      transfer: {
        ...this.transfer,
        chunks: new Map(this.transfer.chunks),
      },
      editModal: { ...this.editModal },
    };
  }

  /**
   * Reset all state
   */
  reset() {
    this.device = {
      name: '',
      btName: '',
      connected: false,
      showMode: null,
      channels: [],
      volume: null,
      capacity: null,
      filesReported: null,
    };
    this.live = {
      action: null,
      eye: null,
      lights: [],
    };
    this.resetFiles();
    this.endTransfer();
    this.editModal = {
      serial: null,
      cluster: 0,
      name: '',
      eye: 1,
    };
    this.targetsBuiltFromE0 = false;
    
    // Notify all observers
    this.notify('device');
    this.notify('live');
    this.notify('files');
    this.notify('transfer');
    this.notify('editModal');
  }
}

  // ============================================================
  // BLE Manager (js/ble-manager.js)
  // ============================================================
/**
 * BLE Manager
 * Handles all Bluetooth Low Energy communication with the device
 */

/**
 * BLE Connection and Communication Manager
 */
class BLEManager {
  constructor(stateManager, logger) {
    this.state = stateManager;
    this.log = logger;
    
    // BLE objects
    this.device = null;
    this.server = null;
    this.service = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    
    // Connection state
    this.isConnecting = false;
    
    // Notification handlers
    this.notificationHandlers = [];
    
    // ACK waiters for request/response patterns
    this.waiters = [];
    
    // Bind methods to preserve 'this' context
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleNotification = this.handleNotification.bind(this);
  }

  /**
   * Check if device is connected
   * @returns {boolean}
   */
  isConnected() {
    return !!(
      this.device &&
      this.device.gatt &&
      this.device.gatt.connected &&
      this.writeCharacteristic
    );
  }

  /**
   * Connect to a BLE device
   * @param {string} nameFilter - Optional device name prefix filter
   * @returns {Promise<void>}
   */
  async connect(nameFilter = '') {
    try {
      // Set connecting flag to prevent disconnect handler from clearing device during retries
      this.isConnecting = true;
      
      // Request device
      const options = nameFilter.trim()
        ? {
            filters: [{ namePrefix: nameFilter.trim() }],
            optionalServices: [BLE_CONFIG.SERVICE_UUID],
          }
        : {
            acceptAllDevices: true,
            optionalServices: [BLE_CONFIG.SERVICE_UUID],
          };

      this.device = await navigator.bluetooth.requestDevice(options);
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
      
      this.log(`Selected: ${this.device.name || '(unnamed)'} ${this.device.id}`, LOG_CLASSES.WARNING);

      // Connect to GATT server with retry logic
      const maxRetries = 3;
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add small delay before connection attempt (helps with timing issues)
          if (attempt > 1) {
            this.log(`Retry ${attempt}/${maxRetries}...`, LOG_CLASSES.WARNING);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Connect to GATT server
          this.server = await this.device.gatt.connect();
          
          // Small delay after connection to let it stabilize
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify still connected
          if (!this.server.connected) {
            throw new Error('Connection lost immediately after connect');
          }
          
          this.service = await this.server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);
          
          // Get characteristics
          this.writeCharacteristic = await this.service.getCharacteristic(BLE_CONFIG.WRITE_UUID);
          this.notifyCharacteristic = await this.service.getCharacteristic(BLE_CONFIG.NOTIFY_UUID);
          
          // Start notifications
          await this.notifyCharacteristic.startNotifications();
          this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotification);

          // Update state
          this.state.updateDevice({
            name: this.device.name || '',
            connected: true,
          });

          this.log('Connected and notifications started ✓', LOG_CLASSES.WARNING);
          
          // Clear connecting flag on success
          this.isConnecting = false;
          
          return true;
        } catch (error) {
          lastError = error;
          
          // Don't retry if it's a user cancellation or device not found
          if (error.message.includes('User cancelled') || 
              error.message.includes('No device selected')) {
            throw error;
          }
          
          // If not the last attempt, continue to retry
          if (attempt < maxRetries) {
            this.log(`Connection attempt ${attempt} failed: ${error.message}`, LOG_CLASSES.WARNING);
            continue;
          }
        }
      }
      
      // All retries exhausted
      throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
      
    } catch (error) {
      this.log(`Connect error: ${error.message}`, LOG_CLASSES.WARNING);
      
      // Clear connecting flag on error
      this.isConnecting = false;
      
      // Clean up on connection failure
      if (this.device) {
        this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
        this.device = null;
      }
      this.server = null;
      this.service = null;
      this.writeCharacteristic = null;
      this.notifyCharacteristic = null;
      this.state.setConnected(false);
      
      throw error;
    }
  }

  /**
   * Disconnect from device
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      // Stop notifications
      if (this.notifyCharacteristic) {
        try {
          await this.notifyCharacteristic.stopNotifications();
        } catch (error) {
          // Ignore errors during cleanup
        }
        this.notifyCharacteristic.removeEventListener('characteristicvaluechanged', this.handleNotification);
      }

      // Disconnect GATT
      if (this.device && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }
    } finally {
      this.handleDisconnect();
    }
  }

  /**
   * Handle disconnect event
   */
  handleDisconnect() {
    // If we're in the middle of connecting, don't clear the device reference
    // as the retry logic needs it. Only log the disconnect.
    if (this.isConnecting) {
      this.log('Disconnected during connection attempt (will retry)', LOG_CLASSES.WARNING);
      return;
    }
    
    this.log('Disconnected', LOG_CLASSES.WARNING);
    
    // Clear BLE objects
    this.device = null;
    this.server = null;
    this.service = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    
    // Clear waiters
    this.waiters.splice(0);
    
    // Update state
    this.state.setConnected(false);
    this.state.updateFilesMetadata({ activeFetch: false });
    if (this.state.files.fetchTimer) {
      clearTimeout(this.state.files.fetchTimer);
    }
  }

  /**
   * Send command bytes to device
   * @param {Uint8Array} commandBytes - Command bytes to send
   * @returns {Promise<void>}
   */
  async send(commandBytes) {
    if (!this.isConnected()) {
      this.log('Not connected', LOG_CLASSES.WARNING);
      throw new Error('Device not connected');
    }

    const hex = bytesToHex(commandBytes);
    this.log(`TX ${hex}`, LOG_CLASSES.TX);
    
    await this.writeCharacteristic.writeValue(commandBytes);
  }

  /**
   * Handle incoming notification
   * @param {Event} event - Characteristic value changed event
   */
  handleNotification(event) {
    const value = new Uint8Array(event.target.value.buffer);
    const hex = bytesToHex(value);
    
    this.log(`RX ${hex}`, LOG_CLASSES.RX);

    // Notify all registered handlers
    for (const handler of this.notificationHandlers) {
      try {
        handler(hex, value);
      } catch (error) {
        console.error('Error in notification handler:', error);
      }
    }

    // Handle waiters for request/response patterns
    this.handleWaiters(hex);
  }

  /**
   * Register a notification handler
   * @param {Function} handler - Handler function (hex, bytes) => void
   * @returns {Function} - Unsubscribe function
   */
  onNotification(handler) {
    this.notificationHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.notificationHandlers.indexOf(handler);
      if (index >= 0) {
        this.notificationHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Wait for a response with specific prefix
   * @param {string} prefix - Response prefix to wait for
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<string>} - Response hex string
   */
  waitForResponse(prefix, timeoutMs = TIMEOUTS.ACK) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${prefix}`));
      }, timeoutMs);

      const waiter = {
        prefix,
        resolve,
        reject,
        timer,
      };

      this.waiters.push(waiter);
    });
  }

  /**
   * Handle waiters by checking if any match the received response
   * @param {string} hex - Received hex string
   */
  handleWaiters(hex) {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const waiter = this.waiters[i];
      if (hex.startsWith(waiter.prefix)) {
        clearTimeout(waiter.timer);
        waiter.resolve(hex);
        this.waiters.splice(i, 1);
      }
    }
  }

  /**
   * Clear all pending waiters (useful on disconnect)
   */
  clearWaiters() {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Cleared'));
    }
    this.waiters.splice(0);
  }

  /**
   * Get device info
   * @returns {Object|null} - Device info or null if not connected
   */
  getDeviceInfo() {
    if (!this.device) return null;
    
    return {
      name: this.device.name || 'Unknown',
      id: this.device.id,
      connected: this.isConnected(),
    };
  }
}

  // ============================================================
  // File Manager (js/file-manager.js)
  // ============================================================
/**
 * File Manager
 * Handles file transfers, audio conversion, and file list management
 */

/**
 * File Transfer and Management
 */
class FileManager {
  constructor(bleManager, stateManager, logger, progressCallback = null) {
    this.ble = bleManager;
    this.state = stateManager;
    this.log = logger;
    this.onProgress = progressCallback;
    
    // File picker state
    this.lastPickedFile = null;
    this.lastOriginalBytes = null;
    this.lastFileBytes = null;
    this.lastFileName = '';
  }

  /**
   * Start fetching file list from device
   * @param {boolean} triggerChain - Whether to trigger subsequent queries
   * @returns {Promise<void>}
   */
  async startFetchFiles(triggerChain = false) {
    if (!this.ble.isConnected()) {
      this.log('Not connected — cannot refresh files.', LOG_CLASSES.WARNING);
      return;
    }

    this.state.resetFiles();
    this.state.updateFilesMetadata({ activeFetch: true });

    // Send query command
    await this.ble.send(buildCommand(COMMANDS.QUERY_FILES, '', 8));

    // Set timeout for no response
    const timer = setTimeout(() => {
      if (!this.state.files.expected && this.state.files.items.size === 0) {
        this.state.updateFilesMetadata({ activeFetch: false });
        this.log('No file info received (timeout).', LOG_CLASSES.WARNING);
      }
    }, TIMEOUTS.FILE_LIST);

    this.state.updateFilesMetadata({
      fetchTimer: timer,
      afterCompleteSent: !triggerChain,
    });
  }

  /**
   * Check if file list is complete and trigger follow-up queries
   */
  finalizeFilesIfDone() {
    if (!this.state.files.activeFetch || !this.state.files.expected) {
      return;
    }

    if (this.state.isFileListComplete()) {
      this.state.updateFilesMetadata({ activeFetch: false });
      if (this.state.files.fetchTimer) {
        clearTimeout(this.state.files.fetchTimer);
      }

      this.log('File list complete ✔', LOG_CLASSES.WARNING);

      if (!this.state.files.afterCompleteSent) {
        this.state.updateFilesMetadata({ afterCompleteSent: true });
      }
    }
  }

  /**
   * Upload file to device
   * @param {Uint8Array} fileBytes - File data
   * @param {string} fileName - Target filename
   * @returns {Promise<void>}
   */
  async uploadFile(fileBytes, fileName) {
    if (!this.ble.isConnected()) {
      this.log('Not connected — cannot send file.', LOG_CLASSES.WARNING);
      throw new Error('Device not connected');
    }

    this.state.startTransfer(fileName);

    try {
      // === Phase 1: Start Transfer (C0) ===
      const size = fileBytes.length;
      const chunkSize = TRANSFER_CONFIG.CHUNK_SIZE;
      const maxPackets = Math.ceil(size / chunkSize);
      const nameHex = utf16leHex(fileName);

      const c0Payload = intToHex(size, 4) + intToHex(maxPackets, 2) + '5C55' + nameHex;
      await this.ble.send(buildCommand(COMMANDS.START_TRANSFER, c0Payload, 8));

      // Wait for start acknowledgment
      const c0Response = await this.ble.waitForResponse(RESPONSES.TRANSFER_START, TIMEOUTS.ACK_LONG);
      if (!c0Response) {
        throw new Error('Timeout waiting for transfer start acknowledgment');
      }

      const c0Failed = parseInt(c0Response.slice(4, 6), 16);
      const c0Written = parseInt(c0Response.slice(6, 14), 16) || 0;

      if (c0Failed !== 0) {
        throw new Error('Device rejected transfer start');
      }

      // Resume from last written position if applicable
      let startIndex = Math.floor(c0Written / chunkSize);
      if (startIndex > 0) {
        this.log(`Resuming at chunk ${startIndex} (written=${c0Written})`, LOG_CLASSES.WARNING);
      }

      // === Phase 2: Send Data Chunks (C1) ===
      for (let index = startIndex; index < maxPackets; index++) {
        if (!this.ble.isConnected()) {
          throw new Error('Disconnected during transfer');
        }

        if (this.state.transfer.cancel) {
          throw new Error('Transfer cancelled');
        }

        // Handle resume request from device
        if (this.state.transfer.resumeFrom !== null) {
          index = this.state.transfer.resumeFrom;
          this.state.setResumePoint(null);
        }

        const offset = index * chunkSize;
        const dataHex = chunkToHex(fileBytes, offset, chunkSize);
        const payload = intToHex(index, 2) + dataHex;

        // Store chunk for potential resend
        this.state.storeChunk(index, payload);

        await this.ble.send(buildCommand(COMMANDS.CHUNK_DATA, payload, 0));
        
        // Update progress
        if (this.onProgress) {
          this.onProgress(index + 1, maxPackets);
        }
        
        await sleep(TRANSFER_CONFIG.CHUNK_DELAY_MS);
      }

      // === Phase 3: End Transfer (C2) ===
      await this.ble.send(buildCommand(COMMANDS.END_TRANSFER, '', 8));

      const c2Response = await this.ble.waitForResponse(
        RESPONSES.TRANSFER_END,
        TIMEOUTS.FILE_TRANSFER
      );

      if (!c2Response) {
        throw new Error('Timeout waiting for transfer end acknowledgment');
      }

      const c2Failed = parseInt(c2Response.slice(4, 6), 16);
      if (c2Failed !== 0) {
        // Device may request resume
        const lastIndex = c2Response.length >= 10 ? parseInt(c2Response.slice(6, 10), 16) : 0;
        this.state.setResumePoint(lastIndex);

        // Resend tail chunks
        let tailIndex = Math.min(maxPackets, Math.max(0, this.state.transfer.resumeFrom));
        while (tailIndex < maxPackets) {
          if (this.state.transfer.cancel) {
            throw new Error('Transfer cancelled');
          }

          const payload = this.state.getChunk(tailIndex);
          if (!payload) break;

          await this.ble.send(buildCommand(COMMANDS.CHUNK_DATA, payload, 0));
          tailIndex += 1;
          await sleep(TRANSFER_CONFIG.EDIT_CHUNK_DELAY_MS);
        }
      }

      // === Phase 4: Rename/Commit (C3) ===
      const c3Payload = '5C55' + nameHex;
      await this.ble.send(buildCommand(COMMANDS.RENAME, c3Payload, 8));

      const c3Response = await this.ble.waitForResponse(RESPONSES.RENAME_ACK, TIMEOUTS.ACK);
      if (!c3Response) {
        throw new Error('Timeout waiting for rename acknowledgment');
      }

      const c3Failed = parseInt(c3Response.slice(4, 6), 16);
      if (c3Failed !== 0) {
        throw new Error('Device failed final rename');
      }

      this.log('File transfer complete ✔', LOG_CLASSES.WARNING);

      // Refresh file list
      this.startFetchFiles();
    } catch (error) {
      this.log(`File send error: ${error.message}`, LOG_CLASSES.WARNING);
      throw error;
    } finally {
      this.state.endTransfer();
    }
  }

  /**
   * Cancel ongoing transfer
   * @returns {Promise<void>}
   */
  async cancelTransfer() {
    if (!this.state.transfer.inProgress) {
      return;
    }

    this.state.cancelTransfer();

    if (this.ble.isConnected()) {
      try {
        await this.ble.send(buildCommand(COMMANDS.CANCEL, '', 8));
      } catch (error) {
        this.log(`Cancel command error: ${error.message}`, LOG_CLASSES.WARNING);
      }
    }
  }

  /**
   * Play a file by serial number
   * @param {number} serial - File serial number
   * @returns {Promise<void>}
   */
  async playFile(serial) {
    if (!this.ble.isConnected()) {
      this.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }

    const payload = intToHex(serial, 2) + '01';
    await this.ble.send(buildCommand(COMMANDS.PLAY_PAUSE, payload, 8));
  }

  /**
   * Delete a file
   * @param {number} serial - File serial number
   * @param {number} cluster - File cluster
   * @returns {Promise<void>}
   */
  async deleteFile(serial, cluster) {
    if (!this.ble.isConnected()) {
      this.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }

    const payload = intToHex(serial, 2) + intToHex(cluster, 4);
    await this.ble.send(buildCommand(COMMANDS.DELETE, payload));
    this.log(`Delete request (C7) serial=${serial} cluster=${cluster}`, LOG_CLASSES.WARNING);
  }

  /**
   * Store file picker data
   * @param {File} file - Selected file
   * @param {Uint8Array} originalBytes - Original file bytes
   * @param {Uint8Array} processedBytes - Processed file bytes (may be converted)
   * @param {string} fileName - Final filename
   */
  storeFilePickerData(file, originalBytes, processedBytes, fileName) {
    this.lastPickedFile = file;
    this.lastOriginalBytes = originalBytes;
    this.lastFileBytes = processedBytes;
    this.lastFileName = fileName;
  }

  /**
   * Get stored file data
   * @returns {Object} - {file, originalBytes, fileBytes, fileName}
   */
  getFilePickerData() {
    return {
      file: this.lastPickedFile,
      originalBytes: this.lastOriginalBytes,
      fileBytes: this.lastFileBytes,
      fileName: this.lastFileName,
    };
  }

  /**
   * Clear file picker data
   */
  clearFilePickerData() {
    this.lastPickedFile = null;
    this.lastOriginalBytes = null;
    this.lastFileBytes = null;
    this.lastFileName = '';
  }
}

/**
 * Audio Converter
 * Handles audio file conversion to device-compatible format
 */
class AudioConverter {
  constructor(logger) {
    this.log = logger;
  }

  /**
   * Get audio duration from file
   * @param {File} file - Audio file
   * @returns {Promise<number|null>} - Duration in seconds or null
   */
  async getAudioDuration(file) {
    // Try HTML audio element first (fast)
    try {
      const duration = await this.getDurationViaAudioElement(file);
      if (duration) return duration;
    } catch (error) {
      // Fall through to Web Audio API
    }

    // Fallback: decode with Web Audio API
    try {
      return await this.getDurationViaWebAudio(file);
    } catch (error) {
      this.log(`Failed to get audio duration: ${error.message}`, LOG_CLASSES.WARNING);
      return null;
    }
  }

  /**
   * Get duration via HTML audio element
   * @private
   */
  getDurationViaAudioElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(url);
        if (isFinite(duration) && duration > 0) {
          resolve(duration);
        } else {
          reject(new Error('Non-finite duration'));
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Audio element failed'));
      };

      audio.src = url;
    });
  }

  /**
   * Get duration via Web Audio API
   * @private
   */
  async getDurationViaWebAudio(file) {
    const buffer = await file.arrayBuffer();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error('Web Audio API not supported');
    }

    const context = new AudioContext();
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    context.close?.();

    return audioBuffer?.duration ?? null;
  }

  /**
   * Convert audio file to device-compatible MP3
   * @param {File} file - Source audio file
   * @param {number} kbps - Target bitrate
   * @returns {Promise<{u8: Uint8Array, name: string}>}
   */
  async convertToDeviceMp3(file, kbps = AUDIO_CONFIG.DEFAULT_MP3_KBPS) {
    if (typeof lamejs === 'undefined' || !lamejs.Mp3Encoder) {
      throw new Error('MP3 encoder library (lamejs) not loaded');
    }

    // Decode audio
    const buffer = await file.arrayBuffer();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error('Web Audio API not supported');
    }

    const context = new AudioContext();
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    context.close?.();

    // Downmix to mono
    const monoData = this.downmixToMono(audioBuffer);

    // Resample to target rate
    const resampledData = this.resampleLinear(
      monoData,
      audioBuffer.sampleRate,
      AUDIO_CONFIG.TARGET_SAMPLE_RATE
    );

    // Convert to 16-bit PCM
    const pcm16 = this.floatTo16BitPCM(resampledData);

    // Encode to MP3
    const encoder = new lamejs.Mp3Encoder(
      AUDIO_CONFIG.TARGET_CHANNELS,
      AUDIO_CONFIG.TARGET_SAMPLE_RATE,
      kbps | 0 || AUDIO_CONFIG.DEFAULT_MP3_KBPS
    );

    const blockSize = AUDIO_CONFIG.MP3_ENCODE_BLOCK_SIZE;
    const mp3Parts = [];

    for (let i = 0; i < pcm16.length; i += blockSize) {
      const chunk = pcm16.subarray(i, Math.min(i + blockSize, pcm16.length));
      const mp3Data = encoder.encodeBuffer(chunk);
      if (mp3Data?.length) {
        mp3Parts.push(mp3Data);
      }
    }

    const endData = encoder.flush();
    if (endData?.length) {
      mp3Parts.push(endData);
    }

    // Create output
    const mp3Blob = new Blob(mp3Parts, { type: 'audio/mpeg' });
    const u8 = new Uint8Array(await mp3Blob.arrayBuffer());
    const outputName = (file.name || 'audio').replace(/\.\w+$/i, '') + '.mp3';

    return { u8, name: outputName };
  }

  /**
   * Downmix audio to mono
   * @private
   */
  downmixToMono(audioBuffer) {
    if (audioBuffer.numberOfChannels === 1) {
      return new Float32Array(audioBuffer.getChannelData(0));
    }

    const length = audioBuffer.length;
    const output = new Float32Array(length);
    const channelCount = audioBuffer.numberOfChannels;

    for (let ch = 0; ch < channelCount; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        output[i] += channelData[i];
      }
    }

    for (let i = 0; i < length; i++) {
      output[i] /= channelCount;
    }

    return output;
  }

  /**
   * Resample audio using linear interpolation
   * @private
   */
  resampleLinear(sourceData, sourceRate, targetRate) {
    if (sourceRate === targetRate) {
      return sourceData;
    }

    const ratio = sourceRate / targetRate;
    const targetLength = Math.max(1, Math.round(sourceData.length / ratio));
    const output = new Float32Array(targetLength);

    for (let i = 0; i < targetLength; i++) {
      const position = i * ratio;
      const i0 = Math.floor(position);
      const i1 = Math.min(i0 + 1, sourceData.length - 1);
      const t = position - i0;
      output[i] = (1 - t) * sourceData[i0] + t * sourceData[i1];
    }

    return output;
  }

  /**
   * Convert float32 PCM to 16-bit PCM
   * @private
   */
  floatTo16BitPCM(float32Array) {
    const output = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return output;
  }
}

  // ============================================================
  // Protocol Parser (js/protocol-parser.js)
  // ============================================================
/**
 * Protocol Parser
 * Parses incoming BLE notifications and updates application state
 */

/**
 * Protocol Response Parser
 */
class ProtocolParser {
  constructor(stateManager, fileManager, logger) {
    this.state = stateManager;
    this.fileManager = fileManager;
    this.log = logger;
  }

  /**
   * Parse incoming BLE notification
   * @param {string} hex - Hex string
   * @param {Uint8Array} bytes - Byte array
   */
  parse(hex, bytes) {
    // Keepalive (FEDC)
    if (hex.startsWith(RESPONSES.KEEPALIVE)) {
      // Optionally log if advanced option is enabled
      const advFEDC = document.querySelector('#advFEDC');
      if (advFEDC?.checked) {
        this.log('Keepalive (FEDC)', LOG_CLASSES.WARNING);
      }
      return;
    }

    // Device parameters (BBE0)
    if (hex.startsWith(RESPONSES.DEVICE_PARAMS)) {
      this.parseDeviceParams(hex);
      return;
    }

    // Live status (BBE1)
    if (hex.startsWith(RESPONSES.LIVE_STATUS)) {
      this.parseLiveStatus(hex);
      return;
    }

    // Volume (BBE5)
    if (hex.startsWith(RESPONSES.VOLUME)) {
      this.parseVolume(hex);
      return;
    }

    // BT name (BBE6)
    if (hex.startsWith(RESPONSES.BT_NAME)) {
      this.parseBTName(hex);
      return;
    }

    // Capacity (BBD2)
    if (hex.startsWith(RESPONSES.CAPACITY)) {
      this.parseCapacity(hex);
      return;
    }

    // Play order (BBD1)
    if (hex.startsWith(RESPONSES.ORDER)) {
      this.parseOrder(hex);
      return;
    }

    // File info (BBD0)
    if (hex.startsWith(RESPONSES.FILE_INFO)) {
      this.parseFileInfo(hex);
      return;
    }

    // Enable Classic BT response (BBFD)
    if (hex.startsWith(RESPONSES.ENABLE_CLASSIC_BT)) {
      this.parseEnableClassicBT(hex);
      return;
    }

    // Transfer responses
    if (hex.startsWith(RESPONSES.TRANSFER_START)) {
      this.parseTransferStart(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.CHUNK_DROPPED)) {
      this.parseChunkDropped(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.TRANSFER_END)) {
      this.parseTransferEnd(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.RENAME_ACK)) {
      this.parseRenameAck(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.CANCEL_ACK)) {
      this.parseCancelAck(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.RESUME_ACK)) {
      this.parseResumeAck(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.PLAY_ACK)) {
      this.parsePlayAck(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.DELETE_ACK)) {
      this.parseDeleteAck(hex);
      return;
    }

    if (hex.startsWith(RESPONSES.FORMAT_ACK)) {
      this.parseFormatAck(hex);
      return;
    }
  }

  /**
   * Parse device parameters (BBE0)
   */
  parseDeviceParams(hex) {
    const channels = [4, 6, 8, 10, 12, 14].map(i => parseInt(hex.slice(i, i + 2), 16));
    const pin = getAsciiFromHex(hex.slice(16, 24));
    const wifiPassword = getAsciiFromHex(hex.slice(24, 40));
    const showMode = parseInt(hex.slice(40, 42), 16);
    const nameLen = parseInt(hex.slice(56, 58), 16);
    const name = getAsciiFromHex(hex.slice(58, 58 + nameLen * 2));

    this.state.updateDevice({
      channels,
      showMode,
      name: name || this.state.device.name,
      pin,
    });

    this.log(
      `Parsed Params: channels=${channels} pin=${pin} wifi=${wifiPassword} showMode=${showMode} name=${name}`
    );
  }

  /**
   * Parse live status (BBE1)
   */
  parseLiveStatus(hex) {
    const action = parseInt(hex.slice(4, 6), 16);
    const lightData = hex.slice(6, 90);
    const lights = [];

    for (let i = 0; i < 6; i++) {
      const ch = lightData.slice(i * 14, (i + 1) * 14);
      if (ch.length < 14) continue;

      const light = {
        effectMode: parseInt(ch.slice(0, 2), 16),
        brightness: parseInt(ch.slice(2, 4), 16),
        r: parseInt(ch.slice(4, 6), 16),
        g: parseInt(ch.slice(6, 8), 16),
        b: parseInt(ch.slice(8, 10), 16),
        colorCycle: parseInt(ch.slice(10, 12), 16),
        effectSpeed: parseInt(ch.slice(12, 14), 16),
      };
      lights.push(light);
    }

    const eyeIcon = parseInt(hex.slice(90, 92), 16);

    this.state.updateLive({
      action,
      eye: eyeIcon,
      lights,
    });

    this.log(`Parsed Live: action=${action} eyeIcon=${eyeIcon} lights=${JSON.stringify(lights)}`);
  }

  /**
   * Parse volume (BBE5)
   */
  parseVolume(hex) {
    const volume = parseInt(hex.slice(4, 6), 16);
    this.state.updateDevice({ volume });
    this.log(`Parsed Volume: ${volume}`);
  }

  /**
   * Parse BT name (BBE6)
   */
  parseBTName(hex) {
    const len = parseInt(hex.slice(4, 6), 16);
    const nameHex = hex.slice(6, 6 + len * 2);
    const btName = getAsciiFromHex(nameHex);
    this.state.updateDevice({ btName });
    this.log(`Parsed Classic BT Name: ${btName}`);
  }

  /**
   * Parse capacity (BBD2)
   */
  parseCapacity(hex) {
    const capacityKB = parseInt(hex.slice(4, 12), 16);
    const count = parseInt(hex.slice(12, 14), 16);
    const field4 = parseInt(hex.slice(14, 22), 16);

    this.state.updateDevice({
      capacity: capacityKB,
      filesReported: count,
    });

    this.log(
      `Capacity ${capacityKB}KB filesReported=${count} extra=0x${field4.toString(16).toUpperCase()}`
    );
  }

  /**
   * Parse play order (BBD1)
   */
  parseOrder(hex) {
    let count = parseInt(hex.slice(4, 6), 16);
    const data = hex.slice(6);
    if (data.length < count * 4) {
      count = Math.floor(data.length / 4);
    }

    const orders = Array.from({ length: count }, (_, i) =>
      parseInt(data.slice(i * 4, i * 4 + 4), 16)
    );

    const ordersAsString = JSON.stringify(orders);
    
    this.state.updateDevice({ order: ordersAsString });
    this.log(`File Order: ${ordersAsString}`);
  }

  /**
   * Parse file info (BBD0)
   */
  parseFileInfo(hex) {
    const serial = parseInt(hex.slice(4, 8), 16);
    const cluster = parseInt(hex.slice(8, 16), 16);
    const total = parseInt(hex.slice(16, 20), 16);
    const length = parseInt(hex.slice(20, 24), 16);
    const action = parseInt(hex.slice(24, 26), 16);
    
    // Parse light data (6 channels, 7 bytes each = 84 hex chars)
    const lightData = hex.slice(26, 110);
    const lights = [];
    for (let i = 0; i < 6; i++) {
      const ch = lightData.slice(i * 14, (i + 1) * 14);
      if (ch.length < 14) continue;

      const light = {
        effectMode: parseInt(ch.slice(0, 2), 16),
        brightness: parseInt(ch.slice(2, 4), 16),
        r: parseInt(ch.slice(4, 6), 16),
        g: parseInt(ch.slice(6, 8), 16),
        b: parseInt(ch.slice(8, 10), 16),
        colorCycle: parseInt(ch.slice(10, 12), 16),
        effectSpeed: parseInt(ch.slice(12, 14), 16),
      };
      lights.push(light);
    }
    
    const eyeIcon = parseInt(hex.slice(110, 112), 16);
    const dbPos = parseInt(hex.slice(112, 114), 16);

    // Extract filename after 5C55 marker
    let name = '';
    const markerPos = hex.indexOf('5C55', 114);
    if (markerPos >= 0) {
      const nameHex = hex.slice(markerPos + 4, hex.length - 2);
      try {
        name = decodeUtf16le(hexToBytes(nameHex)).trim();
      } catch (error) {
        // Ignore decode errors
      }
    }

    // Update expected count
    if (total && !this.state.files.expected) {
      this.state.updateFilesMetadata({ expected: total });
    }

    // Add file to list
    this.state.setFile(serial, {
      serial,
      cluster,
      total,
      length,
      action,
      lights,
      eye: eyeIcon,
      db: dbPos,
      name,
    });

    // Check if list is complete
    this.fileManager.finalizeFilesIfDone();
  }

  /**
   * Parse Enable Classic BT response (BBFD)
   */
  parseEnableClassicBT(hex) {
    const status = hex.slice(4, 6);
    this.log(`Parsed Enable Classic BT: ${status}`);
  }

  /**
   * Parse transfer start (BBC0)
   */
  parseTransferStart(hex) {
    const failed = parseInt(hex.slice(4, 6), 16);
    const written = parseInt(hex.slice(6, 14), 16);
    this.log(`Start Xfer: failed=${failed} written=${written}`);
  }

  /**
   * Parse chunk dropped (BBC1)
   */
  parseChunkDropped(hex) {
    const dropped = parseInt(hex.slice(4, 6), 16);
    const index = parseInt(hex.slice(6, 10), 16);
    this.log(`Chunk Dropped: ${dropped} @${index}`);

    // Resend chunk if we have it stored
    if (this.state.transfer.inProgress) {
      const payload = this.state.getChunk(index);
      if (payload) {
        this.log(`Resending chunk ${index}`, LOG_CLASSES.WARNING);
        // The BLE manager will handle the resend via the stored chunk
        this.state.setResumePoint(index);
      }
    }
  }

  /**
   * Parse transfer end (BBC2)
   */
  parseTransferEnd(hex) {
    const failed = parseInt(hex.slice(4, 6), 16);
    this.log(`End Xfer: failed=${failed}`);
  }

  /**
   * Parse rename ACK (BBC3)
   */
  parseRenameAck(hex) {
    const failed = parseInt(hex.slice(4, 6), 16);
    this.log(`Rename: failed=${failed}`);
  }

  /**
   * Parse cancel ACK (BBC4)
   */
  parseCancelAck(hex) {
    const failed = parseInt(hex.slice(4, 6), 16);
    this.log(`Cancel: failed=${failed}`);
  }

  /**
   * Parse resume ACK (BBC5)
   */
  parseResumeAck(hex) {
    const written = parseInt(hex.slice(4, 12), 16);
    this.log(`Resume written=${written}`);
  }

  /**
   * Parse play/pause ACK (BBC6)
   */
  parsePlayAck(hex) {
    const serial = parseInt(hex.slice(4, 8), 16);
    const playing = !!parseInt(hex.slice(8, 10), 16);
    const duration = parseInt(hex.slice(10, 14), 16);
    this.log(`Play/Pause serial=${serial} playing=${playing} duration=${duration}`);
  }

  /**
   * Parse delete ACK (BBC7)
   */
  parseDeleteAck(hex) {
    const ok = parseInt(hex.slice(4, 6), 16) === 0;
    this.log(`Delete ${ok ? 'OK' : 'FAIL'}`);
  }

  /**
   * Parse format ACK (BBC8)
   */
  parseFormatAck(hex) {
    const ok = parseInt(hex.slice(4, 6), 16);
    this.log(`Format ok=${ok}`);
  }
}

  // ============================================================
  // Edit Modal Manager (js/edit-modal.js)
  // ============================================================
/**
 * Edit Modal Manager
 * Handles the per-file edit modal functionality
 */

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Edit Modal Manager Class
 */
class EditModalManager {
  constructor(bleManager, stateManager, fileManager, logger) {
    this.ble = bleManager;
    this.state = stateManager;
    this.fileManager = fileManager;
    this.log = logger;

    // Current edit state
    this.currentFile = {
      serial: null,
      cluster: 0,
      name: '',
      eye: 1,
    };

    this.initializeModal();
  }

  /**
   * Initialize the edit modal and all its handlers
   */
  initializeModal() {
    // Get modal elements
    this.modal = $('#editModal');
    this.eyeGrid = $('#eyeGrid');

    if (!this.modal) {
      console.warn('Edit modal not found in DOM');
      return;
    }

    // Initialize all handlers
    this.initializeLightingControls();
    this.initializeMovementControls();
    this.initializeColorControls();
    this.initializeEyeGrid();
    this.initializeFileControls();
    this.initializeActionButtons();
  }

  /**
   * Initialize lighting type and speed controls
   */
  initializeLightingControls() {
    const edEffectMode = $('#edEffectMode');
    const edEffectSpeedBlock = $('#edEffectSpeedBlock');
    const edEffectSpeedRange = $('#edEffectSpeedRange');
    const edEffectSpeedNum = $('#edEffectSpeed');

    // Toggle speed UI for Static vs Strobe/Pulsing
    edEffectMode?.addEventListener('change', () => {
      const v = parseInt(edEffectMode.value, 10);
      edEffectSpeedBlock?.classList.toggle('hidden', v === 1); // hide when Static
    });

    // Sync speed inputs
    if (edEffectSpeedRange && edEffectSpeedNum) {
      edEffectSpeedRange.addEventListener('input', (e) => (edEffectSpeedNum.value = e.target.value));
      edEffectSpeedNum.addEventListener('input', (e) => (edEffectSpeedRange.value = clamp(e.target.value, 0, 255)));
    }
  }

  /**
   * Initialize movement controls
   */
  initializeMovementControls() {
    const edMoveGrid = $('#edMove');
    if (!edMoveGrid) return;

    const allBtn = edMoveGrid.querySelector('[data-part="all"]');
    const partBtns = edMoveGrid.querySelectorAll('[data-part="head"], [data-part="arm"], [data-part="torso"]');
    
    // "All" button handler
    allBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      allBtn.classList.toggle('selected');
      // If "all" is now selected, uncheck the other three
      if (allBtn.classList.contains('selected')) {
        partBtns.forEach((btn) => btn.classList.remove('selected'));
      }
    });
    
    // Head/Arm/Torso button handlers
    partBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.toggle('selected');
        // If any part button is clicked, uncheck "all"
        allBtn?.classList.remove('selected');
      });
    });
  }

  /**
   * Initialize color/RGB controls
   */
  initializeColorControls() {
    // Head color sync
    const edHeadColorPick = $('#edHeadColorPick');
    const edHeadR = $('#edHeadR');
    const edHeadG = $('#edHeadG');
    const edHeadB = $('#edHeadB');

    // Sync Head RGB inputs to color picker
    [edHeadR, edHeadG, edHeadB].forEach((inp) => {
      inp?.addEventListener('input', () => {
        const r = clamp(edHeadR.value, 0, 255);
        const g = clamp(edHeadG.value, 0, 255);
        const b = clamp(edHeadB.value, 0, 255);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        if (edHeadColorPick && edHeadColorPick.value !== hex) {
          edHeadColorPick.value = hex;
        }
      });
    });

    // Sync Head color picker to RGB inputs
    edHeadColorPick?.addEventListener('input', () => {
      const v = edHeadColorPick.value.replace('#', '');
      if (v.length === 6) {
        edHeadR.value = parseInt(v.slice(0, 2), 16);
        edHeadG.value = parseInt(v.slice(2, 4), 16);
        edHeadB.value = parseInt(v.slice(4, 6), 16);
      }
    });

    // Head color cycle button (toggle visual state only)
    $('#edHeadColorCycle')?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('selected');
    });

    // Torso color sync
    const edTorsoColorPick = $('#edTorsoColorPick');
    const edTorsoR = $('#edTorsoR');
    const edTorsoG = $('#edTorsoG');
    const edTorsoB = $('#edTorsoB');

    // Sync Torso RGB inputs to color picker
    [edTorsoR, edTorsoG, edTorsoB].forEach((inp) => {
      inp?.addEventListener('input', () => {
        const r = clamp(edTorsoR.value, 0, 255);
        const g = clamp(edTorsoG.value, 0, 255);
        const b = clamp(edTorsoB.value, 0, 255);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        if (edTorsoColorPick && edTorsoColorPick.value !== hex) {
          edTorsoColorPick.value = hex;
        }
      });
    });

    // Sync Torso color picker to RGB inputs
    edTorsoColorPick?.addEventListener('input', () => {
      const v = edTorsoColorPick.value.replace('#', '');
      if (v.length === 6) {
        edTorsoR.value = parseInt(v.slice(0, 2), 16);
        edTorsoG.value = parseInt(v.slice(2, 4), 16);
        edTorsoB.value = parseInt(v.slice(4, 6), 16);
      }
    });

    // Torso color cycle button (toggle visual state only)
    $('#edTorsoColorCycle')?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('selected');
    });

    // Note: Individual apply buttons removed - use "Apply All Settings" button instead
  }

  /**
   * Initialize eye icon grid
   */
  initializeEyeGrid() {
    if (!this.eyeGrid) return;

    // Build eye grid on initialization
    this.buildEyeGrid();

    // Eye selection handler
    this.eyeGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.eye-opt');
      if (!cell) return;

      this.currentFile.eye = parseInt(cell.dataset.eye, 10);
      this.eyeGrid.querySelectorAll('.eye-opt').forEach((el) => el.classList.remove('selected'));
      cell.classList.add('selected');
    });
  }

  /**
   * Build the eye icon grid
   */
  buildEyeGrid() {
    if (!this.eyeGrid) return;

    this.eyeGrid.innerHTML = '';

    // Create eye options for images 1-18
    for (let imgIdx = 1; imgIdx <= 18; imgIdx++) {
      const eyeNum = imgIdx;
      const div = document.createElement('div');
      div.className = 'eye-opt';
      div.dataset.eye = String(eyeNum);
      div.title = `Eye ${eyeNum}`;

      // Create image element
      const img = document.createElement('img');
      img.className = 'eye-thumb';
      img.src = `images/eye_icon_${imgIdx}.png`;
      img.alt = `eye ${eyeNum}`;

      div.appendChild(img);
      this.eyeGrid.appendChild(div);
    }
  }

  /**
   * Initialize file-related controls
   */
  initializeFileControls() {
    // Filename conflict checking
    $('#edName')?.addEventListener('input', () => {
      const name = $('#edName')?.value || '';
      this.checkFileNameConflict(name);
    });

    // File upload for replacement (not yet implemented)
    const edUploadFile = $('#edUploadFile');
    const edUploadBtn = $('#edUploadBtn');

    if (edUploadBtn) {
      edUploadBtn.addEventListener('click', () => {
        this.log('File upload/replace not yet implemented in modular version', LOG_CLASSES.WARNING);
        // TODO: Implement file replacement functionality
      });
    }

    // Convert checkbox toggle
    $('#edChkConvert')?.addEventListener('change', (e) => {
      $('#edConvertOpts')?.classList.toggle('hidden', !e.target.checked);
    });
  }

  /**
   * Initialize action buttons
   */
  initializeActionButtons() {
    // Close button
    $('#edClose')?.addEventListener('click', () => this.close());

    // Delete button (C7)
    $('#edDelete')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const delName = $('#edName')?.value || `serial #${$('#edSerial')?.value}`;
      if (!confirm(`Delete "${delName}" from device? This cannot be undone.`)) return;

      const serial = Math.max(0, parseInt($('#edSerial')?.value || '0', 10));
      const serialHex = serial.toString(16).padStart(4, '0').toUpperCase();
      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();

      await this.ble.send(buildCommand('C7', serialHex + clusterHex, 8));
      this.log(`Delete request (C7) serial=${serial} cluster=${cluster}`, LOG_CLASSES.WARNING);
      this.close();
    });

    // Apply All button - sends all settings to device
    $('#edApplyAll')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();
      
      // Helper to build payload with filename
      const buildPayload = (dataHex) => {
        let payload = dataHex + clusterHex;
        if (name) {
          const nameHex = utf16leHex(name);
          const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
          payload += nameLen + '5C55' + nameHex;
        } else {
          payload += '00';
        }
        return payload;
      };

      this.log('Applying all settings to device...', LOG_CLASSES.INFO);

      // 1. Set Animation (CA) - Movement
      const grid = $('#edMove');
      if (grid) {
        const toggles = grid.querySelectorAll('.iconToggle.selected');
        const parts = Array.from(toggles).map((btn) => btn.getAttribute('data-part'));
        
        let actionBits = 0;
        if (parts.includes('all')) {
          actionBits = 255;
        } else {
          if (parts.includes('head')) actionBits |= 0x01;
          if (parts.includes('arm')) actionBits |= 0x02;
          if (parts.includes('torso')) actionBits |= 0x04;
        }
        
        const actionHex = actionBits.toString(16).padStart(2, '0').toUpperCase();
        const payload = buildPayload(actionHex + '00');
        await this.ble.send(buildCommand('CA', payload, 8));
        this.log(`✓ Set Movement (CA) action=${actionBits}`);
      }

      // 2. Set Eye (F9)
      const eyeHex = this.currentFile.eye.toString(16).padStart(2, '0').toUpperCase();
      const eyePayload = buildPayload(eyeHex + '00');
      await this.ble.send(buildCommand('F9', eyePayload, 8));
      this.log(`✓ Set Eye (F9) icon=${this.currentFile.eye}`);

      // 3. Set Effect Mode (F2)
      const mode = parseInt($('#edEffectMode')?.value || '1', 10);
      const modeHex = mode.toString(16).padStart(2, '0').toUpperCase();
      const modePayload = buildPayload('FF' + modeHex);
      await this.ble.send(buildCommand('F2', modePayload, 8));
      this.log(`✓ Set Effect Mode (F2) mode=${mode}`);

      // 4. Set Effect Speed (F6) - if not Static mode
      if (mode !== 1) {
        const speed = clamp($('#edEffectSpeed')?.value || 0, 0, 255);
        const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
        const speedPayload = buildPayload('FF' + speedHex);
        await this.ble.send(buildCommand('F6', speedPayload, 8));
        this.log(`✓ Set Effect Speed (F6) speed=${speed}`);
      }

      // 5. Set Head Light Color (F4)
      const headR = clamp($('#edHeadR')?.value || 255, 0, 255);
      const headG = clamp($('#edHeadG')?.value || 0, 0, 255);
      const headB = clamp($('#edHeadB')?.value || 0, 0, 255);
      const headColorCycle = $('#edHeadColorCycle')?.classList.contains('selected') ? '01' : '00';
      const headRHex = headR.toString(16).padStart(2, '0').toUpperCase();
      const headGHex = headG.toString(16).padStart(2, '0').toUpperCase();
      const headBHex = headB.toString(16).padStart(2, '0').toUpperCase();
      const headPayload = buildPayload('00' + headRHex + headGHex + headBHex + headColorCycle);
      await this.ble.send(buildCommand('F4', headPayload, 8));
      this.log(`✓ Set Head Color (F4) rgb=${headR},${headG},${headB} cycle=${headColorCycle}`);

      // 6. Set Torso Light Color (F4)
      const torsoR = clamp($('#edTorsoR')?.value || 0, 0, 255);
      const torsoG = clamp($('#edTorsoG')?.value || 0, 0, 255);
      const torsoB = clamp($('#edTorsoB')?.value || 255, 0, 255);
      const torsoColorCycle = $('#edTorsoColorCycle')?.classList.contains('selected') ? '01' : '00';
      const torsoRHex = torsoR.toString(16).padStart(2, '0').toUpperCase();
      const torsoGHex = torsoG.toString(16).padStart(2, '0').toUpperCase();
      const torsoBHex = torsoB.toString(16).padStart(2, '0').toUpperCase();
      const torsoPayload = buildPayload('01' + torsoRHex + torsoGHex + torsoBHex + torsoColorCycle);
      await this.ble.send(buildCommand('F4', torsoPayload, 8));
      this.log(`✓ Set Torso Color (F4) rgb=${torsoR},${torsoG},${torsoB} cycle=${torsoColorCycle}`);

      this.log(`All settings applied successfully for file "${name || '(no name)'}"`, LOG_CLASSES.SUCCESS);
      
      // Close the dialog after applying settings
      this.close();
      
      // Refresh the file list to show updated data
      this.log('Refreshing file list from device...');
      await this.fileManager.startFetchFiles();
    });
  }

  /**
   * Check for filename conflicts
   */
  checkFileNameConflict(name) {
    const conflict = this.state.hasFileName(name);
    const inputEl = $('#edName');
    if (inputEl) {
      inputEl.classList.toggle('warn-border', !!conflict);
    }
    if (conflict) {
      this.log(`Warning: A file named "${conflict.name}" already exists on the device.`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Open the edit modal for a specific file
   */
  open(file) {
    if (!file) return;

    // Store current file data
    this.currentFile.serial = file.serial;
    this.currentFile.cluster = file.cluster;
    this.currentFile.name = file.name || '';
    this.currentFile.eye = file.eye || 1;

    // Populate form fields
    if ($('#edSerial')) $('#edSerial').value = file.serial;
    if ($('#edCluster')) $('#edCluster').value = file.cluster;
    if ($('#edName')) $('#edName').value = file.name || '';

    // Populate lighting data from file if available
    const headLight = file.lights?.[0];
    const torsoLight = file.lights?.[1];

    if (headLight) {
      // Effect mode (use head light's mode)
      if ($('#edEffectMode')) $('#edEffectMode').value = headLight.effectMode || 1;
      
      // Effect speed
      if ($('#edEffectSpeed')) $('#edEffectSpeed').value = headLight.effectSpeed || 0;
      if ($('#edEffectSpeedRange')) $('#edEffectSpeedRange').value = headLight.effectSpeed || 0;
      $('#edEffectSpeedBlock')?.classList.toggle('hidden', headLight.effectMode === 1);

      // Head color
      if ($('#edHeadR')) $('#edHeadR').value = headLight.r;
      if ($('#edHeadG')) $('#edHeadG').value = headLight.g;
      if ($('#edHeadB')) $('#edHeadB').value = headLight.b;
      const headHex = `#${headLight.r.toString(16).padStart(2, '0')}${headLight.g.toString(16).padStart(2, '0')}${headLight.b.toString(16).padStart(2, '0')}`;
      if ($('#edHeadColorPick')) $('#edHeadColorPick').value = headHex;
      
      // Head color cycle
      const edHeadColorCycle = $('#edHeadColorCycle');
      if (edHeadColorCycle) {
        if (headLight.colorCycle === 1) {
          edHeadColorCycle.classList.add('selected');
        } else {
          edHeadColorCycle.classList.remove('selected');
        }
      }
    } else {
      // Defaults
      if ($('#edEffectMode')) $('#edEffectMode').value = '1';
      if ($('#edEffectSpeed')) $('#edEffectSpeed').value = 0;
      if ($('#edEffectSpeedRange')) $('#edEffectSpeedRange').value = 0;
      $('#edEffectSpeedBlock')?.classList.add('hidden');
      
      if ($('#edHeadR')) $('#edHeadR').value = 255;
      if ($('#edHeadG')) $('#edHeadG').value = 0;
      if ($('#edHeadB')) $('#edHeadB').value = 0;
      if ($('#edHeadColorPick')) $('#edHeadColorPick').value = '#ff0000';
      $('#edHeadColorCycle')?.classList.remove('selected');
    }

    if (torsoLight) {
      // Torso color
      if ($('#edTorsoR')) $('#edTorsoR').value = torsoLight.r;
      if ($('#edTorsoG')) $('#edTorsoG').value = torsoLight.g;
      if ($('#edTorsoB')) $('#edTorsoB').value = torsoLight.b;
      const torsoHex = `#${torsoLight.r.toString(16).padStart(2, '0')}${torsoLight.g.toString(16).padStart(2, '0')}${torsoLight.b.toString(16).padStart(2, '0')}`;
      if ($('#edTorsoColorPick')) $('#edTorsoColorPick').value = torsoHex;
      
      // Torso color cycle
      const edTorsoColorCycle = $('#edTorsoColorCycle');
      if (edTorsoColorCycle) {
        if (torsoLight.colorCycle === 1) {
          edTorsoColorCycle.classList.add('selected');
        } else {
          edTorsoColorCycle.classList.remove('selected');
        }
      }
    } else {
      // Defaults
      if ($('#edTorsoR')) $('#edTorsoR').value = 0;
      if ($('#edTorsoG')) $('#edTorsoG').value = 0;
      if ($('#edTorsoB')) $('#edTorsoB').value = 255;
      if ($('#edTorsoColorPick')) $('#edTorsoColorPick').value = '#0000ff';
      $('#edTorsoColorCycle')?.classList.remove('selected');
    }

    // Populate movement from action field (bitfield: 0x01=head, 0x02=arm, 0x04=torso, 0xFF=all)
    const actionBits = file.action || 0;
    $('#edMove')?.querySelectorAll('.iconToggle').forEach((btn) => btn.classList.remove('selected'));
    
    if (actionBits === 255 || actionBits === 0x07) {
      const allBtn = $('#edMove')?.querySelector('[data-part="all"]');
      if (allBtn) allBtn.classList.add('selected');
    } else {
      if (actionBits & 0x01) {
        const headBtn = $('#edMove')?.querySelector('[data-part="head"]');
        if (headBtn) headBtn.classList.add('selected');
      }
      if (actionBits & 0x02) {
        const armBtn = $('#edMove')?.querySelector('[data-part="arm"]');
        if (armBtn) armBtn.classList.add('selected');
      }
      if (actionBits & 0x04) {
        const torsoBtn = $('#edMove')?.querySelector('[data-part="torso"]');
        if (torsoBtn) torsoBtn.classList.add('selected');
      }
    }

    // Update eye grid selection
    if (this.eyeGrid) {
      this.eyeGrid.querySelectorAll('.eye-opt').forEach((el) => {
        const eyeNum = parseInt(el.dataset.eye, 10);
        el.classList.toggle('selected', eyeNum === this.currentFile.eye);
      });
    }

    // Show modal
    this.modal?.classList.remove('hidden');
  }

  /**
   * Close the edit modal
   */
  close() {
    this.modal?.classList.add('hidden');
  }
}

  // ============================================================
  // Main Application (app-modular.js)
  // ============================================================
/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 * 
 * This is a SIMPLIFIED version showing the modular architecture.
 * The full UI controller implementation would be much larger.
 */

/**
 * Simple Logger
 */
class Logger {
  constructor(logElement, autoscrollElement) {
    this.logElement = logElement;
    this.autoscrollElement = autoscrollElement;
  }

  log(message, className = LOG_CLASSES.NORMAL) {
    if (!this.logElement) return;
    const div = document.createElement('div');
    div.className = `line ${className}`;
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${message}`;
    this.logElement.appendChild(div);

    // Auto-scroll if enabled
    if (!this.autoscrollElement || this.autoscrollElement.checked) {
      this.logElement.scrollTop = this.logElement.scrollHeight;
    }
  }
}

// $ helper already defined above

/**
 * Set progress display
 */
function setProgress(idx, total) {
  const pct = total ? Math.round((idx / total) * 100) : 0;
  const progText = $('#progText');
  const progPct = $('#progPct');
  const progBar = $('#progBar');
  if (progText) progText.textContent = `${idx} / ${total}`;
  if (progPct) progPct.textContent = `${pct}%`;
  if (progBar) progBar.style.width = `${pct}%`;
}

/**
 * Main Application
 */
class SkellyApp {
  constructor() {
    try {
      console.log('SkellyApp initializing...');
      
      // Initialize logger
      this.logger = new Logger($('#log'), $('#chkAutoscroll'));
      console.log('Logger created');

      // Initialize state manager
      this.state = new StateManager();
      console.log('State manager created');

      // Initialize BLE manager
      this.ble = new BLEManager(this.state, this.logger.log.bind(this.logger));
      console.log('BLE manager created');

      // Initialize file manager with progress callback
      this.fileManager = new FileManager(
        this.ble, 
        this.state, 
        this.logger.log.bind(this.logger),
        (current, total) => setProgress(current, total)
      );
      console.log('File manager created');

      // Initialize audio converter
      this.audioConverter = new AudioConverter(this.logger.log.bind(this.logger));
      console.log('Audio converter created');

      // Initialize protocol parser
      this.parser = new ProtocolParser(this.state, this.fileManager, this.logger.log.bind(this.logger));
      console.log('Protocol parser created');

      // Initialize edit modal manager
      this.editModal = new EditModalManager(
        this.ble,
        this.state,
        this.fileManager,
        this.logger.log.bind(this.logger)
      );
      console.log('Edit modal manager created');

      // Register protocol parser with BLE manager
      this.ble.onNotification((hex, bytes) => {
        this.parser.parse(hex, bytes);
      });
      console.log('Notification handler registered');

      // Subscribe to state changes
      this.subscribeToStateChanges();
      console.log('State subscriptions registered');

      // Initialize UI
      this.initializeUI();
      console.log('UI initialized');

      // Set initial UI state
      this.updateDeviceUI(this.state.device);
      this.updateFilesTable();
      this.updateTransferUI(this.state.transfer);
      console.log('Initial UI state set');

      console.log('Application initialized successfully');
      this.logger.log('Application initialized', LOG_CLASSES.WARNING);
    } catch (error) {
      console.error('Failed to initialize application:', error);
      console.error('Error stack:', error.stack);
      alert('Failed to initialize application. Check console for details.');
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribeToStateChanges() {
    // Device state changes
    this.state.subscribe('device', (device) => {
      this.updateDeviceUI(device);
    });

    // Live status changes
    this.state.subscribe('live', (live) => {
      this.updateLiveUI(live);
    });

    // File list changes
    this.state.subscribe('files', () => {
      this.updateFilesTable();
    });

    // Transfer state changes
    this.state.subscribe('transfer', (transfer) => {
      this.updateTransferUI(transfer);
    });
  }

  /**
   * Initialize UI and event handlers
   */
  initializeUI() {
    console.log('Initializing UI...');
    
    // Initial disconnected state
    document.body.classList.add('disconnected');

    // Connection controls
    const btnConnect = $('#btnConnect');
    const btnDisconnect = $('#btnDisconnect');
    
    if (btnConnect) {
      console.log('Binding connect button');
      btnConnect.addEventListener('click', () => {
        console.log('Connect button clicked');
        this.handleConnect();
      });
    } else {
      console.error('Connect button not found!');
    }
    
    if (btnDisconnect) {
      btnDisconnect.addEventListener('click', () => this.handleDisconnect());
    } else {
      console.error('Disconnect button not found!');
    }

    // Log controls
    const btnClearLog = $('#btnClearLog');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        const logEl = $('#log');
        if (logEl) logEl.innerHTML = '';
      });
    }

    this.initializeWarningModal();
    this.initializeAdvancedMenu();
    this.initializeQueryButtons();
    this.initializeMediaControls();
    this.initializeFileControls();
    this.initializeLiveControls();

    // Check for Web Bluetooth support
    if (!('bluetooth' in navigator)) {
      console.error('Web Bluetooth not supported');
      this.logger.log(
        'This browser does not support Web Bluetooth. Use Chrome/Edge on desktop or Android over HTTPS.',
        LOG_CLASSES.WARNING
      );
      alert('Web Bluetooth not supported in this browser. Use Chrome or Edge.');
    } else {
      console.log('Web Bluetooth API is available');
    }
    
    // Check for secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      console.error('Not in secure context - Web Bluetooth requires HTTPS or localhost');
      this.logger.log(
        'Web Bluetooth requires HTTPS or localhost. Please use HTTPS.',
        LOG_CLASSES.WARNING
      );
      alert('Web Bluetooth requires HTTPS or localhost!');
    } else {
      console.log('Running in secure context');
    }
    
    console.log('UI initialization complete');
  }

  /**
   * Initialize warning modal
   */
  initializeWarningModal() {
    const riskModal = $('#riskModal');
    const showRisk = () => riskModal?.classList.remove('hidden');
    const hideRisk = () => riskModal?.classList.add('hidden');

    window.addEventListener('load', () => {
      if (!localStorage.getItem(STORAGE_KEYS.RISK_ACK)) {
        showRisk();
      }
    });

    $('#riskAccept')?.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEYS.RISK_ACK, '1');
      hideRisk();
    });

    $('#riskCancel')?.addEventListener('click', () => {
      window.location.href = 'about:blank';
    });
  }

  /**
   * Initialize advanced menu
   */
  initializeAdvancedMenu() {
    const advMenu = $('#advMenu');
    const advRaw = $('#advRaw');
    const advFEDC = $('#advFEDC');
    const advEdit = $('#advEdit');

    // Load saved state
    advRaw.checked = localStorage.getItem(STORAGE_KEYS.ADV_RAW) === '1';
    advFEDC.checked = localStorage.getItem(STORAGE_KEYS.ADV_FEDC) === '1';
    advEdit.checked = localStorage.getItem(STORAGE_KEYS.ADV_EDIT) === '1';

    // Toggle menu
    $('#btnAdvanced')?.addEventListener('click', (e) => {
      e.stopPropagation();
      advMenu?.classList.toggle('hidden');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menuwrap')) {
        advMenu?.classList.add('hidden');
      }
    });

    // Save state on change
    [advRaw, advFEDC, advEdit].forEach((el) => {
      el?.addEventListener('change', () => {
        localStorage.setItem(STORAGE_KEYS.ADV_RAW, advRaw.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.ADV_FEDC, advFEDC.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.ADV_EDIT, advEdit.checked ? '1' : '0');
        this.applyAdvancedVisibility();
      });
    });

    this.applyAdvancedVisibility();
  }

  /**
   * Apply advanced feature visibility
   */
  applyAdvancedVisibility() {
    const advRaw = $('#advRaw');
    
    $('#advRawBlock')?.classList.toggle('hidden', !advRaw?.checked);
  }

  /**
   * Initialize query buttons
   */
  initializeQueryButtons() {
    document.querySelectorAll('[data-q]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!this.ble.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        const tag = btn.getAttribute('data-q');
        await this.ble.send(buildCommand(tag, '', 8));
      });
    });

    // Get All button - executes all query commands in sequence
    $('#btnGetAll')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      
      this.logger.log('Executing all queries...', LOG_CLASSES.INFO);
      const queries = ['E0', 'E1', 'E5', 'E6', 'EE', 'D2', 'D1'];
      
      for (const tag of queries) {
        await this.ble.send(buildCommand(tag, '', 8));
        // Small delay between queries to avoid overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logger.log('All queries completed', LOG_CLASSES.SUCCESS);
    });

    // Raw command send button
    $('#btnSendRaw')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const tag = $('#tag')?.value || 'E0';
      const payload = $('#payload')?.value || '';
      await this.ble.send(buildCommand(tag, payload, 8));
      this.logger.log(`Sent raw command: ${tag} with payload: ${payload || '(empty)'}`);
    });
  }

  /**
   * Initialize media controls
   */
  initializeMediaControls() {
    // Volume control - send command immediately on change
    const volRange = $('#volRange');
    const volNum = $('#vol');

    const sendVolumeCommand = async (value) => {
      if (!this.ble.isConnected()) {
        return;
      }
      const v = Math.max(0, Math.min(255, parseInt(value, 10)));
      await this.ble.send(buildCommand(COMMANDS.SET_VOLUME, v.toString(16).padStart(2, '0').toUpperCase(), 8));
      this.logger.log(`Set volume to ${v}`);
    };

    if (volRange && volNum) {
      volRange.addEventListener('input', (e) => {
        volNum.value = e.target.value;
        sendVolumeCommand(e.target.value);
      });
      volNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 100);
        volRange.value = clamped;
        sendVolumeCommand(clamped);
      });
    }

    // Live Mode button
    $('#btnBT')?.addEventListener('click', () => this.sendMediaCommand(COMMANDS.MEDIA_BT, '01'));
  }

  /**
   * Send media command
   */
  async sendMediaCommand(tag, payload) {
    if (!this.ble.isConnected()) {
      this.logger.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }
    await this.ble.send(buildCommand(tag, payload, 8));
  }

  /**
   * Initialize live controls
   */
  initializeLiveControls() {
    this.selectedEye = 1; // Default eye selection
    this.buildLiveEyeGrid();

    // Track color cycle state for each light
    this.headColorCycleEnabled = false;
    this.torsoColorCycleEnabled = false;

    // Head Light - Brightness control (immediate)
    const headBriRange = $('#headBrightnessRange');
    const headBriNum = $('#headBrightness');
    
    const sendHeadBrightness = async (value) => {
      if (!this.ble.isConnected()) return;
      const ch = '00'; // Head light is channel 0
      const brightness = parseInt(value, 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8));
      this.logger.log(`Set head light brightness to ${brightness}`);
    };
    
    if (headBriRange && headBriNum) {
      headBriRange.addEventListener('input', (e) => {
        headBriNum.value = e.target.value;
        sendHeadBrightness(e.target.value);
      });
      headBriNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 255);
        headBriRange.value = clamped;
        sendHeadBrightness(clamped);
      });
    }

    // Torso Light - Brightness control (immediate)
    const torsoBriRange = $('#torsoBrightnessRange');
    const torsoBriNum = $('#torsoBrightness');
    
    const sendTorsoBrightness = async (value) => {
      if (!this.ble.isConnected()) return;
      const ch = '01'; // Torso light is channel 1
      const brightness = parseInt(value, 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8));
      this.logger.log(`Set torso light brightness to ${brightness}`);
    };
    
    if (torsoBriRange && torsoBriNum) {
      torsoBriRange.addEventListener('input', (e) => {
        torsoBriNum.value = e.target.value;
        sendTorsoBrightness(e.target.value);
      });
      torsoBriNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 255);
        torsoBriRange.value = clamped;
        sendTorsoBrightness(clamped);
      });
    }

    // Head Light - Color/RGB control (immediate)
    const headColorPick = $('#headColorPick');
    const headRInput = $('#headR');
    const headGInput = $('#headG');
    const headBInput = $('#headB');

    const sendHeadColor = async (disableCycle = false) => {
      if (!this.ble.isConnected()) return;
      
      // If user is setting a new color (not from cycle button), disable cycle
      if (disableCycle && this.headColorCycleEnabled) {
        this.headColorCycleEnabled = false;
        const btnHeadColorCycle = $('#btnHeadColorCycle');
        if (btnHeadColorCycle) {
          btnHeadColorCycle.classList.remove('selected');
        }
      }
      
      const ch = '00'; // Head light is channel 0
      const r = parseInt(headRInput?.value || '255', 10);
      const g = parseInt(headGInput?.value || '0', 10);
      const b = parseInt(headBInput?.value || '0', 10);
      const cycle = this.headColorCycleEnabled ? '01' : '00';
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_RGB, ch + rHex + gHex + bHex + cycle + cluster + '00', 9));
      this.logger.log(`Set head light color to RGB(${r}, ${g}, ${b}) with cycle ${this.headColorCycleEnabled ? 'ON' : 'OFF'}`);
    };

    // Sync color picker with RGB inputs and send immediately
    if (headColorPick && headRInput && headGInput && headBInput) {
      headColorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        headRInput.value = parseInt(hex.substring(1, 3), 16);
        headGInput.value = parseInt(hex.substring(3, 5), 16);
        headBInput.value = parseInt(hex.substring(5, 7), 16);
        sendHeadColor(true); // Disable cycle when user picks a color
      });

      [headRInput, headGInput, headBInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(headRInput.value, 0, 255);
          const g = clamp(headGInput.value, 0, 255);
          const b = clamp(headBInput.value, 0, 255);
          headColorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          sendHeadColor(true); // Disable cycle when user changes RGB values
        });
      });
    }

    // Torso Light - Color/RGB control (immediate)
    const torsoColorPick = $('#torsoColorPick');
    const torsoRInput = $('#torsoR');
    const torsoGInput = $('#torsoG');
    const torsoBInput = $('#torsoB');

    const sendTorsoColor = async (disableCycle = false) => {
      if (!this.ble.isConnected()) return;
      
      // If user is setting a new color (not from cycle button), disable cycle
      if (disableCycle && this.torsoColorCycleEnabled) {
        this.torsoColorCycleEnabled = false;
        const btnTorsoColorCycle = $('#btnTorsoColorCycle');
        if (btnTorsoColorCycle) {
          btnTorsoColorCycle.classList.remove('selected');
        }
      }
      
      const ch = '01'; // Torso light is channel 1
      const r = parseInt(torsoRInput?.value || '255', 10);
      const g = parseInt(torsoGInput?.value || '0', 10);
      const b = parseInt(torsoBInput?.value || '0', 10);
      const cycle = this.torsoColorCycleEnabled ? '01' : '00';
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_RGB, ch + rHex + gHex + bHex + cycle + cluster + '00', 9));
      this.logger.log(`Set torso light color to RGB(${r}, ${g}, ${b}) with cycle ${this.torsoColorCycleEnabled ? 'ON' : 'OFF'}`);
    };

    // Sync color picker with RGB inputs and send immediately
    if (torsoColorPick && torsoRInput && torsoGInput && torsoBInput) {
      torsoColorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        torsoRInput.value = parseInt(hex.substring(1, 3), 16);
        torsoGInput.value = parseInt(hex.substring(3, 5), 16);
        torsoBInput.value = parseInt(hex.substring(5, 7), 16);
        sendTorsoColor(true); // Disable cycle when user picks a color
      });

      [torsoRInput, torsoGInput, torsoBInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(torsoRInput.value, 0, 255);
          const g = clamp(torsoGInput.value, 0, 255);
          const b = clamp(torsoBInput.value, 0, 255);
          torsoColorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          sendTorsoColor(true); // Disable cycle when user changes RGB values
        });
      });
    }

    // Head Light - Effect mode (immediate)
    const headEffectMode = $('#headEffectMode');
    const headEffectSpeedBlock = $('#headEffectSpeedBlock');

    if (headEffectMode && headEffectSpeedBlock) {
      headEffectMode.addEventListener('change', async () => {
        const v = parseInt(headEffectMode.value, 10);
        headEffectSpeedBlock.classList.toggle('hidden', v === 1); // hide for Static
        
        if (!this.ble.isConnected()) return;
        const ch = '00'; // Head light is channel 0
        const modeHex = v.toString(16).padStart(2, '0').toUpperCase();
        const cluster = '00000000';
        await this.ble.send(buildCommand(COMMANDS.SET_MODE, ch + modeHex + cluster + '00', 9));
        this.logger.log(`Set head light mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`);
      });
    }

    // Torso Light - Effect mode (immediate)
    const torsoEffectMode = $('#torsoEffectMode');
    const torsoEffectSpeedBlock = $('#torsoEffectSpeedBlock');

    if (torsoEffectMode && torsoEffectSpeedBlock) {
      torsoEffectMode.addEventListener('change', async () => {
        const v = parseInt(torsoEffectMode.value, 10);
        torsoEffectSpeedBlock.classList.toggle('hidden', v === 1); // hide for Static
        
        if (!this.ble.isConnected()) return;
        const ch = '01'; // Torso light is channel 1
        const modeHex = v.toString(16).padStart(2, '0').toUpperCase();
        const cluster = '00000000';
        await this.ble.send(buildCommand(COMMANDS.SET_MODE, ch + modeHex + cluster + '00', 8));
        this.logger.log(`Set torso light mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`);
      });
    }

    // Head Light - Effect speed control (immediate)
    const headEffectSpeedRange = $('#headEffectSpeedRange');
    const headEffectSpeedNum = $('#headEffectSpeed');

    const sendHeadSpeed = async (value) => {
      if (!this.ble.isConnected()) return;
      const ch = '00'; // Head light is channel 0
      const speed = parseInt(value, 10);
      const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8));
      this.logger.log(`Set head light speed to ${speed}`);
    };

    if (headEffectSpeedRange && headEffectSpeedNum) {
      headEffectSpeedRange.addEventListener('input', (e) => {
        headEffectSpeedNum.value = e.target.value;
        sendHeadSpeed(e.target.value);
      });
      headEffectSpeedNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 255);
        headEffectSpeedRange.value = clamped;
        sendHeadSpeed(clamped);
      });
    }

    // Torso Light - Effect speed control (immediate)
    const torsoEffectSpeedRange = $('#torsoEffectSpeedRange');
    const torsoEffectSpeedNum = $('#torsoEffectSpeed');

    const sendTorsoSpeed = async (value) => {
      if (!this.ble.isConnected()) return;
      const ch = '01'; // Torso light is channel 1
      const speed = parseInt(value, 10);
      const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8));
      this.logger.log(`Set torso light speed to ${speed}`);
    };

    if (torsoEffectSpeedRange && torsoEffectSpeedNum) {
      torsoEffectSpeedRange.addEventListener('input', (e) => {
        torsoEffectSpeedNum.value = e.target.value;
        sendTorsoSpeed(e.target.value);
      });
      torsoEffectSpeedNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 255);
        torsoEffectSpeedRange.value = clamped;
        sendTorsoSpeed(clamped);
      });
    }

    // Movement controls - toggle buttons with special "all" logic
    const liveMoveGrid = $('#liveMove');
    if (liveMoveGrid) {
      const allBtn = liveMoveGrid.querySelector('[data-part="all"]');
      const partBtns = liveMoveGrid.querySelectorAll('[data-part="head"], [data-part="arm"], [data-part="torso"]');
      
      const sendMovementCommand = async () => {
        if (!this.ble.isConnected()) {
          return;
        }
        
        // Check if "all" is selected
        if (allBtn?.classList.contains('selected')) {
          // Send CAFF for all movement
          await this.ble.send(buildCommand(COMMANDS.SET_MOVEMENT, 'FF00000000', 8));
          this.logger.log('Applied movement: all');
        } else {
          // Build bitfield from head/arm/torso selections
          let bitfield = 0;
          partBtns.forEach((btn) => {
            if (btn.classList.contains('selected')) {
              const part = btn.getAttribute('data-part');
              if (part === 'head') bitfield |= 0x01;
              else if (part === 'arm') bitfield |= 0x02;
              else if (part === 'torso') bitfield |= 0x04;
            }
          });
          
          if (bitfield > 0) {
            const bitfieldHex = bitfield.toString(16).padStart(2, '0').toUpperCase();
            await this.ble.send(buildCommand(COMMANDS.SET_MOVEMENT, bitfieldHex + '00000000', 8));
            const parts = [];
            if (bitfield & 0x01) parts.push('head');
            if (bitfield & 0x02) parts.push('arm');
            if (bitfield & 0x04) parts.push('torso');
            this.logger.log(`Applied movement: ${parts.join(', ')}`);
          } else {
            // No movement selected - send CA00 to disable movement
            await this.ble.send(buildCommand(COMMANDS.SET_MOVEMENT, '0000000000', 8));
            this.logger.log('Disabled movement');
          }
        }
      };
      
      // "All" button handler
      allBtn?.addEventListener('click', () => {
        allBtn.classList.toggle('selected');
        // If "all" is now selected, uncheck the other three
        if (allBtn.classList.contains('selected')) {
          partBtns.forEach((btn) => btn.classList.remove('selected'));
        }
        sendMovementCommand();
      });
      
      // Head/Arm/Torso button handlers
      partBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('selected');
          // If any part button is clicked, uncheck "all"
          allBtn?.classList.remove('selected');
          sendMovementCommand();
        });
      });
    }

    // Head Light - Color cycle button (toggles cycle state)
    const btnHeadColorCycle = $('#btnHeadColorCycle');
    if (btnHeadColorCycle) {
      btnHeadColorCycle.addEventListener('click', async () => {
        if (!this.ble.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        this.headColorCycleEnabled = !this.headColorCycleEnabled;
        btnHeadColorCycle.classList.toggle('selected', this.headColorCycleEnabled);
        await sendHeadColor();
      });
    }

    // Torso Light - Color cycle button (toggles cycle state)
    const btnTorsoColorCycle = $('#btnTorsoColorCycle');
    if (btnTorsoColorCycle) {
      btnTorsoColorCycle.addEventListener('click', async () => {
        if (!this.ble.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        this.torsoColorCycleEnabled = !this.torsoColorCycleEnabled;
        btnTorsoColorCycle.classList.toggle('selected', this.torsoColorCycleEnabled);
        await sendTorsoColor();
      });
    }

    // Live eye grid selection - send command immediately
    const apEyeGrid = $('#apEyeGrid');
    if (apEyeGrid) {
      apEyeGrid.addEventListener('click', async (e) => {
        const cell = e.target.closest('.eye-opt');
        if (!cell) return;
        
        this.selectedEye = parseInt(cell.dataset.eye, 10);
        apEyeGrid.querySelectorAll('.eye-opt').forEach((el) => el.classList.remove('selected'));
        cell.classList.add('selected');
        
        // Send command immediately if connected
        if (!this.ble.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        
        const eyeHex = this.selectedEye.toString(16).padStart(2, '0').toUpperCase();
        const clusterHex = '00000000'; // Always cluster 0 for live mode
        
        // Build payload: eye + 00 + cluster + 00 (no name)
        const payload = eyeHex + '00' + clusterHex + '00';
        
        await this.ble.send(buildCommand(COMMANDS.SET_EYE, payload, 8));
        this.logger.log(`Set eye to ${this.selectedEye} (live mode)`);
      });
    }
  }

  /**
   * Apply movement from UI
   */
  applyMovement(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const toggles = grid.querySelectorAll('.iconToggle.selected');
    const parts = Array.from(toggles).map((btn) => btn.getAttribute('data-part'));

    if (parts.length === 0) {
      this.logger.log('No movement selected', LOG_CLASSES.WARNING);
      return;
    }

    // Map parts to hex
    const partMap = { all: '00', head: '01', arm: '02', torso: '03' };
    const hexParts = parts.map((p) => partMap[p] || '00');

    // Send movement command for each part
    hexParts.forEach(async (partHex) => {
      await this.ble.send(buildCommand(COMMANDS.SET_MOVEMENT, partHex + '00000000', 8));
    });

    this.logger.log(`Applied movement: ${parts.join(', ')}`);
  }

  /**
   * Initialize file controls
   */
  initializeFileControls() {
    // File refresh
    $('#btnRefreshFiles')?.addEventListener('click', () => {
      this.fileManager.startFetchFiles(false);
    });

    // File filter
    $('#filesFilter')?.addEventListener('input', () => {
      this.updateFilesTable();
    });

    // File input
    $('#fileInput')?.addEventListener('change', async (e) => {
      await this.handleFileSelection(e.target.files?.[0]);
    });

    // Send file button
    $('#btnSendFile')?.addEventListener('click', async () => {
      await this.handleFileSend();
    });

    // Cancel transfer
    $('#btnCancelFile')?.addEventListener('click', async () => {
      await this.fileManager.cancelTransfer();
    });

    // Files table button handler (Play and Edit)
    $('#filesTable')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const serial = parseInt(btn.dataset.serial, 10);
      const item = this.state.files.items.get(serial);
      if (!item) return;

      if (btn.dataset.action === 'play') {
        this.handlePlayFile(serial);
      } else if (btn.dataset.action === 'edit') {
        if (btn.disabled || !$('#advEdit')?.checked) return;
        this.handleEditFile(item);
      }
    });
  }

  /**
   * Handle play file button click
   */
  async handlePlayFile(serial) {
    const serialHex = serial.toString(16).padStart(4, '0').toUpperCase();
    await this.ble.send(buildCommand(COMMANDS.PLAY_PAUSE, serialHex + '01', 8));
    this.logger.log(`Playing file #${serial}`);
  }

  /**
   * Handle edit file button click
   */
  handleEditFile(item) {
    this.editModal.open(item);
  }

  /**
   * Handle file selection
   */
  async handleFileSelection(file) {
    if (!file) return;

    try {
      // Get duration for warning
      const duration = await this.audioConverter.getAudioDuration(file);
      // TODO: Show warning if > 30 seconds

      // Read file
      const buffer = await file.arrayBuffer();
      const originalBytes = new Uint8Array(buffer);

      let fileBytes = originalBytes;
      let fileName = file.name;

      // If convert box is already checked, convert right away
      if ($('#chkConvert')?.checked) {
        const kbps = parseInt($('#mp3Kbps')?.value || '32', 10);
        this.logger.log(`Converting to MP3 8 kHz mono (${kbps} kbps)…`);
        const result = await this.audioConverter.convertToDeviceMp3(file, kbps);
        fileBytes = result.u8;
        fileName = result.name;
        this.logger.log(`Converted: ${fileName} (${fileBytes.length} bytes)`, LOG_CLASSES.WARNING);
      } else {
        this.logger.log(`Picked file: ${file.name} (${originalBytes.length} bytes)`);
      }

      // Store file data
      this.fileManager.storeFilePickerData(file, originalBytes, fileBytes, fileName);

      // Pre-fill filename if empty
      if (!$('#fileName')?.value) {
        $('#fileName').value = fileName;
      }

      // Check for name conflicts
      this.checkFileNameConflict($('#fileName')?.value || fileName);
    } catch (error) {
      this.logger.log(`File error: ${error.message}`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Handle file send
   */
  async handleFileSend() {
    if (!this.ble.isConnected()) {
      this.logger.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }

    const pickerData = this.fileManager.getFilePickerData();
    if (!pickerData.file && !pickerData.fileBytes) {
      this.logger.log('Pick a file first.', LOG_CLASSES.WARNING);
      return;
    }

    let fileBytes = pickerData.fileBytes;
    let fileName = pickerData.fileName;

    // If user toggled "Convert" AFTER selecting the file, convert now
    try {
      if ($('#chkConvert')?.checked && pickerData.file) {
        const kbps = parseInt($('#mp3Kbps')?.value || '32', 10);
        this.logger.log(`Converting to MP3 8 kHz mono (${kbps} kbps) before send…`);
        const result = await this.audioConverter.convertToDeviceMp3(pickerData.file, kbps);
        fileBytes = result.u8;
        // If the filename box is empty or still matches the previous base, prefer .mp3
        const typed = ($('#fileName')?.value || '').trim();
        if (!typed || typed === pickerData.fileName) {
          $('#fileName').value = result.name;
        }
        fileName = result.name;
      } else if (!$('#chkConvert')?.checked && pickerData.originalBytes) {
        // Ensure we're using the original bytes if convert is off
        fileBytes = pickerData.originalBytes;
        fileName = pickerData.file?.name || pickerData.fileName;
      }
    } catch (error) {
      this.logger.log(`Convert error: ${error.message} — sending original file`, LOG_CLASSES.WARNING);
      if (pickerData.originalBytes) {
        fileBytes = pickerData.originalBytes;
        fileName = pickerData.file?.name || pickerData.fileName;
      }
    }

    // Filename to send (auto .mp3 if converting)
    let finalName = ($('#fileName')?.value || fileName || 'skelly.bin').trim();
    if ($('#chkConvert')?.checked && !/\.mp3$/i.test(finalName)) {
      finalName = finalName.replace(/\.\w+$/, '') + '.mp3';
      $('#fileName').value = finalName;
    }
    if (!finalName) {
      this.logger.log('Provide a device filename.', LOG_CLASSES.WARNING);
      return;
    }

    this.checkFileNameConflict(finalName);

    try {
      await this.fileManager.uploadFile(fileBytes, finalName);
    } catch (error) {
      this.logger.log(`Upload error: ${error.message}`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Check for filename conflicts
   */
  checkFileNameConflict(name) {
    const conflict = this.state.hasFileName(name);
    const inputEl = $('#fileName');
    if (inputEl) {
      inputEl.classList.toggle('warn-border', !!conflict);
    }
    if (conflict) {
      this.logger.log(
        `Warning: A file named "${conflict.name}" already exists on the device.`,
        LOG_CLASSES.WARNING
      );
    }
  }

  /**
   * Handle connect button
   */
  async handleConnect() {
    console.log('handleConnect called');
    const nameFilter = $('#nameFilter')?.value || '';
    try {
      console.log('Calling ble.connect with filter:', nameFilter);
      await this.ble.connect(nameFilter);
      console.log('Connected successfully');
      
      // Query device state in sequence: live mode, params, volume, BT name, capacity, order
      await this.ble.send(buildCommand(COMMANDS.QUERY_LIVE, '', 8));
      setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_PARAMS, '', 8)), 50);
      setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_VOLUME, '', 8)), 100);
      setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_BT_NAME, '', 8)), 150);
      setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_CAPACITY, '', 8)), 200);
      setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_ORDER, '', 8)), 250);
      
      // Start file sync after initial queries
      setTimeout(() => {
        this.fileManager.startFetchFiles(true);
      }, 300);
    } catch (error) {
      console.error('Connection error:', error);
      this.logger.log(`Connection failed: ${error.message}`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Handle disconnect button
   */
  async handleDisconnect() {
    await this.ble.disconnect();
  }

  /**
   * Build live eye grid
   */
  buildLiveEyeGrid() {
    const grid = $('#apEyeGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Create eye options for images 1-18
    for (let imgIdx = 1; imgIdx <= 18; imgIdx++) {
      const eyeNum = imgIdx;
      const div = document.createElement('div');
      div.className = 'eye-opt' + (eyeNum === this.selectedEye ? ' selected' : '');
      div.dataset.eye = String(eyeNum);
      div.title = `Eye ${eyeNum}`;
      
      // Create image element
      const img = document.createElement('img');
      img.className = 'eye-thumb';
      img.src = `images/eye_icon_${imgIdx}.png`;
      img.alt = `eye ${eyeNum}`;
      
      div.appendChild(img);
      grid.appendChild(div);
    }
  }

  /**
   * UTF-16LE hex encoding helper
   */
  utf16leHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      hex += (code & 0xff).toString(16).padStart(2, '0');
      hex += ((code >> 8) & 0xff).toString(16).padStart(2, '0');
    }
    return hex.toUpperCase();
  }

  /**
   * Update device UI
   */
  updateDeviceUI(device) {
    console.log('updateDeviceUI called, connected:', device.connected);
    
    // Update status
    const statusSpan = $('#status span');
    if (statusSpan) {
      statusSpan.textContent = device.connected ? 'Connected' : 'Disconnected';
    }

    document.body.classList.toggle('disconnected', !device.connected);
    
    const btnDisconnect = $('#btnDisconnect');
    if (btnDisconnect) {
      btnDisconnect.disabled = !device.connected;
    }
    
    const btnConnect = $('#btnConnect');
    if (btnConnect) {
      btnConnect.disabled = device.connected;
    }

    // Update device info
    if ($('#statName')) $('#statName').textContent = device.name || '—';
    if ($('#statShowMode')) $('#statShowMode').textContent = device.showMode ?? '—';
    if ($('#statChannels')) {
      $('#statChannels').textContent = device.channels.length ? device.channels.join(', ') : '—';
    }
    if ($('#statBtName')) $('#statBtName').textContent = device.btName || '—';
    
    // Update volume slider when device volume changes
    if (device.volume != null) {
      const volRange = $('#volRange');
      const volNum = $('#vol');
      if (volRange) volRange.value = device.volume;
      if (volNum) volNum.value = device.volume;
    }
    
    if ($('#statCapacity')) {
      $('#statCapacity').textContent =
        device.capacity != null
          ? `${device.capacity} KB (${device.filesReported ?? '—'} files)`
          : '—';
    }
    
    if ($('#statOrder')) {
      $('#statOrder').textContent = device.order || '—';
    }
    
    if ($('#statPin')) {
      $('#statPin').textContent = device.pin || '—';
    }
  }

  /**
   * Update live status UI
   */
  updateLiveUI(live) {
    // Update movement icons based on action bitfield
    if (live.action != null) {
      const actionBits = parseInt(live.action, 10);
      const liveMove = $('#liveMove');
      
      if (liveMove && !isNaN(actionBits)) {
        // Clear all selections first
        liveMove.querySelectorAll('.iconToggle').forEach(btn => btn.classList.remove('selected'));
        
        // Map bitfield to icon selections
        // Bit 0 (0x01) = head, Bit 1 (0x02) = arm, Bit 2 (0x04) = torso
        // If all bits set or value is 255, select "all"
        if (actionBits === 255 || actionBits === 0x07) {
          const allBtn = liveMove.querySelector('[data-part="all"]');
          if (allBtn) allBtn.classList.add('selected');
        } else {
          if (actionBits & 0x01) {
            const headBtn = liveMove.querySelector('[data-part="head"]');
            if (headBtn) headBtn.classList.add('selected');
          }
          if (actionBits & 0x02) {
            const armBtn = liveMove.querySelector('[data-part="arm"]');
            if (armBtn) armBtn.classList.add('selected');
          }
          if (actionBits & 0x04) {
            const torsoBtn = liveMove.querySelector('[data-part="torso"]');
            if (torsoBtn) torsoBtn.classList.add('selected');
          }
        }
      }
    }

    // Update eye icon selection
    if (live.eye != null) {
      this.selectedEye = live.eye;
      const apEyeGrid = $('#apEyeGrid');
      if (apEyeGrid) {
        // Clear all selections
        apEyeGrid.querySelectorAll('.eye-opt').forEach(el => el.classList.remove('selected'));
        // Select the current eye
        const eyeOpt = apEyeGrid.querySelector(`[data-eye="${live.eye}"]`);
        if (eyeOpt) eyeOpt.classList.add('selected');
      }
    }

    // Update light settings from live.lights array
    if (live.lights && Array.isArray(live.lights)) {
      // Head light (index 0)
      if (live.lights[0]) {
        const headLight = live.lights[0];
        
        // Brightness
        if ($('#headBrightness')) $('#headBrightness').value = headLight.brightness;
        if ($('#headBrightnessRange')) $('#headBrightnessRange').value = headLight.brightness;
        
        // Color (RGB)
        if ($('#headR')) $('#headR').value = headLight.r;
        if ($('#headG')) $('#headG').value = headLight.g;
        if ($('#headB')) $('#headB').value = headLight.b;
        const headHex = `#${headLight.r.toString(16).padStart(2, '0')}${headLight.g.toString(16).padStart(2, '0')}${headLight.b.toString(16).padStart(2, '0')}`;
        if ($('#headColorPick')) $('#headColorPick').value = headHex;
        
        // Color cycle state
        this.headColorCycleEnabled = (headLight.colorCycle === 1);
        const headCycleBtn = $('#btnHeadColorCycle');
        if (headCycleBtn) {
          if (this.headColorCycleEnabled) {
            headCycleBtn.classList.add('selected');
          } else {
            headCycleBtn.classList.remove('selected');
          }
        }
        
        // Effect mode
        if ($('#headEffectMode')) $('#headEffectMode').value = headLight.effectMode;
        
        // Effect speed (show/hide speed block based on mode)
        const headEffectSpeedBlock = $('#headEffectSpeedBlock');
        if (headEffectSpeedBlock) {
          headEffectSpeedBlock.classList.toggle('hidden', headLight.effectMode === 1);
        }
        if ($('#headEffectSpeed')) $('#headEffectSpeed').value = headLight.effectSpeed;
        if ($('#headEffectSpeedRange')) $('#headEffectSpeedRange').value = headLight.effectSpeed;
      }
      
      // Torso light (index 1)
      if (live.lights[1]) {
        const torsoLight = live.lights[1];
        
        // Brightness
        if ($('#torsoBrightness')) $('#torsoBrightness').value = torsoLight.brightness;
        if ($('#torsoBrightnessRange')) $('#torsoBrightnessRange').value = torsoLight.brightness;
        
        // Color (RGB)
        if ($('#torsoR')) $('#torsoR').value = torsoLight.r;
        if ($('#torsoG')) $('#torsoG').value = torsoLight.g;
        if ($('#torsoB')) $('#torsoB').value = torsoLight.b;
        const torsoHex = `#${torsoLight.r.toString(16).padStart(2, '0')}${torsoLight.g.toString(16).padStart(2, '0')}${torsoLight.b.toString(16).padStart(2, '0')}`;
        if ($('#torsoColorPick')) $('#torsoColorPick').value = torsoHex;
        
        // Color cycle state
        this.torsoColorCycleEnabled = (torsoLight.colorCycle === 1);
        const torsoCycleBtn = $('#btnTorsoColorCycle');
        if (torsoCycleBtn) {
          if (this.torsoColorCycleEnabled) {
            torsoCycleBtn.classList.add('selected');
          } else {
            torsoCycleBtn.classList.remove('selected');
          }
        }
        
        // Effect mode
        if ($('#torsoEffectMode')) $('#torsoEffectMode').value = torsoLight.effectMode;
        
        // Effect speed (show/hide speed block based on mode)
        const torsoEffectSpeedBlock = $('#torsoEffectSpeedBlock');
        if (torsoEffectSpeedBlock) {
          torsoEffectSpeedBlock.classList.toggle('hidden', torsoLight.effectMode === 1);
        }
        if ($('#torsoEffectSpeed')) $('#torsoEffectSpeed').value = torsoLight.effectSpeed;
        if ($('#torsoEffectSpeedRange')) $('#torsoEffectSpeedRange').value = torsoLight.effectSpeed;
      }
    }
  }

  /**
   * Update files table
   */
  updateFilesTable() {
    const tbody = $('#filesTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const query = ($('#filesFilter')?.value || '').toLowerCase().trim();
    const files = Array.from(this.state.files.items.values())
      .filter((file) => !query || (file.name || '').toLowerCase().includes(query))
      .sort((a, b) => a.serial - b.serial);

    const canEdit = $('#advEdit')?.checked;

    for (const file of files) {
      const tr = document.createElement('tr');
      const eyeImgIdx = file.eye;
      
      // Generate Head color indicator (lights[0])
      let headColorHtml = '';
      if (file.lights && file.lights[0]) {
        const headLight = file.lights[0];
        if (headLight.colorCycle) {
          headColorHtml = '<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
        } else {
          const rgb = `rgb(${headLight.r}, ${headLight.g}, ${headLight.b})`;
          headColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${headLight.r},${headLight.g},${headLight.b})"></div>`;
        }
      }
      
      // Generate Torso color indicator (lights[1])
      let torsoColorHtml = '';
      if (file.lights && file.lights[1]) {
        const torsoLight = file.lights[1];
        if (torsoLight.colorCycle) {
          torsoColorHtml = '<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
        } else {
          const rgb = `rgb(${torsoLight.r}, ${torsoLight.g}, ${torsoLight.b})`;
          torsoColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${torsoLight.r},${torsoLight.g},${torsoLight.b})"></div>`;
        }
      }
      
      // Generate movement icons based on action bitfield
      let movementIcons = '';
      const actionBits = file.action || 0;
      if (actionBits === MOVEMENT_BITS.ALL_ON || actionBits === (MOVEMENT_BITS.HEAD | MOVEMENT_BITS.ARM | MOVEMENT_BITS.TORSO)) {
        // All movements
        movementIcons = '<img class="eye-thumb" src="images/icon_action1_se.png" alt="All" title="All movements" />';
      } else {
        // Individual movements
        if (actionBits & MOVEMENT_BITS.HEAD) {
          movementIcons += '<img class="eye-thumb" src="images/icon_action2_se.png" alt="Head" title="Head movement" />';
        }
        if (actionBits & MOVEMENT_BITS.ARM) {
          movementIcons += '<img class="eye-thumb" src="images/icon_action3_se.png" alt="Arm" title="Arm movement" />';
        }
        if (actionBits & MOVEMENT_BITS.TORSO) {
          movementIcons += '<img class="eye-thumb" src="images/icon_action4_se.png" alt="Torso" title="Torso movement" />';
        }
      }
      
      tr.innerHTML = `
        <td>${file.serial}</td>
        <td>${file.cluster}</td>
        <td>${escapeHtml(file.name || '')}</td>
        <td>${headColorHtml}</td>
        <td>${torsoColorHtml}</td>
        <td>${movementIcons}</td>
        <td><img class="eye-thumb" src="images/eye_icon_${eyeImgIdx}.png" alt="eye ${file.eye}" />${file.eye ?? ''}</td>
        <td>${file.db}</td>
        <td>
          <button class="btn sm" data-action="play" data-serial="${file.serial}">▶ Play</button>
          <button class="btn sm" data-action="edit" data-serial="${file.serial}"
            ${canEdit ? '' : 'disabled'}>✏️ Edit</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    const summary = $('#filesSummary');
    if (summary) {
      const got = files.length;
      const expected = this.state.files.expected;
      summary.textContent = `Received ${got}${expected ? ` / ${expected}` : ''}`;
    }
  }

  /**
   * Update transfer UI
   */
  updateTransferUI(transfer) {
    const btnSend = $('#btnSendFile');
    const btnCancel = $('#btnCancelFile');

    if (btnSend) btnSend.disabled = transfer.inProgress;
    if (btnCancel) btnCancel.disabled = !transfer.inProgress;
  }
}

// Initialize application when DOM is ready
// Note: ES6 modules are deferred by default, so DOM is already loaded
function initializeApp() {
  console.log('Initializing SkellyApp...');
  console.log('DOM ready state:', document.readyState);
  
  // Check if critical elements exist
  const btnConnect = document.querySelector('#btnConnect');
  const logEl = document.querySelector('#log');
  console.log('Connect button found:', !!btnConnect);
  console.log('Log element found:', !!logEl);
  
  if (!btnConnect) {
    console.error('Critical UI elements missing! Cannot initialize.');
    return;
  }
  
  window.skellyApp = new SkellyApp();
}

// ES6 modules are deferred, so DOM is usually ready
// But check to be safe
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}

})();
