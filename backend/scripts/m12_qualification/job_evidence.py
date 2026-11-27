"""Closed validator for the one M12 witness execution and its safe stdout receipts.
Pure functions only. It neither launches jobs nor reads credentials.
"""
import copy,datetime,hashlib,json,re
# The driver provides the approved target when loading these checked bytes.
P = N = REGION = JOB = None
def bind_target(project,number,region):
    global P,N,REGION,JOB
    require(JOB is None and isinstance(project,str) and re.fullmatch('[a-z][a-z0-9-]{4,28}[a-z0-9]',project)
            and isinstance(number,str) and re.fullmatch('[1-9][0-9]{5,19}',number) and region=='europe-west6',
            'JOB_TARGET_REJECTED')
    P,N,REGION=project,number,region
    JOB='projects/'+P+'/locations/'+REGION+'/jobs/ritomer-m12-ops'

UUID=re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')
PHASES={'BEFORE','AFTER','REVOKED','RESTORED','RELOGIN','LOGOUT'}
EVENTS={'REQUEST','ACQUIRED','FIXTURE_PROGRESS','FIXTURE','BARRIER_OBSERVED','PHASE_FINISHED','FINISHED'}
HEADER_OPERATIONS={'HEADER_'+x for x in ('ORIGIN','FORWARDED','FORWARDED_HOST','FORWARDED_PORT','FORWARDED_PREFIX','HOST','PROTO')}
def require(ok,code):
    if not ok:raise RuntimeError(code)
def stamp(value):
    require(isinstance(value,str) and len(value)<=40,'TIME_REJECTED')
    try:result=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
    except (ValueError,OverflowError):raise RuntimeError('TIME_REJECTED') from None
    require(result.tzinfo is not None,'TIME_ZONE_REJECTED');return result
