import { join } from 'path';
import { homedir } from 'os';
import { ConfigManager, MCPConfig } from '../base.js';

interface CursorServerConfig {
  type: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Cursor-specific key
const serversKey = 'mcpServers';

interface CursorConfig extends MCPConfig {
  [serversKey]: Record<string, CursorServerConfig>;
}

export class CursorConfigManager extends ConfigManager<CursorConfig, CursorServerConfig> {
  protected configPath: string;

  constructor(workspace?: boolean) {
    super();

    if (workspace) {
      this.configPath = join(process.cwd(), '.cursor', 'mcp.json');
    } else {
      const home = homedir();
      const platform = process.platform;

      switch (platform) {
        case 'darwin':
          this.configPath = join(home, '.cursor', 'mcp.json');
          break;
        case 'win32':
          this.configPath = join(home, '.cursor', 'mcp.json');
          break;
        case 'linux':
          this.configPath = join(home, '.cursor', 'mcp.json');
          break;
        default:
          throw new Error(`platform not supported: ${platform}`);
      }
    }
  }

  protected getServersKey() {
    return serversKey;
  }

  protected createServerConfig(baseUrl: string, apiToken: string): CursorServerConfig {
    const serverConfig: CursorServerConfig = {
      type: 'stdio',
      command: 'npx',
      args: ['argocd-mcp@latest', 'stdio'],
      env: {
        ARGOCD_BASE_URL: baseUrl,
        ARGOCD_API_TOKEN: apiToken
      }
    };

    return serverConfig;
  }
}
