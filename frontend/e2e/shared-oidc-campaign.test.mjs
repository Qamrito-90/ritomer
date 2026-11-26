import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { controller, desktop, networkArgs, runCampaign } from './shared-oidc-campaign.mjs';

test('the Swiss Google origin is routed directly only when explicitly configured', () => {
  const config = {origin: 'https://ritomer.example.invalid', idp_origins: ['https://accounts.google.com']};
  const rules = settings => networkArgs(settings, 1234)
    .find(arg => arg.startsWith('--proxy-bypass-list=')).slice('--proxy-bypass-list='.length).split(';');
  const base = rules(config);
  const suisse = 'https://accounts.google.ch';
  assert.equal(base.includes(suisse + ':443'), false);
  assert.deepEqual(rules({...config, idp_origins: [...config.idp_origins, suisse]}), [...base, suisse + ':443']);
});

test('Chrome sends traffic only to exact approved origins and ports', {skip:!process.env.RITOMER_M12_CHROMIUM_VISIBLE},async()=>{
  let hits=0;
  const forbidden=createServer((req,res)=>res.end());
  forbidden.on('connection',()=>hits++);
  const app=createServer((req,res)=>req.url==='/outside'?
    res.writeHead(302,{Location:'http://127.0.0.1:'+forbidden.address().port+'/end'}).end():res.end('allowed'));
  let browser,control;
  try {
    for(const s of [forbidden,app]) { s.listen(0,'127.0.0.1'); await once(s,'listening'); }
    const origin='http://127.0.0.1:'+app.address().port;
    let context;
    control=await controller({origin,idp_origins:[]},()=>{},async(config,_actor,url,proxy)=>{
      browser=await chromium.launch({executablePath:process.env.RITOMER_M12_CHROMIUM_VISIBLE,headless:true,args:networkArgs(config,proxy)});
      context=await browser.newContext();
      await (await context.newPage()).goto(url);
      return browser;
    });
    await control.open('A1',Date.now()+12000);
    const page=await context.newPage();
    assert.equal((await page.goto(origin)).status(),200);
    await assert.rejects(page.goto(origin+'/outside',{timeout:5000}),/net::ERR_/);
    assert.equal(hits,0);
  } finally {
    await control?.close(); await browser?.close();
    for(const s of [app,forbidden]) { s.closeAllConnections(); if(s.listening) await new Promise(r=>s.close(r)); }
  }
});

test('a foreign local origin cannot submit a campaign observation',async()=>{
  const end=Date.now()+5000;
  const control=await controller({origin:'https://example.invalid'},()=>{},async(config,actor,url)=>{
    const key=new URL(url).hash.slice(1);
    const post=origin=>fetch(desktop+'/enter',{method:'POST',headers:{'Content-Type':'application/json', Connection:'close',
      'X-Ritomer-Local-Run':key, Origin:origin},body:'{}'});
    assert.equal((await post('https://unrelated.invalid')).status,403);
    assert.equal((await post(desktop)).status,200);
    return {close:async()=>{}};
  });
  try { await control.open('A1',end); } finally { await control.close(); }
});

test('a verified witness is reported even when login never starts', async () => {
  const end = Date.now() + 8000;
  const progress = [];
  const launch = async (_config, _actor, url) => {
    const headers = {'Content-Type':'application/json', Connection:'close', 'X-Ritomer-Local-Run':new URL(url).hash.slice(1), Origin:desktop};
    for (const [path, body] of [
      ['/enter', {}],
      ['/event', {event:'WITNESS_READY'}],
      ['/event', {event:'FAILURE', code:'CLIENT_CONTROL_TIMEOUT'}],
    ]) {
      const response = await fetch(desktop + path, {method:'POST', headers, body:JSON.stringify(body)});
      assert.equal(response.status, 200);
      await response.json();
    }
    return {close:async () => {}};
  };
  const go = {command:'GO', actor:'A1', end_utc:new Date(end).toISOString()};
  await assert.rejects(runCampaign({origin:'https://example.invalid'}, [JSON.stringify(go)], event => {
    if (event.event === 'LOGIN_PROGRESS') progress.push(event);
  }, end, launch), /CLIENT_CONTROL_TIMEOUT/);
  assert.deepEqual(progress, ['WINDOW_READY','WITNESS_READY'].map(stage => ({event:'LOGIN_PROGRESS', actor:'A1', stage})));
});

test('after login expiry the same window can finish VERIFY within its fixed grace', async () => {
  const realNow = Date.now;
  const start = realNow();
  const end = start + 300000, verifyEnd = end + 30000;
  let now = start, post, verified;
  const launch = async (_settings, _actor, url) => {
    const headers = {'Content-Type':'application/json', Connection:'close', Origin:desktop, 'X-Ritomer-Local-Run':new URL(url).hash.slice(1)};
    post = (path, body={}) => fetch(desktop+path, {method:'POST',headers,body:JSON.stringify(body)});
    assert.equal((await post('/enter')).status,200);
    for (const event of ['WITNESS_READY','LOGIN_STARTED'])
      assert.equal((await post('/event',{event})).status,200);
    return {close:async()=>{}};
  };
  async function* commands() {
    yield JSON.stringify({command:'GO',actor:'A1',end_utc:new Date(end),verify_until_utc:new Date(verifyEnd)});
    now = end + 2281;
    assert.equal((await post('/enter')).status,403);
    assert.equal((await post('/event',{event:'LOGIN_STARTED'})).status,403);
    assert.equal((await post('/event',{event:'ADMITTED'})).status,403);
    verified = (async () => {
      const cmd = await (await post('/next')).json();
      assert.equal(cmd.command,'VERIFY');
      assert.equal(cmd.expires,verifyEnd);
      for (const event of ['WORKBENCH_READY','ADMITTED'])
        assert.equal((await post('/event',{event})).status,200);
    })();
    yield JSON.stringify({command:'VERIFY',actor:'A1',revision:'ritomer-m12-local'});
    await verified;
    yield JSON.stringify({command:'CLOSE'});
  }
  const events=[];
  Date.now=()=>now;
  try {
    await runCampaign({grants:{A1:{scope:'synthetic'}}},commands(),e=>events.push(e.event),verifyEnd+100,launch);
  } finally { Date.now=realNow; }
  assert.deepEqual(events.slice(-3),['WORKBENCH_READY','ADMITTED','CLOSED']);
});

for(const [name,commands,code] of [
  ['closed input',[],'CLIENT_CONTROL_EOF'],
  ['wrong first actor',[{command:'GO',actor:'B',end_utc:new Date(Date.now()+4000).toISOString()}],'CLIENT_GO_ORDER'],
  ['verification without an open window',[{command:'VERIFY',actor:'A1'}],'CLIENT_GO_ORDER'],
  ['observation before admission',[{command:'OBSERVE',step:'A1:200:ME',sequence:1}],'CLIENT_STEP'],
]) {
  test(name,async()=>{
    const events=[];
    await assert.rejects(runCampaign({},commands.map(JSON.stringify),e=>events.push(e),Date.now()+5000),new RegExp(code));
    assert.deepEqual(events.map(e=>e.event),['READY']);
  });
}
