import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * Base interface that all MCP config formats must implement.
 * This ensures type safety when accessing the servers collection.
 */
export interface MCPConfig {
  [serversKey: string]: Record<string, unknown>;
}

const isObject = (obj: unknown): boolean => {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj);
};

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
  protected abstract getServersKey(): Extract<keyof T, string>;
  protected abstract createServerConfig(baseUrl: string, apiToken: string): S;

  /**
   * ReadConfig preserves all existing properties in the config file.
   * @returns config casted to type T
   */
  async readConfig(): Promise<T> {
    try {
      const content = await readFile(this.configPath, 'utf-8');

      // Parse as unknown first to ensure we preserve all properties
      const parsed = JSON.parse(content) as unknown;

      if (!isObject(parsed)) {
        // Overwrite with object
        return {} as T;
      }

      return parsed as T;
    } catch (error) {
      // File does not exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {} as T;
      }

      // Invalid JSON
      if (error instanceof SyntaxError) {
        // Overwrite with object
        return {} as T;
      }

      throw error;
    }
  }

  async writeConfig(config: T): Promise<void> {
    const dir = dirname(this.configPath);
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write config to ${this.configPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Enable the server configuration.
   * @param baseUrl - Optional ArgoCD base URL
   * @param apiToken - Optional ArgoCD API token
   * @returns true if the server was already enabled, false if it was newly enabled
   */
  async enable(baseUrl: string, apiToken: string): Promise<boolean> {
    const config = await this.readConfig();
    const serversKey = this.getServersKey();

    // Ensure servers object exists
    const obj = config[serversKey];
    if (!isObject(obj)) {
      // Overwrite with object
      (config[serversKey] as Record<string, S>) = {};
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

    const obj = config[serversKey];
    if (!isObject(obj)) {
      // Nothing to disable if servers object doesn't exist
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
