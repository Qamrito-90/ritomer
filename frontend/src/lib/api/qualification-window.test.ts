// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://localhost:1443/","referrer":"http://127.0.0.1:39747/"}
import { afterEach, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { qualificationWindow } from "./qualification-window";

const local = "http://127.0.0.1:39747";
const key = "00000000-0000-4000-9000-000000000001";
const tenant = "00000000-0000-4000-9000-000000000002";
const hash = (s:string) => createHash("sha256").update(s).digest("hex");
const scope = JSON.stringify({actor:{user_id:key,tenant_id:tenant,roles:["ACCOUNTANT"]},own:{},other:{}});
const revision = "ritomer-m12-test";

async function witness(options:{pin?:string; until?:number; foreignSource?:boolean; me?:string}={}) {
  const peer = {closed:false,postMessage:vi.fn()};
  vi.stubGlobal("opener",peer);
  vi.stubGlobal("crypto",webcrypto);
  const deadline = options.until ?? Date.now()+60000;
  const commitment = hash("A1\n"+key+"\n"+hash(scope));
  const headers = {"X-Ritomer-Qualification-Windows":[options.pin??commitment,hash("B"),hash("A2")].join(","),
    "X-Ritomer-Qualification-Revision":revision,"X-Ritomer-Qualification-Until":new Date(deadline).toISOString()};
  const fetcher = vi.fn(async (input:RequestInfo|URL) => String(input).endsWith("/api/session/bootstrap")
    ? new Response("{}",{headers})
    : Response.json({actor:{userId:options.me==="user"?tenant:key},
      memberships:[{tenantId:options.me==="tenant"?key:tenant,roles:["ACCOUNTANT"]}],
      activeTenant:{tenantId:tenant},effectiveRoles:options.me==="roles"?["ADMIN"]:["ACCOUNTANT"]}));
  vi.stubGlobal("fetch",fetcher);
  history.replaceState(null,"","/#m12/A1/"+key+"/"+hash(scope));
  const w=qualificationWindow()!;
  const coordinator={revalidate:vi.fn(),getSnapshot:()=>({mode:"SESSION_READY"})};
  w.attach(coordinator as unknown as Parameters<typeof w.attach>[0]);
  await w.request("/api/session/bootstrap");
  const a=document.createElement("a"); a.href="/oauth2/authorization/google"; document.body.append(a);
  a.addEventListener("click",ev=>ev.preventDefault()); a.click();
  const label=document.createElement("p"); label.textContent="Session connectée · synthetic"; document.body.append(label);
  vi.spyOn(label,"getClientRects").mockReturnValue({length:1} as DOMRectList);
  const verify=(overrides={})=>window.dispatchEvent(new MessageEvent("message",{origin:local,
    source:(options.foreignSource?window:peer) as Window,data:{invitation:key,command:"VERIFY",scope,revision,expires:deadline,...overrides}}));
  return {w,verify,peer,coordinator,fetcher};
}
afterEach(()=>{window.dispatchEvent(new Event("pagehide")); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();});
it.each(["user","tenant","roles"])("rejects mismatched %s after server verification",async me=>{
  const v=await witness({me});v.verify();
  await vi.waitFor(()=>expect(v.peer.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    event:"FAILURE",code:me==="user"?"CLIENT_IDENTITY":me==="tenant"?"CLIENT_TENANT":"CLIENT_ROLES"}),local));
  expect(v.peer.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({event:"ADMITTED"}),local);
});
it.each([{pin:hash("foreign")},{until:1},{foreignSource:true}])("refuses an unbound, expired or foreign invitation",async options=>{
  const v=await witness(options);v.verify();expect(v.coordinator.revalidate).not.toHaveBeenCalled();
});
it.each([{scope:scope+" "},{revision:"other-revision"},{expires:1}])("refuses altered settings, revision or expiration",async override=>{
  const v=await witness();v.verify(override);
  await vi.waitFor(()=>expect(v.peer.postMessage).toHaveBeenCalledWith(expect.objectContaining({event:"FAILURE"}),local));
  expect(v.coordinator.revalidate).not.toHaveBeenCalled();
});
it.each(["HTTP","network"])("retires an armed witness after failed bootstrap (%s)",async kind=>{
  const v=await witness();
  expect(v.peer.postMessage).toHaveBeenCalledWith(expect.objectContaining({event:"WITNESS_READY"}),local);
  if(kind==="HTTP") v.fetcher.mockResolvedValueOnce(new Response(null,{status:503}));
  else v.fetcher.mockRejectedValueOnce(Error("offline"));
  await v.w.request("/api/session/bootstrap").catch(()=>undefined);
  v.verify();expect(v.coordinator.revalidate).not.toHaveBeenCalled();
});
