import { join } from 'path';
import { homedir } from 'os';
import { ConfigManager, MCPConfig } from '../base.js';

interface ClaudeServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Claude-specific key
const serversKey = 'mcpServers';

interface ClaudeConfig extends MCPConfig {
  [serversKey]: Record<string, ClaudeServerConfig>;
}

export class ClaudeConfigManager extends ConfigManager<ClaudeConfig, ClaudeServerConfig> {
  protected configPath: string;

  constructor() {
    super();
    const home = homedir();
    const platform = process.platform;

    if (platform === 'darwin') {
      this.configPath = join(
        home,
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      );
    } else if (platform === 'win32') {
      this.configPath = join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    } else if (platform === 'linux') {
      this.configPath = join(home, '.config', 'Claude', 'claude_desktop_config.json');
    } else throw new Error(`platform not supported: ${platform}`);
  }

  protected getDefaultConfig(): ClaudeConfig {
    return { mcpServers: {} };
  }

  protected getServersKey() {
    return serversKey;
  }

  protected createServerConfig(baseUrl?: URL, apiToken?: string): ClaudeServerConfig {
    const serverConfig: ClaudeServerConfig = {
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
