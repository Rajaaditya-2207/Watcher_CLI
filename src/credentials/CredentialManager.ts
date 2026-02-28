import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class CredentialManager {
  private credentialsPath: string;
  private algorithm = 'aes-256-cbc';
  private key: Buffer;

  constructor(projectPath: string = process.cwd()) {
    const watcherDir = path.join(projectPath, '.watcher');
    if (!fs.existsSync(watcherDir)) {
      fs.mkdirSync(watcherDir, { recursive: true });
    }

    this.credentialsPath = path.join(watcherDir, '.credentials');
    
    // Use machine-specific key (in production, use OS keychain)
    const machineId = this.getMachineId();
    this.key = crypto.scryptSync(machineId, 'salt', 32);
  }

  private getMachineId(): string {
    // Simple machine ID based on hostname and user
    // In production, use a more robust method or OS keychain
    const os = require('os');
    return `${os.hostname()}-${os.userInfo().username}`;
  }

  async storeApiKey(provider: string, apiKey: string): Promise<void> {
    try {
      const credentials = this.loadCredentials();
      credentials[provider] = this.encrypt(apiKey);
      this.saveCredentials(credentials);
    } catch (error: any) {
      throw new Error(`Failed to store API key: ${error.message}`);
    }
  }

  async getApiKey(provider: string): Promise<string | null> {
    try {
      const credentials = this.loadCredentials();
      const encrypted = credentials[provider];
      
      if (!encrypted) {
        return null;
      }

      return this.decrypt(encrypted);
    } catch (error) {
      return null;
    }
  }

  async deleteApiKey(provider: string): Promise<boolean> {
    try {
      const credentials = this.loadCredentials();
      delete credentials[provider];
      this.saveCredentials(credentials);
      return true;
    } catch {
      return false;
    }
  }

  async hasApiKey(provider: string): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return key !== null && key.length > 0;
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private loadCredentials(): Record<string, string> {
    if (!fs.existsSync(this.credentialsPath)) {
      return {};
    }

    try {
      const data = fs.readFileSync(this.credentialsPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private saveCredentials(credentials: Record<string, string>): void {
    fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
    
    // Set restrictive permissions (Unix-like systems)
    try {
      fs.chmodSync(this.credentialsPath, 0o600);
    } catch {
      // Windows doesn't support chmod, ignore
    }
  }
}
