const crypto = require('crypto');

/**
 * Calculate SHA-256 hash of a Buffer or String
 * @param {Buffer|string} data
 * @returns {string} 64-character hexadecimal SHA-256 hash
 */
function calculateSha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Compute Cryptographic Audit Log Chained Hash
 * Combines previous block hash + structured log payload to create tamper-evident chain
 * @param {string} previousHash - Hex hash of previous audit log (or GENESIS_HASH)
 * @param {object} payload - Audit log contents
 * @returns {string} SHA-256 hash
 */
const GENESIS_HASH = '0'.repeat(64);

function calculateAuditHash(previousHash, payload) {
  const normalizedPrev = previousHash || GENESIS_HASH;
  const canonicalPayload = JSON.stringify(payload, Object.keys(payload).sort());
  return calculateSha256(`${normalizedPrev}:${canonicalPayload}`);
}

/**
 * Timing-safe string comparison to prevent timing attacks on hashes/tokens
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  calculateSha256,
  calculateAuditHash,
  timingSafeEqual,
  GENESIS_HASH,
};
