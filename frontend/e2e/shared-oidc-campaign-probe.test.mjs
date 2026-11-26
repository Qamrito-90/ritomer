import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const probe = fileURLToPath(new URL('./shared-oidc-campaign-probe.mjs', import.meta.url));
for (const [description, message] of [
  ['START is refused', { command: 'START', chromium: '', version: '1.0.0.0' }],
  ['a destination is refused', { command: 'PROBE', chromium: '', version: '1.0.0.0', origin: 'https://unused.invalid' }],
]) {
  test(description, () => {
    const result = spawnSync(process.execPath, [probe], {
      input: JSON.stringify(message) + '\n', encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
  });
}
