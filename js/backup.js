// 暗号化バックアップ（AES-GCM 256bit / PBKDF2-SHA256）。ファイルは端末内に保存され、外部送信はしない。
import { kvAll, allEvents, allCheckups, replaceAll } from './db.js';

const ITER = 310000;
const b64 = (buf) => {
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(pass, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const blobToB64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

export async function exportEncrypted(pass) {
  const kv = await kvAll();
  const events = await allEvents();
  const checkups = await allCheckups();
  const cks = [];
  for (const c of checkups) {
    const { file, ...rest } = c;
    cks.push({ ...rest, file: file ? { type: file.type, data: await blobToB64(file) } : null });
  }
  const plain = new TextEncoder().encode(JSON.stringify({ kv, events, checkups: cks, exportedAt: Date.now() }));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pass, salt), plain);
  return new Blob([JSON.stringify({ app: 'MY LIFE', format: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(ct) })], { type: 'application/octet-stream' });
}

export async function importEncrypted(text, pass) {
  const env = JSON.parse(text);
  if (env.app !== 'MY LIFE') throw new Error('MY LIFE のバックアップファイルではありません');
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, await keyFrom(pass, unb64(env.salt)), unb64(env.data));
  } catch {
    throw new Error('パスワードが違うか、ファイルが壊れています');
  }
  const data = JSON.parse(new TextDecoder().decode(plain));
  data.checkups = (data.checkups || []).map((c) => ({ ...c, file: c.file ? new Blob([unb64(c.file.data)], { type: c.file.type }) : null }));
  await replaceAll(data);
}
