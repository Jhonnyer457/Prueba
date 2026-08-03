# TeleDrive

## Novedades de esta versión (v5)

- **Arreglo de la lógica de carpetas**: la app ya NO crea nada automáticamente al abrirla. Ahora cada carpeta de **Inicio** es su propio grupo privado en Telegram (con Topics activado), y solo se crea cuando tú pulsas "Crear carpeta". Si entras en esa carpeta y creas otra, esa segunda sí es una **subcarpeta** (un Topic dentro del grupo que ya existe) — solo se permite un nivel de subcarpetas, que es lo máximo que Telegram permite con Topics.
  - **Importante / migración**: como el índice de carpetas cambió de formato, las carpetas creadas con la v4 (el grupo único "TeleDrive" con Topics) no aparecerán en esta versión. Si tenías archivos ahí, ábrelos desde la app oficial de Telegram y reenvíalos a la carpeta nueva correspondiente.
- **Arreglo de subida de archivos**: ahora se puede subir cualquier tipo de archivo (documentos, zips, PDFs, etc.), no solo fotos y vídeos.
- **Arreglo del visor de Multimedia**: al tocar una foto o vídeo se abre un visor a pantalla completa (con opciones de Descargar/Eliminar) en vez de descargarlo automáticamente. Los vídeos ahora también muestran una miniatura real (un frame capturado del vídeo).
- **"Mensajes guardados" ya no aparece en la app**: sigue existiendo dentro de Telegram como bóveda interna de metadatos (el índice de carpetas), pero no se muestra como una sección de la PWA ni se sube nada de contenido ahí.
- **Arreglo del tema claro**: la barra superior ya no se queda oscura al activar el tema claro.
- **Selección múltiple**: en cualquier lista de archivos (y en Multimedia) puedes tocar "Seleccionar" para marcar varios archivos y luego descargarlos o borrarlos todos de una vez.
- **Botón "+" contextual**: en Inicio crea una carpeta; dentro de una carpeta ofrece "Crear subcarpeta" o "Subir archivos"; dentro de una subcarpeta solo sube archivos; en Multimedia sube fotos/vídeos (te deja elegir a qué carpeta van).

## Novedades de la versión anterior (v4)

- **Canales → Grupo con Temas (Topics)**: cada carpeta ya NO es un canal privado independiente. Ahora existe un único grupo privado llamado "TeleDrive" (con el foro/Topics activado) y cada carpeta es un Tema dentro de ese grupo. Esto es un cambio de arquitectura, no solo visual: **las carpetas que hubieras creado con la versión anterior (canales) no aparecerán aquí**, porque `listFolders()` ahora lee Topics, no canales. Si tenías archivos importantes en esos canales antiguos, ábrelos desde la propia app oficial de Telegram y reenvíalos a la carpeta/tema nueva correspondiente.
- **Nuevo diseño**: barra inferior fija con **Inicio / Descargas / Multimedia**, botón flotante (+) dinámico (crea carpeta en Inicio, sube archivo dentro de una carpeta), menú de ajustes ahora es un desplegable simple (Cambiar tema, Sincronizar, Cerrar sesión), tema oscuro AMOLED y tema claro violeta, y las carpetas se muestran con el emoji 📂 en vez de un ícono SVG.
- Se eliminó la página completa de Ajustes (perfil, modo inmersivo) para ajustarse al menú desplegable de 3 opciones pedido; si la quieres de vuelta dímelo y la reincorporo.

## Novedades de la versión anterior (v3)

- **Diálogos propios**: los `prompt()`/`confirm()` feos del navegador fueron reemplazados por modales con el mismo diseño violeta/negro de la app.
- **Carpetas en lista** (estilo Mega): ahora se muestran como filas con ícono, nombre y conteo real de archivos, en vez de tarjetas en grid.
- **Modo inmersivo persistente**: si el navegador cierra el modo pantalla completa solo (algo común en Android/iOS por seguridad), la app lo vuelve a activar automáticamente en el siguiente toque, sin que tengas que volver a Ajustes.
- **Fondo animado de estrellas**: un canvas sutil con estrellas parpadeantes en blanco/violeta, detrás de toda la interfaz.

