import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';

const SESSION_DAYS = 14;

export async function login(username, password) {
  const result = await query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user) {
    const err = new Error('Usuario o contraseña inválidos');
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  // Un empleado dado de baja no puede entrar más
  if (!ok || user.active === false) {
    const err = new Error('Usuario o contraseña inválidos');
    err.status = 401;
    throw err;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [
    user.id,
    token,
    expires,
  ]);
  return { token, user: publicUser(user), expiresAt: expires.toISOString() };
}

export async function logout(token) {
  if (token) {
    await query('DELETE FROM sessions WHERE token = $1', [token]);
  }
}

export async function userFromToken(token) {
  if (!token) return null;
  const result = await query(
    `
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now() AND u.active = true
    `,
    [token]
  );
  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role || 'admin',
  };
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = await userFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

export function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Solo para administración: configuración, empleados, compras, proveedores, etc.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Esta acción es solo para administración' });
  }
  next();
}

export function isAdmin(req) {
  return req.user?.role === 'admin';
}
