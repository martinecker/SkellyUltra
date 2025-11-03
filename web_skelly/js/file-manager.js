/**
 * File Manager
 * Handles file transfers, audio conversion, and file list management
 */

import {
  TRANSFER_CONFIG,
  TIMEOUTS,
  AUDIO_CONFIG,
  COMMANDS,
  RESPONSES,
  LOG_CLASSES,
} from './constants.js';
import {
  buildCommand,
  intToHex,
  utf16leHex,
  chunkToHex,
  sleep,
} from './protocol.js';

/**
 * File Transfer and Management
 */
export class FileManager {
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

      // Trigger follow-up queries if needed
      if (!this.state.files.afterCompleteSent) {
        this.state.updateFilesMetadata({ afterCompleteSent: true });
        
        this.ble.send(buildCommand(COMMANDS.QUERY_ORDER, '', 8));
        setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_LIVE, '', 8)), 100);
        setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_VOLUME, '', 8)), 200);
        setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_BT_NAME, '', 8)), 250);
        setTimeout(() => this.ble.send(buildCommand(COMMANDS.QUERY_CAPACITY, '', 8)), 300);
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
export class AudioConverter {
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
