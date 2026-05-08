// =============================================================================
// SaveSlotMenu — overlay UI per selezione slot di salvataggio/caricamento.
//
// Riutilizzabile in due contesti:
//   • show() → overlay full-screen (usato in-game)
//   • renderInline(container) → montaggio nel pannello MainMenu
// =============================================================================

import { SaveManager } from '../systems/SaveManager.js';
import { AuthModal } from './AuthModal.js';

function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export class SaveSlotMenu {
  /**
   * @param {{ saveManager: SaveManager, mode: 'save'|'load', onClose: () => void, onAction: (slotId: string, saveName?: string) => void, authManager?: import('../systems/AuthManager.js').AuthManager }} opts
   */
  constructor({ saveManager, mode, onClose, onAction, authManager = null }) {
    this._saveManager = saveManager;
    this._mode = mode;
    this._onClose = onClose;
    this._onAction = onAction;
    this._authManager = authManager;
    this._el = null;
    this._contentEl = null;
    this._slots = [];
  }

  // ── API pubblica ─────────────────────────────────────────────────────────────

  /** Mostra come overlay full-screen (uso in-game) */
  async show() {
    this._slots = await this._saveManager.listSlots();
    const el = document.createElement('div');
    el.id = 'save-slot-overlay';
    el.innerHTML = `
      <div class="save-slot-panel">
        <div class="save-slot-header">
          <button class="ghost-btn save-slot-close-btn" id="save-slot-close">✕</button>
          <span class="save-slot-title">${this._mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'}</span>
        </div>
        <div class="save-slot-list" id="save-slot-list"></div>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;
    this._contentEl = el.querySelector('#save-slot-list');

    el.querySelector('#save-slot-close').addEventListener('click', () => this._onClose());
    el.addEventListener('click', (e) => { if (e.target === el) this._onClose(); });

    this._renderSlotList();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('save-slot-visible')));
  }

  /** Nasconde l'overlay (uso in-game) */
  hide(cb) {
    if (!this._el) { cb?.(); return; }
    this._el.classList.remove('save-slot-visible');
    this._el.addEventListener('transitionend', () => {
      this._el?.remove();
      this._el = null;
      cb?.();
    }, { once: true });
  }

  /**
   * Montaggio embedded nel container del MainMenu (senza overlay).
   * @param {HTMLElement} container
   */
  async renderInline(container) {
    this._slots = await this._saveManager.listSlots();
    container.innerHTML = `<div class="save-slot-list save-slot-list--inline" id="save-slot-list"></div>`;
    this._contentEl = container.querySelector('#save-slot-list');
    this._renderSlotList();
  }

  /** Aggiorna la lista slot (dopo un save o delete) */
  async refresh() {
    this._slots = await this._saveManager.listSlots();
    if (this._contentEl) this._renderSlotList();
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  _renderSlotList() {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = '';

    if (this._mode === 'save') {
      const newBtn = document.createElement('button');
      newBtn.className = 'ghost-btn save-slot-new-btn';
      newBtn.textContent = '＋  NEW SAVE';
      newBtn.addEventListener('click', () => this._doSave(null));
      this._contentEl.appendChild(newBtn);
    }

    const autosaveMeta = this._slots.find((m) => m.slotId === 'autosave') ?? null;
    if (autosaveMeta) this._contentEl.appendChild(this._renderSaveCard(autosaveMeta));

    const userSaves = this._slots.filter((m) => m.slotId !== 'autosave');
    for (const meta of userSaves) {
      this._contentEl.appendChild(this._renderSaveCard(meta));
    }

    if (this._mode === 'load' && this._slots.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'save-slot-empty-state';
      empty.textContent = 'No saves available.';
      this._contentEl.appendChild(empty);
    }
  }

  /** @param {import('../systems/StorageAdapter.js').SlotMeta} meta */
  _renderSaveCard(meta) {
    const { slotId } = meta;
    const isAutosave = slotId === 'autosave';
    const card = document.createElement('div');
    card.className = 'save-slot-card save-slot-card--occupied';

    const canOverwrite = this._mode === 'save' && !isAutosave;
    const canLoad = this._mode === 'load';
    const canDelete = !isAutosave;

    card.innerHTML = `
      <div class="save-slot-card-top">
        ${isAutosave ? '<span class="save-slot-badge">AUTO</span>' : ''}
        <span class="save-slot-name">${this._escape(meta.saveName ?? slotId)}</span>
      </div>
      <div class="save-slot-card-meta">
        <span>Day ${meta.lunarDay ?? 0}</span>
        <span>·</span>
        <span>${meta.buildingCount ?? 0} buildings</span>
        <span>·</span>
        <span>${meta.roverCount ?? 0} rover</span>
      </div>
      <div class="save-slot-card-date">${formatDate(meta.savedAt)}</div>
      <div class="save-slot-card-actions">
        ${canOverwrite ? `<button class="ghost-btn save-slot-action-btn" data-action="primary" data-slot="${slotId}">OVERWRITE</button>` : ''}
        ${canLoad ? `<button class="ghost-btn save-slot-action-btn" data-action="primary" data-slot="${slotId}">LOAD</button>` : ''}
        ${canDelete ? `<button class="ghost-btn save-slot-action-btn save-slot-action-btn--danger" data-action="delete" data-slot="${slotId}">DELETE</button>` : ''}
      </div>
    `;

    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'primary') this._handlePrimary(slotId, meta);
        if (action === 'delete') this._handleDelete(meta, card);
      });
    });

    return card;
  }

  // ── Azioni ───────────────────────────────────────────────────────────────────

  _handlePrimary(slotId, existingMeta) {
    if (this._mode === 'save') {
      this._confirmOverwrite(slotId, () => this._doSave(slotId));
    } else {
      this._onAction(slotId);
    }
  }

  // slotId === null → nuovo save con ID generato; slotId !== null → sovrascrittura
  _doSave(slotId) {
    if (this._authManager && !this._authManager.isLoggedIn) {
      this._showAuthGate(slotId);
      return;
    }
    const defaultName = `Game — ${new Date().toLocaleDateString('en-US')}`;
    const finalId = slotId ?? SaveManager.generateSaveId();
    this._showNameInput(defaultName, (name) => this._onAction(finalId, name));
  }

  _showNameInput(defaultName, onConfirm) {
    this._contentEl?.querySelector('.save-slot-name-form')?.remove();

    const form = document.createElement('div');
    form.className = 'save-slot-name-form';
    form.innerHTML = `
      <span class="save-slot-name-label">SAVE NAME</span>
      <div class="save-slot-name-row">
        <input class="save-slot-name-input" type="text" maxlength="60" spellcheck="false" autocomplete="off" />
        <button class="ghost-btn save-slot-action-btn" id="ssn-confirm">SAVE</button>
        <button class="save-slot-name-cancel" id="ssn-cancel">CANCEL</button>
      </div>
    `;

    const input = form.querySelector('.save-slot-name-input');
    input.value = defaultName;

    const confirm = () => {
      form.remove();
      onConfirm(input.value.trim() || defaultName);
    };
    const cancel = () => {
      form.remove();
      this._renderSlotList();
    };

    form.querySelector('#ssn-confirm').addEventListener('click', confirm);
    form.querySelector('#ssn-cancel').addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    this._contentEl.prepend(form);
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  _showAuthGate(slotId) {
    const modal = new AuthModal({
      authManager: this._authManager,
      onSuccess: () => {
        this.refresh().then(() => this._doSave(slotId));
      },
      onClose: () => {},
    });
    modal.show();
  }

  async _handleDelete(meta, card) {
    if (!confirm(`Delete save "${this._escape(meta.saveName ?? meta.slotId)}"?`)) return;
    await this._saveManager.deleteSlot(meta.slotId);
    await this.refresh();
  }

  _confirmOverwrite(slotId, onConfirm) {
    const existing = this._contentEl?.querySelector(`[data-slot="${slotId}"][data-action="primary"]`);
    if (!existing) { onConfirm(); return; }

    const original = existing.outerHTML;
    existing.replaceWith((() => {
      const wrap = document.createElement('div');
      wrap.className = 'save-slot-confirm-row';
      wrap.innerHTML = `
        <span class="save-slot-confirm-msg">Overwrite?</span>
        <button class="ghost-btn save-slot-action-btn" id="confirm-yes">YES</button>
        <button class="ghost-btn" id="confirm-no">NO</button>
      `;
      wrap.querySelector('#confirm-yes').addEventListener('click', () => { wrap.remove(); onConfirm(); });
      wrap.querySelector('#confirm-no').addEventListener('click', () => {
        wrap.replaceWith(document.createRange().createContextualFragment(original));
      });
      return wrap;
    })());
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  _escape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// ── Stili inline ─────────────────────────────────────────────────────────────
// Iniettati una sola volta al caricamento del modulo.

(function injectStyles() {
  if (document.getElementById('save-slot-styles')) return;
  const style = document.createElement('style');
  style.id = 'save-slot-styles';
  style.textContent = `
    #save-slot-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.82);
      z-index: 6100;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #save-slot-overlay.save-slot-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .save-slot-panel {
      background: rgba(12,15,20,0.96);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(240,240,250,0.12);
      border-radius: 4px;
      padding: 28px 36px 32px;
      min-width: 480px;
      max-width: 560px;
      width: 90vw;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .save-slot-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }
    .save-slot-close-btn {
      font-size: 0.75rem !important;
      padding: 4px 8px !important;
    }
    .save-slot-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--white, #f0f0fa);
    }

    .save-slot-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .save-slot-list--inline {
      max-height: 320px;
      overflow-y: auto;
    }

    .save-slot-card {
      border: 1px solid rgba(240,240,250,0.10);
      border-radius: 3px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: border-color 0.15s ease;
    }
    .save-slot-card--occupied {
      border-color: rgba(240,240,250,0.18);
    }
    .save-slot-card--occupied:hover {
      border-color: rgba(240,240,250,0.30);
    }

    .save-slot-card-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .save-slot-badge {
      font-family: 'Space Mono', monospace;
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0a0a0a;
      background: var(--white, #f0f0fa);
      border-radius: 2px;
      padding: 2px 6px;
      flex-shrink: 0;
    }
    .save-slot-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.45);
      flex-shrink: 0;
    }
    .save-slot-name {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--white, #f0f0fa);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .save-slot-empty {
      font-family: 'Space Mono', monospace;
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.25);
    }

    .save-slot-card-meta {
      display: flex;
      gap: 6px;
      font-family: 'Space Mono', monospace;
      font-size: 0.58rem;
      letter-spacing: 0.06em;
      color: rgba(240,240,250,0.45);
    }
    .save-slot-card-date {
      font-family: 'Space Mono', monospace;
      font-size: 0.56rem;
      color: rgba(240,240,250,0.30);
      letter-spacing: 0.04em;
    }

    .save-slot-card-actions {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .save-slot-action-btn {
      font-size: 0.6rem !important;
      padding: 5px 12px !important;
      letter-spacing: 0.08em !important;
    }
    .save-slot-action-btn--danger {
      border-color: rgba(220,60,60,0.35) !important;
      color: rgba(220,120,120,0.85) !important;
    }
    .save-slot-action-btn--danger:hover {
      border-color: rgba(220,60,60,0.65) !important;
      color: rgb(220,100,100) !important;
    }

    .save-slot-name-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      border: 1px solid rgba(240,240,250,0.22);
      border-radius: 3px;
      background: rgba(240,240,250,0.03);
      margin-bottom: 4px;
    }
    .save-slot-name-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.57rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.38);
    }
    .save-slot-name-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .save-slot-name-input {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      color: var(--white, #f0f0fa);
      background: rgba(240,240,250,0.05);
      border: 1px solid rgba(240,240,250,0.14);
      border-radius: 3px;
      padding: 8px 10px;
      outline: none;
      flex: 1;
      min-width: 0;
      transition: border-color 0.15s;
    }
    .save-slot-name-input:focus {
      border-color: rgba(240,240,250,0.42);
    }
    .save-slot-name-cancel {
      font-family: 'Space Mono', monospace;
      font-size: 0.58rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(240,240,250,0.30);
      padding: 5px 6px;
      transition: color 0.15s;
    }
    .save-slot-name-cancel:hover {
      color: rgba(240,240,250,0.60);
    }

    .save-slot-new-btn {
      width: 100%;
      font-size: 0.62rem !important;
      letter-spacing: 0.14em !important;
      padding: 10px 0 !important;
      margin-bottom: 4px;
      border-style: dashed !important;
      border-color: rgba(240,240,250,0.20) !important;
      color: rgba(240,240,250,0.55) !important;
    }
    .save-slot-new-btn:hover {
      border-color: rgba(240,240,250,0.45) !important;
      color: rgba(240,240,250,0.90) !important;
    }

    .save-slot-empty-state {
      font-family: 'Space Mono', monospace;
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.25);
      text-align: center;
      padding: 24px 0;
    }

    .save-slot-confirm-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .save-slot-confirm-msg {
      font-family: 'Space Mono', monospace;
      font-size: 0.6rem;
      letter-spacing: 0.08em;
      color: rgba(240,240,250,0.6);
      text-transform: uppercase;
    }
  `;
  document.head.appendChild(style);
})();
