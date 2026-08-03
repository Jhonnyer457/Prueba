import './style.css';
import * as tg from './telegram.js';
import { icon } from './icons.js';
import { confirmDialog, promptDialog, selectDialog } from './modal.js';
import { initStarfield } from './starfield.js';

const app = document.getElementById('app');
const THEME_KEY = 'teledrive_theme';

const state = {
  credentials: { id: null, hash: null },
  activeTab: 'home',   // 'home' | 'downloads' | 'media'
  // path vacío = Inicio (lista de carpetas de nivel superior)
  // path = [topFolder] = dentro de una carpeta (viendo subcarpetas + archivos raíz)
  // path = [topFolder, subFolder] = dentro de una subcarpeta (viendo sus archivos)
  path: [],
  topFolders: [],       // [{id, name}]
  transfers: [],
  loggedIn: false,
};

// ---------- Tema ----------
function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('theme-dark', theme !== 'light');
  localStorage.setItem(THEME_KEY, theme);
}
function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
}
function toggleTheme() {
  applyTheme(document.body.classList.contains('theme-light') ? 'dark' : 'light');
}

// ---------- Helpers ----------
function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
function fmtDate(d) {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function iconForMime(mime, name) {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'music';
  if (mime?.includes('pdf')) return 'pdf';
  if (mime?.includes('zip') || mime?.includes('rar') || mime?.includes('7z') || mime?.includes('tar')) return 'archive';
  if (/\.(docx?|txt|rtf)$/i.test(name)) return 'pdf';
  return 'file';
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
let toastTimer;
function toast(msg, type = 'info') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `${type === 'error' ? icon('alert', 16) : icon('shield', 16)}<span>${escapeHtml(msg)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function closeAllPopovers() {
  document.querySelectorAll('.menu-popover, .dropdown-menu, .fab-popover').forEach((el) => el.remove());
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-trigger') && !e.target.closest('.menu-popover') &&
      !e.target.closest('#btn-settings') && !e.target.closest('.dropdown-menu') &&
      !e.target.closest('#fab-main') && !e.target.closest('.fab-popover')) {
    closeAllPopovers();
  }
});

// Crea (una sola vez) un <input type=file> oculto reutilizable con el
// "accept" que se necesite en cada momento, y devuelve los archivos
// elegidos como Promise.
let sharedFileInput = null;
function pickFiles({ accept = '' } = {}) {
  if (!sharedFileInput) {
    sharedFileInput = document.createElement('input');
    sharedFileInput.type = 'file';
    sharedFileInput.multiple = true;
    sharedFileInput.style.display = 'none';
    document.body.appendChild(sharedFileInput);
  }
  sharedFileInput.accept = accept;
  return new Promise((resolve) => {
    sharedFileInput.onchange = () => {
      resolve(sharedFileInput.files);
      sharedFileInput.value = '';
    };
    sharedFileInput.click();
  });
}

// ================= LOGIN =================
function renderLogin() {
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">☁️</div>
        <h1>TeleDrive</h1>
        <p class="sub">Tu nube personal usando Telegram como almacenamiento.</p>
        <div id="login-step"></div>
      </div>
    </div>
  `;
  renderLoginStepCredentials();
}

function renderLoginStepCredentials() {
  const container = document.getElementById('login-step');
  container.innerHTML = `
    <label>api_id</label>
    <input type="text" id="in-apiid" placeholder="123456" inputmode="numeric" />
    <label>api_hash</label>
    <input type="text" id="in-apihash" placeholder="abcdef0123456789..." />
    <label>Número de teléfono (con código de país)</label>
    <input type="tel" id="in-phone" placeholder="+34 600 000 000" />
    <div id="login-error"></div>
    <button class="btn" id="btn-continue">${icon('shield', 17)} Continuar</button>
  `;
  document.getElementById('btn-continue').onclick = async () => {
    const id = document.getElementById('in-apiid').value.trim();
    const hash = document.getElementById('in-apihash').value.trim();
    const phone = document.getElementById('in-phone').value.trim();
    const errBox = document.getElementById('login-error');
    errBox.innerHTML = '';
    if (!id || !hash || !phone) {
      errBox.innerHTML = `<div class="error-msg">${icon('alert', 14)} Completa todos los campos.</div>`;
      return;
    }
    state.credentials = { id, hash, phone };
    const btn = document.getElementById('btn-continue');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner">${icon('refresh', 16)}</span> Enviando código...`;

    try {
      await tg.login({
        id, hash, phone,
        onNeedCode: () => waitForInput(renderLoginStepCode),
        onNeedPassword: () => waitForInput(renderLoginStepPassword),
      });
      state.loggedIn = true;
      await bootApp();
    } catch (e) {
      console.error(e);
      errBox.innerHTML = `<div class="error-msg">${icon('alert', 14)} ${escapeHtml(e.message || 'Error al iniciar sesión.')}</div>`;
      btn.disabled = false;
      btn.innerHTML = `${icon('shield', 17)} Continuar`;
    }
  };
}

function waitForInput(renderStepFn) {
  return new Promise((resolve) => renderStepFn(resolve));
}

function renderLoginStepCode(resolve) {
  const container = document.getElementById('login-step');
  container.innerHTML = `
    <label>Código recibido en Telegram</label>
    <input type="text" id="in-code" placeholder="12345" inputmode="numeric" autofocus />
    <div id="login-error"></div>
    <button class="btn" id="btn-code">${icon('key', 17)} Verificar</button>
  `;
  document.getElementById('btn-code').onclick = () => {
    const code = document.getElementById('in-code').value.trim();
    if (!code) return;
    resolve(code);
    container.innerHTML = `<div class="loading-full" style="min-height:120px"><span class="spinner">${icon('refresh', 22)}</span><span>Verificando...</span></div>`;
  };
}

function renderLoginStepPassword(resolve) {
  const container = document.getElementById('login-step');
  container.innerHTML = `
    <label>Tienes verificación en 2 pasos. Ingresa tu contraseña de Telegram</label>
    <input type="password" id="in-pass" placeholder="••••••••" autofocus />
    <div id="login-error"></div>
    <button class="btn" id="btn-pass">${icon('key', 17)} Entrar</button>
  `;
  document.getElementById('btn-pass').onclick = () => {
    const pass = document.getElementById('in-pass').value;
    if (!pass) return;
    resolve(pass);
    container.innerHTML = `<div class="loading-full" style="min-height:120px"><span class="spinner">${icon('refresh', 22)}</span><span>Verificando...</span></div>`;
  };
}

// ================= APP PRINCIPAL =================
function promptCredentialsOnly() {
  return new Promise((resolve) => {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-logo">☁️</div>
          <h1>TeleDrive</h1>
          <p class="sub">Sesión guardada encontrada. Ingresa tus credenciales de API para reconectar.</p>
          <label>api_id</label>
          <input type="text" id="in-apiid" />
          <label>api_hash</label>
          <input type="text" id="in-apihash" />
          <button class="btn" id="btn-reconnect">${icon('refresh', 17)} Reconectar</button>
        </div>
      </div>`;
    document.getElementById('btn-reconnect').onclick = () => {
      state.credentials.id = document.getElementById('in-apiid').value.trim();
      state.credentials.hash = document.getElementById('in-apihash').value.trim();
      resolve();
    };
  });
}

async function bootApp() {
  app.innerHTML = `<div class="loading-full"><span class="spinner">${icon('refresh', 26)}</span><span>Conectando con Telegram...</span></div>`;
  try {
    if (!state.loggedIn) {
      if (!state.credentials.id) await promptCredentialsOnly();
      await tg.reconnect(state.credentials.id, state.credentials.hash);
    }
    // Nunca se crea nada aquí: solo leemos el índice de carpetas ya existentes.
    state.topFolders = await tg.listTopFolders();
    renderApp();
  } catch (e) {
    console.error(e);
    app.innerHTML = `
      <div class="loading-full">
        <span style="color:var(--error)">${icon('alert', 22)}</span>
        <span style="color:var(--error)">Error al conectar: ${escapeHtml(e.message)}</span>
        <button class="btn btn-ghost" id="btn-relogin" style="max-width:220px">Reiniciar sesión</button>
      </div>`;
    document.getElementById('btn-relogin').onclick = () => {
      tg.logout();
      state.loggedIn = false;
      render();
    };
  }
}

function render() {
  if (!tg.hasSavedSession() && !state.loggedIn) {
    renderLogin();
  } else {
    renderApp();
  }
}

function renderApp() {
  app.innerHTML = `
    <div class="topbar">
      <div class="brand">☁️ TeleDrive</div>
      <div class="settings-wrapper">
        <button class="icon-btn" id="btn-settings" title="Ajustes">${icon('settings', 19)}</button>
      </div>
    </div>
    <main id="main"></main>
    <button class="fab" id="fab-main">${icon('plus', 24)}</button>

    <nav class="bottombar">
      <button class="nav-btn active" data-tab="home">
        <span class="nav-emoji">📂</span>
        <span>Inicio</span>
      </button>
      <button class="nav-btn" data-tab="downloads">
        <span id="nav-downloads-icon">${icon('download', 20)}</span>
        <span id="nav-downloads-label">Descargas</span>
      </button>
      <button class="nav-btn" data-tab="media">
        ${icon('image', 20)}
        <span>Multimedia</span>
      </button>
    </nav>
  `;

  document.getElementById('btn-settings').onclick = toggleSettingsMenu;
  document.getElementById('fab-main').onclick = onFabClick;

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  renderMain();
}

// ---------- Menú de ajustes (desplegable) ----------
function toggleSettingsMenu(e) {
  e.stopPropagation();
  const existing = document.querySelector('.dropdown-menu');
  if (existing) { existing.remove(); return; }
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.innerHTML = `
    <button data-act="theme">${icon('settings', 15)} Cambiar tema</button>
    <button data-act="sync">${icon('refresh', 15)} Sincronizar con Telegram</button>
    <button data-act="logout">${icon('logOut', 15)} Cerrar sesión</button>
  `;
  document.querySelector('.settings-wrapper').appendChild(menu);
  menu.querySelector('[data-act="theme"]').onclick = () => { toggleTheme(); closeAllPopovers(); };
  menu.querySelector('[data-act="sync"]').onclick = async () => {
    closeAllPopovers();
    toast('Sincronizando con Telegram...');
    try {
      state.topFolders = await tg.listTopFolders();
      state.path = [];
      renderMain();
      toast('Sincronizado');
    } catch (e) {
      toast('Error al sincronizar: ' + e.message, 'error');
    }
  };
  menu.querySelector('[data-act="logout"]').onclick = () => { tg.logout(); location.reload(); };
}

// ---------- Navegación inferior ----------
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('fab-main').style.display = tab === 'downloads' ? 'none' : 'flex';
  renderMain();
}

// ---------- FAB dinámico y contextual ----------
function onFabClick(e) {
  e.stopPropagation();
  closeAllPopovers();

  if (state.activeTab === 'media') {
    mediaUploadFlow();
    return;
  }
  if (state.activeTab !== 'home') return;

  if (state.path.length === 0) {
    // Inicio: la única acción posible es crear una carpeta (= un grupo nuevo)
    createTopFolderFlow();
  } else if (state.path.length === 1) {
    // Dentro de una carpeta: se puede crear una subcarpeta o subir archivos
    const top = state.path[0];
    showFabPopover([
      { label: 'Crear carpeta', iconName: 'folderPlus', act: () => createSubFolderFlow(top) },
      { label: 'Subir archivos', iconName: 'uploadCloud', act: () => uploadIntoCurrentView() },
    ]);
  } else {
    // Dentro de una subcarpeta: solo se puede subir archivos (1 solo nivel de subcarpetas)
    uploadIntoCurrentView();
  }
}

function showFabPopover(options) {
  const pop = document.createElement('div');
  pop.className = 'fab-popover';
  pop.innerHTML = options
    .map((o, i) => `<button data-i="${i}">${icon(o.iconName, 17)} ${o.label}</button>`)
    .join('');
  document.body.appendChild(pop);
  pop.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => { closeAllPopovers(); options[Number(btn.dataset.i)].act(); };
  });
}

async function uploadIntoCurrentView() {
  const target = state.path[state.path.length - 1];
  // El campo "id" del objeto carpeta de nivel superior es el id del grupo,
  // no un topic: si solo estamos a un nivel de profundidad, el destino es
  // la raíz (topic General). Si estamos en una subcarpeta, "id" ya es el
  // id del topic correspondiente.
  const topicId = state.path.length === 1 ? tg.GENERAL_TOPIC_ID : target.id;
  const files = await pickFiles({ accept: '' });
  await handleFiles(files, target.entity, topicId, () => renderMain());
}

// ---------- Router principal ----------
async function renderMain() {
  const main = document.getElementById('main');
  if (state.activeTab === 'downloads') {
    renderDownloadsView(main);
  } else if (state.activeTab === 'media') {
    await renderMediaView(main);
  } else if (state.path.length === 0) {
    renderFoldersView(main);
  } else if (state.path.length === 1) {
    await renderTopFolderView(main);
  } else {
    await renderSubFolderView(main);
  }
}

// ---------- Vista: Inicio (carpetas de nivel superior) ----------
function renderFoldersView(main) {
  main.innerHTML = `
    <div class="view-header"><h2>📂 Inicio</h2></div>
    <div class="folder-list" id="folder-list"></div>
  `;
  const list = document.getElementById('folder-list');
  if (state.topFolders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-box">📂</div>
        <div class="empty-text">Aún no tienes carpetas. Usa el botón + de abajo para crear la primera.</div>
      </div>`;
    return;
  }

  state.topFolders.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'folder-row';
    row.innerHTML = `
      <span class="folder-emoji">📂</span>
      <div class="folder-row-info">
        <div class="folder-row-name">${escapeHtml(f.name)}</div>
        <div class="folder-row-meta">Carpeta (grupo en Telegram)</div>
      </div>
      <button class="icon-btn menu-trigger" data-act="menu">${icon('moreVertical', 18)}</button>
    `;
    const openFolder = () => enterTopFolder(f);
    row.querySelector('.folder-row-info').onclick = openFolder;
    row.querySelector('.folder-emoji').onclick = openFolder;

    row.querySelector('[data-act="menu"]').onclick = (e) => {
      e.stopPropagation();
      closeAllPopovers();
      const pop = document.createElement('div');
      pop.className = 'menu-popover';
      pop.innerHTML = `
        <button class="menu-item" data-act="open">📂 Abrir</button>
        <button class="menu-item danger" data-act="del">${icon('trash', 16)} Eliminar carpeta</button>
      `;
      row.style.position = 'relative';
      row.appendChild(pop);
      pop.querySelector('[data-act="open"]').onclick = () => { closeAllPopovers(); openFolder(); };
      pop.querySelector('[data-act="del"]').onclick = async () => {
        closeAllPopovers();
        const ok = await confirmDialog({
          title: 'Eliminar carpeta',
          message: `¿Eliminar por completo la carpeta "${escapeHtml(f.name)}" (el grupo en Telegram) y todo su contenido? Esta acción es irreversible.`,
          confirmText: 'Eliminar',
          danger: true,
        });
        if (!ok) return;
        try {
          await tg.deleteTopFolder(f.id);
          state.topFolders = state.topFolders.filter((x) => x.id !== f.id);
          toast('Carpeta eliminada');
          renderMain();
        } catch (e) {
          toast('Error al eliminar: ' + e.message, 'error');
        }
      };
    };

    list.appendChild(row);
  });
}