> Nota sobre las descargas: el cuadro "Elige dónde descargarlo" que aparece al descargar un archivo es el diálogo **nativo del sistema/navegador** (Android/Chrome), no de la app — por seguridad, ningún sitio web puede reemplazar esa ventana.

## Novedades de la versión anterior (v2)

- Los canales/carpetas ahora se crean con el título **exacto** que escribes (sin prefijos). Internamente, la app guarda un pequeño índice oculto en "Mensajes guardados" (un mensaje que empieza con `TELEGRAM_INDEX_V1`, no lo borres) para reconocer tus carpetas.
- **Migración automática**: si ya habías creado una carpeta con la versión anterior (con el prefijo "🗂 TeleDrive:"), la primera vez que abras la app se detecta, se le quita el prefijo y se agrega sola al nuevo índice.
- **Fix de subida**: se corrigió el error al subir archivos desde la PWA (GramJS necesitaba un envoltorio `CustomFile` para leer bien los archivos del navegador).
- **Rediseño completo**: interfaz estilo Mega/Drive, íconos SVG en vez de emojis, menú de tres puntos por archivo, botón "+" flotante contextual, y el botón de cerrar sesión ahora vive dentro de **Ajustes** (ícono de engranaje, arriba a la derecha).
- **Modo inmersivo**: en Ajustes → "Modo inmersivo" puedes ocultar las barras del navegador. Además, al instalar la PWA en tu pantalla de inicio, el `manifest` ya pide modo `fullscreen` por defecto.


PWA de almacenamiento en la nube que usa **Telegram** como backend:
cada carpeta de nivel superior que creas es un grupo privado de Telegram
(con Topics activado), y las subcarpetas son Topics dentro de ese grupo.
"Mensajes guardados" solo se usa internamente para recordar qué grupos son
tuyos; nunca se muestra ni se sube nada de contenido ahí. Todo corre 100%
en el navegador (no hay servidor propio), así que se puede alojar gratis en
GitHub Pages.

---

## 1. Requisitos previos

