// Entrada alternativa: sirve la app (dist/) desde el mismo Worker. Ver wrangler.embedded.jsonc
import app from './index.js';
import { files } from './embedded-assets.js';

const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
    // /presentacion sirve presentacion.html; todo lo demás que no es un archivo, la app
    const file = files[pathname] || files[`${pathname.replace(/\/$/, '')}.html`] || files['/index.html'];
    const cache = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    return new Response(decode(file.body), { headers: { 'content-type': file.type, 'cache-control': cache } });
  },
};
