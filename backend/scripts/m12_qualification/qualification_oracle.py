"""Closed M1.2 challenge correlation. Pure validation; no I/O, credentials or Cloud."""
import datetime,re

UUID=re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
REVISION=re.compile(r'ritomer-m12-[a-z0-9-]{1,48}')
PHASES={'BEFORE','AFTER','REVOKED','RESTORED','RELOGIN','LOGOUT'}
HEADER_OPERATIONS={'HEADER_'+x for x in ('ORIGIN','FORWARDED','FORWARDED_HOST','FORWARDED_PORT','FORWARDED_PREFIX','HOST','PROTO')}
PROXY_HEADERS={'HEADER_HOST','HEADER_PROTO'}
BROWSER_OPERATIONS={'DOCUMENT','EXPORT','FOREIGN_DOCUMENT','FOREIGN_EXPORT'}
OPERATIONS=BROWSER_OPERATIONS|{'ME','DOCUMENT_CONTENT','EXPORT_CONTENT','LOGOUT','OTHER'}|HEADER_OPERATIONS
def require(ok,code):
    if not ok:raise RuntimeError(code)
def instant(value):
    require(isinstance(value,str) and len(value)<=40,'TIME_REJECTED')
    result=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
    require(result.tzinfo is not None,'TIME_NOT_UTC_BOUND');return result
def correlate(entries,receipts,revisions,*,project):
    require(isinstance(project,str) and re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]",project),"PROJECT_REJECTED")
    require(isinstance(revisions,set) and 1<=len(revisions)<=3 and all(REVISION.fullmatch(x) for x in revisions),'REVISIONS_REJECTED')
    require(isinstance(entries,list) and isinstance(receipts,list) and len(entries)<=400 and len(receipts)<=400,'CORRELATION_LIMIT')
    expected={};sequences=set()
    for row in receipts:
        require(isinstance(row,dict) and set(row)=={'event','phase','utc','actor','sequence','status','traced','operation','startedAt','challenge','session'},'RECEIPT_SCHEMA_REJECTED')
        require(row['event']=='REQUEST' and row['traced'] is True and row['phase'] in PHASES and row['actor'] in ('A','B') and row['session'] in ('ORIGINAL','REPLACEMENT'),'RECEIPT_IDENTITY_REJECTED')
        require(row['operation'] in OPERATIONS-{'OTHER'} and type(row['status']) is int and (row['status'] in (200,204,400,401,403,404) or row['status']==421 and row['operation'] in PROXY_HEADERS),'RECEIPT_STATUS_REJECTED')
        if row['operation'] in HEADER_OPERATIONS:
            require(row['phase']=='BEFORE' and row['session']=='ORIGINAL' and row['status'] in ({200,400,403,404,421} if row['operation'] in PROXY_HEADERS else {403}),'HEADER_ORACLE_REJECTED')
        require(type(row['sequence']) is int and 1<=row['sequence']<=400 and row['sequence'] not in sequences,'RECEIPT_SEQUENCE_REJECTED')
        sequences.add(row['sequence']);challenge=row['challenge']
        require(isinstance(challenge,str) and UUID.fullmatch(challenge) and challenge not in expected,'CHALLENGE_REJECTED')
        require(instant(row['startedAt'])<=instant(row['utc']),'RECEIPT_TIME_REJECTED');expected[challenge]=row
    observed={};result=[];boot_instances={}
    for entry in entries:
        require(isinstance(entry,dict),'ENTRY_REJECTED');payload=entry.get('jsonPayload',{});resource=entry.get('resource',{});labels=resource.get('labels',{})
        require(set(payload)=={'challenge','bootId','revision','status'},'NATIVE_PAYLOAD_REJECTED')
        challenge=payload['challenge'];require(isinstance(challenge,str) and challenge in expected and challenge not in observed,'NATIVE_CHALLENGE_MULTIPLICITY')
        row=expected[challenge];require(type(payload['status']) is int and payload['status']==row['status'],'NATIVE_STATUS_MISMATCH')
        require(payload['revision'] in revisions and labels.get('revision_name')==payload['revision'],'NATIVE_REVISION_MISMATCH')
        require(isinstance(payload['bootId'],str) and UUID.fullmatch(payload['bootId']),'NATIVE_BOOT_REJECTED')
        require(entry.get('logName')=='projects/'+project+'/logs/run.googleapis.com%2Fstdout' and resource.get('type')=='cloud_run_revision' and labels.get('project_id')==project and labels.get('service_name')=='ritomer-m12' and labels.get('location')=='europe-west6','NATIVE_RESOURCE_REJECTED')
        instance=entry.get('labels',{}).get('instanceId');require(isinstance(instance,str) and re.fullmatch('[0-9a-f]{16,256}',instance),'NATIVE_INSTANCE_REJECTED')
        key=(payload['revision'],payload['bootId']);require(key not in boot_instances or boot_instances[key]==instance,'BOOT_INSTANCE_CONTRADICTION');boot_instances[key]=instance
        occurred=instant(entry.get('timestamp'));start=instant(row['startedAt']);end=instant(row['utc'])
        # Independent service/client clocks are allowed at most five seconds skew; identity is the exact challenge.
        require(start-datetime.timedelta(seconds=5)<=occurred<=end+datetime.timedelta(seconds=5),'NATIVE_TIME_MISMATCH')
        require(isinstance(entry.get('insertId'),str) and 0<len(entry['insertId'])<=256,'NATIVE_INSERT_ID_REJECTED')
        observed[challenge]=entry['insertId']
        result.append(dict(phase=row['phase'],actor=row['actor'],session=row['session'],operation=row['operation'],status=row['status'],
            sequence=row['sequence'],challenge=challenge,revision=payload['revision'],bootId=payload['bootId'],instanceId=instance,
            timestamp=entry['timestamp'],insertId=entry['insertId'],startedAt=row['startedAt'],utc=row['utc']))
    missing=set(expected)-set(observed)
    require(bool(expected) and all(expected[c]['operation'] in PROXY_HEADERS and expected[c]['status'] in (400,403,404,421) for c in missing),'NATIVE_CORRELATION_INCOMPLETE')
    for challenge in missing:
        row=expected[challenge]
        result.append(dict(phase=row['phase'],actor=row['actor'],session=row['session'],operation=row['operation'],status=row['status'],sequence=row['sequence'],challenge=challenge,revision=None,bootId=None,instanceId=None,timestamp=None,insertId=None,startedAt=row['startedAt'],utc=row['utc'],layer='NON_DETERMINE',instance_attribution=False))
    require(len(set(observed.values()))==len(observed),'NATIVE_INSERT_ID_DUPLICATE')
    return sorted(result,key=lambda x:x['sequence'])

