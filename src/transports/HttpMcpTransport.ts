// v0.3.4: Streamable HTTP transport for Obsidian Extended MCP
import http, { type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export interface HttpMcpTransportOptions {
  host: string;
  port: number;
  path: string;
  authToken?: string;
  corsOrigins?: string[];
  version?: string;
  createServer: () => McpServer | Promise<McpServer>;
}

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export class HttpMcpTransport {
  private server?: Server;
  private sessions = new Map<string, Session>();
  private requestCount = 0;
  private errorCount = 0;

  constructor(private readonly options: HttpMcpTransportOptions) {}

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => void this.handleRequest(req, res));

    return new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.options.port, this.options.host, () => {
        this.server!.removeListener('error', reject);
        const address = this.server!.address();
        const port = typeof address === 'object' && address ? address.port : this.options.port;
        console.error(`[HTTP] MCP transport listening on http://${this.options.host}:${port}${this.options.path}`);
        resolve();
      });
    });
  }

  getAddress(): string | import('node:net').AddressInfo | null {
    return this.server?.address() ?? null;
  }

  private applyCors(req: IncomingMessage, res: ServerResponse): boolean {
    const allowed = this.options.corsOrigins ?? [];
    if (allowed.length === 0) return false;
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
      return true;
    }
    return false;
  }

  private sendJson(res: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  private reject(res: ServerResponse, status: number, message: string): void {
    this.sendJson(res, status, { error: message });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      this.applyCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = (req.url ?? '').split('?')[0];

    if (pathname === '/health') {
      this.applyCors(req, res);
      this.sendJson(res, 200, { status: 'ok', version: this.options.version ?? '0.3.4' });
      return;
    }

    if (pathname === '/metrics') {
      this.applyCors(req, res);
      this.sendJson(res, 200, {
        requests: this.requestCount,
        errors: this.errorCount,
        sessions: this.sessions.size,
      });
      return;
    }

    if (pathname !== this.options.path) {
      this.reject(res, 404, 'Not found');
      return;
    }

    if (this.options.authToken) {
      const auth = req.headers.authorization ?? '';
      const match = /^Bearer\s+(.+)$/i.exec(auth);
      const provided = Buffer.from(match ? match[1] : '');
      const expected = Buffer.from(this.options.authToken);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        this.errorCount++;
        this.reject(res, 401, 'Unauthorized');
        return;
      }
    }

    this.applyCors(req, res);
    this.requestCount++;

    try {
      await this.handleMcpRequest(req, res);
    } catch (err) {
      this.errorCount++;
      console.error('[HTTP] Error handling MCP request:', err);
      if (!res.headersSent) {
        this.reject(res, 500, 'Internal server error');
      }
    }
  }

  private async handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;

    // Existing session: route to its transport
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        this.reject(res, 404, 'Session not found');
        return;
      }
      await session.transport.handleRequest(req, res);
      return;
    }

    // New session only allowed for initialize requests
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (isInitializeRequest(body)) {
        const session = await this.createSession();
        await session.transport.handleRequest(req, res, body);
        return;
      }
    }

    this.reject(res, 400, 'Missing or invalid session ID');
  }

  private async createSession(): Promise<Session> {
    const server = await this.options.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        const session: Session = { transport, server };
        this.sessions.set(sessionId, session);
        transport.onclose = () => {
          this.sessions.delete(sessionId);
        };
      },
    });

    await server.connect(transport);
    return { transport, server };
  }

  async close(): Promise<void> {
    for (const session of this.sessions.values()) {
      try {
        await session.transport.close();
        await session.server.close();
      } catch (err) {
        console.error('[HTTP] Error closing session:', err);
      }
    }
    this.sessions.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = undefined;
    }
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
