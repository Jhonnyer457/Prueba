import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { CustomFile } from 'telegram/client/uploads.js';
import { Buffer } from 'buffer';

// ============================================================================
// Lógica de carpetas (v2)
//
// Cada carpeta de NIVEL SUPERIOR = un grupo privado propio en Telegram (con
// los "Topics" / foro activados). No se crea NADA automáticamente al abrir
// la PWA: el primer grupo solo se crea cuando el usuario pulsa "Crear
// carpeta" desde Inicio.
//
// Dentro de esa carpeta de nivel superior, si el usuario crea otra carpeta,
// esa SÍ es un Topic (tema) dentro del grupo ya creado -> solo 1 nivel de
// subcarpetas, tal y como permite Telegram.
//
// Los archivos subidos directamente dentro de una carpeta de nivel superior
// (sin entrar antes en una subcarpeta) se guardan en el Topic "General"
// (id = 1) que Telegram crea por defecto en todo grupo-foro; ese topic no
// se muestra como "subcarpeta" en la lista, pero sí se listan sus archivos.
//
// Para poder encontrar los grupos que pertenecen a TeleDrive en cualquier
// dispositivo/sesión, guardamos un pequeño índice JSON como UN mensaje fijo
// en "Mensajes guardados" (Saved Messages). Ese apartado NUNCA se muestra
// en la interfaz de la PWA: es solo una bóveda de metadatos interna.
// ============================================================================

const INDEX_MARKER = 'TELEDRIVE_INDEX_V2';
const SESSION_KEY = 'teledrive_session';
export const GENERAL_TOPIC_ID = 1; // Topic "General" que crea Telegram por defecto

let client = null;
const entityCache = new Map(); // id (string) -> entidad resuelta, cacheada por sesión

export function hasSavedSession() {
  return !!localStorage.getItem(SESSION_KEY);
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  client = null;
  entityCache.clear();
}

function buildClient(id, hash) {
  const savedSession = localStorage.getItem(SESSION_KEY) || '';
  const stringSession = new StringSession(savedSession);
  client = new TelegramClient(stringSession, Number(id), hash, {
    connectionRetries: 5,
  });
  return client;
}

export async function login({ id, hash, phone, onNeedCode, onNeedPassword }) {
  buildClient(id, hash);
  await client.start({
    phoneNumber: async () => phone,
    phoneCode: async () => await onNeedCode(),
    password: async () => await onNeedPassword(),
    onError: (err) => console.error('Telegram login error:', err),
  });
  localStorage.setItem(SESSION_KEY, client.session.save());
  return true;
}

export async function reconnect(id, hash) {
  buildClient(id, hash);
  await client.connect();
  const me = await client.getMe();
  if (!me) throw new Error('Sesión inválida');
  return me;
}

export function getClient() {
  if (!client) throw new Error('Cliente de Telegram no inicializado.');
  return client;
}

export async function getMeInfo() {
  const me = await client.getMe();
  return {
    firstName: me.firstName || '',
    lastName: me.lastName || '',
    username: me.username || '',
    phone: me.phone || '',
  };
}

// ---------------- Índice de carpetas (guardado como metadato en "me") ----------------

async function loadIndex() {
  const results = await client.getMessages('me', { search: INDEX_MARKER, limit: 5 });
  const msg = results.find((m) => (m.message || '').startsWith(INDEX_MARKER));
  if (!msg) return { data: { folders: [] }, msgId: null };
  try {
    const json = msg.message.slice(INDEX_MARKER.length).trim();
    const data = JSON.parse(json);
    if (!Array.isArray(data.folders)) data.folders = [];
    return { data, msgId: msg.id };
  } catch {
    return { data: { folders: [] }, msgId: msg.id };
  }
}

async function saveIndex(data, oldMsgId) {
  const text = `${INDEX_MARKER} ${JSON.stringify(data)}`;
  await client.sendMessage('me', { message: text });
  if (oldMsgId) {
    try {
      await client.deleteMessages('me', [oldMsgId], { revoke: true });
    } catch {
      // no pasa nada si no se pudo borrar el índice viejo
    }
  }
}

