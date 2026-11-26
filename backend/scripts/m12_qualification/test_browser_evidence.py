import copy,json,os,pathlib,tempfile,time,unittest,uuid
from unittest.mock import Mock
import campaign
import qualification_oracle as oracle
import native_http as transport
PROJECT="synthetic-local-m12"

class LocalBrowserEvidence(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("RITOMER_M12_LOCAL_OBSERVATIONS"), "requires a Chromium test export")
    def test_reject_mixed_runs_bad_rows_and_nonexclusive_publication(self):
        source = pathlib.Path(os.environ["RITOMER_M12_LOCAL_OBSERVATIONS"])
        observed = json.loads(source.read_bytes())
        ref = observed["publication"]
        run = os.environ["RITOMER_M12_RUN_ID"]
        self.assertEqual(ref["run"],run)
        rows = campaign.read_local(source.parent,run,ref["candidate"],ref["published"])
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            rid = str(uuid.uuid4())
            for fault in ("absent","duplicate","wrong session","wrong operation","unexpected field","out of order"):
                bad = copy.deepcopy(rows)
                if fault == "absent": bad.pop()
                if fault == "duplicate": bad[1]["challenge"] = bad[0]["challenge"]
                if fault == "wrong session": bad[0]["session"] = "REPLACEMENT"
                if fault == "wrong operation": bad[0]["operation"] = "LOGOUT"
                if fault == "unexpected field": bad[0]["extra"] = "unexpected"
                if fault == "out of order": bad.reverse()
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):
                    campaign.publish_local(root,rid,ref["candidate"],bad)
                self.assertEqual(list(root.iterdir()),[])
            digest = campaign.publish_local(root,rid,ref["candidate"],rows)
            with self.assertRaises(FileExistsError): campaign.publish_local(root,rid,ref["candidate"],rows)
            with self.assertRaises(RuntimeError): campaign.read_local(root,rid,ref["candidate"],"0"*64)
            path = root / (rid+".receipts.json")
            other = str(uuid.uuid4())
            path.rename(root/(other+".receipts.json"))
            with self.assertRaisesRegex(RuntimeError,"LOCAL_RUN_BINDING"):
                campaign.read_local(root,other,ref["candidate"],digest)

    def test_partial_binding_and_failed_recovery_do_not_advance_the_browser(self):
        client, stop = Mock(), Mock()
        binding = Mock(side_effect=[None,RuntimeError("UNCONFIRMED")])
        stop.side_effect = RuntimeError("REST_UNCONFIRMED")
        with self.assertRaisesRegex(RuntimeError,"REST_UNCONFIRMED") as caught:
            campaign.activate(client,binding,stop)
        self.assertEqual(str(caught.exception.__context__),"UNCONFIRMED")
        self.assertEqual([c.args for c in binding.call_args_list],[("BIND_A",),("BIND_B",)])
        client.phase.assert_not_called()
        client.finish.assert_not_called()
        client.close.assert_called_once()
        stop.assert_called_once()

    @unittest.skipUnless(os.environ.get("RITOMER_M12_LOCAL_OBSERVATIONS"), "requires a Chromium test export")
    def test_observed_chromium_requests_reach_the_collector(self):
        # Only the provider's transport envelope is synthetic. No client rows or servlet events are generated here.
        source = pathlib.Path(os.environ["RITOMER_M12_LOCAL_OBSERVATIONS"])
        observations = json.loads(source.read_text(encoding="utf-8"))
        self.assertEqual(observations["environment"], "SINGLE_LOCAL_SERVLET_SYNTHETIC_IDP_MEMORY")
        self.assertEqual(observations["simulatedCloud"], ["BIND_A", "BIND_B", "READY_A", "READY_B", "REVOKE_A", "RESTORE_A", "READY_A2", "REST"])
        self.assertEqual(observations["fixture"], "UNMODIFIED_SERVER_EXPIRATION_LOCAL_CLIENT")
        revision = "ritomer-m12-loopback"
        entries = []
        for index, event in enumerate(observations["events"]):
            entries.append({
                "jsonPayload": event["payload"], "timestamp": event["timestamp"], "receiveTimestamp": event["timestamp"],
                "insertId": "synthetic-loopback-" + str(index), "labels": {"instanceId": "0" * 16},
                "resource": {"type": "cloud_run_revision", "labels": {
                    "revision_name": revision, "project_id": PROJECT, "service_name": "ritomer-m12",
                    "location": "europe-west6"}},
                "logName": "projects/" + PROJECT + "/logs/run.googleapis.com%2Fstdout"
            })
        receipt = observations["publication"]
        self.assertEqual(receipt["run"], os.environ["RITOMER_M12_RUN_ID"])
        rows = campaign.read_local(source.parent,receipt["run"],receipt["candidate"],receipt["published"])
        self.assertEqual(rows, observations["rows"])
        correlated = oracle.correlate(entries, rows, {revision},project=PROJECT)
        self.assertEqual([(r["actor"], r["phase"], r["status"]) for r in correlated if r["operation"] in ("ME","LOGOUT")], [
            ("A", "BEFORE", 200), ("B", "BEFORE", 200), ("A", "REVOKED", 403), ("B", "REVOKED", 200),
            ("A", "RESTORED", 401), ("B", "RESTORED", 200),
            ("A", "RELOGIN", 200), ("A", "RELOGIN", 401), ("A", "RELOGIN", 403),
            ("A", "RELOGIN", 200), ("B", "RELOGIN", 200),
            ("A", "LOGOUT", 204), ("A", "LOGOUT", 401), ("B", "LOGOUT", 200)])
        self.assertEqual(sum(r["operation"] in ("DOCUMENT_CONTENT","EXPORT_CONTENT") for r in correlated), 16)
        def read_fixture(method, url, payload):
            self.assertEqual(method, "POST")
            self.assertTrue(url.startswith("https://logging.googleapis.com/v2/entries:list?fields="))
            self.assertTrue(all(r["challenge"] in payload["filter"] for r in rows))
            return 200, {"entries": entries}
        context = {"mode": "P6", "revisions": {revision},
                   "phase_revisions": dict.fromkeys(("REVOKED", "RESTORED", "RELOGIN", "LOGOUT"), revision)}
        with self.assertRaisesRegex(RuntimeError, "^TWO_INSTANCES_NOT_PROVEN$"):
            transport.native_pass(read_fixture, oracle, rows, context, time, time.monotonic()+60,project=PROJECT)



if __name__=='__main__':unittest.main()
