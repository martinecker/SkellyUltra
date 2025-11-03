/**
 * BLE Manager
 * Handles all Bluetooth Low Energy communication with the device
 */

import { BLE_CONFIG, TIMEOUTS, LOG_CLASSES } from './constants.js';
import { bytesToHex } from './protocol.js';

/**
 * BLE Connection and Communication Manager
 */
export class BLEManager {
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
