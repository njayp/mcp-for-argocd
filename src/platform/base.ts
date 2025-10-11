import { readFile, writeFile, mkdir, copyFile, stat } from 'fs/promises';
import { dirname, join } from 'path';

/**
 * Base interface that all MCP config formats must implement.
 * This ensures type safety when accessing the servers collection.
 */
export interface MCPConfig {
  [serversKey: string]: Record<string, unknown>;
}

export interface ConfigChangeResult {
  wasEnabled: boolean;
  backupPath?: string | null;
}

/**
 * Abstract base class for managing MCP server configurations across different platforms.
 *
 * This implementation preserves all unknown properties in the config file to avoid data loss
 * when modifying only the server configuration.
 *
 * @template T - The specific config type for the platform (must extend MCPConfig)
 * @template S - The server configuration type for the platform
 */
export abstract class ConfigManager<T extends MCPConfig, S = unknown> {
  protected readonly serverName = 'argocd-mcp-stdio';

  protected abstract configPath: string;
  protected abstract getDefaultConfig(): T;
  protected abstract getServersKey(): Extract<keyof T, string>;
  protected abstract createServerConfig(baseUrl?: URL, apiToken?: string): S;

  /**
   * ReadConfig preserves all existing properties in the config file, then
   * @returns config casted to type T
   */
  async readConfig(): Promise<T> {
    try {
      const content = await readFile(this.configPath, 'utf-8');

      // Parse as unknown first to ensure we preserve all properties
      const parsed = JSON.parse(content) as unknown;

      // Ensure parsed is an object
      if (Object.prototype.toString.call(parsed) !== '[object Object]') {
        throw new Error(`Config file ${this.configPath} contains invalid data: expected an object`);
      }

      return parsed as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.getDefaultConfig();
      }

      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in config file ${this.configPath}: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Create a backup of the config file with timestamp
   * @returns the path to the backup file, or null if no backup was created
   */
  async createBackup(): Promise<string | null> {
    try {
      await stat(this.configPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = dirname(this.configPath);
    const backupPath = join(dir, `mcp.backup.${timestamp}.json`);

    await copyFile(this.configPath, backupPath);
    return backupPath;
  }

  async writeConfig(config: T): Promise<string | null> {
    const dir = dirname(this.configPath);
    await mkdir(dir, { recursive: true });
    const backupPath = await this.createBackup();
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    return backupPath;
  }

  /**
   * Enable the server configuration.
   * @param baseUrl - Optional ArgoCD base URL
   * @param apiToken - Optional ArgoCD API token
   * @returns ConfigChangeResult with wasEnabled flag and backup path
   */
  async enable(baseUrl?: URL, apiToken?: string): Promise<ConfigChangeResult> {
    const config = await this.readConfig();
    const serversKey = this.getServersKey();

    if (!config[serversKey]) {
      config[serversKey] = {} as T[Extract<keyof T, string>];
    }

    const servers = config[serversKey] as Record<string, S>;
    const wasEnabled = this.serverName in servers;
    const serverConfig = this.createServerConfig(baseUrl, apiToken);
    servers[this.serverName] = serverConfig;
    const backupPath = await this.writeConfig(config);
    return { wasEnabled, backupPath };
  }

  /**
   * Disable the server configuration.
   * @returns ConfigChangeResult with wasEnabled flag and backup path
   */
  async disable(): Promise<ConfigChangeResult> {
    const config = await this.readConfig();
    const serversKey = this.getServersKey();

    if (!config[serversKey]) {
      return { wasEnabled: false };
    }

    const servers = config[serversKey] as Record<string, S>;
    const wasEnabled = this.serverName in servers;

    if (wasEnabled) {
      delete servers[this.serverName];
      const backupPath = await this.writeConfig(config);
      return { wasEnabled, backupPath };
    }

    return { wasEnabled, backupPath };
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
