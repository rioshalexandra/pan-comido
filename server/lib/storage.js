import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

function safeRoot() {
  return path.resolve(config.uploadDir);
}

export async function ensureUploadDir() {
  await fs.mkdir(safeRoot(), { recursive: true });
}

export async function saveStoredFile({ entityType, entityId, originalName, mimeType, buffer }) {
  const ext = extensionFor(originalName, mimeType);
  const key = `${entityType}/${entityId}/${crypto.randomUUID()}${ext}`;
  const full = path.join(safeRoot(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return key;
}

export async function readStoredFile(storageKey) {
  return fs.readFile(path.join(safeRoot(), storageKey));
}

export async function removeStoredFile(storageKey) {
  if (!storageKey) return;
  try {
    await fs.unlink(path.join(safeRoot(), storageKey));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function extensionFor(originalName, mimeType) {
  const fromName = path.extname(String(originalName || '')).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'application/pdf': '.pdf',
    'text/csv': '.csv',
    'text/plain': '.txt',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return map[String(mimeType || '').toLowerCase()] || '';
}
