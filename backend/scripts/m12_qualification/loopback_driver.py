"""Local transport for the shared campaign sequence. No Cloud client or account."""
import json,os,pathlib,re,subprocess,sys
import campaign
import owned_process as P

def serve_fixture(args):
    # Called only by the ephemeral Spring/JUnit fixture. Node has its own origin guard.
    interrupted=args[-1:]==['--fixture-interrupt-after-revoke']
    if interrupted:args=args[:-1]
    directory=pathlib.Path(os.environ["RITOMER_M12_BROWSER_RESULT"]).resolve(strict=True)
    run_id=os.environ["RITOMER_M12_RUN_ID"]
    candidate=campaign.local_candidate()
    origin,idp,exe,actor_a,tenant_a,actor_b,tenant_b,version=args
    P.require(re.fullmatch(r'https://localhost:[0-9]+',origin) and
              re.fullmatch(r'http://127[.]0[.]0[.]1:[0-9]+',idp),'FIXTURE_ORIGIN')
    base=P.WORKSPACE
    child=P.OwnedProcess(['node',str(base/'frontend/e2e/shared-oidc-client.mjs'),*args],dict(os.environ),stdout=subprocess.PIPE)
    def publish(obj):print(json.dumps(obj,separators=(',',':')),flush=True)
    def read():
        raw=child.child.stdout.readline(2049)
        P.require(raw and len(raw)<=2048,'FIXTURE_CLIENT_CLOSED')
        return json.loads(raw)
    def ack(label):
        publish({'next':label})
        P.require(sys.stdin.readline(64).strip()==label,'FIXTURE_EFFECT_NOT_ACKNOWLEDGED')
    seen=set()
    class Client:
        count=0
        invitations=["A","B","A2"]
        def phase(self,phase):
            if interrupted and phase=='REVOKED':raise RuntimeError('FIXTURE_INJECTED_INTERRUPTION')
            child.send((phase+'\n').encode())
            rows=[]
            while True:
                obj=read()
                if set(obj)=={'failure'}:
                    code=obj['failure']
                    if isinstance(code,str) and re.fullmatch(r'FIXTURE_FILE_(SCOPE|HTTP_[1-5][0-9]{2}|LENGTH|CONTENT|CACHE)',code):
                        raise RuntimeError(code)
                    raise RuntimeError('BROWSER_SCENARIO_INCOMPLETE')
                if set(obj)=={'ready'}:
                    actor=obj['ready']
                    P.require(self.invitations and actor==self.invitations[0] and
                              phase==('RELOGIN' if actor=='A2' else 'BEFORE'),'FIXTURE_PERSONAL_ORDER')
                    self.invitations.pop(0)
                    ack('READY_'+actor)
                    child.send(('GO_'+actor+'\n').encode())
                    continue
                if set(obj)=={'done','count'}:
                    P.require(obj['done']==phase and type(obj['count']) is int and
                              obj['count']==self.count+len(rows),'FIXTURE_PHASE_ORDER')
                    self.count+=len(rows)
                    return rows
                P.require(set(obj)=={'event','operation','phase','actor','session','sequence','challenge','traced','startedAt','utc','status'}
                          and obj['phase']==phase,'FIXTURE_PUBLIC_ROW_REJECTED')
                P.require(len(rows)<len(campaign.observations(phase)),'FIXTURE_PHASE_COUNT')
                campaign.check_row(obj,phase,len(rows),self.count+len(rows)+1,seen)
                rows.append(obj)
                publish(obj)
        def finish(self):
            res=child.close(seconds=12)
            P.require(res['exit']==0 and res['tree_terminated'] and not res['forced_tree_termination'],'FIXTURE_CLIENT_NOT_CLOSED')
        def close(self):
            if not child.disposed:
                P.require(child.close(force=True,seconds=12)['tree_terminated'],'FIXTURE_FAMILY_STILL_ACTIVE')
    try:
        child.send(b'FIXTURE_START\n')
        ready=read()
        P.require(ready=={'browserVersion':version},'FIXTURE_BROWSER_VERSION')
        publish(ready)
        rows=campaign.activate(Client(),ack,lambda:ack('REST'))
        digest=campaign.publish_local(directory,run_id,candidate,rows)
        publish({'published':digest,'run':run_id,'candidate':candidate})
    finally:
        if not child.disposed:
            result=child.close(force=True,seconds=12)
            P.require(result['tree_terminated'],'FIXTURE_FAMILY_STILL_ACTIVE')


if __name__=='__main__':
    if sys.argv[1:2]==['--loopback-client']:
        try:serve_fixture(sys.argv[2:])
        except RuntimeError as error:
            if str(error)=='FIXTURE_INJECTED_INTERRUPTION':sys.exit(41)
            raise
    else:sys.exit("expected --loopback-client")
