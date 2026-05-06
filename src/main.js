// =============================================================================
// MOONBASE — main.js (Entry Point)
// Flusso: SplashScreen → MainMenu → MoonbaseScene
// =============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { MoonbaseScene } from './scenes/MoonbaseScene.js';
import { SplashScreen } from './ui/SplashScreen.js';
import { MainMenu } from './ui/MainMenu.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { SIDEBAR_W, TOP_BAR_H } from './constants.js';
import { LocalStorageAdapter } from './systems/StorageAdapter.js';
import { SupabaseAdapter } from './systems/SupabaseAdapter.js';
import { SaveManager } from './systems/SaveManager.js';
import { AuthManager } from './systems/AuthManager.js';
import { AuthModal } from './ui/AuthModal.js';

// ── Supabase ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://bysfmupjhzewjfaimrtk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5c2ZtdXBqaHpld2pmYWltcnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzY2ODYsImV4cCI6MjA5MzY1MjY4Nn0.PEayjPMSH3EFYePl3GgFSEKa3DMOCeSTfbvmC0fAXXI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const authManager = new AuthManager(supabase);

// ── Game ──────────────────────────────────────────────────────────────────────

function getGameSize() {
  return {
    w: window.innerWidth - SIDEBAR_W,
    h: window.innerHeight - TOP_BAR_H,
  };
}

document.body.classList.add('pre-game');

const { w: initW, h: initH } = getGameSize();

const config = {
  type: Phaser.AUTO,
  width: initW,
  height: initH,
  backgroundColor: '#0a0a0a',
  parent: 'phaser-game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: {
    mouse: {
      target: null,
      capture: true,
    },
  },
  scene: [],
};

const game = new Phaser.Game(config);
window.__phaserGame = game;

game.events.once('ready', () => {
  game.scene.add('MoonbaseScene', MoonbaseScene, false);
});

// ── Storage ───────────────────────────────────────────────────────────────────

const localAdapter = new LocalStorageAdapter();
// Migra eventuale salvataggio legacy (moonbase_save → slot_1) una tantum
localAdapter.importLegacySave();

// SaveManager parte senza adapter (guest = nessun salvataggio)
const saveManager = new SaveManager(null, authManager);

// ── Auth → adapter swap ───────────────────────────────────────────────────────

authManager.onAuthChange((user) => {
  if (user) {
    const cloudAdapter = new SupabaseAdapter(supabase);
    saveManager._adapter = cloudAdapter;
    // Esponi riferimento per hasAutosaveSync nel MainMenu
    authManager._supabaseAdapter = cloudAdapter;
    _migrateLocalSavesToCloud(localAdapter, cloudAdapter, user.id);
  } else {
    saveManager._adapter = null;
    authManager._supabaseAdapter = null;
  }
  if (menu._el) menu._rerenderRoot();
});

// ── Migrazione locale → cloud ─────────────────────────────────────────────────

async function _migrateLocalSavesToCloud(local, cloud, userId) {
  const migrationKey = `moonbase_v1::cloud_migrated_${userId}`;
  if (localStorage.getItem(migrationKey)) return;

  try {
    const [localSlots, cloudSlots] = await Promise.all([local.listSlots(), cloud.listSlots()]);
    if (localSlots.length === 0) {
      localStorage.setItem(migrationKey, '1');
      return;
    }

    const cloudIds = new Set(cloudSlots.map((s) => s.slotId));
    for (const meta of localSlots) {
      if (cloudIds.has(meta.slotId)) continue;
      const data = await local.readSlot(meta.slotId);
      if (data) await cloud.writeSlot(meta.slotId, data);
    }
    localStorage.setItem(migrationKey, '1');
    console.info('[Moonbase] Save locali migrati nel cloud.');
  } catch (e) {
    console.warn('[Moonbase] Migrazione cloud fallita:', e);
  }
}

// ── Avvio gioco ───────────────────────────────────────────────────────────────

function startGame(loadSlot = null) {
  const loading = new LoadingScreen();
  loading.show(() => {
    document.body.classList.remove('pre-game');
  });

  requestAnimationFrame(() => {
    const { w, h } = getGameSize();
    game.scale.resize(w, h);
    game.scene.start('MoonbaseScene', { loadSlot: loadSlot ?? undefined, saveManager, authManager });

    requestAnimationFrame(() => {
      const scene = game.scene.getScene('MoonbaseScene');
      loading.trackLoader(scene?.load ?? null);
    });
  });
}

// ── Menu ──────────────────────────────────────────────────────────────────────

const splash = new SplashScreen();
const menu = new MainMenu({
  saveManager,
  authManager,
  onStart() {
    menu.hide(() => startGame(null));
  },
  onContinue() {
    menu.hide(() => startGame('autosave'));
  },
  onLoadSlot(slotId) {
    menu.hide(() => startGame(slotId));
  },
});

// Init auth prima di mostrare il menu (ripristina sessione da localStorage)
authManager.init().then(() => {
  // Se loggato, prepara subito il cloud adapter (prima del menu)
  if (authManager.isLoggedIn) {
    const cloudAdapter = new SupabaseAdapter(supabase);
    saveManager._adapter = cloudAdapter;
    authManager._supabaseAdapter = cloudAdapter;
    // Pre-fetch hasAutosave per mostrare "CONTINUA" correttamente
    cloudAdapter.hasAutosave().then(() => {});
  }
  initAccountButton();
  splash.show(() => menu.show());
});

// ── Account button (top bar) ──────────────────────────────────────────────────

function initAccountButton() {
  const btn = document.getElementById('btn-account');
  const label = document.getElementById('btn-account-label');
  const dropdown = document.getElementById('account-dropdown');
  const emailEl = document.getElementById('account-dropdown-email');
  const loginItem = document.getElementById('account-dropdown-login');
  const logoutItem = document.getElementById('account-dropdown-logout');
  if (!btn) return;

  function updateUI() {
    const user = authManager.user;
    if (user) {
      label.textContent = user.email;
      btn.classList.add('account-logged-in');
      emailEl.textContent = user.email;
      loginItem.style.display = 'none';
      logoutItem.style.display = '';
    } else {
      label.textContent = 'OSPITE';
      btn.classList.remove('account-logged-in');
      emailEl.textContent = '';
      loginItem.style.display = '';
      logoutItem.style.display = 'none';
    }
    // Reinitialize Lucide icons for the dropdown
    if (window.lucide) window.lucide.createIcons();
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display !== 'none';
    dropdown.style.display = isOpen ? 'none' : 'block';
  });

  loginItem.addEventListener('click', () => {
    closeDropdown();
    const modal = new AuthModal({
      authManager,
      onSuccess: () => updateUI(),
      onClose: () => {},
    });
    modal.show();
  });

  logoutItem.addEventListener('click', () => {
    closeDropdown();
    authManager.logout();
  });

  document.addEventListener('click', (e) => {
    if (!btn.closest('#top-bar-account').contains(e.target)) closeDropdown();
  });

  authManager.onAuthChange(() => updateUI());
  updateUI();
}

// ── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const { w, h } = getGameSize();
  game.scale.resize(w, h);
});