async function enterTopFolder(f) {
  toast('Abriendo carpeta...');
  try {
    const entity = await tg.resolveFolderEntity(f.id);
    state.path = [{ ...f, entity }];
    renderMain();
  } catch (e) {
    toast('Error al abrir la carpeta: ' + e.message, 'error');
  }
}

async function createTopFolderFlow() {
  const name = await promptDialog({
    title: 'Nueva carpeta',
    label: 'Nombre de la carpeta',
    placeholder: 'Ej: Juegos',
    confirmText: 'Crear',
    iconName: 'folderPlus',
  });
  if (!name) return;
  toast('Creando grupo en Telegram...');
  try {
    const folder = await tg.createTopFolder(name);
    state.topFolders.push({ id: folder.id, name: folder.name });
    toast(`Carpeta "${name}" creada`);
    renderMain();
  } catch (e) {
    console.error(e);
    toast('Error al crear la carpeta: ' + e.message, 'error');
  }
}

// ---------- Vista: dentro de una carpeta de nivel superior ----------
async function renderTopFolderView(main) {
  const top = state.path[0];
  main.innerHTML = `
    <div class="breadcrumb">
      <span class="crumb" data-nav="home">📂 Inicio</span>
      <span class="sep">${icon('chevronRight', 13)}</span>
      <span class="crumb current">${escapeHtml(top.name)}</span>
    </div>
    <div class="view-header">
      <h2>📂 ${escapeHtml(top.name)}</h2>
      <button class="icon-btn" id="del-top">${icon('trash', 18)}</button>
    </div>

    <div class="section-title">Subcarpetas</div>
    <div class="folder-list" id="subfolder-list">
      <div class="loading-full" style="min-height:80px"><span class="spinner">${icon('refresh', 20)}</span></div>
    </div>

    <div id="files-area"></div>
  `;

  main.querySelector('[data-nav="home"]').onclick = () => { state.path = []; renderMain(); };
  document.getElementById('del-top').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Eliminar carpeta',
      message: `¿Eliminar por completo la carpeta "${escapeHtml(top.name)}" y todo su contenido? Esta acción es irreversible.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await tg.deleteTopFolder(top.id);
      state.topFolders = state.topFolders.filter((f) => f.id !== top.id);
      state.path = [];
      toast('Carpeta eliminada');
      renderMain();
    } catch (e) {
      toast('Error al eliminar: ' + e.message, 'error');
    }
  };

  await loadSubFolderList(top);
  renderFilesArea(document.getElementById('files-area'), top.entity, tg.GENERAL_TOPIC_ID, top.name);
}

async function loadSubFolderList(top) {
  const list = document.getElementById('subfolder-list');
  try {
    const subFolders = await tg.listSubFolders(top.entity);
    if (subFolders.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:18px 10px"><div class="empty-text">Aún no hay subcarpetas.</div></div>`;
      return;
    }
    list.innerHTML = '';
    subFolders.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'folder-row';
      row.innerHTML = `
        <span class="folder-emoji">📁</span>
        <div class="folder-row-info">
          <div class="folder-row-name">${escapeHtml(s.name)}</div>
          <div class="folder-row-meta">Subcarpeta (tema)</div>
        </div>
        <button class="icon-btn menu-trigger" data-act="menu">${icon('moreVertical', 18)}</button>
      `;
      const open = () => { state.path = [top, s]; renderMain(); };
      row.querySelector('.folder-row-info').onclick = open;
      row.querySelector('.folder-emoji').onclick = open;
      row.querySelector('[data-act="menu"]').onclick = (e) => {
        e.stopPropagation();
        closeAllPopovers();
        const pop = document.createElement('div');
        pop.className = 'menu-popover';
        pop.innerHTML = `
          <button class="menu-item" data-act="open">📁 Abrir</button>
          <button class="menu-item danger" data-act="del">${icon('trash', 16)} Eliminar subcarpeta</button>
        `;
        row.style.position = 'relative';
        row.appendChild(pop);
        pop.querySelector('[data-act="open"]').onclick = () => { closeAllPopovers(); open(); };
        pop.querySelector('[data-act="del"]').onclick = async () => {
          closeAllPopovers();
          const ok = await confirmDialog({
            title: 'Eliminar subcarpeta',
            message: `¿Vaciar la subcarpeta "${escapeHtml(s.name)}"? Esta acción es irreversible.`,
            confirmText: 'Eliminar',
            danger: true,
          });
          if (!ok) return;
          try {
            await tg.deleteSubFolder(s.entity, s.id);
            toast('Subcarpeta eliminada');
            loadSubFolderList(top);
          } catch (e) {
            toast('Error al eliminar: ' + e.message, 'error');
          }
        };
      };
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div class="empty-text">Error al cargar subcarpetas: ${escapeHtml(e.message)}</div></div>`;
  }
}

async function createSubFolderFlow(top) {
  const name = await promptDialog({
    title: 'Nueva subcarpeta',
    label: 'Nombre de la subcarpeta',
    placeholder: 'Ej: Capturas',
    confirmText: 'Crear',
    iconName: 'folderPlus',
  });
  if (!name) return;
  toast('Creando tema en Telegram...');
  try {
    await tg.createSubFolder(top.entity, name);
    toast(`Subcarpeta "${name}" creada`);
    if (state.path.length === 1 && state.path[0].id === top.id) loadSubFolderList(top);
  } catch (e) {
    toast('Error al crear la subcarpeta: ' + e.message, 'error');
  }
}

// ---------- Vista: dentro de una subcarpeta ----------
async function renderSubFolderView(main) {
  const [top, sub] = state.path;
  main.innerHTML = `
    <div class="breadcrumb">
      <span class="crumb" data-nav="home">📂 Inicio</span>
      <span class="sep">${icon('chevronRight', 13)}</span>
      <span class="crumb" data-nav="top">${escapeHtml(top.name)}</span>
      <span class="sep">${icon('chevronRight', 13)}</span>
      <span class="crumb current">${escapeHtml(sub.name)}</span>
    </div>
    <div class="view-header">
      <h2>📁 ${escapeHtml(sub.name)}</h2>
      <button class="icon-btn" id="del-sub">${icon('trash', 18)}</button>
    </div>
    <div id="files-area"></div>
  `;
  main.querySelector('[data-nav="home"]').onclick = () => { state.path = []; renderMain(); };
  main.querySelector('[data-nav="top"]').onclick = () => { state.path = [top]; renderMain(); };
  document.getElementById('del-sub').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Eliminar subcarpeta',
      message: `¿Vaciar la subcarpeta "${escapeHtml(sub.name)}"? Esta acción es irreversible.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await tg.deleteSubFolder(sub.entity, sub.id);
      state.path = [top];
      toast('Subcarpeta eliminada');
      renderMain();
    } catch (e) {
      toast('Error al eliminar: ' + e.message, 'error');
    }
  };
  renderFilesArea(document.getElementById('files-area'), sub.entity, sub.id, sub.name);
}

