const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;

// In-memory store for decrypted user keys (cleared on server restart)
const keyStore = new Map();

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

function generateDataKey() {
  return crypto.randomBytes(KEY_LENGTH);
}

function encryptDataKey(dataKey, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const kek = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);
  const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted_key: Buffer.concat([salt, iv, tag, encrypted]).toString('base64'),
  };
}

function decryptDataKey(encryptedKeyB64, password) {
  const buf = Buffer.from(encryptedKeyB64, 'base64');
  const salt = buf.subarray(0, SALT_LENGTH);
  const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const kek = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function encrypt(text, dataKey) {
  if (!text || !dataKey) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(encryptedB64, dataKey) {
  if (!encryptedB64 || !dataKey) return encryptedB64;
  try {
    const buf = Buffer.from(encryptedB64, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    // Return as-is if decryption fails (e.g. unencrypted legacy data)
    return encryptedB64;
  }
}

// Encrypt sensitive transaction fields
function encryptTransaction(tx, dataKey) {
  if (!dataKey) return tx;
  return {
    ...tx,
    description: tx.description ? encrypt(tx.description, dataKey) : tx.description,
    merchant: tx.merchant ? encrypt(tx.merchant, dataKey) : (tx.merchant === undefined ? null : tx.merchant),
    notes: tx.notes ? encrypt(tx.notes, dataKey) : (tx.notes === undefined ? null : tx.notes),
  };
}

// Decrypt sensitive transaction fields
function decryptTransaction(tx, dataKey) {
  if (!dataKey || !tx) return tx;
  return {
    ...tx,
    description: decrypt(tx.description, dataKey),
    merchant: tx.merchant ? decrypt(tx.merchant, dataKey) : tx.merchant,
    notes: tx.notes ? decrypt(tx.notes, dataKey) : tx.notes,
  };
}

// Encrypt sensitive account fields
function encryptAccount(acct, dataKey) {
  if (!dataKey) return acct;
  return {
    ...acct,
    institution: acct.institution ? encrypt(acct.institution, dataKey) : (acct.institution === undefined ? null : acct.institution),
    account_number_last4: acct.account_number_last4 ? encrypt(acct.account_number_last4, dataKey) : (acct.account_number_last4 === undefined ? null : acct.account_number_last4),
  };
}

// Decrypt sensitive account fields
function decryptAccount(acct, dataKey) {
  if (!dataKey || !acct) return acct;
  return {
    ...acct,
    institution: acct.institution ? decrypt(acct.institution, dataKey) : acct.institution,
    account_number_last4: acct.account_number_last4 ? decrypt(acct.account_number_last4, dataKey) : acct.account_number_last4,
  };
}

function storeKey(userId, dataKey) {
  keyStore.set(userId, dataKey);
}

function getKey(userId) {
  return keyStore.get(userId);
}

function removeKey(userId) {
  keyStore.delete(userId);
}

module.exports = {
  generateDataKey,
  encryptDataKey,
  decryptDataKey,
  encrypt,
  decrypt,
  encryptTransaction,
  decryptTransaction,
  encryptAccount,
  decryptAccount,
  storeKey,
  getKey,
  removeKey,
};
