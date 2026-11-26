"""Native HTTP evidence pass; no application requests, credentials or mutations."""
import datetime,json
from urllib.parse import quote
def require(ok,code):
 if not ok:raise RuntimeError(code)
def native_pass(request,Q,witness_rows,context,clock,deadline,*,project):
 expected=[x for x in witness_rows if x.get('event')=='REQUEST' and x.get('traced') is True]
 require(0<len(expected)<=400 and all(Q.UUID.fullmatch(x.get('challenge','')) for x in expected),'HTTP_EXPECTATIONS_REJECTED')
 begin=min(Q.instant(x['startedAt']) for x in expected)-datetime.timedelta(seconds=5);P=project
 scope='resource.type="cloud_run_revision" AND resource.labels.project_id="'+P+'" AND resource.labels.location="europe-west6" AND resource.labels.service_name="ritomer-m12" AND timestamp>="'+begin.isoformat()+'"'
 views=['projects/'+P+'/locations/global/buckets/'+b+'/views/_AllLogs' for b in ('_Default','_Required')]
 def entries(view,filters,positive=False):
  result=[];token=None;seen=set()
  fields='entries(insertId,timestamp,receiveTimestamp,logName,resource,labels,jsonPayload,textPayload),nextPageToken' if positive else 'entries(insertId),nextPageToken'
  for _ in range(20):
   require(clock.monotonic()+20<deadline,'NATIVE_COLLECTION_DEADLINE')
   payload=dict(resourceNames=[view],filter=filters,pageSize=100,orderBy='timestamp asc')
   if token:payload['pageToken']=token
   _,page=request('POST','https://logging.googleapis.com/v2/entries:list?fields='+quote(fields,safe=''),payload)
   require(not page.get('unreachables'),'NATIVE_DESTINATION_UNREACHABLE');result.extend(page.get('entries',[]));require(len(result)<=400,'NATIVE_COLLECTION_LIMIT')
   token=page.get('nextPageToken')
   if not token:return result
   require(token not in seen,'NATIVE_PAGE_CYCLE');seen.add(token)
  raise RuntimeError('NATIVE_PAGINATION_LIMIT')
 native=[]
 for offset in range(0,len(expected),50):
  challenges=' OR '.join('jsonPayload.challenge="'+x['challenge']+'"' for x in expected[offset:offset+50])
  native.extend(entries(views[0],scope+' AND logName="projects/'+P+'/logs/run.googleapis.com%2Fstdout" AND ('+challenges+')',True));require(len(native)<=400,'NATIVE_COLLECTION_LIMIT')
 for entry in native:
  require('textPayload' not in entry and isinstance(entry.get('receiveTimestamp'),str) and Q.instant(entry['receiveTimestamp'])>=Q.instant(entry['timestamp'])-datetime.timedelta(seconds=5),'NATIVE_RECEIVE_TIME_REJECTED')
 correlated=Q.correlate(native,expected,context['revisions'],project=P)
 if context['mode']=='BROWSER_UI':proof=context['browser_verdict'](correlated,context['phase_revisions'])
 elif context['mode']=='P5':proof=Q.persistence(correlated,context['before'],context['after'])
 elif context['mode']=='P6':proof=Q.revocation(correlated,context['phase_revisions'])
 else:raise RuntimeError('NATIVE_MODE_REJECTED')
 header_proof=Q.headers(correlated,context['before']) if context['mode']=='P5' else []
 require(context['mode']=='P5' or not any(x['operation'] in Q.HEADER_OPERATIONS for x in correlated),'HEADER_MODE_REJECTED')
 absence=[len(entries(view,scope+' AND logName="projects/'+P+'/logs/run.googleapis.com%2Frequests"')) for view in views]
 require(absence==[0,0],'REQUEST_LOG_PERSISTENCE_PRESENT')
 # Native payloads are emitted only after exact schema/identity/time validation.
 sanitized=[dict(insertId=x['insertId'],timestamp=x['timestamp'],receiveTimestamp=x['receiveTimestamp'],logName=x['logName'],resource=dict(type=x['resource']['type'],labels={k:x['resource']['labels'].get(k) for k in ('project_id','location','service_name','revision_name','configuration_name')}),labels=dict(instanceId=x['labels']['instanceId']),jsonPayload=x['jsonPayload']) for x in native]
 sanitized.sort(key=lambda x:x['insertId'])
 return dict(native=sanitized,correlated=correlated,proof=proof,header_proof=header_proof,request_log_counts=absence,absence_search_no_upper_timestamp_bound=True)
