/**
 * Edit Modal Manager
 * Handles the per-file edit modal functionality
 */

import { LOG_CLASSES } from './constants.js';
import { buildCommand, clamp, intToHex, utf16leHex } from './protocol.js';

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Edit Modal Manager Class
 */
export class EditModalManager {
  constructor(bleManager, stateManager, fileManager, audioConverter, logger) {
    this.ble = bleManager;
    this.state = stateManager;
    this.fileManager = fileManager;
    this.audioConverter = audioConverter;
    this.mainLogger = logger;

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
    this.logElement = $('#edLog');
    this.progText = $('#edProgText');
    this.progPct = $('#edProgPct');
    this.progBar = $('#edProgBar');

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
   * Update edit modal progress bar
   */
  setProgress(current, total) {
    const pct = total ? Math.round((current / total) * 100) : 0;
    if (this.progText) this.progText.textContent = `${current} / ${total}`;
    if (this.progPct) this.progPct.textContent = `${pct}%`;
    if (this.progBar) this.progBar.style.width = `${pct}%`;
  }

  /**
   * Log to both main log and edit modal log
   */
  log(message, className = 'normal') {
    // Log to main page
    this.mainLogger(message, className);
    
    // Also log to edit modal if open
    if (this.logElement) {
      const div = document.createElement('div');
      div.className = `line ${className}`;
      const time = new Date().toLocaleTimeString();
      div.textContent = `[${time}] ${message}`;
      this.logElement.appendChild(div);
      
      // Auto-scroll to bottom
      this.logElement.scrollTop = this.logElement.scrollHeight;
    }
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

    // File upload for replacement
    const edUploadFile = $('#edUploadFile');
    const edUploadBtn = $('#edUploadBtn');

    if (edUploadBtn) {
      edUploadBtn.addEventListener('click', async () => {
        await this.handleFileUpload();
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
   * Handle file upload/replacement
   */
  async handleFileUpload() {
    if (!this.ble.isConnected()) {
      this.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }

    const edUploadFile = $('#edUploadFile');
    const file = edUploadFile?.files?.[0];
    
    if (!file) {
      this.log('No file selected', LOG_CLASSES.WARNING);
      return;
    }

    const fileName = ($('#edName')?.value || '').trim();
    if (!fileName) {
      this.log('File name is required', LOG_CLASSES.WARNING);
      return;
    }

    // Confirm overwrite
    if (!confirm(`Replace "${fileName}" with the selected file? This cannot be undone.`)) {
      return;
    }
    
    try {
      let bytes;

      // Convert if checkbox is checked
      const shouldConvert = $('#edChkConvert')?.checked;
      if (shouldConvert) {
        const kbps = parseInt($('#edMp3Kbps')?.value || '32', 10);
        this.log(`Converting to MP3 8 kHz mono (${kbps} kbps)…`);
        
        const result = await this.audioConverter.convertToDeviceMp3(file, kbps);
        bytes = result.u8;
        
        this.log(`Converted to ${(bytes.length / 1024).toFixed(1)} KB MP3`);
      } else {
        // Read file as bytes
        const arrayBuffer = await file.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      }

      // Temporarily override FileManager's progress callback to use edit modal's progress bar
      const originalProgressCallback = this.fileManager.onProgress;
      this.fileManager.onProgress = (current, total) => this.setProgress(current, total);
      
      try {
        // Upload via FileManager - MUST use exact same filename as before
        this.log(`Uploading ${fileName} (${(bytes.length / 1024).toFixed(1)} KB)...`);
        this.setProgress(0, 0); // Reset progress bar
        
        await this.fileManager.uploadFile(bytes, fileName);
        
        this.log(`File "${fileName}" uploaded successfully ✓`, LOG_CLASSES.SUCCESS);
        
      } finally {
        // Restore original progress callback
        this.fileManager.onProgress = originalProgressCallback;
      }
      
      // Clear the file input
      if (edUploadFile) edUploadFile.value = '';
      
      // Refresh file list
      setTimeout(() => {
        this.fileManager.startFetchFiles();
      }, 500);
      
    } catch (error) {
      this.log(`Upload failed: ${error.message}`, LOG_CLASSES.WARNING);
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

    // Clear the log when opening
    if (this.logElement) {
      this.logElement.innerHTML = '';
    }

    // Reset progress bar
    this.setProgress(0, 0);

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
