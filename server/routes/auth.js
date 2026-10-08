import { Router } from 'express';
import { login, logout, readToken } from '../middleware/auth.js';

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

router.post('/logout', async (req, res, next) => {
  try {
    await logout(readToken(req) || req.token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