// ---------- Sección reutilizable: dropzone + lista de archivos (con selección múltiple) ----------
function renderFilesArea(container, entity, topicId, label) {
  container.innerHTML = `
    <div class="upload-row" id="dropzone">
      <div class="upload-icon-box">${icon('uploadCloud', 18)}</div>
      <div>
        <div class="upload-text">Subir archivo a "${escapeHtml(label)}"</div>
        <div class="upload-sub">Toca aquí o arrastra un archivo (cualquier tipo)</div>
      </div>
    </div>
    <div class="section-title-row">
      <div class="section-title">Archivos</div>
      <button class="select-toggle-btn" id="btn-select-toggle">${icon('checkSquare', 15)} Seleccionar</button>
    </div>
    <div id="file-list"><div class="loading-full" style="min-height:120px"><span class="spinner">${icon('refresh', 22)}</span></div></div>
  `;

  const dropzone = container.querySelector('#dropzone');
  dropzone.onclick = async () => {
    const files = await pickFiles({ accept: '' });
    await handleFiles(files, entity, topicId, () => loadFileList());
  };
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, entity, topicId, () => loadFileList());
  });

  let selectMode = false;
  const selected = new Map(); // messageId -> file

  container.querySelector('#btn-select-toggle').onclick = () => {
    selectMode = !selectMode;
    selected.clear();
    removeSelectionBar();
    loadFileList();
  };

  function removeSelectionBar() {
    document.querySelectorAll('.selection-bar').forEach((el) => el.remove());
  }

  function updateSelectionBar() {
    removeSelectionBar();
    if (!selectMode || selected.size === 0) return;
    const bar = document.createElement('div');
    bar.className = 'selection-bar';
    bar.innerHTML = `
      <span class="sel-count">${selected.size} seleccionado(s)</span>
      <button data-act="dl">${icon('download', 15)} Descargar</button>
      <button class="danger" data-act="del">${icon('trash', 15)} Borrar</button>
      <button class="cancel" data-act="cancel">Cancelar</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('[data-act="dl"]').onclick = async () => {
      for (const f of selected.values()) await startDownload(entity, f);
      toast('Descarga(s) iniciada(s)');
    };
    bar.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmDialog({
        title: 'Borrar archivos',
        message: `¿Borrar ${selected.size} archivo(s)? Esta acción es irreversible.`,
        confirmText: 'Borrar',
        danger: true,
      });
      if (!ok) return;
      for (const f of selected.values()) {
        try { await tg.deleteFile(entity, f.messageId); } catch { /* seguimos con el resto */ }
      }
      toast('Archivos borrados');
      selectMode = false;
      selected.clear();
      removeSelectionBar();
      loadFileList();
    };
    bar.querySelector('[data-act="cancel"]').onclick = () => {
      selectMode = false;
      selected.clear();
      removeSelectionBar();
      loadFileList();
    };
  }

  async function loadFileList() {
    const listEl = container.querySelector('#file-list');
    listEl.innerHTML = `<div class="loading-full" style="min-height:120px"><span class="spinner">${icon('refresh', 22)}</span></div>`;
    try {
      const files = await tg.listFiles(entity, topicId, 100);
      if (files.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon-box">${icon('inbox', 26)}</div>
            <div class="empty-text">Aún no hay archivos aquí. Sube el primero arriba.</div>
          </div>`;
        return;
      }
      listEl.innerHTML = '';
      files.sort((a, b) => b.date - a.date).forEach((f) => {
        const row = document.createElement('div');
        row.className = 'file-row' + (selectMode ? ' selectable' : '');
        row.innerHTML = `
          ${selectMode ? `<span class="row-checkbox">${icon('square', 20)}</span>` : `<div class="file-icon">${icon(iconForMime(f.mimeType, f.name), 19)}</div>`}
          <div class="file-info">
            <div class="file-name">${escapeHtml(f.name)}</div>
            <div class="file-meta">${fmtSize(f.size)} · ${fmtDate(f.date)}</div>
          </div>
          ${selectMode ? '' : `<button class="icon-btn menu-trigger" data-act="menu">${icon('moreVertical', 18)}</button>`}
        `;
        if (selectMode) {
          row.onclick = () => {
            if (selected.has(f.messageId)) {
              selected.delete(f.messageId);
              row.classList.remove('selected');
              row.querySelector('.row-checkbox').innerHTML = icon('square', 20);
            } else {
              selected.set(f.messageId, f);
              row.classList.add('selected');
              row.querySelector('.row-checkbox').innerHTML = icon('checkSquare', 20);
            }
            updateSelectionBar();
          };
        } else {
          row.querySelector('[data-act="menu"]').onclick = (e) => {
            e.stopPropagation();
            closeAllPopovers();
            const pop = document.createElement('div');
            pop.className = 'menu-popover';
            pop.innerHTML = `
              <button class="menu-item" data-act="dl">${icon('download', 16)} Descargar</button>
              <button class="menu-item danger" data-act="del">${icon('trash', 16)} Borrar</button>
            `;
            row.style.position = 'relative';
            row.appendChild(pop);
            pop.querySelector('[data-act="dl"]').onclick = () => { closeAllPopovers(); startDownload(entity, f); };
            pop.querySelector('[data-act="del"]').onclick = async () => {
              closeAllPopovers();
              const ok = await confirmDialog({
                title: 'Borrar archivo',
                message: `¿Borrar "${escapeHtml(f.name)}"? Esta acción es irreversible.`,
                confirmText: 'Borrar',
                danger: true,
              });
              if (!ok) return;
              await tg.deleteFile(entity, f.messageId);
              row.remove();
              toast('Archivo borrado');
            };
          };
        }
        listEl.appendChild(row);
      });
    } catch (e) {
      console.error(e);
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon-box">${icon('alert', 24)}</div><div class="empty-text">Error al cargar archivos: ${escapeHtml(e.message)}</div></div>`;
    }
  }

  loadFileList();
}

