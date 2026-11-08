# 0004 — v1 output is the clipboard, and only the clipboard

## Context

The obvious next step after “build a prompt” is “send it somewhere”: an editor command, an agent
socket, an HTTP endpoint, a file. Each adds a trust boundary (a server, a token, a protocol, a
listener) to a tool whose value is that it is local and disposable.

## Decision

The only output channel in v1 is `navigator.clipboard.writeText`, triggered by an explicit user
action. No HTTP endpoints, no sockets, no files, no auto-copy, no analytics. The payload is never
persisted; closing the tab clears it.

## Consequences

- The plugin needs no server surface, no authentication and no permissions beyond the clipboard
  (and dev-server file reads for source windows).
- “Send to my agent” becomes a v2 candidate with its own ADR (a local MCP surface is the natural
  shape, not a cloud service).
- Clipboard failures (insecure context, denied permission) are a first-class state in the UI, with a
  documented fallback.

## Alternatives considered

- **A local HTTP endpoint that the agent polls** (a mini API): more moving parts, a second auth story,
  and it leaks the payload outside the browser. Revisit only if the MCP route is unavailable.
- **Write a file to the project** (`.sphere/prompt.md`): pollutes the workspace and needs cleanup
  rules; also surprising in a git repository.
