// Íconos SVG originales (trazo simple, 24x24), inspirados en el estilo
// "line icons" que usan apps como Mega/Drive. Se usan como HTML strings
// para poder insertarlos directo en el DOM. Heredan color con currentColor.

const wrap = (inner, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const Icon = {
  folder: (s) => wrap('<path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h4.4a1.5 1.5 0 0 1 1.06.44L11.5 7H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/>', s),

  folderPlus: (s) => wrap('<path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h4.4a1.5 1.5 0 0 1 1.06.44L11.5 7H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/><line x1="12" y1="10.5" x2="12" y2="15"/><line x1="9.5" y1="12.75" x2="14.5" y2="12.75"/>', s),

  file: (s) => wrap('<path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/><polyline points="14 3.5 14 7.5 18 7.5"/>', s),

  image: (s) => wrap('<rect x="3.5" y="4.5" width="17" height="15" rx="1.6"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17.5 4.5-5 3 3.2 2.5-3 4 4.8"/>', s),

  video: (s) => wrap('<rect x="3" y="6" width="13" height="12" rx="1.5"/><path d="m16.5 10.5 4.5-3v9l-4.5-3Z"/>', s),

  music: (s) => wrap('<circle cx="7" cy="17.5" r="2.3"/><circle cx="16.5" cy="15.5" r="2.3"/><path d="M9.3 17.5V6l9-2v11.5"/>', s),

  pdf: (s) => wrap('<path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/><polyline points="14 3.5 14 7.5 18 7.5"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16" x2="13" y2="16"/>', s),

  archive: (s) => wrap('<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M4.5 8.5v9a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-9"/><line x1="10" y1="12" x2="14" y2="12"/>', s),

  save: (s) => wrap('<path d="M6 3.5h9l3.5 3.5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z"/><path d="M8.5 3.5v6h6v-6"/><path d="M8.5 21v-6.5h7V21"/>', s),

  uploadCloud: (s) => wrap('<path d="M7 17.5a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.2 9.2 4.25 4.25 0 0 1 16.5 17.5H15"/><path d="M12 21v-8"/><polyline points="9 15.5 12 12.5 15 15.5"/>', s),

  download: (s) => wrap('<path d="M12 3.5v11"/><polyline points="8 11 12 15 16 11"/><path d="M5 17.5v1.7a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-1.7"/>', s),

  trash: (s) => wrap('<line x1="4.5" y1="7" x2="19.5" y2="7"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2"/><path d="M6.5 7 7.3 19a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/>', s),

  moreVertical: (s) => wrap('<circle cx="12" cy="5.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18.5" r="1"/>', s),

  settings: (s) => wrap('<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.55 1.55M17.55 17.55l1.55 1.55M3 12h2.2M18.8 12H21M4.9 19.1l1.55-1.55M17.55 6.45l1.55-1.55"/>', s),

  logOut: (s) => wrap('<path d="M9 5.5H6.5a1.5 1.5 0 0 0-1.5 1.5v10a1.5 1.5 0 0 0 1.5 1.5H9"/><polyline points="15 8 19 12 15 16"/><line x1="19" y1="12" x2="9.5" y2="12"/>', s),

  chevronLeft: (s) => wrap('<polyline points="15 5 9 12 15 19"/>', s),

  chevronRight: (s) => wrap('<polyline points="9 5 15 12 9 19"/>', s),

  x: (s) => wrap('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>', s),

  plus: (s) => wrap('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', s),

  transfer: (s) => wrap('<polyline points="7 8 4 11 7 14"/><line x1="4" y1="11" x2="14" y2="11"/><polyline points="17 16 20 13 17 10"/><line x1="20" y1="13" x2="10" y2="13"/>', s),

  cloud: (s) => wrap('<path d="M7 18a4.2 4.2 0 0 1-.6-8.35A5.5 5.5 0 0 1 17 8.7 3.8 3.8 0 0 1 16.3 18Z"/>', s),

  key: (s) => wrap('<circle cx="8" cy="15" r="3.5"/><path d="M10.8 12.2 18 5l2 2-1.5 1.5L20 10l-2 2-1.5-1.5-1.5 1.5"/>', s),

  phone: (s) => wrap('<rect x="7" y="2.5" width="10" height="19" rx="1.8"/><line x1="11" y1="18" x2="13" y2="18"/>', s),

  shield: (s) => wrap('<path d="M12 2.5 4.5 5.5v6c0 5 3.4 8 7.5 9.5 4.1-1.5 7.5-4.5 7.5-9.5v-6L12 2.5Z"/><polyline points="9 11.8 11.2 14 15.5 9.5"/>', s),

  refresh: (s) => wrap('<path d="M3.5 12a8.5 8.5 0 0 1 14.4-6.1L20 8"/><polyline points="20 3 20 8 15 8"/><path d="M20.5 12a8.5 8.5 0 0 1-14.4 6.1L4 16"/><polyline points="4 21 4 16 9 16"/>', s),

  alert: (s) => wrap('<path d="M12 3 2 20h20L12 3Z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>', s),

  user: (s) => wrap('<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>', s),

  inbox: (s) => wrap('<path d="M3.5 12.5h5l1.5 2.5h4l1.5-2.5h5"/><path d="M5 6.5h14l1.5 6v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18.5v-6l1.5-6Z"/>', s),

  checkSquare: (s) => wrap('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><polyline points="7.5 12.3 10.3 15 16.5 8.5"/>', s),

  square: (s) => wrap('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/>', s),

  playCircle: (s) => wrap('<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5 15.5 12 10 15.5Z" fill="currentColor" stroke="none"/>', s),

  check: (s) => wrap('<polyline points="4.5 12.5 9.5 17.5 19.5 6.5"/>', s),
};

export function icon(name, size) {
  const fn = Icon[name];
  if (!fn) return '';
  return fn(size);
}