async function handleFiles(fileListRaw, entity, topicId, onDone) {
  if (!fileListRaw || fileListRaw.length === 0) return;
  const files = Array.from(fileListRaw);
  for (const file of files) {
    const transferId = crypto.randomUUID();
    addTransfer({ id: transferId, name: file.name, type: 'upload', progress: 0, status: 'uploading' });
    try {
      await tg.uploadFile(entity, topicId, file, (progress) => updateTransfer(transferId, { progress }));
      updateTransfer(transferId, { progress: 1, status: 'done' });
      toast(`"${file.name}" subido`);
    } catch (e) {
      console.error(e);
      updateTransfer(transferId, { status: 'error' });
      toast(`Error al subir "${file.name}": ${e.message}`, 'error');
    }
  }
  if (onDone) onDone();
}

async function startDownload(entity, file) {
  const transferId = crypto.randomUUID();
  addTransfer({ id: transferId, name: file.name, type: 'download', progress: 0, status: 'downloading' });
  try {
    const buffer = await tg.downloadFile(file.rawMessage, (progress) => updateTransfer(transferId, { progress }));
    updateTransfer(transferId, { progress: 1, status: 'done' });
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`"${file.name}" descargado`);
  } catch (e) {
    console.error(e);
    updateTransfer(transferId, { status: 'error' });
    toast(`Error al descargar "${file.name}"`, 'error');
  }
}

