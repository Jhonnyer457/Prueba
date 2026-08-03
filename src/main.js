import './style.css';
import * as tg from './telegram.js';
import { icon } from './icons.js';
import { confirmDialog, promptDialog } from './modal.js';
import { initStarfield } from './starfield.js';

const app = document.getElementById('app');
const THEME_KEY = 'teledrive_theme';

const state = {
  credentials: { id: null, hash: null },
  activeTab: 'home',            // 'home' | 'downloads' | 'media'
  currentView: 'folders',       // 'folders' | 'saved' | objeto-carpeta (solo aplica a la pestaña 'home')
  folders: [],
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
  document.querySelectorAll('.menu-popover, .dropdown-menu').forEach((el) => el.remove());
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-trigger') && !e.target.closest('.menu-popover') &&
      !e.target.closest('#btn-settings') && !e.target.closest('.dropdown-menu')) {
    closeAllPopovers();
  }
});

// ---------- Render raíz ----------
function render() {
  if (!tg.hasSavedSession() && !state.loggedIn) {
    renderLogin();
  } else {
    renderApp();
  }
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
    state.folders = await tg.listFolders();
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

    <input type="file" id="global-file-input" style="display:none" multiple />
  `;

  document.getElementById('btn-settings').onclick = toggleSettingsMenu;
  document.getElementById('fab-main').onclick = onFabClick;
  document.getElementById('global-file-input').onchange = (e) => {
    const target = state.currentView === 'saved' ? null : state.currentView;
    handleFiles(e.target.files, target, target !== null);
    e.target.value = '';
  };

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
      state.folders = await tg.listFolders();
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
  document.getElementById('fab-main').style.display = tab === 'home' ? 'flex' : 'none';
  renderMain();
}

// ---------- FAB dinámico ----------
function onFabClick() {
  if (state.activeTab !== 'home') return;
  if (state.currentView === 'folders') {
    createFolderFlow();
  } else {
    document.getElementById('global-file-input').click();
  }
}

// ---------- Router principal ----------
async function renderMain() {
  const main = document.getElementById('main');
  if (state.activeTab === 'downloads') {
    renderDownloadsView(main);
  } else if (state.activeTab === 'media') {
    await renderMediaView(main);
  } else if (state.currentView === 'folders') {
    renderFoldersView(main);
  } else if (state.currentView === 'saved') {
    await renderChatView(main, { type: 'saved', name: 'Mensajes guardados', iconName: 'save' });
  } else {
    await renderChatView(main, state.currentView);
  }
}

// ---------- Vista: listado de carpetas (📂 en filas) ----------
function renderFoldersView(main) {
  main.innerHTML = `
    <div class="view-header"><h2>📂 Inicio</h2></div>
    <div class="folder-row saved-row" id="row-saved">
      <div class="folder-row-icon">${icon('save', 20)}</div>
      <div class="folder-row-info">
        <div class="folder-row-name">Mensajes guardados</div>
        <div class="folder-row-meta">Archivos sueltos, fuera de carpetas</div>
      </div>
    </div>
    <div class="folder-list" id="folder-list"></div>
  `;
  document.getElementById('row-saved').onclick = () => { state.currentView = 'saved'; renderMain(); };

  const list = document.getElementById('folder-list');
  if (state.folders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-box">📂</div>
        <div class="empty-text">Aún no tienes carpetas. Usa el botón + de abajo para crear la primera.</div>
      </div>`;
    return;
  }

  state.folders.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'folder-row';
    row.innerHTML = `
      <span class="folder-emoji">📂</span>
      <div class="folder-row-info">
        <div class="folder-row-name">${escapeHtml(f.name)}</div>
        <div class="folder-row-meta" data-count>Calculando...</div>
      </div>
      <button class="icon-btn menu-trigger" data-act="menu">${icon('moreVertical', 18)}</button>
    `;
    row.querySelector('.folder-row-info').onclick = () => { state.currentView = f; renderMain(); };
    row.querySelector('.folder-emoji').onclick = () => { state.currentView = f; renderMain(); };

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
      pop.querySelector('[data-act="open"]').onclick = () => { closeAllPopovers(); state.currentView = f; renderMain(); };
      pop.querySelector('[data-act="del"]').onclick = async () => {
        closeAllPopovers();
        const ok = await confirmDialog({
          title: 'Eliminar carpeta',
          message: `¿Vaciar la carpeta "${escapeHtml(f.name)}" y todo su contenido? Esta acción es irreversible.`,
          confirmText: 'Eliminar',
          danger: true,
        });
        if (!ok) return;
        try {
          await tg.deleteFolder(f.entity, f.id);
          state.folders = state.folders.filter((x) => x.id !== f.id);
          toast('Carpeta eliminada');
          renderMain();
        } catch (e) {
          toast('Error al eliminar: ' + e.message, 'error');
        }
      };
    };

    list.appendChild(row);
  });

  // Conteo real de archivos por carpeta (Topic), en paralelo.
  state.folders.forEach(async (f) => {
    try {
      const count = await tg.countFiles(f.entity, f.id);
      const row = [...list.children].find((r) => r.querySelector('.folder-row-name')?.textContent === f.name);
      const metaEl = row?.querySelector('[data-count]');
      if (metaEl) metaEl.textContent = count === 1 ? '1 archivo' : `${count} archivos`;
    } catch {
      const row = [...list.children].find((r) => r.querySelector('.folder-row-name')?.textContent === f.name);
      const metaEl = row?.querySelector('[data-count]');
      if (metaEl) metaEl.textContent = 'Carpeta (tema)';
    }
  });
}

