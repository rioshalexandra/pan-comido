import { Router } from 'express';
import { changePassword, login, logout, readToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const data = await login(username, password);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  res.json({ user: req.user });
});

router.post('/password', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    // El usuario de la demo es compartido: si alguien le cambia la clave, nadie más puede entrar
    if (req.user.username === 'demo') {
      return res.status(403).json({ error: 'En la demo no se puede cambiar la contraseña' });
    }
    const { currentPassword, newPassword } = req.body || {};
    await changePassword(req.user.id, currentPassword, newPassword, readToken(req));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await logout(readToken(req) || req.token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