// ---------------- Carpetas de nivel superior (= grupos) ----------------

/**
 * Devuelve la lista de carpetas de nivel superior (solo id + nombre, sin
 * resolver la entidad de Telegram todavía: eso se hace bajo demanda al
 * entrar en la carpeta, para que abrir la PWA sea instantáneo).
 */
export async function listTopFolders() {
  const { data } = await loadIndex();
  return data.folders;
}

/**
 * Resuelve (y cachea) la entidad de Telegram de una carpeta de nivel
 * superior a partir de su id guardado en el índice.
 */
export async function resolveFolderEntity(id) {
  if (entityCache.has(id)) return entityCache.get(id);
  const entity = await client.getEntity(id);
  entityCache.set(id, entity);
  return entity;
}

/**
 * Crea una carpeta de nivel superior = un grupo privado nuevo con el foro
 * (Topics) activado. Solo ocurre cuando el usuario lo pide explícitamente.
 */
export async function createTopFolder(name) {
  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title: name,
      about: 'Carpeta gestionada por TeleDrive. No la borres ni renombres desde Telegram.',
      megagroup: true,
    })
  );
  const channel = result.chats[0];
  await client.invoke(new Api.channels.ToggleForum({ channel, enabled: true }));
  const id = channel.id.toString();
  entityCache.set(id, channel);

  const { data, msgId } = await loadIndex();
  data.folders.push({ id, name });
  await saveIndex(data, msgId);

  return { id, name, entity: channel };
}

/**
 * Elimina una carpeta de nivel superior por completo (borra el grupo en
 * Telegram y la quita del índice).
 */
export async function deleteTopFolder(id) {
  const entity = await resolveFolderEntity(id);
  await client.invoke(new Api.channels.DeleteChannel({ channel: entity }));
  entityCache.delete(id);

  const { data, msgId } = await loadIndex();
  data.folders = data.folders.filter((f) => f.id !== id);
  await saveIndex(data, msgId);
}

// ---------------- Subcarpetas (= Topics dentro de una carpeta de nivel superior) ----------------

/**
 * Lista las subcarpetas (Topics) de una carpeta de nivel superior,
 * ocultando el tema "General" que Telegram crea automáticamente.
 */
export async function listSubFolders(topEntity) {
  const res = await client.invoke(
    new Api.channels.GetForumTopics({
      channel: topEntity,
      offsetDate: 0,
      offsetId: 0,
      offsetTopic: 0,
      limit: 100,
    })
  );
  return res.topics
    .filter((t) => t.id !== GENERAL_TOPIC_ID && t.className === 'ForumTopic')
    .map((t) => ({ id: t.id, name: t.title, entity: topEntity }));
}

/**
 * Crea una subcarpeta = un Topic nuevo dentro de una carpeta de nivel
 * superior ya existente. Solo se permite un nivel de subcarpetas.
 */
export async function createSubFolder(topEntity, name) {
  const randomId = BigInt(Math.floor(Math.random() * 1e15));
  const res = await client.invoke(
    new Api.channels.CreateForumTopic({
      channel: topEntity,
      title: name,
      randomId,
    })
  );
  const created = res.updates.find((u) => u.className === 'UpdateNewChannelMessage');
  const topicId = created ? created.message.id : null;
  return { id: topicId, name, entity: topEntity };
}

/**
 * Vacía una subcarpeta (Topic). Telegram no ofrece un "borrar tema"
 * definitivo aparte de vaciar su historial; tras eso queda vacía, igual
 * que una carpeta vacía.
 */
export async function deleteSubFolder(entity, id) {
  await client.invoke(new Api.channels.DeleteTopicHistory({ channel: entity, topMsgId: id }));
}

// ---------------- Archivos dentro de una carpeta o subcarpeta (Topic) ----------------