def headers(rows,revision):
    selected=[x for x in rows if x['operation'] in HEADER_OPERATIONS]
    require(len(selected)==14,'HEADER_MATRIX_INCOMPLETE');proof=[]
    for actor in ('A','B'):
        for operation in sorted(HEADER_OPERATIONS):
            items=[x for x in selected if x['actor']==actor and x['operation']==operation]
            require(len(items)==1,'HEADER_MATRIX_MULTIPLICITY');row=items[0]
            require(row['phase']=='BEFORE' and row['session']=='ORIGINAL','HEADER_PHASE_REJECTED')
            if row.get('layer')=='NON_DETERMINE':
                require(operation in PROXY_HEADERS and row['status'] in (400,403,404,421) and all(row.get(k) is None for k in ('revision','bootId','instanceId','insertId')),'HEADER_ABSENCE_REJECTED')
            else:require(row['revision']==revision,'HEADER_REVISION_REJECTED')
            proof.append(dict(actor=actor,operation=operation,status=row['status'],challenge=row['challenge'],layer=row.get('layer','APPLICATION_CORRELATED'),instance_attribution=row.get('instance_attribution',True)))
    return proof
def two_instances(rows,phase,actor,session,operation,statuses,revision):
    selected=[x for x in rows if x['phase']==phase and x['actor']==actor and x['session']==session and x['operation']==operation and x['status'] in statuses and x['revision']==revision]
    require(len({x['bootId'] for x in selected})>=2 and len({x['instanceId'] for x in selected})>=2,'TWO_INSTANCES_NOT_PROVEN')
    return dict(phase=phase,actor=actor,session=session,operation=operation,revision=revision,
        challenges=[x['challenge'] for x in selected],bootIds=sorted({x['bootId'] for x in selected}),instanceIds=sorted({x['instanceId'] for x in selected}))
