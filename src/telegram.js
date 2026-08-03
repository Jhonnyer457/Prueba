import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { CustomFile } from 'telegram/client/uploads.js';
import { Buffer } from 'buffer';

// Las carpetas ya NO son canales privados: ahora son "Topics" (temas)
// dentro de UN ÚNICO grupo privado con el foro activado. Telegram nos da
// el título de cada tema de forma nativa (channels.GetForumTopics), así
// que ya no hace falta mantener un índice JSON aparte para el nombre;
// solo guardamos el ID del grupo raíz para poder reencontrarlo en
// cualquier dispositivo/sesión.
const ROOT_GROUP_MARKER = 'TELEDRIVE_ROOT_GROUP_ID';
const ROOT_GROUP_TITLE = 'TeleDrive';
const SESSION_KEY = 'teledrive_session';
const GENERAL_TOPIC_ID = 1; // Topic "General" que crea Telegram por defecto, lo ocultamos

let client = null;
let rootGroupEntity = null; // entidad del grupo raíz, resuelta una vez por sesión

export function hasSavedSession() {
  return !!localStorage.getItem(SESSION_KEY);
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  client = null;
  rootGroupEntity = null;
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

// ---------------- Grupo raíz (contenedor de todas las carpetas/temas) ----------------

/**
 * Busca (por índice guardado en Mensajes Guardados) o crea el grupo
 * privado único que contendrá todas las carpetas como Topics. Se
 * resuelve una sola vez por sesión y se cachea en memoria.
 */
export async function ensureRootGroup() {
  if (rootGroupEntity) return rootGroupEntity;

  // 1) ¿Ya tenemos el ID guardado en Mensajes Guardados?
  const results = await client.getMessages('me', { search: ROOT_GROUP_MARKER, limit: 5 });
  const marker = results.find((m) => (m.message || '').startsWith(ROOT_GROUP_MARKER));
  if (marker) {
    const id = marker.message.slice(ROOT_GROUP_MARKER.length).trim();
    try {
      rootGroupEntity = await client.getEntity(id);
      return rootGroupEntity;
    } catch {
      // El grupo ya no existe o no es accesible: seguimos y creamos uno nuevo.
    }
  }

  // 2) Fallback: buscar entre los diálogos un grupo llamado "TeleDrive" con foro activado.
  try {
    const dialogs = await client.getDialogs({ limit: 300 });
    const found = dialogs.find((d) => d.isGroup && d.title === ROOT_GROUP_TITLE && d.entity?.forum);
    if (found) {
      rootGroupEntity = found.entity;
      await client.sendMessage('me', { message: `${ROOT_GROUP_MARKER} ${rootGroupEntity.id.toString()}` });
      return rootGroupEntity;
    }
  } catch {
    // continuar y crear uno nuevo
  }

  // 3) Crear el grupo desde cero, con Topics (foro) activados.
  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title: ROOT_GROUP_TITLE,
      about: 'Grupo gestionado por TeleDrive. No lo borres ni renombres.',
      megagroup: true,
    })
  );
  const channel = result.chats[0];
  await client.invoke(new Api.channels.ToggleForum({ channel, enabled: true }));
  rootGroupEntity = channel;
  await client.sendMessage('me', { message: `${ROOT_GROUP_MARKER} ${channel.id.toString()}` });
  return rootGroupEntity;
}

/**
 * Lista todas las carpetas (Topics) del grupo raíz, ocultando el tema
 * "General" que Telegram crea automáticamente.
 */
export async function listFolders() {
  const group = await ensureRootGroup();
  const res = await client.invoke(
    new Api.channels.GetForumTopics({
      channel: group,
      offsetDate: 0,
      offsetId: 0,
      offsetTopic: 0,
      limit: 100,
    })
  );
  return res.topics
    .filter((t) => t.id !== GENERAL_TOPIC_ID && t.className === 'ForumTopic')
    .map((t) => ({ id: t.id, name: t.title, entity: group }));
}

/**
 * Crea una carpeta nueva = un Topic nuevo dentro del grupo raíz.
 */
export async function createFolder(name) {
  const group = await ensureRootGroup();
  const randomId = BigInt(Math.floor(Math.random() * 1e15));
  const res = await client.invoke(
    new Api.channels.CreateForumTopic({
      channel: group,
      title: name,
      randomId,
    })
  );
  const created = res.updates.find((u) => u.className === 'UpdateNewChannelMessage');
  const topicId = created ? created.message.id : null;
  return { id: topicId, name, entity: group };
}

export async function deleteFolder(entity, id) {
  // Borra todo el historial del tema. Telegram no ofrece un "borrar tema"
  // definitivo aparte de esto; tras vaciar su historial, el tema deja de
  // aparecer con contenido (queda vacío, igual que una carpeta vacía).
  await client.invoke(
    new Api.channels.DeleteTopicHistory({ channel: entity, topMsgId: id })
  );
}

export async function getSavedMessagesPeer() {
  return await client.getMe();
}

// ---------------- Archivos dentro de una carpeta (Topic) ----------------

export async function listFiles(entity, topicId, limit = 100) {
  const opts = { limit };
  if (topicId) opts.replyTo = topicId;
  const messages = await client.getMessages(entity, opts);
  return messages
    .filter((m) => m.media && !(m.message || '').startsWith(ROOT_GROUP_MARKER))
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
 * Sube un archivo con progreso en tiempo real, a un Topic concreto
 * (o a "Mensajes guardados" si no se pasa topicId).
 */
export async function uploadFile(entity, topicId, file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const toUpload = new CustomFile(file.name, file.size, '', buffer);

  await client.sendFile(entity, {
    file: toUpload,
    caption: file.name,
    forceDocument: false,
    workers: 1,
    replyTo: topicId || undefined,
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
 * Recorre todas las carpetas (Topics) para reunir fotos/vídeos para la
 * vista Multimedia.
 */
export async function listAllMedia(folders, limitPerFolder = 30) {
  const group = await ensureRootGroup();
  const items = [];
  for (const folder of folders) {
    try {
      const files = await listFiles(group, folder.id, limitPerFolder);
      files.filter((f) => f.isPhoto || f.isVideo).forEach((f) => items.push({ ...f, folderName: folder.name }));
    } catch {
      // Ignoramos carpetas con error puntual y seguimos con el resto.
    }
  }
  return items.sort((a, b) => b.date - a.date);
}
