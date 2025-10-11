import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  connectStdioTransport,
  connectHttpTransport,
  connectSSETransport
} from '../server/transport.js';
import { ClaudeConfigManager } from '../platform/claude/config.js';
import { VSCodeConfigManager } from '../platform/vscode/config.js';

export const cmd = () => {
  const exe = yargs(hideBin(process.argv));

  exe.command(
    'stdio',
    'Start ArgoCD MCP server using stdio.',
    () => {},
    () => connectStdioTransport()
  );

  exe.command(
    'sse',
    'Start ArgoCD MCP server using SSE.',
    (yargs) => {
      return yargs.option('port', {
        type: 'number',
        default: 3000
      });
    },
    ({ port }) => connectSSETransport(port)
  );

  exe.command(
    'http',
    'Start ArgoCD MCP server using Http Stream.',
    (yargs) => {
      return yargs.option('port', {
        type: 'number',
        default: 3000
      });
    },
    ({ port }) => connectHttpTransport(port)
  );

  const stringToURL = (url: string) => {
    return new URL(url);
  };

  exe.command('claude', 'Manage Claude Desktop integration', (yargs) => {
    return yargs
      .command(
        'enable',
        'Enable ArgoCD MCP server in Claude Desktop',
        (yargs) => {
          return yargs
            .option('url', {
              type: 'string',
              description: 'ArgoCD base URL',
              coerce: stringToURL,
              demandOption: true
            })
            .option('token', {
              type: 'string',
              description: 'ArgoCD API token',
              demandOption: true
            });
        },
        async ({ url, token }) => {
          const manager = new ClaudeConfigManager();
          try {
            const wasEnabled = await manager.enable(url, token);
            if (wasEnabled) {
              console.log('✓ ArgoCD MCP server configuration updated in Claude Desktop');
            } else {
              console.log('✓ ArgoCD MCP server enabled in Claude Desktop');
            }
            console.log(`Configuration file: ${manager.getConfigPath()}`);
          } catch (error) {
            console.error('Failed to enable ArgoCD MCP server:', error);
            process.exit(1);
          }
        }
      )
      .command(
        'disable',
        'Disable ArgoCD MCP server in Claude Desktop',
        () => {},
        async () => {
          const manager = new ClaudeConfigManager();
          try {
            const wasEnabled = await manager.disable();
            if (wasEnabled) {
              console.log('✓ ArgoCD MCP server disabled in Claude Desktop');
            } else {
              console.log('ArgoCD MCP server was not enabled');
            }
            console.log(`Configuration file: ${manager.getConfigPath()}`);
          } catch (error) {
            console.error('Failed to disable ArgoCD MCP server:', error);
            process.exit(1);
          }
        }
      );
  });

  exe.command('vscode', 'Manage VS Code integration', (yargs) => {
    return yargs
      .command(
        'enable',
        'Enable ArgoCD MCP server in VS Code',
        (yargs) => {
          return yargs
            .option('workspace', {
              type: 'boolean',
              description: 'Install in current workspace directory'
            })
            .option('url', {
              type: 'string',
              description: 'ArgoCD base URL',
              coerce: stringToURL,
              demandOption: true
            })
            .option('token', {
              type: 'string',
              description: 'ArgoCD API token',
              demandOption: true
            });
        },
        async ({ workspace, url, token }) => {
          const manager = new VSCodeConfigManager(workspace);
          try {
            const wasEnabled = await manager.enable(url, token);
            if (wasEnabled) {
              console.log('✓ ArgoCD MCP server configuration updated in VS Code');
            } else {
              console.log('✓ ArgoCD MCP server enabled in VS Code');
            }
            console.log(`Configuration file: ${manager.getConfigPath()}`);
          } catch (error) {
            console.error('Failed to enable ArgoCD MCP server:', error);
            process.exit(1);
          }
        }
      )
      .command(
        'disable',
        'Disable ArgoCD MCP server in VS Code',
        (yargs) => {
          return yargs.option('workspace', {
            type: 'boolean',
            description: 'Install in current workspace directory'
          });
        },
        async ({ workspace }) => {
          const manager = new VSCodeConfigManager(workspace);
          try {
            const wasEnabled = await manager.disable();
            if (wasEnabled) {
              console.log('✓ ArgoCD MCP server disabled in VS Code');
            } else {
              console.log('ArgoCD MCP server was not enabled');
            }
            console.log(`Configuration file: ${manager.getConfigPath()}`);
          } catch (error) {
            console.error('Failed to disable ArgoCD MCP server:', error);
            process.exit(1);
          }
        }
      );
  });

  exe.demandCommand().strict().parse();
};
