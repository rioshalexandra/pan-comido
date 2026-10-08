import { Router } from 'express';
import multer from 'multer';
import { httpError } from '../lib/helpers.js';
import { createAttachment, deleteAttachment, loadAttachmentFile } from '../lib/attachments.js';
import { userFromToken } from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const entityType = String(req.body?.entityType || '').trim();
    const entityId = Number(req.body?.entityId);
    if (!entityId) throw httpError(400, 'Falta el comprobante o producto');
    const photosOnly = entityType === 'product' || req.body?.photosOnly === 'true';
    const row = await createAttachment({
      entityType,
      entityId,
      file: req.file,
      userId: req.user?.id,
      photosOnly,
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : String(req.query.token || '');
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { row, data } = await loadAttachmentFile(req.params.id);
    const inline = row.kind === 'photo' || row.mime_type === 'application/pdf';
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(row.original_name)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteAttachment(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
