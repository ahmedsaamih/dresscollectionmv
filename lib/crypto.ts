import crypto from 'crypto';

/**
 * Symmetric encryption for secrets we store in the database (Google Drive
 * refresh token, Telegram bot token, Resend/MsgOwl keys — all in `Setting`).
 * A fixed dev key keeps local development working without any setup, but
 * it's only used when NODE_ENV is explicitly 'development' — every other
 * environment (production, staging, unset) throws if SETTINGS_ENCRYPTION_KEY
 * isn't set, rather than silently falling back to a publicly-visible key.
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const DEV_KEY = Buffer.alloc(32, 'many-maldives-dev-key');

function encryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    // Allowlist, not a blocklist: only fall back to the fixed dev key in an
    // explicit local-dev environment. Any other NODE_ENV (staging, test,
    // unset, a typo) throws instead of silently encrypting secrets with a
    // publicly-visible key.
    if (process.env.NODE_ENV === 'development') {
      return DEV_KEY;
    }
    throw new Error('SETTINGS_ENCRYPTION_KEY is not set.');
  }
  const key = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
  if (key.length !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (64 hex chars, or base64).');
  }
  return key;
}

/** Encrypts a secret for storage. Output: `enc:v1:<iv>:<authTag>:<ciphertext>` (all base64). */
export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a value produced by encryptSecret. A value without the `enc:v1:`
 * prefix predates this change and is a plain-text secret from before
 * encryption-at-rest was added — returned as-is so already-connected
 * integrations keep working; it's re-encrypted the next time it's written.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  const key = encryptionKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
