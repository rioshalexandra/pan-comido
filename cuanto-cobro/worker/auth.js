// Contraseñas y sesiones. Todo con Web Crypto, que viene incluido en Cloudflare Workers.

const ITERATIONS = 100000; // el máximo que permite Workers para PBKDF2
const enc = new TextEncoder();

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(bits)}`;
}

export async function checkPassword(password, stored) {
  const [, , saltHex, hashHex] = String(stored || '').split('$');
  if (!saltHex || !hashHex) return false;
  const bits = toHex(await derive(password, fromHex(saltHex)));
  // Comparación de tiempo constante
  let diff = bits.length ^ hashHex.length;
  for (let i = 0; i < Math.min(bits.length, hashHex.length); i++) diff |= bits.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

export function newToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

// Contraseña fácil de dictar por WhatsApp: palabra + 4 números (ej: "frutilla-4821")
const WORDS = ['frutilla', 'canela', 'vainilla', 'merengue', 'alfajor', 'budin', 'cookie', 'limon', 'chocolate', 'nuez', 'coco', 'manzana', 'naranja', 'caramelo', 'crema', 'almendra'];
export function friendlyPassword() {
  const n = crypto.getRandomValues(new Uint32Array(2));
  return `${WORDS[n[0] % WORDS.length]}-${String(1000 + (n[1] % 9000))}`;
}
