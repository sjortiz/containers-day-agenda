# Mi Agenda · Containers Day

PWA que toma la agenda pública de [containers.day/agenda](https://containers.day/agenda/),
te deja **armar tu propia agenda** (guardada en el dispositivo, sin cuenta ni backend) y
te **avisa 10 minutos antes** de cada charla que elegiste, mostrando **salón, título y speaker**.

Hecha con **Next.js** (export estático) para publicarse en **GitHub Pages**.

## Cómo funciona

- **Datos**: `scripts/fetch-agenda.mjs` descarga y parsea la agenda a `src/data/agenda.json`
  en build time. Los horarios se guardan con el offset del evento (`America/Santo_Domingo`, UTC-4).
- **Tu selección**: se guarda en `localStorage` (por dispositivo). Marca ★ en cada charla.
- **Avisos**: notificación nativa vía Service Worker **mientras la PWA esté abierta**
  (aunque sea en segundo plano) + un **banner con cuenta regresiva** dentro de la app.
  > GitHub Pages es 100% estático: no hay push del servidor, así que no hay aviso con la app cerrada.

## Desarrollo

```bash
npm install
npm run fetch-agenda   # regenera src/data/agenda.json (opcional; ya viene commiteado)
npm run make-icons     # regenera los iconos PWA (opcional)
npm run dev            # http://localhost:3000   (sin basePath en dev)
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
   - refresca la agenda, hace el export estático y publica `./out`.

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

Si containers.day actualiza su agenda, corre `npm run fetch-agenda` y commitea el
`src/data/agenda.json` resultante (o simplemente vuelve a disparar el workflow: el
`prebuild` la refresca automáticamente).