// ---------- Vista: Descargas (pestaña inferior) ----------
function renderDownloadsView(main) {
  main.innerHTML = `
    <div class="view-header"><h2>Descargas y subidas</h2></div>
    <div id="transfers-list"></div>
  `;
  renderTransfers();
}

// ---------- Vista: Multimedia (pestaña inferior) ----------
async function renderMediaView(main) {
  main.innerHTML = `
    <div class="section-title-row" style="padding:14px 16px 0">
      <h2 style="font-size:16px">Multimedia</h2>
      <button class="select-toggle-btn" id="btn-media-select">${icon('checkSquare', 15)} Seleccionar</button>
    </div>
    <div class="loading-full" style="min-height:160px"><span class="spinner">${icon('refresh', 22)}</span><span>Buscando fotos y vídeos...</span></div>
  `;
  let items;
  try {
    items = await tg.listAllMedia(state.topFolders);
  } catch (e) {
    console.error(e);
    main.querySelector('.loading-full').outerHTML = `<div class="empty-state"><div class="empty-icon-box">${icon('alert', 24)}</div><div class="empty-text">Error al cargar multimedia: ${escapeHtml(e.message)}</div></div>`;
    return;
  }
  if (items.length === 0) {
    main.querySelector('.loading-full').outerHTML = `
      <div class="empty-state">
        <div class="empty-icon-box">${icon('image', 24)}</div>
        <div class="empty-text">Aún no hay fotos ni vídeos en tus carpetas.</div>
      </div>`;
    return;
  }
  main.querySelector('.loading-full').outerHTML = `<div class="media-grid" id="media-grid"></div>`;
  const grid = document.getElementById('media-grid');

  let selectMode = false;
  const selected = new Map();
  const blobCache = new Map(); // messageId -> {url, blob}

  function removeSelectionBar() {
    document.querySelectorAll('.selection-bar').forEach((el) => el.remove());
  }
  function updateSelectionBar() {
    removeSelectionBar();
    if (!selectMode || selected.size === 0) return;
    const bar = document.createElement('div');
    bar.className = 'selection-bar';
    bar.innerHTML = `
      <span class="sel-count">${selected.size} seleccionado(s)</span>
      <button data-act="dl">${icon('download', 15)} Descargar</button>
      <button class="danger" data-act="del">${icon('trash', 15)} Borrar</button>
      <button class="cancel" data-act="cancel">Cancelar</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('[data-act="dl"]').onclick = async () => {
      for (const it of selected.values()) await startDownload(it.entity, it);
      toast('Descarga(s) iniciada(s)');
    };
    bar.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmDialog({
        title: 'Borrar archivos',
        message: `¿Borrar ${selected.size} archivo(s)? Esta acción es irreversible.`,
        confirmText: 'Borrar',
        danger: true,
      });
      if (!ok) return;
      for (const it of selected.values()) {
        try { await tg.deleteFile(it.entity, it.messageId); } catch { /* seguimos */ }
      }
      toast('Archivos borrados');
      renderMediaView(main);
    };
    bar.querySelector('[data-act="cancel"]').onclick = () => {
      selectMode = false;
      selected.clear();
      removeSelectionBar();
      document.querySelectorAll('.media-cell.selected').forEach((c) => c.classList.remove('selected'));
    };
  }

  document.getElementById('btn-media-select').onclick = () => {
    selectMode = !selectMode;
    selected.clear();
    removeSelectionBar();
    document.querySelectorAll('.media-cell.selected').forEach((c) => c.classList.remove('selected'));
  };

  for (const item of items) {
    const cell = document.createElement('div');
    cell.className = 'media-cell';
    cell.innerHTML = `<div class="media-placeholder">${icon(item.isVideo ? 'video' : 'image', 20)}</div>`;
    grid.appendChild(cell);

    cell.onclick = () => {
      if (selectMode) {
        if (selected.has(item.messageId)) {
          selected.delete(item.messageId);
          cell.classList.remove('selected');
        } else {
          selected.set(item.messageId, item);
          cell.classList.add('selected');
        }
        updateSelectionBar();
        return;
      }
      openLightbox(item, blobCache.get(item.messageId));
    };

    tg.downloadFile(item.rawMessage, () => {}).then((buffer) => {
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      blobCache.set(item.messageId, { url, blob });
      if (item.isVideo) {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.addEventListener('loadeddata', () => {
          try {
            const c = document.createElement('canvas');
            c.width = video.videoWidth || 320;
            c.height = video.videoHeight || 240;
            c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
            cell.innerHTML = `<img src="${c.toDataURL('image/jpeg', 0.6)}" alt="${escapeHtml(item.name)}" /><span class="video-badge">${icon('playCircle', 20)}</span>`;
          } catch {
            cell.innerHTML = `<img src="" alt="" /><span class="video-badge">${icon('playCircle', 20)}</span>`;
          }
        }, { once: true });
        video.currentTime = 0.1;
      } else {
        cell.innerHTML = `<img src="${url}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
      }
    }).catch(() => {});
  }
}

