import { join } from 'path';
import { homedir } from 'os';
import { ConfigManager, MCPConfig } from '../base.js';

interface VSCodeServerConfig {
  type: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const serversKey = 'servers';

interface VSCodeConfig extends MCPConfig {
  [serversKey]: Record<string, VSCodeServerConfig>;
}

export class VSCodeConfigManager extends ConfigManager<VSCodeConfig, VSCodeServerConfig> {
  protected configPath: string;

  constructor(workspace?: boolean) {
    super();

    if (workspace) {
      this.configPath = join(process.cwd(), '.vscode', 'mcp.json');
    } else {
      const home = homedir();
      const platform = process.platform;

      if (platform === 'darwin') {
        this.configPath = join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
      } else if (platform === 'win32') {
        this.configPath = join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json');
      } else if (platform === 'linux') {
        this.configPath = join(home, '.config', 'Code', 'User', 'mcp.json');
      } else throw new Error(`platform not supported: ${platform}`);
    }
  }

  protected getDefaultConfig(): VSCodeConfig {
    return { servers: {} };
  }

  protected getServersKey() {
    return serversKey;
  }

  protected createServerConfig(baseUrl?: URL, apiToken?: string): VSCodeServerConfig {
    const serverConfig: VSCodeServerConfig = {
      type: 'stdio',
      command: 'npx',
      args: ['argocd-mcp@latest', 'stdio']
    };

    if (baseUrl || apiToken) {
      serverConfig.env = {};

      if (baseUrl) {
        serverConfig.env.ARGOCD_BASE_URL = baseUrl.toString();
      }

      if (apiToken) {
        serverConfig.env.ARGOCD_API_TOKEN = apiToken;
      }
    }

    return serverConfig;
  }
}
