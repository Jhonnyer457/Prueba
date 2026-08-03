import { icon } from './icons.js';

function overlayRoot() {
  let el = document.getElementById('modal-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'modal-root';
    document.body.appendChild(el);
  }
  return el;
}

function buildShell(iconName, title, bodyHtml, danger = false) {
  const root = overlayRoot();
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-card">
        <div class="modal-icon-box ${danger ? 'danger' : ''}">${icon(iconName, 20)}</div>
        <h3 class="modal-title">${title}</h3>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-actions" id="modal-actions"></div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => root.querySelector('.modal-overlay').classList.add('open'));
  return root;
}

function closeModal(root) {
  const overlay = root.querySelector('.modal-overlay');
  overlay.classList.remove('open');
  setTimeout(() => { root.innerHTML = ''; }, 180);
}

export function confirmDialog({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    const root = buildShell(danger ? 'trash' : 'shield', title, `<p>${message}</p>`, danger);
    const actions = document.getElementById('modal-actions');
    actions.innerHTML = `
      <button class="btn btn-ghost" id="modal-cancel">${cancelText}</button>
      <button class="btn ${danger ? 'btn-danger-solid' : ''}" id="modal-confirm">${confirmText}</button>
    `;
    document.getElementById('modal-cancel').onclick = () => { closeModal(root); resolve(false); };
    document.getElementById('modal-confirm').onclick = () => { closeModal(root); resolve(true); };
    root.querySelector('.modal-overlay').onclick = (e) => {
      if (e.target.id === 'modal-overlay') { closeModal(root); resolve(false); }
    };
  });
}

export function selectDialog({ title, options, emptyText = 'No hay opciones disponibles.', iconName = 'folder' }) {
  return new Promise((resolve) => {
    if (!options || options.length === 0) {
      const root = buildShell(iconName, title, `<p>${emptyText}</p>`);
      const actions = document.getElementById('modal-actions');
      actions.innerHTML = `<button class="btn" id="modal-confirm">Entendido</button>`;
      document.getElementById('modal-confirm').onclick = () => { closeModal(root); resolve(null); };
      return;
    }
    const listHtml = options
      .map((opt, i) => `<button class="modal-option" data-i="${i}">${opt.label}</button>`)
      .join('');
    const root = buildShell(iconName, title, `<div class="modal-option-list">${listHtml}</div>`);
    document.getElementById('modal-actions').innerHTML = `<button class="btn btn-ghost" id="modal-cancel">Cancelar</button>`;
    root.querySelectorAll('.modal-option').forEach((btn) => {
      btn.onclick = () => { closeModal(root); resolve(options[Number(btn.dataset.i)].value); };
    });
    document.getElementById('modal-cancel').onclick = () => { closeModal(root); resolve(null); };
    root.querySelector('.modal-overlay').onclick = (e) => {
      if (e.target.id === 'modal-overlay') { closeModal(root); resolve(null); }
    };
  });
}

export function promptDialog({ title, label, placeholder = '', confirmText = 'Crear', iconName = 'folderPlus' }) {
  return new Promise((resolve) => {
    const root = buildShell(iconName, title, `
      <label class="modal-label">${label}</label>
      <input type="text" id="modal-input" placeholder="${placeholder}" autocomplete="off" />
    `);
    const actions = document.getElementById('modal-actions');
    actions.innerHTML = `
      <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
      <button class="btn" id="modal-confirm">${confirmText}</button>
    `;
    const input = document.getElementById('modal-input');
    setTimeout(() => input.focus(), 50);
    const submit = () => {
      const val = input.value.trim();
      if (!val) { input.focus(); return; }
      closeModal(root);
      resolve(val);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    document.getElementById('modal-cancel').onclick = () => { closeModal(root); resolve(null); };
    document.getElementById('modal-confirm').onclick = submit;
    root.querySelector('.modal-overlay').onclick = (e) => {
      if (e.target.id === 'modal-overlay') { closeModal(root); resolve(null); }
    };
  });
}
