"""Closed M1.2 recipes. Pure construction/validation; no I/O or credentials."""
import base64,datetime,hashlib,json,re
UUID=re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
DIAG='M12_PRIVATE_QUALIFICATION_09'
CLASS='RitomerM12PrivateQualification09'
CLASS_SHA='7200a7815c1f676830a6eb6c17bd32573c4439a4c1634d8378dcc90335026312'
MODES={'BIND_A','BIND_B','REVOKE_A','RESTORE_A','RESET_AB','PHOTO'}
STATES={'INITIAL':0,'A_ONLY':1,'ACTIVE_PAIR':2,'REVOKED_A':2}
def require(ok,code):
    if not ok:raise RuntimeError(code)
def uuid(v):return isinstance(v,str) and UUID.fullmatch(v) is not None
def description(mode,state,generations):
    require(mode in MODES and state in STATES and set(generations)=={'A','B'},'RECIPE_SCHEMA_REJECTED')
    rules=dict(generations)
    for actor,rule in rules.items():
        present=STATES[state]==2 or state=='A_ONLY' and actor=='A'
        require((rule=='ANY' or uuid(rule)) if present and mode=='PHOTO' else uuid(rule) if present else rule=='ABSENT','RECIPE_GENERATION_REJECTED')
    if mode=='PHOTO':return {'pre':state,'post':None,'pre_rules':rules,'post_rules':None,'operation':None}
    expected={'BIND_A':'INITIAL','BIND_B':'A_ONLY','REVOKE_A':'ACTIVE_PAIR','RESTORE_A':'REVOKED_A'}
    require(state in ('A_ONLY','ACTIVE_PAIR','REVOKED_A') if mode=='RESET_AB' else state==expected[mode],'RECIPE_STATE_REJECTED')
    post={'BIND_A':'A_ONLY','BIND_B':'ACTIVE_PAIR','REVOKE_A':'REVOKED_A','RESTORE_A':'ACTIVE_PAIR','RESET_AB':'INITIAL'}[mode]
    after=dict(rules)
    # First insertion has no previous UUID. ANY is limited to that previously absent actor.
    if mode.startswith('BIND_'):after[mode[-1]]='ANY'
    elif mode in ('REVOKE_A','RESTORE_A'):after['A']='NEW_FROM_'+rules['A']
    else:after={'A':'ABSENT','B':'ABSENT'}
    operation='bind' if mode.startswith('BIND_') else 'reset-ab' if mode=='RESET_AB' else 'revoke'
    return {'pre':state,'post':post,'pre_rules':rules,'post_rules':after,'operation':operation}
def shell(mode,state,generations,class_bytes):
    d=description(mode,state,generations)
    require(hashlib.sha256(class_bytes).hexdigest()==CLASS_SHA,'HELPER_CLASS_HASH_REJECTED')
    directory='/tmp/ritomer-m12-binding-09';path=directory+'/'+CLASS+'.class'
    launch='java -XX:-HeapDumpOnOutOfMemoryError -XX:ErrorFile=/dev/null -Dloader.path='+directory+'/ -Dloader.main='+CLASS+' -cp /opt/ritomer/app.jar org.springframework.boot.loader.launch.PropertiesLauncher '
    def mark(stage):return "printf '%s\\n' '"+json.dumps({'recipe':mode,'stage':stage},separators=(',',':'))+"'"
    def inspect(stage,selected,rules):
        if stage=='POST' and mode=='RESET_AB' or mode=='PHOTO' and selected=='INITIAL':command=launch+'INITIAL'
        else:command='RITOMER_M12_EXPECTED_BINDING_STATE='+selected+' RITOMER_M12_GENERATION_A='+rules['A']+' RITOMER_M12_GENERATION_B='+rules['B']+' '+launch+'BINDING_RECOVERY'
        return [mark(stage),command]
    commands=['set -eu','umask 077','mkdir '+directory,"printf '%s' '"+base64.b64encode(class_bytes).decode()+"' | base64 -d >'"+path+"'","printf '%s\\n' '"+CLASS_SHA+'  '+path+"' | sha256sum -c >/dev/null"]
    commands+=inspect('PRE',state,d['pre_rules'])
    if d['operation']:
        commands.append(mark('OPERATION'))
        child=[]
        if mode.startswith('BIND_'):
            actor=mode[-1];child+=['export RITOMER_M12_ACTOR='+actor,'export RITOMER_M12_SUBJECT="$RITOMER_M12_SUBJECT_'+actor+'"','unset RITOMER_M12_SUBJECT_A RITOMER_M12_SUBJECT_B']
        elif mode in ('REVOKE_A','RESTORE_A'):
            child+=['unset RITOMER_M12_SUBJECT_A RITOMER_M12_SUBJECT_B','export RITOMER_M12_ACTOR=A','export RITOMER_M12_BINDING_ACTIVE='+('true' if mode=='RESTORE_A' else 'false'),'export RITOMER_M12_EXPECTED_BINDING='+generations['A']]
        else:child+=['export RITOMER_M12_RESET_BINDING_'+a+'='+generations[a] for a in ('A','B')]
        child+=['exec java -XX:-HeapDumpOnOutOfMemoryError -XX:ErrorFile=/dev/null -Dloader.main=ch.qamwaq.ritomer.devtools.SharedCloudOperations -cp /opt/ritomer/app.jar org.springframework.boot.loader.launch.PropertiesLauncher '+d['operation']]
        commands.append('( '+ '; '.join(child)+' )')
        commands+=inspect('POST',d['post'],d['post_rules'])
    commands.append(mark('COMPLETE'))
    return ['-c','; '.join(commands)]
