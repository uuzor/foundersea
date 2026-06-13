import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Encrypted wallet key manager
 * Supports both raw private keys and encrypted keystore files
 */
@Injectable()
export class EncryptedWalletService {
  private readonly logger = new Logger(EncryptedWalletService.name);
  
  /**
   * Decrypt an encrypted private key using AES-256-GCM
   * Format: ethereum keystore v3 or custom encrypted
   */
  decryptPrivateKey(encryptedKey: string, password: string): string {
    try {
      // Check if it's a JSON keystore (ethers.js format)
      if (encryptedKey.trim().startsWith('{')) {
        return this.decryptKeystoreV3(encryptedKey, password);
      }
      
      // Check if it's already a raw key (starts with 0x)
      if (encryptedKey.startsWith('0x') && encryptedKey.length === 66) {
        this.logger.warn('Using raw private key - consider using encrypted format for production');
        return encryptedKey;
      }
      
      // Check if it's our custom encrypted format
      if (encryptedKey.includes(':')) {
        return this.decryptCustomFormat(encryptedKey, password);
      }
      
      throw new Error('Unknown key format');
    } catch (error) {
      this.logger.error('Failed to decrypt private key:', error);
      throw error;
    }
  }
  
  /**
   * Encrypt a private key for storage
   * Returns encrypted string in custom format: iv:encryptedData:authTag:algorithm
   */
  encryptPrivateKey(privateKey: string, password: string): string {
    const algorithm = 'aes-256-gcm';
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // Derive key from password using PBKDF2
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedData = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Format: salt:iv:authTag:encryptedData (all base64)
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encryptedData.toString('base64'),
    ].join(':');
  }
  
  /**
   * Decrypt our custom encrypted format
   */
  private decryptCustomFormat(encryptedData: string, password: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted key format');
    }
    
    const [saltB64, ivB64, authTagB64, encryptedB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encryptedBuffer = Buffer.from(encryptedB64, 'base64');
    
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return '0x' + decrypted.toString('hex');
  }
  
  /**
   * Decrypt ethers.js keystore v3 format
   */
  private decryptKeystoreV3(keystoreJson: string, password: string): string {
    const keystore = JSON.parse(keystoreJson);
    
    if (keystore.version !== 3) {
      throw new Error('Only keystore v3 supported');
    }
    
    const salt = Buffer.from(keystore.crypto.salt, 'hex');
    const iv = Buffer.from(keystore.crypto.cipherparams.iv, 'hex');
    const encrypted = Buffer.from(keystore.crypto.ciphertext, 'hex');
    const authTag = Buffer.from(keystore.crypto.cipherparams.iv, 'hex').slice(0, 16); // Simplified
    
    // Derive key
    const derivedKey = crypto.pbkdf2Sync(password, salt, keystore.crypto.kdfparams.iterations || 262144, 32, 'sha256');
    
    // Decrypt
    const decipher = crypto.createDecipheriv('aes-128-ctr', derivedKey.slice(0, 16), iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return '0x' + decrypted.toString('hex');
  }
  
  /**
   * Validate that a private key is properly formatted
   */
  validatePrivateKey(privateKey: string): boolean {
    if (!privateKey.startsWith('0x')) return false;
    if (privateKey.length !== 66) return false;
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) return false;
    return true;
  }
  
  /**
   * Hash a password for comparison (not for key derivation)
   */
  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
  
  /**
   * Verify a password against a hash
   */
  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }
}
