const { encryptAES256GCM, decryptAES256GCM, decryptDocumentFields } = require('../src/utils/crypto');
const crypto = require('crypto');

describe('Field-Level Encryption', () => {
  const masterKeyHex = crypto.randomBytes(32).toString('hex');
  const plaintext = 'Secret Informant John Doe';

  it('should encrypt and decrypt correctly', () => {
    const encrypted = encryptAES256GCM(plaintext, masterKeyHex);
    expect(encrypted).toHaveProperty('isEncrypted', true);
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('authTag');
    expect(encrypted).toHaveProperty('ciphertext');

    const decrypted = decryptAES256GCM(encrypted, masterKeyHex);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption if authTag is tampered', () => {
    const encrypted = encryptAES256GCM(plaintext, masterKeyHex);
    // Tamper the auth tag
    const tamperedAuthTag = Buffer.from(encrypted.authTag, 'hex');
    tamperedAuthTag[0] ^= 1; // flip a bit
    encrypted.authTag = tamperedAuthTag.toString('hex');

    expect(() => {
      decryptAES256GCM(encrypted, masterKeyHex);
    }).toThrow(/Unsupported state or unable to authenticate data/);
  });

  it('should fail decryption if ciphertext is tampered', () => {
    const encrypted = encryptAES256GCM(plaintext, masterKeyHex);
    // Tamper the ciphertext
    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'hex');
    tamperedCiphertext[0] ^= 1; // flip a bit
    encrypted.ciphertext = tamperedCiphertext.toString('hex');

    expect(() => {
      decryptAES256GCM(encrypted, masterKeyHex);
    }).toThrow(/Unsupported state or unable to authenticate data/);
  });

  it('should successfully decryptDocumentFields', () => {
    const doc = {
      extractedFields: {
        complainant: {
          field: 'complainant',
          isEncrypted: true,
          value: encryptAES256GCM('Jane Doe', masterKeyHex),
          aiValue: encryptAES256GCM('Jane Doe', masterKeyHex),
          humanValue: null,
          confidence: 0.99
        },
        nonSensitive: {
          field: 'nonSensitive',
          value: 'Public Info',
          aiValue: 'Public Info'
        }
      }
    };

    const decryptedDoc = decryptDocumentFields(doc, masterKeyHex);
    
    expect(decryptedDoc.extractedFields.complainant.isEncrypted).toBe(false);
    expect(decryptedDoc.extractedFields.complainant.value).toBe('Jane Doe');
    expect(decryptedDoc.extractedFields.complainant.aiValue).toBe('Jane Doe');
    expect(decryptedDoc.extractedFields.complainant.humanValue).toBe(null);
    expect(decryptedDoc.extractedFields.nonSensitive.value).toBe('Public Info');
  });
});