function openLightbox(item, cached) {
  const root = document.createElement('div');
  root.className = 'lightbox-overlay';
  root.innerHTML = `
    <div class="lightbox-top"><button id="lb-close">${icon('x', 18)}</button></div>
    <div class="lightbox-stage" id="lb-stage">
      <span class="spinner">${icon('refresh', 24)}</span>
    </div>
    <div class="lightbox-actions">
      <button id="lb-download">${icon('download', 16)} Descargar</button>
      <button class="danger" id="lb-delete">${icon('trash', 16)} Eliminar</button>
    </div>
  `;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('open'));

  const close = () => { root.classList.remove('open'); setTimeout(() => root.remove(), 180); };
  root.querySelector('#lb-close').onclick = close;

  async function getUrl() {
    if (cached) return cached.url;
    const buffer = await tg.downloadFile(item.rawMessage, () => {});
    const blob = new Blob([buffer]);
    return URL.createObjectURL(blob);
  }

  getUrl().then((url) => {
    const stage = root.querySelector('#lb-stage');
    stage.innerHTML = item.isVideo
      ? `<video src="${url}" controls autoplay playsinline></video>`
      : `<img src="${url}" alt="${escapeHtml(item.name)}" />`;
  });

  root.querySelector('#lb-download').onclick = () => startDownload(item.entity, item);
  root.querySelector('#lb-delete').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Eliminar archivo',
      message: `¿Borrar "${escapeHtml(item.name)}"? Esta acción es irreversible.`,
      confirmText: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await tg.deleteFile(item.entity, item.messageId);
      toast('Archivo borrado');
      close();
      renderMain();
    } catch (e) {
      toast('Error al borrar: ' + e.message, 'error');
    }
  };
}

