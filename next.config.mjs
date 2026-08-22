/**
 * Next.js config para export estático desplegado en GitHub Pages (project page).
 *
 * En un "project page" el sitio vive en https://<usuario>.github.io/<repo>/, así que
 * necesitamos basePath/assetPrefix = "/<repo>". Se puede sobreescribir con la env
 * NEXT_PUBLIC_BASE_PATH (útil para dev local, dominio propio o user/org page => "").
 */
const isProd = process.env.NODE_ENV === 'production';
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (isProd ? '/containers-day-agenda' : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    // Requerido en export estático: no hay optimizador de imágenes en runtime.
    unoptimized: true,
  },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
