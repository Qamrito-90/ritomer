import { randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createDenyProxy } from 'node:net';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

export const desktop = 'http://127.0.0.1:39747';
const actors = ['A1', 'B', 'A2'];
function requireOK(value, code) { if (!value) throw Error(code); }
async function until(end, predicate) {
  while (Date.now() < end) {
    const result = predicate();
    if (result) return result;
    await delay(80);
  }
  throw Error('CLIENT_CONTROL_TIMEOUT');
}

// Served only on loopback. Messages are accepted exclusively from the window
// opened by the operator and only while it is on the exact application origin.
function operatorPage() {
  const key = location.hash.slice(1);
  history.replaceState(null, '', '/');
  const rpc = async (method, value = {}) => {
    const response = await fetch('/' + method, {method:'POST', mode:'same-origin', cache:'no-store',
      headers: {'Content-Type':'application/json', 'X-Ritomer-Local-Run':key}, body:JSON.stringify(value)});
    if (!response.ok) throw Error('DESKTOP_CLOSED');
    return response.json();
  };
  async function main() {
    const label = document.querySelector('p');
    const button = document.querySelector('button');
    const {actor, origin, probe, invitation, scopeHash} = await rpc('enter');
    if (probe) {
      const info = await navigator.userAgentData.getHighEntropyValues(['fullVersionList']);
      await rpc('version', {version:info.fullVersionList.find(b => b.brand === 'Google Chrome')?.version});
      return;
    }
    document.title = 'Ritomer · campagne ' + (actor === 'A1' ? 'A' : actor);
    label.textContent = 'Connexion du compte ' + (actor === 'A1' ? 'A' : actor);
    button.textContent = 'Ouvrir Ritomer';
    button.hidden = false;
    let witness, serial = Promise.resolve();
    button.onclick = () => {
      if (witness) return;
      witness = window.open(origin + '/#m12/' + actor + '/' + invitation + '/' + scopeHash, '_blank');
      if (!witness) { label.textContent = 'La fenêtre Ritomer n’a pas pu s’ouvrir.'; return; }
      button.hidden = true;
      label.textContent = 'Dans Ritomer, sélectionnez « Se connecter avec Google ». Laissez les fenêtres de campagne ouvertes.';
    };
    window.addEventListener('message', e => {
      if (!witness || e.source !== witness || e.origin !== origin || e.data?.invitation !== invitation) return;
      const {invitation:unused, ...message} = e.data;
      serial = serial.then(() => rpc('event', message)).catch(() => { label.textContent = 'La campagne est fermée.'; });
    });
    for (;;) {
      const cmd = await rpc('next');
      if (cmd.command === 'WAIT') continue;
      if (cmd.command === 'END') return;
      if (!witness || witness.closed) throw Error('CLIENT_WINDOW_CLOSED');
      witness.postMessage({invitation, ...cmd}, origin);
    }
  }
  main().catch(() => { document.querySelector('p').textContent = 'La connexion au pilote est fermée.'; });
}

export function networkArgs(config, proxy) {
  const allow = [desktop, config.origin, ...config.idp_origins].map(origin => {
    const u = new URL(origin);
    requireOK(u.origin === origin, 'CLIENT_ORIGIN');
    return u.protocol + '//' + u.hostname + ':' + (u.port || (u.protocol === 'https:' ? '443' : '80'));
  });
  return ['--disable-background-networking','--disable-sync','--disable-quic',
    '--proxy-server=http://127.0.0.1:' + proxy,'--proxy-bypass-list=' + ['<-loopback>', ...allow].join(';')];
}

export async function openStandard(config, actor, url, proxy) {
  const child = spawn(config.chromium.path, ['--user-data-dir=' + join(config.profile_root, actor),
    '--incognito','--no-first-run','--no-default-browser-check',...networkArgs(config,proxy),url], {stdio:'ignore'});
  await once(child, 'spawn');
  return { async close() {
    if (child.exitCode === null && child.signalCode === null) {
      // One ephemeral profile per owned browser. Ask only its live process to close normal windows.
      const script = '$p=Get-Process -Id ' + Number(child.pid) +
        ' -ErrorAction Stop; $end=[DateTime]::UtcNow.AddSeconds(7); while (!$p.HasExited -and [DateTime]::UtcNow -lt $end) { $p.Refresh(); [void]$p.CloseMainWindow(); Start-Sleep -Milliseconds 100 }';
      const shell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      await new Promise((ok, fail) => execFile(shell,
        ['-NoProfile','-NonInteractive','-Command',script], {windowsHide:true,timeout:9500},
        error => error && child.exitCode === null ? fail(Error('CLIENT_CLOSE')) : ok()));
      await until(Date.now()+1500, () => child.exitCode !== null || child.signalCode !== null);
    }
  }};
}