// ---------- Subida directa desde la pestaña Multimedia ----------
async function mediaUploadFlow() {
  if (state.topFolders.length === 0) {
    toast('Primero crea una carpeta desde Inicio', 'error');
    return;
  }
  const options = [];
  for (const top of state.topFolders) {
    options.push({ label: `📂 ${top.name}`, value: { id: top.id, name: top.name } });
  }
  const chosenTop = await selectDialog({
    title: 'Subir a...',
    iconName: 'uploadCloud',
    options,
    emptyText: 'Primero crea una carpeta desde Inicio.',
  });
  if (!chosenTop) return;

  toast('Abriendo carpeta...');
  let entity;
  try {
    entity = await tg.resolveFolderEntity(chosenTop.id);
  } catch (e) {
    toast('Error al abrir la carpeta: ' + e.message, 'error');
    return;
  }

  let topicId = tg.GENERAL_TOPIC_ID;
  try {
    const subFolders = await tg.listSubFolders(entity);
    if (subFolders.length > 0) {
      const subOptions = [{ label: `📂 Raíz de "${chosenTop.name}"`, value: tg.GENERAL_TOPIC_ID }];
      subFolders.forEach((s) => subOptions.push({ label: `📁 ${s.name}`, value: s.id }));
      const chosenId = await selectDialog({
        title: 'Elige la subcarpeta',
        iconName: 'uploadCloud',
        options: subOptions,
      });
      if (chosenId === null || chosenId === undefined) return;
      topicId = chosenId;
    }
  } catch {
    // si falla la carga de subcarpetas, subimos a la raíz igualmente
  }

  const files = await pickFiles({ accept: 'image/*,video/*' });
  if (!files || files.length === 0) return;
  await handleFiles(files, entity, topicId, () => { if (state.activeTab === 'media') renderMain(); });
}

