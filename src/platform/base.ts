import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * Base interface that all MCP config formats must implement.
 * This ensures type safety when accessing the servers collection.
 */
export interface MCPConfig {
  [serversKey: string]: Record<string, unknown>;
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

  async writeConfig(config: T): Promise<void> {
    const dir = dirname(this.configPath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Enable the server configuration.
   * @param baseUrl - Optional ArgoCD base URL
   * @param apiToken - Optional ArgoCD API token
   * @returns true if the server was already enabled, false if it was newly enabled
   */
  async enable(baseUrl?: URL, apiToken?: string): Promise<boolean> {
    const config = await this.readConfig();
    const serversKey = this.getServersKey();

    if (!config[serversKey]) {
      config[serversKey] = {} as T[Extract<keyof T, string>];
    }

    const servers = config[serversKey] as Record<string, S>;
    const wasEnabled = this.serverName in servers;
    const serverConfig = this.createServerConfig(baseUrl, apiToken);
    servers[this.serverName] = serverConfig;
    await this.writeConfig(config);
    return wasEnabled;
  }

  /**
   * Disable the server configuration.
   * @returns true if the server was enabled and has been disabled, false if it was not enabled
   */
  async disable(): Promise<boolean> {
    const config = await this.readConfig();
    const serversKey = this.getServersKey();

    if (!config[serversKey]) {
      // Nothing to disable if servers key doesn't exist
      return false;
    }

    const servers = config[serversKey] as Record<string, S>;
    const wasEnabled = this.serverName in servers;

    if (wasEnabled) {
      delete servers[this.serverName];
      await this.writeConfig(config);
    }

    return wasEnabled;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
