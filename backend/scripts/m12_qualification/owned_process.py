"""Local subprocess ownership, bounded shutdown and Windows Job Objects."""
import os
from pathlib import Path
import subprocess
import time

WORKSPACE = Path(__file__).resolve().parents[3]

def require(condition, code):
    if not condition:
        raise RuntimeError(code)


class WindowsProcessJob:
    """The unnamed kernel Job belongs only to this invocation; no PID lookup."""
    def __init__(self):
        import ctypes as C
        self.C=C;self.handle=None
        class Basic(C.Structure):
            _fields_=[('process_time',C.c_int64),('job_time',C.c_int64),('flags',C.c_uint32),
                      ('min_ws',C.c_size_t),('max_ws',C.c_size_t),('active_limit',C.c_uint32),
                      ('affinity',C.c_size_t),('priority',C.c_uint32),('scheduling',C.c_uint32)]
        class IO(C.Structure):
            _fields_=[(name,C.c_uint64) for name in ('read','write','other','read_bytes','write_bytes','other_bytes')]
        class Extended(C.Structure):
            _fields_=[('basic',Basic),('io',IO),('process_memory',C.c_size_t),('job_memory',C.c_size_t),
                      ('peak_process',C.c_size_t),('peak_job',C.c_size_t)]
        class Accounting(C.Structure):
            _fields_=[(name,C.c_int64) for name in ('user','kernel','period_user','period_kernel')]+[
                      (name,C.c_uint32) for name in ('faults','total','active','terminated')]
        self.Accounting=Accounting;k=C.WinDLL('kernel32',use_last_error=True);self.k=k
        signatures={
          'CreateJobObjectW':([C.c_void_p,C.c_wchar_p],C.c_void_p),
          'SetInformationJobObject':([C.c_void_p,C.c_int,C.c_void_p,C.c_uint32],C.c_int),
          'AssignProcessToJobObject':([C.c_void_p,C.c_void_p],C.c_int),
          'QueryInformationJobObject':([C.c_void_p,C.c_int,C.c_void_p,C.c_uint32,C.c_void_p],C.c_int),
          'TerminateJobObject':([C.c_void_p,C.c_uint32],C.c_int),
          'SetHandleInformation':([C.c_void_p,C.c_uint32,C.c_uint32],C.c_int),
          'IsProcessInJob':([C.c_void_p,C.c_void_p,C.c_void_p],C.c_int),
          'CloseHandle':([C.c_void_p],C.c_int)}
        for name,(args,result) in signatures.items():
            fn=getattr(k,name);fn.argtypes=args;fn.restype=result
        self.handle=k.CreateJobObjectW(None,None);require(self.handle,'CLIENT_JOB_CREATE_FAILED')
        try:
            limit=Extended();limit.basic.flags=0x2000
            require(k.SetInformationJobObject(self.handle,9,C.byref(limit),C.sizeof(limit))
                    and k.SetHandleInformation(self.handle,1,0),'CLIENT_JOB_CONFIG_FAILED')
        except BaseException:self.close();raise

    def assign(self,child):
        C=self.C;inside=C.c_int()
        require(self.k.AssignProcessToJobObject(self.handle,C.c_void_p(int(child._handle)))
                and self.k.IsProcessInJob(C.c_void_p(int(child._handle)),self.handle,C.byref(inside))
                and inside.value,'CLIENT_JOB_ASSIGN_FAILED')

    def active(self):
        value=self.Accounting()
        require(self.k.QueryInformationJobObject(self.handle,1,self.C.byref(value),self.C.sizeof(value),None),
                'CLIENT_JOB_STATE_UNKNOWN')
        return value.active

    def terminate(self):require(self.k.TerminateJobObject(self.handle,1),'CLIENT_JOB_STOP_FAILED')

    def close(self):
        if self.handle:
            handle=self.handle;self.handle=None
            require(self.k.CloseHandle(handle),'CLIENT_JOB_HANDLE_CLOSE_FAILED')


