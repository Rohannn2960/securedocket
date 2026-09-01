const { generateSecret, generateURI, verifySync, generateSync } = require('otplib');
const QRCode = require('qrcode');
const logger = require('../config/logger');

const SERVICE_NAME = 'SecureDMS-SIH26190';

/**
 * TOTP Service for Two-Factor Authentication (RFC 6238 Standard)
 */
class TotpService {
  /**
   * Generate new base32 secret and QR Code Data URL for user onboarding
   * @param {string} email - User official email
   * @returns {Promise<{ secret: string, qrCodeDataUrl: string, otpauthUrl: string }>}
   */
  async generateSecret(email) {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: SERVICE_NAME,
      label: email,
      secret,
    });

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: {
          dark: '#0B0F19',
          light: '#FFFFFF',
        },
      });

      return {
        secret,
        qrCodeDataUrl,
        otpauthUrl,
      };
    } catch (error) {
      logger.error('Failed to generate QR Code for TOTP setup', { error, email });
      throw new Error('Failed to generate 2FA QR code');
    }
  }

  /**
   * Verify a 6-digit TOTP token against user secret
   * @param {string} token - 6-digit token code
   * @param {string} secret - User base32 TOTP secret
   * @returns {boolean}
   */
  verifyCode(token, secret) {
    if (!token || !secret) return false;
    try {
      const cleanToken = String(token).trim();
      const result = verifySync({
        token: cleanToken,
        secret,
        window: 1, // ±30s clock drift
      });
      return Boolean(result && (result.valid === true || result === true));
    } catch (error) {
      logger.warn('TOTP code verification error', { error: error.message });
      return false;
    }
  }

  /**
   * Generate current TOTP code (helper for testing)
   * @param {string} secret
   * @returns {string}
   */
  generateCode(secret) {
    return generateSync({ secret });
  }
}

module.exports = new TotpService();
