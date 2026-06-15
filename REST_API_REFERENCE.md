# Obsidian Local REST API Bridge Reference

This document describes the REST Bridge (`src/layers/L2b-rest/`) used by Obsidian Extended MCP to fall back to the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) when the Obsidian CLI is unavailable.

## Configuration

Set these environment variables (or add them to `mcp-config.yaml` under the `bridge` section):

| Variable | Default | Description |
|----------|---------|-------------|
| `REST_API_URL` | `http://localhost:27123` | Base URL of the Local REST API |
| `REST_API_TOKEN` | — | Bearer token required by the plugin when HTTPS is enabled |

A token is only sent over HTTPS. If a token is configured but the base URL is not `https://`, the bridge refuses to start.

## Error codes

| Code | Error | Meaning |
|------|-------|---------|
| `E300` | `RestError` | Generic REST failure |
| `E301` | `RestQueryError` | Dataview query failed |
| `E303` | `RestNotFoundError` | Note, endpoint, or command not found (HTTP 404) |
| `E304` | `RestAuthError` | Authentication failed (HTTP 401/403) |
| `E305` | `RestTimeoutError` | Request exceeded the configured timeout |

## Endpoints mapped by `RestBridge`

| Method | Endpoint | Bridge method | Tool |
|--------|----------|---------------|------|
| GET | `/` | `isAvailable()` | — |
| GET | `/active/` | `activeNote()`, `activeNoteContent()` | `rest_active_note` |
| GET | `/vault/{path}` | `getNote(path)` | `rest_get_note` |
| POST | `/vault/{path}` | `writeNote(path, content)` | `rest_write_note` |
| DELETE | `/vault/{path}` | `deleteNote(path)` | `rest_delete_note` |
| GET | `/tags/` | `listTags()` | `rest_list_tags` |
| POST | `/commands/{commandId}/` | `executeCommand(commandId)` | `rest_execute_command` |
| POST | `/search/` | `search(query)` | `rest_search` |
| POST | `/dataview/` | `executeDataview(query)` | `rest_dataview` |

`{path}` and `{commandId}` are URL-encoded before the request is sent.

## Tool gating

The following tools require `ENABLE_COMMANDS=true` to be registered:

- `rest_write_note`
- `rest_delete_note`
- `rest_execute_command`

Read-only tools (`rest_active_note`, `rest_get_note`, `rest_list_tags`, `rest_search`, `rest_dataview`) are always available when the REST bridge is configured.

## Fallback behavior

When the Obsidian CLI is unavailable or not configured (`OBSIDIAN_CLI_PATH` empty), the MCP server still exposes the REST tools. Each tool first calls `RestBridge.isAvailable()` and returns a clear error if the Local REST API plugin is not running or reachable. This allows clients to use the same MCP server in environments where the CLI plugin cannot be installed.
