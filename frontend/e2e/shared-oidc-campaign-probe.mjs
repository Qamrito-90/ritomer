import { once } from 'node:events';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { controller, desktop } from './shared-oidc-campaign.mjs';

const input = createInterface({input:process.stdin,crlfDelay:Infinity});
let control, stage='START';
try {
  const [line] = await once(input,'line');
  const msg = JSON.parse(line);
  if (Object.keys(msg).sort().join(',') !== 'chromium,command,profile_root,version' || msg.command !== 'PROBE'
      || !/^\d+\.\d+\.\d+\.\d+$/.test(msg.version) ||
      realpathSync(msg.chromium).toLowerCase() !== realpathSync(resolve(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe')).toLowerCase()) {
    throw Error('PROBE_INPUT');
  }
  // No external destination is allowed; the probe contains no user account or sign-in.
  control = await controller({chromium:{path:msg.chromium}, chromium_version:msg.version,
    profile_root:msg.profile_root, origin:desktop, idp_origins:[]},()=>{});
  stage='OPEN';
  const version = await control.open('probe', Date.now()+18000);
  process.stdout.write(JSON.stringify({event:'READY',version,destination:'LOOPBACK_ONLY'})+'\n');
  stage='CLOSE';
  const closing=control; control=undefined;
  await closing.close();
  process.stdout.write(JSON.stringify({event:'CLOSED'})+'\n');
} catch(e) {
  process.stdout.write(JSON.stringify({event:'FAILURE',stage,
    code: ['CLIENT_CONTROL_TIMEOUT','CLIENT_CLOSE','PROBE_INPUT','EADDRINUSE'].includes(e.code || e.message) ? (e.code || e.message) : 'CLIENT_PROBE_FAILED'})+'\n');
  process.exitCode=1;
}
finally { input.close(); process.stdin.destroy(); if(control) await control.close(); }