export async function listFiles(entity, topicId, limit = 100) {
  const opts = { limit };
  if (topicId) opts.replyTo = topicId;
  const messages = await client.getMessages(entity, opts);
  return messages
    .filter((m) => m.media && !(m.message || '').startsWith(INDEX_MARKER))
    .map(parseFileMessage);
}

export async function countFiles(entity, topicId) {
  const opts = { limit: 1, filter: new Api.InputMessagesFilterDocument() };
  if (topicId) opts.replyTo = topicId;
  const docCount = await client.getMessages(entity, opts);
  const photoOpts = { limit: 1, filter: new Api.InputMessagesFilterPhotos() };
  if (topicId) photoOpts.replyTo = topicId;
  const photoCount = await client.getMessages(entity, photoOpts);
  return (docCount.total || 0) + (photoCount.total || 0);
}

function parseFileMessage(m) {
  let name = 'archivo';
  let size = 0;
  let mimeType = '';
  const doc = m.media?.document;
  if (doc) {
    size = Number(doc.size || 0);
    mimeType = doc.mimeType || '';
    const attr = doc.attributes?.find((a) => a.fileName);
    if (attr) name = attr.fileName;
    else if (mimeType) name = `archivo.${mimeType.split('/')[1] || 'bin'}`;
  } else if (m.media?.photo) {
    name = `foto_${m.id}.jpg`;
    mimeType = 'image/jpeg';
  }
  return {
    messageId: m.id,
    name,
    size,
    mimeType,
    date: m.date ? new Date(m.date * 1000) : new Date(),
    rawMessage: m,
    isPhoto: !!m.photo,
    isVideo: mimeType.startsWith('video/'),
  };
}

/**
 * Sube un archivo con progreso en tiempo real, a un Topic concreto de una
 * carpeta o subcarpeta. Se acepta CUALQUIER tipo de archivo: solo se activa
 * el modo "documento forzado" cuando el archivo NO es imagen ni vídeo, para
 * evitar que Telegram intente (y falle) tratarlo como media.
 */
export async function uploadFile(entity, topicId, file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const toUpload = new CustomFile(file.name, file.size, '', buffer);
  const isMedia = /^image\//.test(file.type) || /^video\//.test(file.type);

  await client.sendFile(entity, {
    file: toUpload,
    caption: file.name,
    forceDocument: !isMedia,
    workers: 4,
    replyTo: topicId || undefined,
    attributes: [new Api.DocumentAttributeFilename({ fileName: file.name })],
    progressCallback: (progress) => onProgress(progress),
  });
}

export async function downloadFile(rawMessage, onProgress) {
  const buffer = await client.downloadMedia(rawMessage, {
    progressCallback: (downloaded, total) => {
      if (total) onProgress(Number(downloaded) / Number(total));
    },
  });
  return buffer;
}

export async function deleteFile(entity, messageId) {
  await client.deleteMessages(entity, [messageId], { revoke: true });
}

/**
 * Recorre todas las carpetas y subcarpetas para reunir fotos/vídeos para
 * la vista Multimedia. NUNCA toca "Mensajes guardados": esa vive solo como
 * bóveda de metadatos.
 */
export async function listAllMedia(topFolders, limitPerFolder = 30) {
  const items = [];
  for (const top of topFolders) {
    try {
      const entity = await resolveFolderEntity(top.id);
      const subFolders = await listSubFolders(entity);
      const scopes = [
        { id: GENERAL_TOPIC_ID, name: top.name },
        ...subFolders.map((s) => ({ id: s.id, name: `${top.name} / ${s.name}` })),
      ];
      for (const scope of scopes) {
        const files = await listFiles(entity, scope.id, limitPerFolder);
        files
          .filter((f) => f.isPhoto || f.isVideo)
          .forEach((f) => items.push({ ...f, folderName: scope.name, entity, topicId: scope.id }));
      }
    } catch {
      // Ignoramos carpetas con error puntual y seguimos con el resto.
    }
  }
  return items.sort((a, b) => b.date - a.date);
}
