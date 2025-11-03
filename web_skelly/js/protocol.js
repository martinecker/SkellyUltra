/**
 * Protocol Utilities
 * Handles BLE protocol encoding/decoding, CRC calculation, and command building
 */

import { PADDING, PROTOCOL_MARKERS } from './constants.js';

/**
 * Calculate CRC8 checksum for BLE protocol
 * @param {Uint8Array} bytes - Input bytes
 * @returns {string} - 2-character hex string
 */
export function crc8(bytes) {
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
export function hexToBytes(hex) {
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
export function bytesToHex(u8) {
  return Array.from(u8, b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

/**
 * Convert integer to hex string with specified byte length
 * @param {number} n - Integer value
 * @param {number} bytes - Number of bytes
 * @returns {string} - Uppercase hex string
 */
export function intToHex(n, bytes) {
  return (n >>> 0).toString(16).toUpperCase().padStart(bytes * 2, '0').slice(-bytes * 2);
}

/**
 * Convert string to UTF16-LE hex representation
 * @param {string} str - Input string
 * @returns {string} - Uppercase hex string
 */
export function utf16leHex(str) {
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
export function decodeUtf16le(u8) {
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
export function buildCommand(tag, payloadHex = '', minBytes = PADDING.DEFAULT) {
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
export function getAsciiFromHex(hexString) {
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
export function buildFilenamePayload(name) {
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
export function chunkToHex(u8, offset, length) {
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
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters
 * @param {string} s - Input string
 * @returns {string} - Escaped string
 */
export function escapeHtml(s) {
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
export function normalizeDeviceName(s) {
  return (s || '').trim().toLowerCase();
}
