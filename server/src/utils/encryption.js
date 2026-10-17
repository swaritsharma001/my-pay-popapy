const crypto = require('crypto');
const { getRequiredEnv } = require('../config');

function getEncryptionKey() {
  const raw = getRequiredEnv('ENCRYPTION_KEY').trim();
  let key;
  if (/^[a-f\d]{64}$/i.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must encode exactly 32 bytes as hex or base64');
  }
  return key;
}

function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptText(encrypted) {
  const [version, ivText, tagText, ciphertextText] = String(encrypted).split(':');
  if (version !== 'v1' || !ivText || !tagText || ciphertextText === undefined) {
    throw new Error('Encrypted value has an unsupported format');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivText, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encryptText, decryptText };