def ordered(rows,phases):
    require(bool(rows),'PHASE_RECEIPTS_MISSING')
    previous_phase=-1;previous_end=None;sequences=set()
    for row in sorted(rows,key=lambda x:x['sequence']):
        require(type(row['sequence']) is int and row['sequence']>0 and row['sequence'] not in sequences,'RECEIPT_SEQUENCE_REJECTED');sequences.add(row['sequence'])
        require(row['phase'] in phases,'UNEXPECTED_PHASE')
        phase=phases.index(row['phase']);require(phase>=previous_phase,'PHASE_ORDER_REJECTED')
        start=instant(row['startedAt']);end=instant(row['utc'])
        require(start<=end and (previous_end is None or start>=previous_end),'CLIENT_TIME_ORDER_REJECTED')
        previous_phase=phase;previous_end=end

def persistence(rows,before,after):
    ordered(rows,['BEFORE','AFTER'])
    require(before!=after,'REPLACEMENT_NOT_PROVEN');proof=[]
    for phase,revision in (('BEFORE',before),('AFTER',after)):
        for actor in ('A','B'):
            for operation in ('ME','DOCUMENT_CONTENT','EXPORT_CONTENT'):
                proof.append(two_instances(rows,phase,actor,'ORIGINAL',operation,{200},revision))
    return proof
def revocation(rows,phase_revisions):
    require(set(phase_revisions)=={'REVOKED','RESTORED','RELOGIN','LOGOUT'},'PHASE_REVISION_BINDING_REJECTED');proof=[]
    ordered(rows,['BEFORE','REVOKED','RESTORED','RELOGIN','LOGOUT'])
    for row in rows:
        if row['phase'] in ('REVOKED','RESTORED','RELOGIN') and row['actor']=='A' and row['session']=='ORIGINAL' and row['operation']=='ME':
            require(row['status'] in (401,403),'OLD_SESSION_RESURRECTED')
        if row['phase'] in ('REVOKED','RESTORED','RELOGIN','LOGOUT') and row['actor']=='B' and row['session']=='ORIGINAL' and row['operation'] in ('ME','DOCUMENT_CONTENT','EXPORT_CONTENT'):
            require(row['status']==200,'B_ACCESS_CONTRADICTION')
        if row['phase']=='RELOGIN' and row['actor']=='A' and row['session']=='REPLACEMENT' and row['operation'] in ('ME','DOCUMENT_CONTENT','EXPORT_CONTENT'):
            require(row['status']==200,'NEW_SESSION_ACCESS_CONTRADICTION')
    logout=[x for x in rows if x['phase']=='LOGOUT' and x['actor']=='A' and x['session']=='REPLACEMENT' and x['operation']=='LOGOUT' and x['status']==204]
    require(len(logout)==1 and logout[0]['revision']==phase_revisions['LOGOUT'],'EXACT_LOGOUT_NOT_PROVEN')
    post_logout=[x for x in rows if x['sequence']>logout[0]['sequence'] and instant(x['startedAt'])>=instant(logout[0]['utc'])]
    require(all(x['status'] in (401,403) for x in post_logout if x['actor']=='A' and x['session']=='REPLACEMENT' and x['operation']=='ME'),'LOGGED_OUT_SESSION_RESURRECTED')
    for phase in ('REVOKED','RESTORED','RELOGIN'):
        revision=phase_revisions[phase]
        proof.append(two_instances(rows,phase,'A','ORIGINAL','ME',{401,403},revision))
        for operation in ('ME','DOCUMENT_CONTENT','EXPORT_CONTENT'):
            proof.append(two_instances(rows,phase,'B','ORIGINAL',operation,{200},revision))
    for operation in ('ME','DOCUMENT_CONTENT','EXPORT_CONTENT'):
        proof.append(two_instances(rows,'RELOGIN','A','REPLACEMENT',operation,{200},phase_revisions['RELOGIN']))
        proof.append(two_instances(post_logout,'LOGOUT','B','ORIGINAL',operation,{200},phase_revisions['LOGOUT']))
    replay=[x for x in post_logout if x['phase']=='LOGOUT' and x['actor']=='A' and x['session']=='REPLACEMENT' and x['operation']=='ME' and x['status'] in (401,403) and x['revision']==logout[0]['revision']]
    other=[x for x in replay if x['instanceId']!=logout[0]['instanceId'] and x['bootId']!=logout[0]['bootId']]
    require(bool(other),'LOGOUT_OTHER_INSTANCE_NOT_PROVEN')
    proof.append(dict(logout=logout[0]['challenge'],other_instance_replays=[x['challenge'] for x in other]))
    return proof
