/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 * 
 * This is a SIMPLIFIED version showing the modular architecture.
 * The full UI controller implementation would be much larger.
 */

import { STORAGE_KEYS, LOG_CLASSES, COMMANDS } from './js/constants.js';
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
   * Initialize appearance (live) controls
   */
  initializeAppearanceControls() {
    // Build appearance eye grid
    this.selectedEye = 1; // Default eye selection
    this.buildAppearanceEyeGrid();

    // Head Light - Brightness control
    const headBriRange = $('#headBrightnessRange');
    const headBriNum = $('#headBrightness');
    
    if (headBriRange && headBriNum) {
      headBriRange.addEventListener('input', (e) => (headBriNum.value = e.target.value));
      headBriNum.addEventListener('input', (e) => (headBriRange.value = clamp(e.target.value, 0, 255)));
    }

    $('#btnSetHeadBrightness')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '00'; // Head light is channel 0
      const brightness = parseInt($('#headBrightness')?.value || '200', 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8));
      this.logger.log(`Set head light brightness to ${brightness}`);
    });

    // Torso Light - Brightness control
    const torsoBriRange = $('#torsoBrightnessRange');
    const torsoBriNum = $('#torsoBrightness');
    
    if (torsoBriRange && torsoBriNum) {
      torsoBriRange.addEventListener('input', (e) => (torsoBriNum.value = e.target.value));
      torsoBriNum.addEventListener('input', (e) => (torsoBriRange.value = clamp(e.target.value, 0, 255)));
    }

    $('#btnSetTorsoBrightness')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '01'; // Torso light is channel 1
      const brightness = parseInt($('#torsoBrightness')?.value || '200', 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8));
      this.logger.log(`Set torso light brightness to ${brightness}`);
    });

    // Head Light - Color/RGB control
    const headColorPick = $('#headColorPick');
    const headRInput = $('#headR');
    const headGInput = $('#headG');
    const headBInput = $('#headB');

    // Sync color picker with RGB inputs
    if (headColorPick && headRInput && headGInput && headBInput) {
      headColorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        headRInput.value = parseInt(hex.substring(1, 3), 16);
        headGInput.value = parseInt(hex.substring(3, 5), 16);
        headBInput.value = parseInt(hex.substring(5, 7), 16);
      });

      [headRInput, headGInput, headBInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(headRInput.value, 0, 255);
          const g = clamp(headGInput.value, 0, 255);
          const b = clamp(headBInput.value, 0, 255);
          headColorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        });
      });
    }

    $('#btnSetHeadRGB')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '00'; // Head light is channel 0
      const r = parseInt($('#headR')?.value || '255', 10);
      const g = parseInt($('#headG')?.value || '0', 10);
      const b = parseInt($('#headB')?.value || '0', 10);
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_RGB, ch + rHex + gHex + bHex + cluster, 8));
      this.logger.log(`Set head light color to RGB(${r}, ${g}, ${b})`);
    });

    // Torso Light - Color/RGB control
    const torsoColorPick = $('#torsoColorPick');
    const torsoRInput = $('#torsoR');
    const torsoGInput = $('#torsoG');
    const torsoBInput = $('#torsoB');

    // Sync color picker with RGB inputs
    if (torsoColorPick && torsoRInput && torsoGInput && torsoBInput) {
      torsoColorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        torsoRInput.value = parseInt(hex.substring(1, 3), 16);
        torsoGInput.value = parseInt(hex.substring(3, 5), 16);
        torsoBInput.value = parseInt(hex.substring(5, 7), 16);
      });

      [torsoRInput, torsoGInput, torsoBInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(torsoRInput.value, 0, 255);
          const g = clamp(torsoGInput.value, 0, 255);
          const b = clamp(torsoBInput.value, 0, 255);
          torsoColorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        });
      });
    }

    $('#btnSetTorsoRGB')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '01'; // Torso light is channel 1
      const r = parseInt($('#torsoR')?.value || '255', 10);
      const g = parseInt($('#torsoG')?.value || '0', 10);
      const b = parseInt($('#torsoB')?.value || '0', 10);
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_RGB, ch + rHex + gHex + bHex + cluster, 8));
      this.logger.log(`Set torso light color to RGB(${r}, ${g}, ${b})`);
    });

    // Head Light - Lighting mode
    const headEffectMode = $('#headEffectMode');
    const headEffectSpeedBlock = $('#headEffectSpeedBlock');

    if (headEffectMode && headEffectSpeedBlock) {
      headEffectMode.addEventListener('change', () => {
        const v = parseInt(headEffectMode.value, 10);
        headEffectSpeedBlock.classList.toggle('hidden', v === 1); // hide for Static
      });
    }

    $('#btnSetHeadEffectMode')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '00'; // Head light is channel 0
      const mode = parseInt($('#headEffectMode')?.value || '1', 10);
      const modeHex = mode.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_MODE, ch + modeHex + cluster + '00', 8));
      this.logger.log(`Set head light mode to ${mode} (1=Static, 2=Strobe, 3=Pulsing)`);
    });

    // Torso Light - Lighting mode
    const torsoEffectMode = $('#torsoEffectMode');
    const torsoEffectSpeedBlock = $('#torsoEffectSpeedBlock');

    if (torsoEffectMode && torsoEffectSpeedBlock) {
      torsoEffectMode.addEventListener('change', () => {
        const v = parseInt(torsoEffectMode.value, 10);
        torsoEffectSpeedBlock.classList.toggle('hidden', v === 1); // hide for Static
      });
    }

    $('#btnSetTorsoEffectMode')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '01'; // Torso light is channel 1
      const mode = parseInt($('#torsoEffectMode')?.value || '1', 10);
      const modeHex = mode.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_MODE, ch + modeHex + cluster + '00', 8));
      this.logger.log(`Set torso light mode to ${mode} (1=Static, 2=Strobe, 3=Pulsing)`);
    });

    // Head Light - Speed control
    const headEffectSpeedRange = $('#headEffectSpeedRange');
    const headEffectSpeedNum = $('#headEffectSpeed');

    if (headEffectSpeedRange && headEffectSpeedNum) {
      headEffectSpeedRange.addEventListener('input', (e) => (headEffectSpeedNum.value = e.target.value));
      headEffectSpeedNum.addEventListener('input', (e) => (headEffectSpeedRange.value = clamp(e.target.value, 0, 255)));
    }

    $('#btnSetHeadEffectSpeed')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '00'; // Head light is channel 0
      const speed = parseInt($('#headEffectSpeed')?.value || '0', 10);
      const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8));
      this.logger.log(`Set head light speed to ${speed}`);
    });

    // Torso Light - Speed control
    const torsoEffectSpeedRange = $('#torsoEffectSpeedRange');
    const torsoEffectSpeedNum = $('#torsoEffectSpeed');

    if (torsoEffectSpeedRange && torsoEffectSpeedNum) {
      torsoEffectSpeedRange.addEventListener('input', (e) => (torsoEffectSpeedNum.value = e.target.value));
      torsoEffectSpeedNum.addEventListener('input', (e) => (torsoEffectSpeedRange.value = clamp(e.target.value, 0, 255)));
    }

    $('#btnSetTorsoEffectSpeed')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '01'; // Torso light is channel 1
      const speed = parseInt($('#torsoEffectSpeed')?.value || '0', 10);
      const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.ble.send(buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8));
      this.logger.log(`Set torso light speed to ${speed}`);
    });

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

    // Head Light - Color cycle button
    $('#btnHeadColorCycle')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '00'; // Head light is channel 0
      await this.ble.send(buildCommand(COMMANDS.COLOR_CYCLE, ch + '00000000', 8));
      this.logger.log('Head light color cycle (all colors)');
    });

    // Torso Light - Color cycle button
    $('#btnTorsoColorCycle')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const ch = '01'; // Torso light is channel 1
      await this.ble.send(buildCommand(COMMANDS.COLOR_CYCLE, ch + '00000000', 8));
      this.logger.log('Torso light color cycle (all colors)');
    });

    // Appearance eye grid selection - send command immediately
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
   * Build appearance eye grid
   */
  buildAppearanceEyeGrid() {
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
      tr.innerHTML = `
        <td>${file.serial}</td>
        <td>${file.cluster}</td>
        <td>${escapeHtml(file.name || '')}</td>
        <td>${file.attr}</td>
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