def sha(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def canonical(value):
    require(isinstance(value,str),'NAME_REJECTED')
    return value.replace('projects/'+N+'/', 'projects/'+P+'/',1)
def parent(value,expected):
    return isinstance(value,str) and (value==expected.rsplit('/',1)[-1] or canonical(value)==expected)
def template(value,task_response=False):
    require(isinstance(value,dict),'TEMPLATE_REJECTED')
    keys={'serviceAccount','executionEnvironment','maxRetries','timeout','vpcAccess','containers','volumes','encryptionKey','nodeSelector','gpuZonalRedundancyDisabled'}
    output={'annotations','completionTime','conditions','createTime','deleteTime','etag','execution','expireTime','generation','index','job','labels','lastAttemptResult','logUri','name','observedGeneration','reconciling','retried','satisfiesPzs','scheduledTime','startTime','uid','updateTime'}
    require(set(value)<=keys|(output if task_response else set()),'TASK_FIELDS_REJECTED')
    # Task responses also contain output-only lifecycle fields, which are validated separately.
    result={k:copy.deepcopy(value[k]) for k in keys if k in value}
    require(not any(result.get(k) for k in ('volumes','encryptionKey','nodeSelector','gpuZonalRedundancyDisabled')),'EXTRA_TASK_CONFIGURATION')
    for key in ('volumes','encryptionKey','nodeSelector','gpuZonalRedundancyDisabled'):result.pop(key,None)
    require(result.get('executionEnvironment')=='EXECUTION_ENVIRONMENT_GEN2' and result.get('maxRetries',0)==0,'TASK_RUNTIME_REJECTED')
    result['maxRetries']=0
    vpc=result.get('vpcAccess',{});require(isinstance(vpc,dict),'VPC_FIELDS_REJECTED');interfaces=vpc.get('networkInterfaces',[])
    require(set(vpc)<= {'egress','networkInterfaces','connector'} and all(set(x)<= {'network','subnetwork','tags'} for x in interfaces),'VPC_FIELDS_REJECTED')
    require(vpc.get('egress')=='PRIVATE_RANGES_ONLY' and not vpc.get('connector') and len(interfaces)==1 and not interfaces[0].get('tags'),'VPC_REJECTED')
    network=interfaces[0].get('network');subnetwork=interfaces[0].get('subnetwork')
    require(network in ('ritomer-m12','projects/'+P+'/global/networks/ritomer-m12','projects/'+N+'/global/networks/ritomer-m12') and subnetwork in ('ritomer-m12-ew6','projects/'+P+'/regions/europe-west6/subnetworks/ritomer-m12-ew6','projects/'+N+'/regions/europe-west6/subnetworks/ritomer-m12-ew6'),'VPC_TARGET_REJECTED')
    result['vpcAccess']={'egress':'PRIVATE_RANGES_ONLY','networkInterfaces':[{'network':'ritomer-m12','subnetwork':'ritomer-m12-ew6'}]}
    require(len(result.get('containers',[]))==1,'CONTAINER_COUNT_REJECTED')
    container=result['containers'][0]
    require(set(container)<= {'name','image','command','args','resources','env','volumeMounts','ports','dependsOn','workingDir'} and not any(container.get(k) for k in ('volumeMounts','ports','dependsOn','workingDir')),'CONTAINER_EXTRA_CONFIGURATION')
    for key in ('volumeMounts','ports','dependsOn','workingDir'):container.pop(key,None)
    require(set(container.get('resources',{}))=={'limits'} and container['resources']['limits']=={'cpu':'1','memory':'2Gi'},'RESOURCES_REJECTED')
    env=container.get('env',[])
    require(isinstance(env,list) and len(env)<=24 and all(isinstance(x,dict) and isinstance(x.get('name'),str) for x in env) and len({x['name'] for x in env})==len(env),'ENVIRONMENT_DUPLICATE')
    container['env']=sorted(env,key=lambda x:x['name'])
    return result
def execution_template(value):
    require(isinstance(value,dict) and set(value)=={'taskCount','parallelism','template'} and value['taskCount']==1 and value['parallelism']==1,'EXECUTION_TEMPLATE_REJECTED')
    return dict(taskCount=1,parallelism=1,template=template(value['template']))
def native_templates(execution,task,configured_vpc=None):
    """Complement only fields omitted by the native API, never a present value."""
    e=copy.deepcopy(execution.get('template'));t=copy.deepcopy(task)
    require(isinstance(e,dict) and isinstance(t,dict),'NATIVE_TEMPLATE_REJECTED')
    if 'vpcAccess' not in e:
        require('vpcAccess' in t,'NATIVE_VPC_NOT_OBSERVED');e['vpcAccess']=copy.deepcopy(t['vpcAccess'])
    if 'executionEnvironment' not in t:
        require('executionEnvironment' in e,'NATIVE_RUNTIME_NOT_OBSERVED');t['executionEnvironment']=e['executionEnvironment']
    for view in (e,t):
        network=view.get('vpcAccess')
        if isinstance(network,dict) and 'egress' not in network:
            require(isinstance(configured_vpc,dict) and configured_vpc.get('egress')=='PRIVATE_RANGES_ONLY','NATIVE_EGRESS_NOT_OBSERVED')
            # This is configured egress from the owned Job, NOT a runtime Task observation.
            network['egress']=configured_vpc['egress']
    return template(e),template(t,True)

def configured_execution(execution,expected_template,configured_vpc):
    """Pre-cancel configuration comparison; never a runtime network proof."""
    require(parent(execution.get('job'),JOB) and execution.get('taskCount')==1 and execution.get('parallelism')==1 and execution.get('retriedCount',0)==0 and not execution.get('deleteTime'),'EXECUTION_CONFIGURATION_IDENTITY')
    value=copy.deepcopy(execution.get('template'))
    require(isinstance(value,dict) and isinstance(configured_vpc,dict),'EXECUTION_CONFIGURATION_MISSING')
    if 'vpcAccess' not in value:value['vpcAccess']=copy.deepcopy(configured_vpc)
    elif isinstance(value['vpcAccess'],dict) and 'egress' not in value['vpcAccess']:
        require(configured_vpc.get('egress')=='PRIVATE_RANGES_ONLY','CONFIGURED_EGRESS_REJECTED');value['vpcAccess']['egress']=configured_vpc['egress']
    require(template(value)==template(expected_template),'EXECUTION_CONFIGURATION_MISMATCH')
    return True

def known_facts(facts,name,uid):
    """Retain the complete identity and every previous observation of this Task."""
    identities=[];uids=[];observed=False;started=False
    for row in facts:
        label=row.get('label');identity=None
        if label in ('execution-snapshot','task-observed'):identity=row.get('identity')
        elif label=='cessation-task-proof':identity=row.get('data',{}).get('identity')
        elif label=='result':identity=row.get('identity')
        if identity is not None:
            require(identity.get('execution_uid')==uid and canonical(identity.get('execution_name'))==canonical(name),'HISTORY_EXECUTION_CHANGED')
            identities.append(identity);observed=True
            if identity.get('task_uid') is not None:uids.append(identity['task_uid'])
        if label=='task-presence-observed':
            require(canonical(row['name'])==canonical(name) and row['uid']==uid,'HISTORY_TASK_PRESENCE_CHANGED');observed=True
        if label=='task-terminal':
            data=row['data'];observed=True
            if data.get('execution') is not None:require(parent(data['execution'],name),'HISTORY_TASK_PARENT_CHANGED')
            if data.get('uid') is not None:uids.append(data['uid'])
        if label=='execution-start-observed':
            require(canonical(row['name'])==canonical(name) and row['uid']==uid,'HISTORY_STARTED_IDENTITY_CHANGED');started=True
        if label=='execution-terminal':started=started or bool(row['data'].get('startTime') or row['data'].get('runningCount',0))
    require(all(isinstance(x,str) and UUID.fullmatch(x) for x in uids) and len(set(uids))<=1,'KNOWN_TASK_UID_AMBIGUOUS')
    require(not identities or all(x==identities[0] for x in identities),'KNOWN_TASK_IDENTITY_AMBIGUOUS')
    identity=identities[0] if identities else None;known_uid=uids[0] if uids else None
    require(identity is None or known_uid is None or identity.get('task_uid')==known_uid,'KNOWN_TASK_IDENTITY_CONTRADICTION')
    return dict(known_task_uid=known_uid,known_task_identity=identity,task_observed=observed,started_observed=started)

def snapshot(execution,tasks,expected_name,expected_uid,expected_template,known_task_uid=None,known_task_identity=None,configured_vpc=None):
    require(canonical(expected_name).startswith(JOB+'/executions/') and UUID.fullmatch(expected_uid or ''),'EXPECTED_EXECUTION_REJECTED')
    name=canonical(expected_name);short=name.rsplit('/',1)[-1]
    require(canonical(execution.get('name'))==name and execution.get('uid')==expected_uid and parent(execution.get('job'),JOB),'EXECUTION_IDENTITY_REJECTED')
    require(execution.get('taskCount')==1 and execution.get('parallelism')==1 and execution.get('retriedCount',0)==0 and not execution.get('deleteTime'),'EXECUTION_COUNTS_REJECTED')
    expected=template(expected_template)
    require(isinstance(tasks,dict) and not tasks.get('nextPageToken') and len(tasks.get('tasks',[]))==1,'TASK_COUNT_REJECTED')
    task=tasks['tasks'][0];task_name=name+'/tasks/'+short+'-task0'
    require(canonical(task.get('name'))==task_name and parent(task.get('execution'),name) and parent(task.get('job'),JOB) and task.get('index',0)==0,'TASK_IDENTITY_REJECTED')
    execution_config,task_config=native_templates(execution,task,configured_vpc)
    require(execution_config==expected,'EXECUTION_SNAPSHOT_MISMATCH')
    task_uid=task.get('uid')
    require(('uid' not in task or isinstance(task_uid,str) and UUID.fullmatch(task_uid)) and (known_task_uid is None or task_uid==known_task_uid),'TASK_UID_REJECTED')
    require(task.get('retried',0)==0 and not task.get('deleteTime'),'TASK_RETRY_REJECTED')
    require(task_config==expected,'TASK_SNAPSHOT_MISMATCH')
    identity=dict(execution_name=name,execution_uid=expected_uid,task_name=task_name,task_uid=task_uid,template_sha256=sha(expected))
    if isinstance(task.get('vpcAccess'),dict) and 'egress' not in task['vpcAccess']:
        identity.update(network_egress_evidence='OWNED_JOB_CONFIGURATION_ONLY',runtime_egress_observed=False)
    if task_uid is None:
        require(stamp(execution.get('createTime'))<=stamp(task.get('createTime')),'TASK_CREATION_REJECTED')
        require(task.get('generation')=='1' and task.get('observedGeneration')=='1','TASK_GENERATION_REJECTED')
        require(all(not task.get(k) or stamp(task['createTime'])<=stamp(task[k]) for k in ('startTime','completionTime')),'TASK_CHRONOLOGY_REJECTED')
        identity.update(task_identity_mode='NAME_WITHIN_PINNED_EXECUTION',execution_create_time=execution['createTime'],task_create_time=task['createTime'],task_index=0,task_generation='1')
    if known_task_identity is not None:require(identity==known_task_identity,'TASK_IDENTITY_CHANGED')
    return identity
def terminal(execution,task,identity):
    require(canonical(execution.get('name'))==identity['execution_name'] and execution.get('uid')==identity['execution_uid'] and canonical(task.get('name'))==identity['task_name'] and task.get('uid')==identity['task_uid'],'TERMINAL_IDENTITY_REJECTED')
    if identity.get('task_identity_mode')=='NAME_WITHIN_PINNED_EXECUTION':
        require(execution.get('createTime')==identity['execution_create_time'] and task.get('createTime')==identity['task_create_time'] and task.get('index',0)==0 and task.get('generation')==task.get('observedGeneration')=='1','TERMINAL_FALLBACK_IDENTITY_REJECTED')
    require(execution.get('completionTime') and not execution.get('runningCount',0) and not execution.get('reconciling',False) and execution.get('succeededCount')==1 and all(execution.get(k,0)==0 for k in ('failedCount','cancelledCount','retriedCount')),'EXECUTION_NOT_SUCCESSFUL')
    require(task.get('completionTime') and not task.get('reconciling',False) and task.get('retried',0)==0 and task.get('maxRetries',0)==0,'TASK_NOT_TERMINAL')
    for resource in (execution,task):
        conditions=resource.get('conditions',[]);completed=[c for c in conditions if c.get('type')=='Completed']
        require(len(completed)==1 and completed[0].get('state')=='CONDITION_SUCCEEDED' and not any(c.get('state')=='CONDITION_FAILED' for c in conditions),'COMPLETION_NOT_SUCCESSFUL')
    result=task.get('lastAttemptResult',{})
    require(isinstance(result,dict) and isinstance(result.get('status'),dict) and result.get('exitCode',0)==0 and result.get('termSignal',0)==0 and result['status'].get('code',0)==0,'TASK_EXIT_REJECTED')
    return True
def cessation(execution,tasks,name,uid,expected_template,known_task_uid=None,started_observed=False,task_observed=False,known_task_identity=None,configured_vpc=None):
    require(canonical(execution.get('name'))==canonical(name) and execution.get('uid')==uid and parent(execution.get('job'),JOB),'CESSATION_EXECUTION_IDENTITY')
    require(execution.get('taskCount')==1 and execution.get('parallelism')==1,'CESSATION_EXECUTION_CONFIGURATION')
    require(execution.get('completionTime') and not execution.get('runningCount',0) and not execution.get('reconciling',False) and execution.get('retriedCount',0)==0,'CESSATION_EXECUTION_NOT_TERMINAL')
    counts=[execution.get(k,0) for k in ('succeededCount','failedCount','cancelledCount')]
    require(all(type(x) is int and 0<=x<=1 for x in counts) and sum(counts)==1,'CESSATION_COUNTS_REJECTED')
    completed=[c for c in execution.get('conditions',[]) if c.get('type')=='Completed']
    require(len(completed)==1 and completed[0].get('state') in ('CONDITION_SUCCEEDED','CONDITION_FAILED'),'CESSATION_CONDITION_REJECTED')
    require(isinstance(tasks,dict) and not tasks.get('nextPageToken') and len(tasks.get('tasks',[]))<=1,'CESSATION_TASKS_REJECTED')
    if not tasks.get('tasks'):
        require(known_task_uid is None and known_task_identity is None and not task_observed and not started_observed and counts==[0,0,1] and not execution.get('startTime'),'TASK_ABSENCE_NOT_PRESTART_CANCEL')
        configured_execution(execution,expected_template,configured_vpc) if configured_vpc is not None else require(template(execution.get('template'))==template(expected_template),'CESSATION_EXECUTION_CONFIGURATION')
        return dict(state='NO_TASK_OBSERVED_PRESTART_CANCEL',execution_uid=uid)
    identity=snapshot(execution,tasks,name,uid,expected_template,known_task_uid,known_task_identity,configured_vpc);task=tasks['tasks'][0]
    require(task.get('completionTime') and not task.get('reconciling',False),'CESSATION_TASK_NOT_TERMINAL')
    completed=[c for c in task.get('conditions',[]) if c.get('type')=='Completed']
    require(len(completed)==1 and completed[0].get('state') in ('CONDITION_SUCCEEDED','CONDITION_FAILED'),'CESSATION_TASK_CONDITION_REJECTED')
    return dict(state='EXECUTION_AND_TASK_TERMINAL',identity=identity,functional_success_not_asserted=True)
def payload(value,mode):
    require(isinstance(value,dict),'PAYLOAD_REJECTED')
    if set(value)=={'operation','status'}:
        require(value['operation']==mode and value['status'] in ('PASS','OPERATION_FAILED','CONFIGURATION_REJECTED'),'OPERATION_RESULT_REJECTED');return value
    require(value.get('event') in EVENTS and value.get('phase') in PHASES and 'utc' in value,'EVENT_REJECTED');stamp(value['utc'])
    event=value['event'];keys={'event','phase','utc'}
    if event in ('ACQUIRED','FIXTURE','FIXTURE_PROGRESS','BARRIER_OBSERVED'):
        require(value.get('actor') in ('A','B'),'ACTOR_REJECTED');keys.add('actor')
    if event=='REQUEST':
        keys|={'sequence','status','traced','operation','startedAt'}
        require(type(value.get('sequence')) is int and 1<=value['sequence']<=400 and type(value.get('status')) is int and 100<=value['status']<=599,'REQUEST_VALUE_REJECTED')
        require(type(value.get('traced')) is bool and value.get('operation') in {'ME','DOCUMENT_CONTENT','EXPORT_CONTENT','LOGOUT','OTHER'}|HEADER_OPERATIONS,'REQUEST_OPERATION_REJECTED')
        if value['operation'] in HEADER_OPERATIONS:
            require(mode=='witness-persistence' and value['phase']=='BEFORE' and value.get('actor') in ('A','B') and value.get('session')=='ORIGINAL' and value['traced'],'HEADER_SCOPE_REJECTED')
        require(stamp(value['startedAt'])<=stamp(value['utc']),'REQUEST_TIME_REJECTED')
        if value['traced']:
            keys.add('challenge');require(UUID.fullmatch(value.get('challenge','')) and value['operation']!='OTHER','CHALLENGE_REJECTED')
        else:require(value['operation']=='OTHER','UNTRACED_OPERATION_REJECTED')
        if 'actor' in value:
            keys|={'actor','session'};require(value['actor'] in ('A','B') and value.get('session') in ('ORIGINAL','REPLACEMENT'),'REQUEST_ACTOR_REJECTED')
        else:require(not value['traced'],'ANONYMOUS_TRACED_REJECTED')
    elif event=='FIXTURE_PROGRESS':
        keys.add('folder');require(UUID.fullmatch(value.get('folder','')),'FIXTURE_ID_REJECTED')
        if 'document' in value:keys.add('document');require(UUID.fullmatch(value['document']),'FIXTURE_ID_REJECTED')
    elif event=='FIXTURE':
        keys|={'folder','document','documentHash','documentBytes','export','exportHash','exportBytes'}
        for key in ('folder','document','export'):require(UUID.fullmatch(value.get(key,'')),'FIXTURE_ID_REJECTED')
        for key in ('documentHash','exportHash'):require(re.fullmatch('[0-9a-f]{64}',value.get(key,'')),'FIXTURE_HASH_REJECTED')
        for key in ('documentBytes','exportBytes'):require(type(value.get(key)) is int and 0<value[key]<=4*1024**2,'FIXTURE_SIZE_REJECTED')
    elif event=='BARRIER_OBSERVED':
        keys.add('generation');require(UUID.fullmatch(value.get('generation','')) and value['actor']=='A','BARRIER_GENERATION_REJECTED')
        if 'active' in value:keys.add('active');require(type(value['active']) is bool,'BARRIER_STATE_REJECTED')
        else:keys.add('session');require(value.get('session')=='REPLACEMENT','BARRIER_SESSION_REJECTED')
    elif event=='FINISHED':
        keys.add('status');require(value.get('status')=='HTTP_ASSERTIONS_COMPLETE_NATIVE_CORRELATION_PENDING','FINISHED_STATUS_REJECTED')
    require(set(value)==keys,'PAYLOAD_FIELDS_REJECTED');return value
def receipts(entries,identity,mode,started_at,deadline,complete=False):
    require(mode in ('witness-persistence','witness-revocation') and isinstance(entries,list) and len(entries)<=512,'LOG_INPUT_REJECTED')
    seen=set();rows=[];short=identity['execution_name'].rsplit('/',1)[-1];start=stamp(started_at);end=stamp(deadline)
    for entry in entries:
        resource=entry.get('resource',{});labels=resource.get('labels',{});native=entry.get('labels',{})
        require(resource.get('type')=='cloud_run_job' and labels.get('project_id')==P and labels.get('location')==REGION and labels.get('job_name')=='ritomer-m12-ops','NATIVE_RESOURCE_REJECTED')
        require(native.get('run.googleapis.com/execution_name')==short and native.get('run.googleapis.com/task_index')=='0' and native.get('run.googleapis.com/task_attempt')=='0','NATIVE_EXECUTION_REJECTED')
        require(entry.get('logName')=='projects/'+P+'/logs/run.googleapis.com%2Fstdout' and 'textPayload' not in entry,'NATIVE_STREAM_REJECTED')
        require(isinstance(entry.get('insertId'),str) and 0<len(entry['insertId'])<=256 and entry['insertId'] not in seen,'NATIVE_DUPLICATE');seen.add(entry['insertId'])
        observed=stamp(entry.get('timestamp'));received=stamp(entry.get('receiveTimestamp'))
        require(start-datetime.timedelta(seconds=5)<=observed<=end+datetime.timedelta(seconds=5) and observed-datetime.timedelta(seconds=5)<=received,'NATIVE_TIME_REJECTED')
        value=payload(entry.get('jsonPayload'),mode)
        if 'utc' in value:require(abs((stamp(value['utc'])-observed).total_seconds())<=5,'PAYLOAD_TIME_REJECTED')
        rows.append(value)
    results=[v for v in rows if 'operation' in v and 'event' not in v]
    require(len(results)<=1 and all(v['status']=='PASS' for v in results),'WITNESS_OPERATION_FAILED')
    requests=[v for v in rows if v.get('event')=='REQUEST']
    require(len({v['sequence'] for v in requests})==len(requests),'REQUEST_DUPLICATE')
    ordered=sorted(requests,key=lambda v:v['sequence'])
    require(all(stamp(left['utc'])<=stamp(right['startedAt']) for left,right in zip(ordered,ordered[1:])),'REQUEST_CHRONOLOGY_REJECTED')
    acquired=[v for v in rows if v.get('event')=='ACQUIRED']
    require(len(acquired)<=2 and len({v['actor'] for v in acquired})==len(acquired) and all(v['phase']=='BEFORE' for v in acquired),'ACQUIRED_DUPLICATE')
    finished=[v for v in rows if v.get('event')=='FINISHED'];require(len(finished)<=1,'FINISHED_DUPLICATE')
    if complete:
        require(len(results)==1 and len(finished)==1 and {v['actor'] for v in acquired}=={'A','B'},'WITNESS_INCOMPLETE')
        require(bool(requests) and sorted(v['sequence'] for v in requests)==list(range(1,len(requests)+1)),'REQUEST_SEQUENCE_INCOMPLETE')
        phases=[v['phase'] for v in rows if v.get('event')=='PHASE_FINISHED']
        require(sorted(phases)==sorted(['BEFORE','AFTER'] if mode=='witness-persistence' else ['REVOKED','RESTORED','LOGOUT']),'PHASE_COMPLETION_INCOMPLETE')
        require(finished[0]['phase']==('AFTER' if mode=='witness-persistence' else 'LOGOUT'),'FINISHED_PHASE_REJECTED')
    return rows
def acquired_ack(rows,mode):
    acquired={v['actor']:v for v in rows if v.get('event')=='ACQUIRED'}
    if set(acquired)!={'A','B'}:return False
    for actor,event in acquired.items():
        require(any(v.get('event')=='REQUEST' and v.get('actor')==actor and v.get('session')=='ORIGINAL' and v.get('phase')=='BEFORE' and v.get('operation')=='ME' and v.get('status')==200 and stamp(v['utc'])<=stamp(event['utc']) for v in rows),'ACQUIRED_WITHOUT_ME')
    if mode=='witness-persistence':return True
    requests=sorted([v for v in rows if v.get('event')=='REQUEST' and v.get('actor')=='B'],key=lambda v:v['sequence'])
    if not requests:return False
    last=requests[-1]
    return last.get('session')=='ORIGINAL' and last.get('phase')=='BEFORE' and last.get('operation')=='ME' and last.get('status')==200 and stamp(last['startedAt'])>=stamp(acquired['B']['utc'])