async function createFolderFlow() {
  const name = await promptDialog({
    title: 'Nueva carpeta',
    label: 'Nombre de la carpeta',
    placeholder: 'Ej: Juegos',
    confirmText: 'Crear',
    iconName: 'folderPlus',
  });
  if (!name) return;
  toast('Creando tema en Telegram...');
  try {
    const folder = await tg.createFolder(name);
    state.folders.push(folder);
    toast(`Carpeta "${name}" creada`);
    renderMain();
  } catch (e) {
    console.error(e);
    toast('Error al crear la carpeta: ' + e.message, 'error');
  }
}

// ---------- Vista: contenido de una carpeta (Topic) o Mensajes guardados ----------
async function renderChatView(main, target) {
  const isFolder = target.entity !== undefined && target.type !== 'saved';
  main.innerHTML = `
    <div class="breadcrumb">
      <span class="crumb" data-nav="folders">📂 Inicio</span>
      <span class="sep">${icon('chevronRight', 13)}</span>
      <span class="crumb current">${escapeHtml(target.name)}</span>
    </div>

    <div class="view-header">
      <h2>${isFolder ? '📂' : `<span class="header-icon-box">${icon('save', 17)}</span>`} ${escapeHtml(target.name)}</h2>
      ${isFolder ? `<button class="icon-btn" id="del-folder">${icon('trash', 18)}</button>` : ''}
    </div>

    <div class="upload-row" id="dropzone">
      <div class="upload-icon-box">${icon('uploadCloud', 18)}</div>
      <div>
        <div class="upload-text">Subir archivo a "${escapeHtml(target.name)}"</div>
        <div class="upload-sub">Toca aquí o arrastra un archivo</div>
      </div>
      <input type="file" id="file-input" style="display:none" multiple />
    </div>

    <div class="section-title">Archivos</div>
    <div id="file-list"><div class="loading-full" style="min-height:120px"><span class="spinner">${icon('refresh', 22)}</span></div></div>
  `;

  main.querySelector('[data-nav="folders"]').onclick = () => { state.currentView = 'folders'; renderMain(); };

  const delBtn = document.getElementById('del-folder');
  if (delBtn) {
    delBtn.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Eliminar carpeta',
        message: `¿Vaciar la carpeta "${escapeHtml(target.name)}" y todo su contenido? Esta acción es irreversible.`,
        confirmText: 'Eliminar',
        danger: true,
      });
      if (!ok) return;
      try {
        await tg.deleteFolder(target.entity, target.id);
        state.folders = state.folders.filter((f) => f.id !== target.id);
        state.currentView = 'folders';
        toast('Carpeta eliminada');
        renderMain();
      } catch (e) {
        toast('Error al eliminar: ' + e.message, 'error');
      }
    };
  }

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  dropzone.onclick = () => fileInput.click();
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, target, isFolder);
  });
  fileInput.onchange = () => handleFiles(fileInput.files, target, isFolder);

  await loadFileList(target, isFolder);
}

async function loadFileList(target, isFolder) {
  const entity = isFolder ? target.entity : await tg.getSavedMessagesPeer();
  const topicId = isFolder ? target.id : null;
  const listEl = document.getElementById('file-list');
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
      row.className = 'file-row';
      row.innerHTML = `
        <div class="file-icon">${icon(iconForMime(f.mimeType, f.name), 19)}</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">${fmtSize(f.size)} · ${fmtDate(f.date)}</div>
        </div>
        <button class="icon-btn menu-trigger" data-act="menu">${icon('moreVertical', 18)}</button>
      `;
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
      listEl.appendChild(row);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon-box">${icon('alert', 24)}</div><div class="empty-text">Error al cargar archivos: ${escapeHtml(e.message)}</div></div>`;
  }
}

async function handleFiles(fileListRaw, target, isFolder) {
  if (!fileListRaw || fileListRaw.length === 0) return;
  const entity = isFolder ? target.entity : await tg.getSavedMessagesPeer();
  const topicId = isFolder ? target.id : null;
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
  if (state.activeTab === 'home' && (state.currentView === target || state.currentView === 'saved')) {
    await loadFileList(target, isFolder);
  }
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
    <div class="view-header"><h2>Multimedia</h2></div>
    <div class="loading-full" style="min-height:160px"><span class="spinner">${icon('refresh', 22)}</span><span>Buscando fotos y vídeos...</span></div>
  `;
  try {
    const items = await tg.listAllMedia(state.folders, 24);
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
    for (const item of items) {
      const cell = document.createElement('div');
      cell.className = 'media-cell';
      cell.innerHTML = `<div class="media-placeholder">${icon(item.isVideo ? 'video' : 'image', 20)}</div>`;
      grid.appendChild(cell);
      cell.onclick = () => startDownload(null, item);
      tg.downloadFile(item.rawMessage, () => {}).then((buffer) => {
        const blob = new Blob([buffer]);
        const url = URL.createObjectURL(blob);
        cell.innerHTML = item.isVideo
          ? `<video src="${url}" muted></video>`
          : `<img src="${url}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
      }).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    main.querySelector('.loading-full').outerHTML = `<div class="empty-state"><div class="empty-icon-box">${icon('alert', 24)}</div><div class="empty-text">Error al cargar multimedia: ${escapeHtml(e.message)}</div></div>`;
  }
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
