// Mete los archivos de dist/ dentro del Worker (para publicar sin la subida de "assets" de Cloudflare)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files['/' + relative('dist', p)] = { type: types[extname(p)] || 'application/octet-stream', body: readFileSync(p).toString('base64') };
  }
};
walk('dist');
writeFileSync('worker/embedded-assets.js', `export const files = ${JSON.stringify(files)};\n`);
console.log(`Embebidos ${Object.keys(files).length} archivos`);
