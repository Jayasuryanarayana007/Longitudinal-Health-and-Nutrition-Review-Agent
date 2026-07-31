import crypto from 'crypto';

/**
 * Hashes a plain-text password using SHA-256.
 * @param {string} password 
 * @returns {string} Hex-encoded password hash
 */
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