// ---------- Transferencias (subidas/descargas) ----------
function addTransfer(t) {
  state.transfers.unshift(t);
  updateNavDownloadsIcon();
  renderTransfers();
}
function updateTransfer(id, patch) {
  const t = state.transfers.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  updateNavDownloadsIcon();
  renderTransfers();
}
function updateNavDownloadsIcon() {
  const iconEl = document.getElementById('nav-downloads-icon');
  const labelEl = document.getElementById('nav-downloads-label');
  if (!iconEl || !labelEl) return;
  const active = state.transfers.find((t) => t.status === 'uploading' || t.status === 'downloading');
  if (!active) {
    iconEl.innerHTML = icon('download', 20);
    labelEl.textContent = 'Descargas';
    return;
  }
  iconEl.innerHTML = `<span class="spin-icon">${icon(active.type === 'upload' ? 'uploadCloud' : 'download', 20)}</span>`;
  labelEl.textContent = active.type === 'upload' ? 'Subiendo…' : 'Descargando…';
}
function renderTransfers() {
  const list = document.getElementById('transfers-list');
  if (!list) return;
  if (state.transfers.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:30px 10px"><div class="empty-icon-box">${icon('transfer', 22)}</div><div class="empty-text">No hay transferencias todavía.</div></div>`;
    return;
  }
  list.innerHTML = '';
  state.transfers.slice(0, 25).forEach((t) => {
    const pct = Math.round((t.progress || 0) * 100);
    const div = document.createElement('div');
    div.className = 'transfer-item';
    div.innerHTML = `
      <div class="row">
        <span class="name">${icon(t.type === 'upload' ? 'uploadCloud' : 'download', 14)} ${escapeHtml(t.name)}</span>
        <span class="pct">${t.status === 'error' ? 'Error' : pct + '%'}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${t.status === 'done' ? 'done' : ''} ${t.status === 'error' ? 'error' : ''}" style="width:${pct}%"></div>
      </div>
    `;
    list.appendChild(div);
  });
}

// ---------- Init ----------
(async function init() {
  initTheme();
  initStarfield();
  if (tg.hasSavedSession()) {
    state.loggedIn = false;
    await bootApp();
  } else {
    render();
  }
})();
