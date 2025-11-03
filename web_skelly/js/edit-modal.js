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

    // Apply effect mode for this specific file (F2)
    $('#edApplyEffectMode')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const mode = parseInt($('#edEffectMode')?.value || '1', 10);
      const modeHex = mode.toString(16).padStart(2, '0').toUpperCase();
      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();

      // Per-file: channel FF (all) + cluster + filename
      let payload = 'FF' + modeHex + clusterHex;
      if (name) {
        const nameHex = utf16leHex(name);
        const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
        payload += nameLen + '5C55' + nameHex;
      } else {
        payload += '00';
      }

      await this.ble.send(buildCommand('F2', payload, 8));
      this.log(`Set Effect Mode (F2) for file "${name || '(no name)'}" mode=${mode} cluster=${cluster}`);
    });

    // Apply SPEED for this specific file (F6)
    $('#edApplyEffectSpeed')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const speed = clamp($('#edEffectSpeed')?.value || 0, 0, 255);
      const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();

      let payload = 'FF' + speedHex + clusterHex;
      if (name) {
        const nameHex = utf16leHex(name);
        const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
        payload += nameLen + '5C55' + nameHex;
      } else {
        payload += '00';
      }

      await this.ble.send(buildCommand('F6', payload, 8));
      this.log(`Set Effect Speed (F6) for file "${name || '(no name)'}" speed=${speed} cluster=${cluster}`);
    });
  }

  /**
   * Initialize movement controls
   */
  initializeMovementControls() {
    // Movement button handler is already initialized globally by iconToggle in app-modular.js
    // Apply button
    $('#applyEdMove')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const grid = $('#edMove');
      if (!grid) return;

      const toggles = grid.querySelectorAll('.iconToggle.selected');
      const parts = Array.from(toggles).map((btn) => btn.getAttribute('data-part'));

      if (parts.length === 0) {
        this.log('No movement selected', LOG_CLASSES.WARNING);
        return;
      }

      // Map parts to hex
      const partMap = { all: '00', head: '01', arm: '02', torso: '03' };
      const hexParts = parts.map((p) => partMap[p] || '00');

      // Send F0 command for each part
      for (const partHex of hexParts) {
        await this.ble.send(buildCommand('F0', partHex + '00000000', 8));
      }

      this.log(`Applied movement: ${parts.join(', ')}`);
    });
  }

  /**
   * Initialize color/RGB controls
   */
  initializeColorControls() {
    const edColorPick = $('#edColorPick');
    const edR = $('#edR');
    const edG = $('#edG');
    const edB = $('#edB');

    // Sync RGB inputs to color picker
    [edR, edG, edB].forEach((inp) => {
      inp?.addEventListener('input', () => {
        const r = clamp(edR.value, 0, 255);
        const g = clamp(edG.value, 0, 255);
        const b = clamp(edB.value, 0, 255);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        if (edColorPick && edColorPick.value !== hex) {
          edColorPick.value = hex;
        }
      });
    });

    // Sync color picker to RGB inputs
    edColorPick?.addEventListener('input', () => {
      const v = edColorPick.value.replace('#', '');
      if (v.length === 6) {
        edR.value = parseInt(v.slice(0, 2), 16);
        edG.value = parseInt(v.slice(2, 4), 16);
        edB.value = parseInt(v.slice(4, 6), 16);
      }
    });

    // Apply per-file color (F4)
    $('#edApplyRGB')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const r = clamp(edR?.value || 255, 0, 255);
      const g = clamp(edG?.value || 0, 0, 255);
      const b = clamp(edB?.value || 0, 0, 255);
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const loop = '00'; // not cycling
      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();

      let payload = 'FF' + rHex + gHex + bHex + loop + clusterHex;
      if (name) {
        const nameHex = utf16leHex(name);
        const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
        payload += nameLen + '5C55' + nameHex;
      } else {
        payload += '00';
      }

      await this.ble.send(buildCommand('F4', payload, 8));
      this.log(`Set Color (F4) for file "${name || '(no name)'}" rgb=${r},${g},${b} cluster=${cluster}`);
    });

    // Color cycle button
    $('#edColorCycle')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();

      let payload = 'FF' + clusterHex;
      if (name) {
        const nameHex = utf16leHex(name);
        const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
        payload += nameLen + '5C55' + nameHex;
      } else {
        payload += '00';
      }

      await this.ble.send(buildCommand('F7', payload, 8));
      this.log(`Color cycle (F7) for file "${name || '(no name)'}"`);
    });
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

    // Set Eye button (F9)
    $('#edApplyEye')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();
      const eyeHex = this.currentFile.eye.toString(16).padStart(2, '0').toUpperCase();

      let payload = eyeHex + '00' + clusterHex;
      if (name) {
        const nameHex = utf16leHex(name);
        const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
        payload += nameLen + '5C55' + nameHex;
      } else {
        payload += '00';
      }

      await this.ble.send(buildCommand('F9', payload, 8));
      this.log(`Set Eye (F9) icon=${this.currentFile.eye} cluster=${cluster}${name ? ` name="${name}"` : ''}`);
    });

    // Set Animation button (CA)
    $('#edApplyAnim')?.addEventListener('click', async () => {
      if (!this.ble.isConnected()) {
        this.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const action = Math.max(0, Math.min(255, parseInt($('#edAction')?.value || '255', 10)));
      const actionHex = action.toString(16).padStart(2, '0').toUpperCase();
      const cluster = Math.max(0, parseInt($('#edCluster')?.value || '0', 10));
      const clusterHex = cluster.toString(16).padStart(8, '0').toUpperCase();
      const name = ($('#edName')?.value || '').trim();

      let payload = actionHex + '00' + clusterHex;
      if (name) {
        const nameHex = utf16leHex(name);
        const nameLen = ((nameHex.length / 2) + 2).toString(16).padStart(2, '0').toUpperCase();
        payload += nameLen + '5C55' + nameHex;
      } else {
        payload += '00';
      }

      await this.ble.send(buildCommand('CA', payload, 8));
      this.log(`Set Animation (CA) for "${name}" action=${action} cluster=${cluster}`);
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
    if ($('#edAction')) $('#edAction').value = 255;
    if ($('#edName')) $('#edName').value = file.name || '';
    if ($('#edEffectMode')) $('#edEffectMode').value = '1';
    if ($('#edEffectSpeed')) $('#edEffectSpeed').value = 0;
    if ($('#edEffectSpeedRange')) $('#edEffectSpeedRange').value = 0;
    $('#edEffectSpeedBlock')?.classList.add('hidden'); // Static by default

    // Reset color to red
    if ($('#edR')) $('#edR').value = 255;
    if ($('#edG')) $('#edG').value = 0;
    if ($('#edB')) $('#edB').value = 0;
    if ($('#edColorPick')) $('#edColorPick').value = '#ff0000';

    // Clear movement selections
    $('#edMove')?.querySelectorAll('.iconToggle').forEach((btn) => btn.classList.remove('selected'));

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
