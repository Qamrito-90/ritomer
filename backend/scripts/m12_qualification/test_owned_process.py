import os, pathlib, sys, tempfile, time, types, unittest
from unittest.mock import Mock, patch
import owned_process as P
HERE=pathlib.Path(__file__).resolve().parent

class ProcessOwnership(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.addCleanup(patch.stopall);patch.object(P,'WORKSPACE',pathlib.Path(self.tmp.name)).start()

    def test_no_handoff_means_no_effect_and_nominal_exit_closes_family(self):
        marker=pathlib.Path(self.tmp.name)/'effect'
        code="import sys,pathlib; message=sys.stdin.buffer.readline(); assert message==b'DIRECT31_OWNED_START\\n'; pathlib.Path(sys.argv[1]).write_text('owned')"
        family=P.OwnedProcess([sys.executable,'-B','-c',code,str(marker)],dict(os.environ))
        try:
            self.assertFalse(marker.exists());self.assertIsNone(family.child.poll())
            family.send(b'DIRECT31_OWNED_START\n')
            result=family.close(seconds=5)
            self.assertTrue(result['tree_terminated']);self.assertFalse(result['forced_tree_termination'])
            self.assertEqual(marker.read_text(),'owned')
        finally:
            if not family.disposed:family.close(force=True)

    def test_timeout_forces_only_the_owned_family_and_never_passes(self):
        env=dict(os.environ)
        result=P.supervise([sys.executable,'-B','-c','import sys,time;sys.stdin.buffer.readline();time.sleep(30)'],env,.15,owned_family=True)
        self.assertTrue(result['timed_out']);self.assertTrue(result['tree_terminated'])
        self.assertTrue(result['forced_tree_termination']);self.assertNotEqual(result['exit'],0)

    def test_deadline_crossed_during_assignment_blocks_handoff_and_closes(self):
        family=Mock(disposed=False)
        with patch.object(P,'OwnedProcess',return_value=family),patch.object(P.time,'monotonic',side_effect=[10,11]):
            with self.assertRaisesRegex(RuntimeError,'STOP_CHILD_LAUNCH_EXPIRED'):
                P.supervise([],{},20,deadline=11,owned_family=True)
        family.send.assert_not_called()
        family.close.assert_called_once_with(force=True,seconds=15)

    def test_failed_windows_assignment_never_sends_handoff(self):
        marker=pathlib.Path(self.tmp.name)/'not-written'
        job=Mock();job.assign.side_effect=RuntimeError('CLIENT_JOB_ASSIGN_FAILED')
        with patch.object(P,'os',types.SimpleNamespace(name='nt')),patch.object(P,'WindowsProcessJob',return_value=job):
            with self.assertRaisesRegex(RuntimeError,'CLIENT_JOB_ASSIGN_FAILED'):
                P.OwnedProcess([sys.executable,'-B','-c',"import sys,pathlib;sys.stdin.buffer.readline();pathlib.Path(sys.argv[1]).write_text('bad')",str(marker)],dict(os.environ))
        self.assertFalse(marker.exists());job.close.assert_called_once()

    def test_unknown_tree_never_becomes_a_closure_proof(self):
        family=P.OwnedProcess([sys.executable,'-B','-c','import sys;sys.stdin.buffer.readline()'],dict(os.environ))
        family.send(b'exit\n');family.child.wait(timeout=3)
        with patch.object(family,'active',return_value=True),patch.object(family,'terminate'):
            with self.assertRaisesRegex(RuntimeError,'CLIENT_FAMILY_CLOSURE_UNPROVEN'):family.close(seconds=.01)
        self.assertIsNone(family.result)

    @unittest.skipUnless(os.name=='nt','native nested Windows Jobs require Windows')
    def test_native_nested_jobs_close_descendants_after_worker_kill(self):
        marker=pathlib.Path(self.tmp.name)/'nested-ready'
        # Both levels wait for the owning process handoff. No network/application.
        child_code=(
            "import sys,time,pathlib,os,importlib.util;"
            "assert sys.stdin.buffer.readline()==b'DIRECT31_OWNED_START\\n';"
            "s=importlib.util.spec_from_file_location('nested',sys.argv[1]);"
            "p=importlib.util.module_from_spec(s);s.loader.exec_module(p);"
            "p.WORKSPACE=pathlib.Path(sys.argv[2]);"
            "f=p.OwnedProcess([sys.executable,'-B','-c','import sys,time;sys.stdin.buffer.readline();time.sleep(60)'],dict(os.environ));"
            "f.send(b'owned\\n');pathlib.Path(sys.argv[3]).write_text('ready');time.sleep(60)"
        )
        family=P.OwnedProcess([sys.executable,'-B','-c',child_code,str(HERE/'owned_process.py'),
                              self.tmp.name,str(marker)],dict(os.environ))
        try:
            family.send(b'DIRECT31_OWNED_START\n')
            end=time.monotonic()+10
            while not marker.exists() and time.monotonic()<end:time.sleep(.02)
            self.assertTrue(marker.exists(),'nested worker did not reach its owned-child barrier')
            result=family.close(force=True,seconds=15)
            self.assertTrue(result['tree_terminated']);self.assertTrue(result['forced_tree_termination'])
        finally:
            if not family.disposed:family.close(force=True)


if __name__=='__main__':unittest.main()