export async function controller(config, emit, launch = openStandard) {
  const clients = new Map();
  const proxy = createDenyProxy(socket => { socket.on('error', () => {}); socket.destroy(); });
  const reply = (res, status, data, type = 'application/json') => {
    res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'strict-origin',
      'Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options':'nosniff'});
    res.end(type === 'application/json' ? JSON.stringify(data) : data);
  };
  const server = createServer(async (req,res) => {
    try {
      requireOK(req.headers.host === '127.0.0.1:39747', 'CLIENT_HOST');
      if (req.method === 'GET' && req.url === '/')
        return reply(res,200,'<!doctype html><html lang="fr"><meta charset="utf-8"><title>Ritomer · recette</title><p>Ouverture de la campagne.</p><button hidden></button><script type="module" src="/operator.js"></script></html>','text/html;charset=utf-8');
      if (req.method === 'GET' && req.url === '/operator.js')
        return reply(res,200,'(' + operatorPage.toString() + ')();','text/javascript;charset=utf-8');
      const client = clients.get(req.headers['x-ritomer-local-run']);
      requireOK(req.method === 'POST' && req.headers.origin === desktop && client && Date.now() < client.deadline &&
        req.headers['content-type'] === 'application/json' && Number(req.headers['content-length']) <= 2048, 'CLIENT_LOCAL_SCOPE');
      let bytes = '';
      for await (const part of req) { bytes += part; requireOK(bytes.length <= 2048,'CLIENT_LOCAL_SCOPE'); }
      const body = JSON.parse(bytes);
      requireOK(Date.now() < client.deadline, 'CLIENT_LOCAL_SCOPE');
      if (req.url === '/enter' && !client.entered) {
        client.entered = true;
        const grant=config.grants?.[client.actor];
        return reply(res,200,{actor:client.actor,origin:config.origin,probe:client.actor === 'probe',
          invitation:grant?.invitation,scopeHash:grant?.scopeHash});
      }
      requireOK(client.entered, 'CLIENT_LOCAL_SCOPE');
      if (req.url === '/version' && client.actor === 'probe' && !client.version && body.version === config.chromium_version) {
        client.version = body.version;
      } else if (req.url === '/next' && !client.pulling) {
        client.pulling = true;
        try {
          const end = Math.min(client.deadline,Date.now()+12000);
          while (!client.command && !client.closed && Date.now()<end) await delay(80);
          const cmd = client.command;
          client.command = null;
          requireOK(!cmd || Date.now() < Math.min(cmd.expires,client.deadline), 'CLIENT_DEADLINE');
          return reply(res,200,cmd || {command:client.closed ? 'END' : 'WAIT'});
        } finally { client.pulling = false; }
      } else if (req.url === '/event' && !client.closed && client.events.length < 6) {
        const keys = Object.keys(body).sort().join(',');
        if (body.event === 'WITNESS_READY' || body.event === 'LOGIN_STARTED')
          requireOK(Date.now() < client.loginEnd && !client.loginStarted, 'CLIENT_LOGIN_CLOSED');
        if (body.event === 'WORKBENCH_READY' || body.event === 'ADMITTED')
          requireOK(client.verifying && !client.admitted, 'CLIENT_VERIFY_ORDER');
        requireOK((keys === 'event' && ['WITNESS_READY','LOGIN_STARTED','WORKBENCH_READY','ADMITTED'].includes(body.event)) ||
          (keys === 'code,event' && body.event === 'FAILURE' && /^CLIENT_[A-Z_]{1,50}$/.test(body.code)) ||
          (keys === 'challenge,event,sequence,status' && body.event === 'RESPONSE' &&
           Number.isInteger(body.sequence) && Number.isInteger(body.status) && typeof body.challenge === 'string' &&
           /^[a-f0-9-]{36}$/.test(body.challenge)), 'CLIENT_MESSAGE');
        client.events.push(body);
      } else throw Error('CLIENT_LOCAL_SCOPE');
      reply(res,200,{});
    } catch { if (!res.headersSent) reply(res,403,{}); else res.destroy(); }
  });
  server.requestTimeout = 16000;
  try {
    await Promise.all([new Promise((ok,fail)=>server.once('error',fail).listen(39747,'127.0.0.1',ok)),
      new Promise((ok,fail)=>proxy.once('error',fail).listen(0,'127.0.0.1',ok))]);
  } catch (e) { server.close(); proxy.close(); throw e; }
  return {
    async open(actor, end, sessionEnd = end) {
      const key = randomUUID(), client = {actor,loginEnd:end,deadline:end,events:[],entered:false,sessionEnd};
      clients.set(key,client);
      client.browser = await launch(config,actor,desktop+'/#'+key,proxy.address().port);
      await until(end, () => client.entered);
      if (actor === 'probe') {
        await until(end, () => client.version);
        return client.version;
      }
      emit({event:'LOGIN_PROGRESS',actor,stage:'WINDOW_READY'});
      return client;
    },
    async next(client, expected, end) {
      const event = await until(end, () => client.events.shift());
      if (event.event === 'FAILURE') throw Error(event.code);
      requireOK(event.event === expected,'CLIENT_MESSAGE_ORDER');
      return event;
    },
    async close() {
      for (const c of clients.values()) c.closed = true;
      try { await Promise.all([...clients.values()].map(c => c.browser?.close())); }
      finally { server.closeAllConnections(); server.close(); proxy.close(); }
    }
  };
}

