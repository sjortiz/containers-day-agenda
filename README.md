# Talk Track

PWA que reúne agendas de eventos —incluyendo Containers Day y APIs públicas de
Sessionize—, te deja **armar tu propia agenda** (guardada en el dispositivo, sin cuenta ni backend) y
te **avisa 10 minutos antes** de cada charla que elegiste, mostrando **salón, título y speaker**.

Hecha con **Next.js** (export estático) para publicarse en **GitHub Pages**.

## Características

### Biblioteca de eventos

- Pantalla inicial con todos los eventos guardados en el dispositivo.
- Containers Day viene agregado de fábrica y obtiene su agenda directamente de
  su endpoint público de Sessionize.
- Importación de múltiples eventos pegando una URL pública de Sessionize API v2.
- Cada tarjeta muestra nombre, fechas, cantidad de sesiones y estado de
  actualización; al abrirla se accede a la agenda independiente del evento.
- Los eventos importados se pueden eliminar con confirmación, junto con sus
  datos locales. Containers Day permanece siempre disponible.

### Importación y uso compartido con QR

- Registro de eventos mediante URL de Sessionize o escaneando un QR.
- Generación de un QR para compartir un evento guardado. Contiene la URL pública
  y el nombre del evento, nunca los favoritos del usuario.
- Escaneo en vivo mediante `BarcodeDetector`, con fallback basado en `jsQR`.
- Opción **Tomar foto del QR** para iOS, PWAs o navegadores donde el video de la
  cámara no esté disponible.
- Entrada manual por URL siempre disponible.

### Agenda personal

- Selección de charlas con ★, almacenada por separado para cada evento.
- Búsqueda por título, salón, speaker y etiquetas.
- Filtros por salón y etiquetas, más la vista **Solo las mías**.
- Agrupación cronológica por hora y opción para limpiar la selección.
- Las sesiones de opción única se preseleccionan una vez, pero pueden quitarse.
- Identificación automática de bloques de servicio.
- Banner de la próxima sesión seleccionada con cuenta regresiva.

### Actualización en vivo y tolerancia a cambios

- Consulta directa a Sessionize al abrir un evento, recuperar el foco, volver a
  estar en línea o regresar a la pestaña.
- Sondeo cada minuto mientras la agenda está visible para recoger cambios de los
  organizadores durante el evento.
- Solicitudes deduplicadas con timeout, protección contra respuestas antiguas y
  reintentos con espera progresiva.
- Caché de la última agenda válida para consultarla sin conexión o durante un
  fallo temporal de Sessionize.
- Indicador de frescura: actualizando, última actualización, copia sin conexión
  o error.
- Si cambia la hora de una charla, sus avisos pendientes se reprograman usando
  la información más reciente.
- Las horas de Sessionize sin offset se interpretan en la zona horaria del evento.

### Avisos y PWA

- Notificaciones nativas 10 minutos antes de cada charla seleccionada, con
  título, salón y speaker.
- Controles para activar, desactivar y probar las notificaciones.
- Avisos aislados por evento para evitar colisiones entre agendas.
- Instalación como PWA en Android e iOS, con orientación según la plataforma.
- Service Worker, shell sin conexión e interfaz adaptable a móvil y escritorio.
- Enlace para saltar al contenido, controles semánticos, foco visible y respeto
  por la preferencia de movimiento reducido.

### Privacidad y almacenamiento

- No requiere cuenta ni backend: biblioteca, caché y selecciones se guardan en
  `localStorage` en el dispositivo.
- Migración de datos anteriores al formato multi-evento sin perder selecciones.
- Compartir un evento no comparte favoritos ni otros datos personales.

## Limitaciones actuales

- La importación admite endpoints públicos de **Sessionize API v2**. Todavía no
  admite páginas arbitrarias, archivos ICS ni otros proveedores.
- GitHub Pages es 100% estático: no existe push desde un servidor. Los avisos
  funcionan mientras la PWA permanece abierta, incluso en segundo plano, pero
  no pueden llegar si está completamente cerrada.

## Desarrollo

```bash
make install           # instala las dependencias
make dev               # http://localhost:3000 (sin basePath en dev)
make test              # ejecuta las pruebas
make check             # pruebas + comprobación de TypeScript
make icons             # regenera los iconos PWA (opcional)
```

También se pueden ejecutar directamente los comandos equivalentes de `npm`.

## Skills de Claude Code

Para trabajar en este proyecto con Claude Code usamos las siguientes skills de
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills):

- `vercel-react-best-practices`
- `vercel-composition-patterns`
- `vercel-react-view-transitions`
- `web-design-guidelines`
- `writing-guidelines`

No instalamos ni usamos las skills de despliegue, CLI u optimización de Vercel,
porque este proyecto se publica como export estático en GitHub Pages. Tampoco
incluimos la skill de React Native porque la aplicación es una PWA web.

Instalación global para Claude Code:

```bash
npx skills add vercel-labs/agent-skills --global --agent claude-code \
  --skill vercel-composition-patterns vercel-react-best-practices \
  vercel-react-view-transitions web-design-guidelines writing-guidelines \
  --yes --copy
```

## Build local

```bash
npm run build          # genera el sitio estático en ./out
npx serve out          # previsualizar el export
```

> Las notificaciones y el Service Worker requieren **HTTPS** o **localhost**.

## Deploy en GitHub Pages

1. Crea un repo en GitHub y sube este proyecto (rama `main`).
2. En **Settings → Pages → Build and deployment → Source**, elige **GitHub Actions**.
3. Cada push a `main` dispara `.github/workflows/deploy.yml`, que:
   - calcula el `basePath` automáticamente según el nombre del repo
     (`/<repo>` para *project pages*, vacío si el repo es `usuario.github.io`),
   - hace el export estático y publica `./out`.

El sitio queda en `https://<usuario>.github.io/<repo>/`.

### Nombre del repo / basePath

El workflow deriva el `basePath` solo. Para **build local** el valor por defecto es
`/containers-day-agenda`; si tu repo se llama distinto, expórtalo:

```bash
NEXT_PUBLIC_BASE_PATH=/tu-repo npm run build
```

### Dominio propio (opcional)

Agrega un archivo `public/CNAME` con tu dominio y pon `NEXT_PUBLIC_BASE_PATH=""`.

## Refrescar la agenda

La PWA consulta directamente el endpoint Sessionize de cada evento al abrirse,
al recuperar foco o conexión y durante el sondeo visible. La última respuesta
válida se conserva localmente y se usa mientras no haya conexión.