def _equal(value,wanted):
    require(set(value)==set(wanted),'RECIPE_PAYLOAD_KEYS_REJECTED')
    for key,expected in wanted.items():
        actual=value[key]
        if type(expected) is bool:require(type(actual) is bool and actual==expected,'RECIPE_BOOLEAN_REJECTED')
        elif type(expected) is int:require(type(actual) in (int,float) and actual==expected,'RECIPE_NUMBER_REJECTED')
        else:require(type(actual) is type(expected) and actual==expected,'RECIPE_VALUE_REJECTED')
def validate_payloads(payloads,mode,state,generations,complete=True):
    """All stdout entries in native chronological order, including unexpected or FAIL rows."""
    d=description(mode,state,generations);require(len(payloads)<=32,'RECIPE_LOG_LIMIT')
    phases=['PRE']+(['OPERATION','POST'] if d['operation'] else [])+['COMPLETE'];blocks={};selected=None
    for value in payloads:
        require(isinstance(value,dict),'RECIPE_PAYLOAD_REJECTED')
        if 'recipe' in value:
            require(len(blocks)<len(phases),'RECIPE_EXTRA_PHASE')
            selected=phases[len(blocks)];_equal(value,{'recipe':mode,'stage':selected});blocks[selected]=[]
        else:
            require(selected is not None and selected!='COMPLETE','RECIPE_PHASE_MISSING')
            blocks[selected].append(value)
            require(value.get('status')=='PASS','RECIPE_OPERATION_FAILED')
    result={}
    for phase,values in blocks.items():
        if phase=='COMPLETE':require(not values,'RECIPE_TRAILING_ROWS');continue
        if phase=='OPERATION':
            require(len(values)<=1,'RECIPE_OPERATION_DUPLICATE')
            for value in values:_equal(value,{'operation':d['operation'],'status':'PASS'})
            if complete or phase!=selected:require(len(values)==1,'RECIPE_OPERATION_MISSING')
            continue
        selected_state=d['pre'] if phase=='PRE' else d['post'];rules=d['pre_rules'] if phase=='PRE' else d['post_rules']
        initial=phase=='POST' and mode=='RESET_AB' or mode=='PHOTO' and selected_state=='INITIAL'
        wanted=[{'step':'CONFIGURATION'},{'step':'TARGET','privateIpMatches':True,'postgres17':True,'transactionReadOnly':True,'tls':True},{'step':'IDENTITIES','tenants':2,'actors':2,'memberships':2,'bindings':STATES[selected_state],'exactSets':True}]
        found={}
        if initial:wanted.append({'step':'UNBOUND_SESSIONS','securityContextAttributes':0,'oidcTransactionCount':0})
        else:
            for actor in ('A','B'):
                present=STATES[selected_state]==2 or selected_state=='A_ONLY' and actor=='A';active=not(actor=='A' and selected_state=='REVOKED_A')
                row={'step':'BINDING_RECOVERY','actor':actor,'expectedState':selected_state,'present':present,'membership':'ACTIVE' if active else 'INACTIVE'}
                index=len(wanted)
                if present and index<len(values):
                    generation=values[index].get('generation');require(uuid(generation),'RECIPE_UUID_REJECTED');rule=rules[actor]
                    require(rule=='ANY' or rule.startswith('NEW_FROM_') and generation!=rule[9:] or rule==generation,'RECIPE_GENERATION_MISMATCH')
                    row.update(generation=generation,active=active);found[actor]=generation
                wanted.append(row)
        wanted.append({'step':'COMPLETE','ddlExecuted':False,'expectedDataMatches':True})
        require(len(values)<=len(wanted),'RECIPE_EXTRA_ROWS')
        for value,fields in zip(values,wanted):_equal(value,{'diagnostic':DIAG,'status':'PASS',**fields})
        require(len(set(found.values()))==len(found),'RECIPE_DUPLICATE_GENERATION')
        if complete or phase!=selected:require(len(values)==len(wanted),'RECIPE_INCOMPLETE_PHASE')
        result[phase]=found
    if complete:require(list(blocks)==phases,'RECIPE_INCOMPLETE')
    return result
