/**
 * State Manager
 * Centralized application state with observer pattern for reactive updates
 */

/**
 * Application State Manager
 * Manages device status, file list, and transfer state with change notifications
 */
export class StateManager {
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
