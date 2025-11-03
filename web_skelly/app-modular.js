/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 * 
 * This is a SIMPLIFIED version showing the modular architecture.
 * The full UI controller implementation would be much larger.
 */

import { STORAGE_KEYS, LOG_CLASSES, EYE_IMG_TO_NUM, EYE_NUM_TO_IMG } from './js/constants.js';
import { buildCommand, clamp, escapeHtml, normalizeDeviceName } from './js/protocol.js';
import { StateManager } from './js/state-manager.js';
import { BLEManager } from './js/ble-manager.js';
import { FileManager, AudioConverter } from './js/file-manager.js';
import { ProtocolParser } from './js/protocol-parser.js';
import { EditModalManager } from './js/edit-modal.js';

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

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

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

    // Warning modal
    this.initializeWarningModal();

    // Advanced menu
    this.initializeAdvancedMenu();

    // Query buttons
    this.initializeQueryButtons();

    // Media controls
    this.initializeMediaControls();

    // File controls
    this.initializeFileControls();

    // Appearance (Live) controls
    this.initializeAppearanceControls();

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
  }

  /**
   * Initialize media controls
   */
  initializeMediaControls() {
    // Volume control
    const volRange = $('#volRange');
    const volNum = $('#vol');

    if (volRange && volNum) {
      volRange.addEventListener('input', (e) => (volNum.value = e.target.value));
      volNum.addEventListener('input', (e) => (volRange.value = clamp(e.target.value, 0, 100)));
    }

    $('#btnSetVol')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const v = Math.max(0, Math.min(255, parseInt($('#vol')?.value || '0', 10)));
      await this.ble.send(buildCommand('FA', v.toString(16).padStart(2, '0').toUpperCase(), 8));
      this.logger.log(`Set volume to ${v}`);
    });

    // Live Mode button
    $('#btnBT')?.addEventListener('click', () => this.sendMediaCommand('FD', '01'));
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
   * Initialize appearance (live) controls
   */
  initializeAppearanceControls() {
    // Build target channel dropdown
    this.buildTargetOptions(6);

    // Build appearance eye grid
    this.selectedEye = 1; // Default eye selection
    this.buildAppearanceEyeGrid();

    // Brightness control
    const briRange = $('#brightnessRange');
    const briNum = $('#brightness');
    
    if (briRange && briNum) {
      briRange.addEventListener('input', (e) => (briNum.value = e.target.value));
      briNum.addEventListener('input', (e) => (briRange.value = clamp(e.target.value, 0, 255)));
    }

    $('#btnSetBrightness')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = this.getCurrentChannelHex();
      const brightness = parseInt($('#brightness')?.value || '200', 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand('F3', ch + brightnessHex + cluster, 8));
      this.logger.log(`Set brightness to ${brightness} (channel=${ch})`);
    });

    // Color/RGB control
    const colorPick = $('#colorPick');
    const rInput = $('#r');
    const gInput = $('#g');
    const bInput = $('#b');

    // Sync color picker with RGB inputs
    if (colorPick && rInput && gInput && bInput) {
      colorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        rInput.value = parseInt(hex.substring(1, 3), 16);
        gInput.value = parseInt(hex.substring(3, 5), 16);
        bInput.value = parseInt(hex.substring(5, 7), 16);
      });

      [rInput, gInput, bInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(rInput.value, 0, 255);
          const g = clamp(gInput.value, 0, 255);
          const b = clamp(bInput.value, 0, 255);
          colorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        });
      });
    }

    $('#btnSetRGB')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = this.getCurrentChannelHex();
      const r = parseInt($('#r')?.value || '255', 10);
      const g = parseInt($('#g')?.value || '0', 10);
      const b = parseInt($('#b')?.value || '0', 10);
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand('F4', ch + rHex + gHex + bHex + cluster, 8));
      this.logger.log(`Set color to RGB(${r}, ${g}, ${b}) channel=${ch}`);
    });

    // Lighting mode
    const lightMode = $('#lightMode');
    const speedBlock = $('#speedBlock');

    if (lightMode && speedBlock) {
      lightMode.addEventListener('change', () => {
        const v = parseInt(lightMode.value, 10);
        speedBlock.classList.toggle('hidden', v === 1); // hide for Static
      });
    }

    $('#btnSetMode')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = this.getCurrentChannelHex();
      const mode = parseInt($('#lightMode')?.value || '1', 10);
      const modeHex = mode.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand('F2', ch + modeHex + cluster + '00', 8));
      this.logger.log(`Set lighting mode to ${mode} (1=Static, 2=Strobe, 3=Pulsing)`);
    });

    // Speed control
    const speedRange = $('#speedRange');
    const speedNum = $('#speed');

    if (speedRange && speedNum) {
      speedRange.addEventListener('input', (e) => (speedNum.value = e.target.value));
      speedNum.addEventListener('input', (e) => (speedRange.value = clamp(e.target.value, 0, 255)));
    }

    $('#btnSetSpeed')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = this.getCurrentChannelHex();
      const speed = parseInt($('#speed')?.value || '0', 10);
      const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand('F6', ch + speedHex + cluster, 8));
      this.logger.log(`Set speed to ${speed}`);
    });

    // Movement controls
    $('#applyLiveMove')?.addEventListener('click', () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      this.applyMovement('liveMove');
    });

    // Color cycle button
    $('#btnColorCycleLive')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = this.getCurrentChannelHex();
      await this.ble.send(buildCommand('F7', ch + '00000000', 8));
      this.logger.log('Color cycle (all colors)');
    });

    // Initialize icon toggle buttons for movement
    document.querySelectorAll('.iconToggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
      });
    });

    // Appearance eye grid selection
    const apEyeGrid = $('#apEyeGrid');
    if (apEyeGrid) {
      apEyeGrid.addEventListener('click', (e) => {
        const cell = e.target.closest('.eye-opt');
        if (!cell) return;
        this.selectedEye = parseInt(cell.dataset.eye, 10);
        apEyeGrid.querySelectorAll('.eye-opt').forEach((el) => el.classList.remove('selected'));
        cell.classList.add('selected');
      });
    }

    // Set Eye button (F9)
    $('#apSetEye')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      
      const eyeHex = this.selectedEye.toString(16).padStart(2, '0').toUpperCase();
      const clusterHex = '00000000'; // Always cluster 0 for live mode
      
      // Build payload: eye + 00 + cluster + 00 (no name)
      const payload = eyeHex + '00' + clusterHex + '00';
      
      await this.ble.send(buildCommand('F9', payload, 8));
      this.logger.log(`Set eye to ${this.selectedEye} (live mode)`);
    });
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

    // Send F0 command for each part
    hexParts.forEach(async (partHex) => {
      await this.ble.send(buildCommand('F0', partHex + '00000000', 8));
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
    await this.ble.send(buildCommand('C6', serialHex + '01', 8));
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
      
      // Query live mode status and device params first, then start file sync
      await this.ble.send(buildCommand('E1', '', 8));
      setTimeout(() => this.ble.send(buildCommand('E0', '', 8)), 50);
      setTimeout(() => {
        this.fileManager.startFetchFiles(true);
      }, 150);
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
   * Build target channel dropdown
   */
  buildTargetOptions(count = 6) {
    const sel = $('#targetSelect');
    if (!sel) return;
    
    sel.innerHTML = '<option value="FF">All Channels</option>' +
      Array.from({ length: count }, (_, i) => {
        const hex = (i + 1).toString(16).padStart(2, '0').toUpperCase();
        return `<option value="${hex}">Channel ${i + 1}</option>`;
      }).join('');
  }

  /**
   * Build appearance eye grid
   */
  buildAppearanceEyeGrid() {
    const grid = $('#apEyeGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Create eye options for images 1-18
    for (let imgIdx = 1; imgIdx <= 18; imgIdx++) {
      const eyeNum = EYE_IMG_TO_NUM[imgIdx] || imgIdx;
      const div = document.createElement('div');
      div.className = 'eye-opt' + (eyeNum === this.selectedEye ? ' selected' : '');
      div.dataset.eye = String(eyeNum);
      div.title = `Eye ${eyeNum}`;
      
      // Create image element
      const img = document.createElement('img');
      img.className = 'eye-thumb';
      img.src = `images/icon_eyes_${imgIdx}_se.png`;
      img.alt = `eye ${eyeNum}`;
      img.onerror = () => {
        img.onerror = null;
        img.src = `images/icon_eyes_${imgIdx}_se.bmp`;
      };
      
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
   * Get current channel hex from target select
   */
  getCurrentChannelHex() {
    return ($('#targetSelect')?.value || 'FF').toUpperCase();
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
    if ($('#statVolume')) {
      const v = device.volume;
      $('#statVolume').textContent = v == null ? '—' : `${v}%`;
    }
    if ($('#statCapacity')) {
      $('#statCapacity').textContent =
        device.capacity != null
          ? `${device.capacity} KB (${device.filesReported ?? '—'} files)`
          : '—';
    }
  }

  /**
   * Update live status UI
   */
  updateLiveUI(live) {
    if ($('#statAction')) {
      $('#statAction').textContent = live.action ?? '—';
    }

    // Update eye icon
    const img = $('#statEye');
    const txt = $('#statEyeText');
    if (img && txt && live.eye != null) {
      const imgIdx = EYE_NUM_TO_IMG[live.eye] || live.eye;
      img.style.display = 'inline-block';
      img.src = `images/icon_eyes_${imgIdx}_se.png`;
      img.onerror = () => {
        img.onerror = null;
        img.src = `images/icon_eyes_${live.eye}_se.bmp`;
      };
      txt.textContent = ` ${live.eye}`;
    } else if (img && txt) {
      img.style.display = 'none';
      txt.textContent = '—';
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
      const eyeImgIdx = EYE_NUM_TO_IMG[file.eye] || file.eye;
      tr.innerHTML = `
        <td>${file.serial}</td>
        <td>${file.cluster}</td>
        <td>${escapeHtml(file.name || '')}</td>
        <td>${file.attr}</td>
        <td><img class="eye-thumb" src="images/icon_eyes_${eyeImgIdx}_se.png" alt="eye ${file.eye}" />${file.eye ?? ''}</td>
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
