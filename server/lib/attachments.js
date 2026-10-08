import path from 'path';
import { query } from '../db/pool.js';
import { httpError } from './helpers.js';
import { readStoredFile, removeStoredFile, saveStoredFile } from './storage.js';

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']);
const FILE_EXT = new Set([
  ...PHOTO_EXT,
  '.pdf',
  '.csv',
  '.txt',
  '.xls',
  '.xlsx',
  '.doc',
  '.docx',
]);

const PHOTO_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const FILE_MIME = new Set([
  ...PHOTO_MIME,
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function isPhoto({ mimeType, originalName }) {
  const mime = String(mimeType || '').toLowerCase();
  return PHOTO_MIME.has(mime) || PHOTO_EXT.has(path.extname(String(originalName || '')).toLowerCase());
}

function allowed({ mimeType, originalName, photosOnly }) {
  const mime = String(mimeType || '').toLowerCase();
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (photosOnly) return PHOTO_MIME.has(mime) || PHOTO_EXT.has(ext);
  return FILE_MIME.has(mime) || FILE_EXT.has(ext);
}

export async function listAttachments(entityType, entityId) {
  const result = await query(
    `SELECT id, entity_type, entity_id, kind, original_name, mime_type, size_bytes, created_at
     FROM attachments
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY id`,
    [entityType, entityId]
  );
  return result.rows;
}

export async function createAttachment({ entityType, entityId, file, userId, photosOnly }) {
  if (!file?.buffer?.length) throw httpError(400, 'Elegí un archivo');
  const originalName = String(file.originalname || 'archivo').slice(0, 180);
  const mimeType = String(file.mimetype || 'application/octet-stream');
  if (!allowed({ mimeType, originalName, photosOnly })) {
    throw httpError(400, photosOnly ? 'Solo se permiten fotos' : 'Tipo de archivo no permitido');
  }
  await assertEntity(entityType, entityId);
  const kind = isPhoto({ mimeType, originalName }) ? 'photo' : 'file';
  const storageKey = await saveStoredFile({
    entityType,
    entityId,
    originalName,
    mimeType,
    buffer: file.buffer,
  });
  try {
    const result = await query(
      `INSERT INTO attachments (entity_type, entity_id, kind, original_name, mime_type, size_bytes, storage_key, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, entity_type, entity_id, kind, original_name, mime_type, size_bytes, created_at`,
      [entityType, entityId, kind, originalName, mimeType, file.size || file.buffer.length, storageKey, userId || null]
    );
    return result.rows[0];
  } catch (err) {
    await removeStoredFile(storageKey);
    throw err;
  }
}

export async function loadAttachmentFile(id) {
  const result = await query('SELECT * FROM attachments WHERE id = $1', [id]);
  if (!result.rowCount) throw httpError(404, 'Archivo no encontrado');
  const row = result.rows[0];
  const data = await readStoredFile(row.storage_key);
  return { row, data };
}

export async function deleteAttachment(id) {
  const result = await query('DELETE FROM attachments WHERE id = $1 RETURNING storage_key', [id]);
  if (!result.rowCount) throw httpError(404, 'Archivo no encontrado');
  await removeStoredFile(result.rows[0].storage_key);
}

export async function pullAttachments(client, entityType, entityId) {
  const result = await client.query(
    'DELETE FROM attachments WHERE entity_type = $1 AND entity_id = $2 RETURNING storage_key',
    [entityType, entityId]
  );
  return result.rows.map((row) => row.storage_key);
}

async function assertEntity(entityType, entityId) {
  if (entityType === 'product') {
    const found = await query('SELECT id FROM products WHERE id = $1', [entityId]);
    if (!found.rowCount) throw httpError(404, 'Producto no encontrado');
    return;
  }
  if (entityType === 'purchase') {
    const found = await query('SELECT id FROM purchases WHERE id = $1', [entityId]);
    if (!found.rowCount) throw httpError(404, 'Compra no encontrada');
    return;
  }
  throw httpError(400, 'Tipo de adjunto inválido');
}
