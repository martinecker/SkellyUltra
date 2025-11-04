/**
 * Protocol Parser
 * Parses incoming BLE notifications and updates application state
 */

import {
  RESPONSES,
  MOVEMENT_BITS,
  LOG_CLASSES,
} from './constants.js';
import {
  getAsciiFromHex,
  decodeUtf16le,
  hexToBytes,
} from './protocol.js';

/**
 * Protocol Response Parser
 */
export class ProtocolParser {
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

    // MAC address (BBCC)
    if (hex.startsWith(RESPONSES.MAC)) {
      this.parseMac(hex);
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
   * Parse MAC address (BBCC)
   */
  parseMac(hex) {
    const mac = hex.slice(4, 16);
    this.log(`Parsed Wi-Fi MAC: ${mac}`);
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
