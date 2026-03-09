import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const GLOBAL_DIR = path.join(os.homedir(), '.watcher');

interface KeyEntry {
  alias: string;
  encrypted: string;
}

// Stored format: { provider: { alias: encryptedKey, ... }, ... }
type CredentialStore = Record<string, Record<string, string>>;

export class CredentialManager {
  private credentialsPath: string;
  private algorithm = 'aes-256-cbc';
  private key: Buffer;

  constructor(_projectPath: string = process.cwd()) {
    if (!fs.existsSync(GLOBAL_DIR)) {
      fs.mkdirSync(GLOBAL_DIR, { recursive: true });
    }
    this.credentialsPath = path.join(GLOBAL_DIR, '.credentials');

    // Use machine-specific key (in production, use OS keychain)
    const machineId = this.getMachineId();
    this.key = crypto.scryptSync(machineId, 'salt', 32);
  }

  private getMachineId(): string {
    return `${os.hostname()}-${os.userInfo().username}`;
  }

  /**
   * Store an API key with a named alias for a provider.
   * If no alias is given, defaults to 'default'.
   */
  async storeApiKey(provider: string, apiKey: string, alias: string = 'default'): Promise<void> {
    try {
      const store = this.loadCredentials();
      if (!store[provider]) {
        store[provider] = {};
      }
      store[provider][alias] = this.encrypt(apiKey);
      this.saveCredentials(store);
    } catch (error: any) {
      throw new Error(`Failed to store API key: ${error.message}`);
    }
  }

  /**
   * Get an API key by provider and alias. Falls back to 'default' alias.
   * Also supports the old flat format for backward compatibility.
   */
  async getApiKey(provider: string, alias: string = 'default'): Promise<string | null> {
    try {
      const raw = this.loadRawCredentials();

      // New nested format
      if (raw[provider] && typeof raw[provider] === 'object' && !Array.isArray(raw[provider])) {
        const providerKeys = raw[provider] as Record<string, string>;
        const encrypted = providerKeys[alias];
        if (encrypted) {
          return this.decrypt(encrypted);
        }
        // If alias not found but 'default' exists, fall back
        if (alias !== 'default' && providerKeys['default']) {
          return this.decrypt(providerKeys['default']);
        }
        return null;
      }

      // Old flat format: provider -> encryptedString (backward compat)
      if (typeof raw[provider] === 'string') {
        return this.decrypt(raw[provider] as string);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a specific key alias for a provider, or all keys for a provider.
   */
  async deleteApiKey(provider: string, alias?: string): Promise<boolean> {
    try {
      const store = this.loadCredentials();
      if (!store[provider]) return false;

      if (alias) {
        delete store[provider][alias];
        if (Object.keys(store[provider]).length === 0) {
          delete store[provider];
        }
      } else {
        delete store[provider];
      }

      this.saveCredentials(store);
      return true;
    } catch {
      return false;
    }
  }

  async hasApiKey(provider: string, alias: string = 'default'): Promise<boolean> {
    const key = await this.getApiKey(provider, alias);
    return key !== null && key.length > 0;
  }

  /**
   * List all saved key aliases for a provider.
   */
  async listKeyAliases(provider: string): Promise<string[]> {
    try {
      const raw = this.loadRawCredentials();
      if (raw[provider] && typeof raw[provider] === 'object') {
        return Object.keys(raw[provider] as Record<string, string>);
      }
      // Old flat format
      if (typeof raw[provider] === 'string') {
        return ['default'];
      }
      return [];
    } catch {
      return [];
    }
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

  private loadRawCredentials(): Record<string, any> {
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

  private loadCredentials(): CredentialStore {
    const raw = this.loadRawCredentials();
    const store: CredentialStore = {};

    for (const [provider, value] of Object.entries(raw)) {
      if (typeof value === 'string') {
        // Migrate old flat format to nested
        store[provider] = { default: value };
      } else if (typeof value === 'object' && value !== null) {
        store[provider] = value as Record<string, string>;
      }
    }

    return store;
  }

  private saveCredentials(credentials: CredentialStore): void {
    fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');

    // Set restrictive permissions (Unix-like systems)
    try {
      fs.chmodSync(this.credentialsPath, 0o600);
    } catch {
      // Windows doesn't support chmod, ignore
    }
  }
}
