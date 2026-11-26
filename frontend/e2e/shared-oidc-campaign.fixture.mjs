// Synthetic Spring only: exercise the campaign controller and the shipped Workbench.
// Two clicks substitute for the operator. The local issuer performs the actual redirect.
import { createInterface } from 'node:readline';
import { chromium } from '@playwright/test';
import { desktop, networkArgs, runCampaign } from './shared-oidc-campaign.mjs';

const input = createInterface({input:process.stdin,crlfDelay:Infinity});
const lines = input[Symbol.asyncIterator]();
const emit = msg => process.stdout.write(JSON.stringify(msg)+'\n');
try {
  const {command,config,end_utc}=JSON.parse((await lines.next()).value);
  if (command!=='START' || !/^https:\/\/localhost:\d+$/.test(config.origin) || config.idp_origins.length!==1 ||
      !/^http:\/\/127\.0\.0\.1:\d+$/.test(config.idp_origins[0]) || !/^[A-Za-z0-9+/]{43}=$/.test(config.testSpki))
    throw Error('CLIENT_FIXTURE_SCOPE');
  async function localBrowser(settings,actor,url,proxy) {
    const browser=await chromium.launch({executablePath:settings.chromium.path,headless:true,
      args:[...networkArgs(settings,proxy),'--ignore-certificate-errors-spki-list='+settings.testSpki]});
    try {
      if(browser.version()!==settings.chromium_version) throw Error('CLIENT_FIXTURE_VERSION');
      const context=await browser.newContext();
      await context.route('**/*',route=>[desktop,config.origin,...config.idp_origins].includes(new URL(route.request().url()).origin)
        ? route.continue() : route.abort());
      const portal=await context.newPage();
      await portal.goto(url);
      const [witness]=await Promise.all([portal.waitForEvent('popup'),portal.getByRole('button',{name:'Ouvrir Ritomer'}).click()]);
      await witness.waitForFunction(()=>document.title.startsWith('Ritomer · campagne '),{},{timeout:7000});
      await witness.getByRole('link',{name:'Se connecter avec Google'}).click({timeout:7000});
      return browser;
    } catch(error) { await browser.close(); throw error; }
  }
  await runCampaign(config,lines,emit,Date.parse(end_utc),localBrowser);
} catch(error) {
  emit({event:'FAILURE',code:/^CLIENT_[A-Z_]{1,60}$/.test(error.message)?error.message:'CLIENT_FIXTURE_INCOMPLETE'});
  process.exitCode=1;
} finally { input.close(); }
