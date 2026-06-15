# Streamable HTTP Transport

Obsidian Extended MCP can run as an HTTP service using the MCP Streamable HTTP transport, allowing remote clients (or local non-stdio clients) to connect.

## Quick start

1. Set a strong bearer token:

   ```bash
   export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
   ```

2. Enable HTTP transport:

   ```bash
   export MCP_HTTP_ENABLED=true
   ```

3. Start the server:

   ```bash
   npm run build
   node dist/index.js
   ```

   The server listens on `http://127.0.0.1:8787/mcp` by default.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_HTTP_ENABLED` | `false` | Enable the Streamable HTTP transport. |
| `MCP_HTTP_HOST` | `127.0.0.1` | Interface to bind. Use `127.0.0.1` for local-only access. |
| `MCP_HTTP_PORT` | `8787` | TCP port to listen on. |
| `MCP_HTTP_PATH` | `/mcp` | URL path for MCP messages. |
| `MCP_HTTP_CORS_ORIGINS` | *(empty)* | Comma-separated allowed CORS origins. Empty disables CORS. |
| `MCP_STDIO_DISABLED` | `false` | Disable stdio when running HTTP-only. |
| `MCP_AUTH_TOKEN` | *(empty)* | **Required** when HTTP is enabled. Bearer token for request auth. |

## Authentication

When HTTP is enabled, `MCP_AUTH_TOKEN` is required. Every MCP request must include:

```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```

Requests without a token or with an invalid token receive `401 Unauthorized`.

## Health and metrics

- `GET /health` returns `{ "status": "ok", "version": "0.3.4" }`.
- `GET /metrics` returns basic request/error/session counts.

These endpoints are available on the same HTTP port and do not require authentication.

## CORS

To allow browser-based clients, set allowed origins:

```bash
export MCP_HTTP_CORS_ORIGINS="http://localhost:3000,https://my-app.example.com"
```

The server responds to `OPTIONS` preflight requests and adds the appropriate headers for listed origins.

## Running both transports

By default, enabling HTTP does **not** disable stdio. This lets the same process serve stdio clients and HTTP clients simultaneously:

```bash
export MCP_HTTP_ENABLED=true
export MCP_STDIO_DISABLED=false  # default
```

To run HTTP-only:

```bash
export MCP_HTTP_ENABLED=true
export MCP_STDIO_DISABLED=true
```

## Security notes

- Bind to `127.0.0.1` unless you intentionally expose the service.
- Use a long, random `MCP_AUTH_TOKEN` (at least 32 characters).
- HTTPS termination should be handled by a reverse proxy (e.g., nginx, Caddy, or a cloud load balancer) when exposing to a network.
