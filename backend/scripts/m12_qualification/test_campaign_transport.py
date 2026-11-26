import json
import subprocess
import unittest
from unittest.mock import Mock, patch

import campaign_transport as transport
import owned_process


class ProbeTests(unittest.TestCase):
    def test_campaign_data_is_refused_before_creating_a_child(self):
        with patch.object(owned_process, "OwnedProcess") as process:
            with self.assertRaisesRegex(RuntimeError, "CLIENT_PROBE_CONFIG"):
                transport.probe_runtime({"actors": {}, "origin": "https://unused.invalid"})
            process.assert_not_called()

    def test_failure_timeout_and_interrupt_close_the_owned_family(self):
        settings = {"node": {"path": "node"}, "client": {"path": "client"},
                    "chromium": {"path": "chrome"}, "chromium_version": "1.0.0.0"}
        for error in (OSError(), subprocess.TimeoutExpired("probe", 30), KeyboardInterrupt()):
            with self.subTest(error=type(error).__name__):
                family = Mock(disposed=False)
                family.child.communicate.side_effect = error
                with patch.object(transport, "verify_runtime"), patch.object(owned_process, "OwnedProcess", return_value=family):
                    with self.assertRaises(type(error)):
                        transport.probe_runtime(settings)
                family.close.assert_called_once_with(force=True, seconds=15)

    def test_events_alone_do_not_prove_graceful_closure(self):
        settings = {"node": {"path": "node"}, "client": {"path": "client"},
                    "chromium": {"path": "chrome"}, "chromium_version": "1.0.0.0"}
        events = [{"event": "READY", "version": "1.0.0.0", "destination": "LOOPBACK_ONLY"}, {"event": "CLOSED"}]
        family = Mock(disposed=True)
        family.child.communicate.return_value = ('\n'.join(map(json.dumps, events)).encode(), None)
        family.close.return_value = {"exit": 0, "tree_terminated": True, "forced_tree_termination": True}
        with patch.object(transport, "verify_runtime"), patch.object(owned_process, "OwnedProcess", return_value=family):
            with self.assertRaisesRegex(RuntimeError, "CLIENT_PROBE_FAILED"):
                transport.probe_runtime(settings)


if __name__ == "__main__":
    unittest.main()
