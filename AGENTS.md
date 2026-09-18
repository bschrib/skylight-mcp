# Development notes

Read `CLAUDE.md` for build, test, authentication, and release conventions.

## MCP v2

Use `@modelcontextprotocol/server` for the server and `@modelcontextprotocol/client` for clients. `@chrischall/mcp-utils` 0.28 supplies the server factory and test helpers. Use `serveStdio` from the official SDK with `createMcpServer`; the shared `runMcp` helper still connects the legacy transport and does not handle modern stdio discovery. Tool schemas must be complete Zod objects, rather than raw shapes. Schema inspection tests read `.shape` directly.

`tests/protocol.test.ts` exercises modern discovery, tool listing, schema validation, credential-free startup, and legacy initialization through the official HTTP adapter. The production entry point remains stdio. A modern request must include protocol version, client capabilities, and client identity metadata. Match the method and tool-name headers to the request.

Run `npm run test:coverage` and `npm run build`. Keep all version markers unchanged unless the release workflow updates them.

The test commands build first so `tests/stdio.test.ts` exercises the production entry point.
