// v0.3.4: Tests for Streamable HTTP MCP transport
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpMcpTransport } from '../../src/transports/HttpMcpTransport.js';

async function createServer(): Promise<Server> {
  const server = new Server(
    { name: 'test-http-mcp', version: '0.0.1' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{ name: 'ping', description: 'ping', inputSchema: { type: 'object' } }],
  }));
  server.setRequestHandler(CallToolRequestSchema, async () =>
    ({ content: [{ type: 'text', text: 'pong' }] }) as CallToolResult
  );
  return server;
}

async function post(port: number, path: string, body: unknown, token?: string, headers?: Record<string, string>): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  };
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

async function get(port: number, path: string, token?: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('HttpMcpTransport', () => {
  let mcpServer: Server;
  let transport: HttpMcpTransport;

  beforeEach(async () => {
    mcpServer = await createServer();
  });

  afterEach(async () => {
    await transport?.close();
  });

  it('responds to a valid MCP initialize request with token', async () => {
    transport = new HttpMcpTransport({
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      authToken: 'test-token-123456789012345678901234567890',
      createServer,
    });
    await transport.start(mcpServer);

    const address = transport.getAddress();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await post(
      port,
      '/mcp',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      },
      'test-token-123456789012345678901234567890'
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect(body.result?.serverInfo?.name).toBe('test-http-mcp');
  });

  it('rejects requests without a valid token with 401', async () => {
    transport = new HttpMcpTransport({
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      authToken: 'test-token-123456789012345678901234567890',
      createServer,
    });
    await transport.start(mcpServer);

    const address = transport.getAddress();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await post(port, '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('exposes a health endpoint', async () => {
    transport = new HttpMcpTransport({
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      authToken: 'test-token-123456789012345678901234567890',
      createServer,
    });
    await transport.start(mcpServer);

    const address = transport.getAddress();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await get(port, '/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.3.4');
  });

  it('supports CORS preflight when origins configured', async () => {
    transport = new HttpMcpTransport({
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      corsOrigins: ['http://example.com'],
      createServer,
    });
    await transport.start(mcpServer);

    const address = transport.getAddress();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://example.com');
  });

  it('shuts down gracefully', async () => {
    transport = new HttpMcpTransport({
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      authToken: 'test-token-123456789012345678901234567890',
      createServer,
    });
    await transport.start(mcpServer);
    await transport.close();

    const address = transport.getAddress();
    expect(address).toBeNull();
  });
});
