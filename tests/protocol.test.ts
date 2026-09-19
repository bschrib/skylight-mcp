import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMcpServer } from '@chrischall/mcp-utils';
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { registerEventTools } from '../src/tools/events.js';
import { registerHealthcheckTools } from '../src/tools/health.js';
import { makeGetClient } from '../src/get-client.js';

let handler: McpHttpHandler;
afterEach(async () => { await handler?.close(); vi.unstubAllEnvs(); });

function start() {
  vi.stubEnv('SKYLIGHT_EMAIL', '');
  vi.stubEnv('SKYLIGHT_PASSWORD', '');
  vi.stubEnv('SKYLIGHT_REFRESH_TOKEN', '');
  const getClient = makeGetClient();
  handler = createMcpHandler(() => createMcpServer({
    name: 'skylight-mcp', version: 'test', deps: getClient,
    tools: [registerEventTools, registerHealthcheckTools],
  }));
}

async function rpc(method: string, params: Record<string, unknown> = {}, modern = true) {
  const headers: Record<string, string> = {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream'};
  if (modern) {
    headers['MCP-Protocol-Version'] = '2026-07-28';
    headers['Mcp-Method'] = method;
    if (params.name) headers['Mcp-Name'] = String(params.name);
    params = {...params, _meta: {'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {}, 'io.modelcontextprotocol/clientInfo': {name: 'test', version: '1'}}};
  }
  const response = await handler.fetch(new Request('http://localhost/mcp', {
    method: 'POST', headers, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  }));
  expect(response.status, await response.clone().text()).toBe(200);
  expect(response.headers.has('Mcp-Session-Id')).toBe(false);
  const text = await response.text();
  return JSON.parse(text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data:'))!.slice(5) : text);
}

describe('MCP v2 protocol', () => {
  it('discovers and lists tools without initialization or credentials', async () => {
    start();
    const discovery = await rpc('server/discover');
    expect(discovery.error).toBeUndefined();
    const result = await rpc('tools/list');
    expect(result.result.tools).toHaveLength(11);
    expect(result.result.tools.find((t: {name: string}) => t.name === 'skylight_list_events').inputSchema.required)
      .toEqual(['date_min', 'date_max']);
  });

  it('validates schemas before reaching credential resolution', async () => {
    start();
    const response = await rpc('tools/call', {name: 'skylight_list_events', arguments: {}});
    expect(JSON.stringify(response)).toMatch(/date_min/);
    expect(JSON.stringify(response)).not.toMatch(/no_credential/);
  });

  it('reports missing credentials through a modern healthcheck call', async () => {
    start();
    const response = await rpc('tools/call', {name: 'skylight_healthcheck', arguments: {}});
    expect(JSON.stringify(response)).toContain('no_credential');
  });

  it('still accepts the legacy initialization handshake', async () => {
    start();
    const response = await rpc('initialize', {protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {name: 'test', version: '1'}}, false);
    expect(response.result.protocolVersion).toBe('2025-11-25');
  });
});
