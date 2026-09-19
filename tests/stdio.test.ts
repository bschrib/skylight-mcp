import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let child: ChildProcessWithoutNullStreams;
afterEach(() => child?.kill());

describe('production stdio entry point', () => {
  it('supports modern discovery, all 114 tools, and credential-free healthcheck', async () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SKYLIGHT_')));
    // Stripping `SKYLIGHT_*` from the inherited env is not enough on its own:
    // `dist/index.js` calls `loadDotenvSafely()`, and `dotenv.config()` with no
    // explicit path resolves `.env` against the CHILD's cwd — so a developer's
    // repo-root `.env` puts the credentials straight back and this assertion
    // flips from `no_credential` to a live, authenticated request against
    // app.ourskylight.com. CI has no `.env`, so it only ever failed locally.
    // Spawning from an empty directory (with an absolute path to the entry)
    // closes it without depending on dotenv's internals or another env switch.
    const cwd = mkdtempSync(join(tmpdir(), 'skylight-stdio-'));
    child = spawn(process.execPath, [resolve('dist/index.js')], {env, cwd});
    child.stderr.resume();
    const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
    const rpc = async (method: string, params: Record<string, unknown> = {}) => {
      child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 1, method, params: {...params, _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': {name: 'test', version: '1'},
      }}}) + '\n');
      const line = await lines.next();
      expect(line.done).toBe(false);
      const response = JSON.parse(line.value!);
      expect(response.error).toBeUndefined();
      return response.result;
    };
    await rpc('server/discover');
    expect((await rpc('tools/list')).tools).toHaveLength(114);
    expect(JSON.stringify(await rpc('tools/call', {name: 'skylight_healthcheck', arguments: {}}))).toContain('no_credential');
  });
});
