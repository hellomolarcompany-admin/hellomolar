import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encrypt a JSON-serializable value with AES-256-GCM.
 *
 * Output buffer layout: [IV (12 bytes)][AUTH TAG (16 bytes)][CIPHERTEXT].
 * The key must be a 32-byte key provided as a base64-encoded string.
 */
export function encryptJsonToBuffer(data: unknown, base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('INTAKE_ENC_KEY moet een base64-encoded sleutel van 32 bytes zijn (AES-256).');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypt a buffer produced by encryptJsonToBuffer and parse it as JSON.
 *
 * Expects the buffer layout: [IV (12)][AUTH TAG (16)][CIPHERTEXT].
 * Returns the parsed JSON value.
 */
export function decryptBufferToJson(buf: Buffer, base64Key: string): unknown {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Ongeldige sleutel');
  if (buf.length < 28) throw new Error('Buffer te kort');

  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