class OwnedProcess:
    """Start behind stdin handoff; prove the direct child and its family closed."""
    def __init__(self,argv,env,stdout=subprocess.DEVNULL):
        self.job=WindowsProcessJob() if os.name=='nt' else None;self.child=None;self.result=None;self.disposed=False
        try:
            self.child=subprocess.Popen(argv,cwd=WORKSPACE,env=env,stdin=subprocess.PIPE,
                stdout=stdout,stderr=subprocess.DEVNULL,close_fds=True,start_new_session=os.name!='nt')
            if self.job:self.job.assign(self.child)
        except BaseException:
            try:
                if self.child and self.child.poll() is None:self.child.kill();self.child.wait(timeout=15)
            finally:
                try:
                    if self.job:self.job.close()
                finally:
                    if self.child:
                        for stream in (self.child.stdin,self.child.stdout):
                            if stream:stream.close()
            raise

    def send(self,value):
        require(self.result is None and self.child.poll() is None,'CLIENT_PROCESS_CLOSED')
        self.child.stdin.write(value);self.child.stdin.flush()

    def active(self):
        if self.job:return self.job.active()!=0
        try:os.killpg(self.child.pid,0);return True
        except ProcessLookupError:return False

    def terminate(self):
        if self.job:self.job.terminate()
        else:
            import signal
            try:os.killpg(self.child.pid,signal.SIGKILL)
            except ProcessLookupError:pass

    def close(self,force=False,seconds=15):
        if self.result is not None:return self.result
        require(not self.disposed,'CLIENT_FAMILY_CLOSURE_UNPROVEN')
        end=time.monotonic()+seconds;forced=force
        try:
            if force:self.terminate()
            try:self.child.wait(timeout=max(0,end-time.monotonic()-(0 if force else min(5,seconds/3))))
            except subprocess.TimeoutExpired:
                forced=True;self.terminate()
                self.child.wait(timeout=max(0,end-time.monotonic()))
            # Windows may still be reaping renderer processes after the browser's
            # main process exits normally. Reserve time for a forced shutdown.
            graceful_until=end-min(2,seconds/4)
            while not force and self.active() and time.monotonic()<graceful_until:
                time.sleep(.05)
            if self.active():
                forced=True;self.terminate()
                while self.active() and time.monotonic()<end:time.sleep(.05)
            require(self.child.poll() is not None and not self.active(),'CLIENT_FAMILY_CLOSURE_UNPROVEN')
            self.result={'pid':self.child.pid,'exit':self.child.returncode,'terminated':True,
                         'tree_terminated':True,'forced_tree_termination':forced}
            return self.result
        finally:
            self.disposed=True
            try:
                if self.job:self.job.close()
            finally:
                for stream in (self.child.stdin,self.child.stdout):
                    if stream:stream.close()


def supervise(argv,env,timeout,deadline=None,*,owned_family=False):
    """Only the exact child created here can be stopped; no PID scanning/killing."""
    if deadline is not None:require(time.monotonic()<deadline,'STOP_CHILD_LAUNCH_EXPIRED')
    if owned_family:
        family=OwnedProcess(argv,env);timed_out=False
        try:
            if deadline is not None:require(time.monotonic()<deadline,'STOP_CHILD_LAUNCH_EXPIRED')
            family.send(b'DIRECT31_OWNED_START\n')
            if deadline is not None:timeout=min(timeout,max(0,deadline-time.monotonic()))
            try:family.child.wait(timeout=timeout)
            except subprocess.TimeoutExpired:timed_out=True
            result=family.close(force=timed_out,seconds=15)
            return dict(result,timed_out=timed_out or (deadline is not None and time.monotonic()>=deadline))
        finally:
            if not family.disposed:family.close(force=True,seconds=15)
    child=subprocess.Popen(argv,cwd=WORKSPACE,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    timed_out=False
    try:
        if deadline is not None:timeout=min(timeout,max(0,deadline-time.monotonic()))
        try:code=child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out=True;child.kill();code=child.wait(timeout=15)
        if deadline is not None and time.monotonic()>=deadline:timed_out=True
        return {'pid':child.pid,'exit':code,'timed_out':timed_out,'terminated':child.poll() is not None}
    finally:
        if child.poll() is None:
            child.kill();child.wait(timeout=15)