- Node.js 18 o superior instalado en tu PC.
- Tu `api_id` y `api_hash` de Telegram (ya los tienes, de https://my.telegram.org → **API Development Tools**).
- Una cuenta de GitHub.

---

## 2. Probarlo en local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. La primera vez te pedirá:
1. `api_id` y `api_hash`
2. Tu número de teléfono (con código de país, ej: `+34600000000`)
3. El código que te llega por Telegram
4. Tu contraseña de verificación en 2 pasos (solo si la tienes activada)

Después de loguearte, la sesión queda guardada en `localStorage` del navegador,
así que no tendrás que volver a poner el código cada vez — solo el `api_id`/`api_hash`
al recargar la página (por seguridad, esos dos valores nunca se guardan).

---

## 3. Publicar en GitHub Pages — 100% desde el teléfono, sin terminal

Este proyecto incluye un **workflow de GitHub Actions** (`.github/workflows/deploy.yml`)
que compila la app automáticamente en la nube cada vez que subes cambios.
Tú solo subes los archivos tal cual están en el zip — nada de `npm install` en tu dispositivo.

### Paso 1 — Crea el repositorio

1. Abre la app o web de GitHub en tu teléfono.
2. **New repository** → ponle un nombre (ej: `teledrive`) → **Public** o **Private** (ambos funcionan con Pages) → **Create**.

### Paso 2 — Sube TODO el contenido del zip (descomprimido)

En GitHub, dentro del repo: **Add file → Upload files** → selecciona todos los
archivos y carpetas que venían dentro del zip (`index.html`, `package.json`,
`vite.config.js`, `src/`, `public/`, `.github/`, `README.md`, `.gitignore`) →
**Commit changes**.

> ⚠️ Importante: sube la carpeta `.github/workflows/deploy.yml` también — muchas
> apps de gestión de archivos ocultan las carpetas que empiezan con punto. Si tu
> gestor de archivos no te deja verla, usa la web de GitHub directamente
> (github.com desde el navegador del móvil) y sube ese archivo aparte
> en la ruta `.github/workflows/deploy.yml`.

### Paso 3 — Activa GitHub Pages con origen "GitHub Actions"

**Settings → Pages → Source → elige "GitHub Actions"** (NO "Deploy from a branch").

### Paso 4 — Espera el build automático

Ve a la pestaña **Actions** de tu repo. En cuanto subiste los archivos, el workflow
"Deploy TeleDrive to GitHub Pages" empieza solo. Tarda 1-2 minutos. Cuando el
círculo se pone verde ✔, tu PWA ya está publicada en:

```
https://TU_USUARIO.github.io/TU_REPO/
```

(la URL exacta también aparece en Settings → Pages, arriba del todo)

### Paso 5 — Instálala en tu móvil

Abre esa URL en Chrome (Android) o Safari (iPhone) y usa
**"Añadir a pantalla de inicio"**. Quedará como una app más, con el ícono
negro y el símbolo violeta.

### ¿Y si luego quiero cambiar algo del código?

Solo edita el archivo directamente en la web de GitHub (ícono del lápiz ✏️) y
dale a **Commit changes**. El workflow se vuelve a ejecutar solo y en un par
de minutos la PWA se actualiza sin que tengas que tocar nada más.

---

## 4. Cómo funciona por dentro

| Función | Cómo se implementa |
|---|---|
| Login | GramJS (MTProto) con tu número de teléfono, corre en el navegador |
| Carpetas | Cada carpeta = un canal privado de Telegram con el prefijo `🗂 TeleDrive:` |
| Storage principal | El chat "Mensajes guardados" (`Saved Messages`) de tu propia cuenta |
| Subir archivo | `client.sendFile()` con `progressCallback` en tiempo real |
| Descargar archivo | `client.downloadMedia()` con `progressCallback`, genera un Blob descargable |
| Sesión persistente | `StringSession` de GramJS guardado en `localStorage` |
| Multi-dispositivo | Al listar tus diálogos, la app reconoce tus carpetas por el prefijo del título, así que si entras desde otro navegador/dispositivo con la misma cuenta, tus carpetas aparecen automáticamente |

## 6. Solución de problemas

**El Action queda en verde pero la página se ve completamente negra/en blanco:**
Esto casi siempre es un error de JavaScript al cargar (no un problema de GitHub
Pages, que ya está sirviendo los archivos bien). La causa típica es que la
librería de Telegram (GramJS) necesita "polyfills" de Node.js para funcionar
en el navegador — esto ya viene solucionado en `vite.config.js` con
`vite-plugin-node-polyfills`. Si igual ves la pantalla negra:

1. Confirma que subiste la versión más reciente de `package.json` y `vite.config.js`.
2. Ve a la pestaña **Actions** y confirma que el último build (verde ✔) es
   posterior a la fecha en que subiste esos archivos.
3. Para ver el error real: abre la URL en una PC con Chrome, presiona F12
   → pestaña **Console**. Ahí aparecerá el mensaje de error exacto.
4. En el móvil también puedes ver la consola: en Chrome Android, ve a
   `chrome://inspect` desde una PC conectada por USB con "Depuración USB"
   activada en el teléfono.

## 5. Límites y notas importantes

- **Tamaño de archivo:** con cuenta de usuario (no bot) puedes subir hasta 2 GB por archivo
  (4 GB si tienes Telegram Premium).
- **api_id/api_hash no se guardan** por seguridad — solo viven en memoria durante la sesión
  del navegador. Si quieres que se recuerden también, puedes guardarlos tú mismo en
  `localStorage` editando `telegram.js`, pero no es recomendable en un dispositivo compartido.
- **No hay verdadero "offline"**: los archivos siempre se piden en vivo a los servidores
  de Telegram. El Service Worker solo cachea la interfaz (HTML/CSS/JS) para que cargue rápido.
- Esta app usa tu cuenta personal de Telegram vía su API oficial de cliente — es el mismo
  mecanismo que usan apps como Telegram Web o Telegram Desktop. Úsala de forma responsable
  y no compartas tu `session string` ni tu `api_hash` con nadie.