export async function runCampaign(config, lines, emit, deadline, launch) {
  const control = await controller(config,emit,launch);
  const active = new Map();
  let sequence = 0, closedNormally = false;
  try {
    emit({event:'READY',schema:'M12_BROWSER_UI_STANDARD_V1'});
    for await (const line of lines) {
      requireOK(line.length <= 2048 && Date.now()<deadline,'CLIENT_DEADLINE');
      const msg = JSON.parse(line);
      if (msg.command === 'CLOSE') { closedNormally = true; break; }
      if (msg.command === 'GO') {
        const end = Date.parse(msg.end_utc);
        const verifyEnd = msg.verify_until_utc === undefined ? end : Date.parse(msg.verify_until_utc);
        const previous = active.get(actors[active.size-1]);
        requireOK(msg.actor===actors[active.size] && (!previous || previous.admitted) &&
          end>Date.now() && (verifyEnd===end || verifyEnd===end+30000) && verifyEnd<=deadline,'CLIENT_GO_ORDER');
        const c = await control.open(msg.actor,end,deadline);
        active.set(msg.actor,c);
        await control.next(c,'WITNESS_READY',end);
        emit({event:'LOGIN_PROGRESS',actor:msg.actor,stage:'WITNESS_READY'});
        await control.next(c,'LOGIN_STARTED',end);
        requireOK(Date.now()<end,'CLIENT_LOGIN_CLOSED');
        c.loginStarted=true;
        c.deadline=verifyEnd;
        emit({event:'LOGIN_PROGRESS',actor:msg.actor,stage:'LOGIN_STARTED'});
      } else if (msg.command === 'VERIFY') {
        const c=active.get(msg.actor);
        requireOK(c?.loginStarted && !c.verifying && !c.admitted && Date.now()<c.deadline,'CLIENT_GO_ORDER');
        c.verifying=true;
        c.command={command:'VERIFY',scope:config.grants[msg.actor].scope,revision:msg.revision,expires:c.deadline};
        await control.next(c,'WORKBENCH_READY',c.deadline);
        emit({event:'WORKBENCH_READY',actor:msg.actor,page:'witness'});
        await control.next(c,'ADMITTED',c.deadline);
        c.admitted=true; c.deadline=c.sessionEnd; emit({event:'ADMITTED',actor:msg.actor});
      } else {
        const [who,code,operation]=String(msg.step).split(':'), c=active.get(who);
        requireOK(msg.command==='OBSERVE' && c?.admitted && msg.sequence===sequence+1 && msg.sequence<=394 &&
          ['ME','DOCUMENT','EXPORT','FOREIGN_DOCUMENT','FOREIGN_EXPORT','LOGOUT'].includes(operation),'CLIENT_STEP');
        const challenge=randomUUID(), startedAt=new Date().toISOString(), expected=Number(code);
        c.command={command:'OBSERVE',phase:msg.phase,operation,status:expected,sequence:++sequence,challenge,
          expires:Math.min(deadline,Date.now()+19000)};
        const v=await control.next(c,'RESPONSE',Math.min(deadline,Date.now()+19000));
        requireOK(v.sequence===sequence && v.challenge===challenge && v.status===expected,'CLIENT_BROWSER_RECEIPT');
        emit({event:'REQUEST',phase:msg.phase,operation,actor:who[0],session:who==='A2'?'REPLACEMENT':'ORIGINAL',
          sequence,challenge,traced:true,startedAt,utc:new Date().toISOString(),status:v.status});
      }
    }
  } finally { await control.close(); }
  requireOK(closedNormally,'CLIENT_CONTROL_EOF');
  emit({event:'CLOSED'});
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const input=createInterface({input:process.stdin,crlfDelay:Infinity}), lines=input[Symbol.asyncIterator]();
  const emit=obj=>process.stdout.write(JSON.stringify(obj)+'\n');
  try {
    const first=await lines.next();
    requireOK(!first.done && first.value.length<32768,'CLIENT_START');
    const {command,config,end_utc}=JSON.parse(first.value);
    requireOK(command==='START' && Date.parse(end_utc)>Date.now(),'CLIENT_START');
    await runCampaign(config,lines,emit,Date.parse(end_utc));
  } catch(e) {
    emit({event:'FAILURE',code:/^CLIENT_[A-Z_]{1,50}$/.test(e.message)?e.message:'CLIENT_INCOMPLETE'});
    process.exitCode=1;
  } finally {input.close();}
}
