import copy
import datetime
import queue
import unittest
from unittest.mock import Mock, patch
import uuid

import browser_campaign as campaign


class BrowserCampaignTest(unittest.TestCase):
    @unittest.skipUnless(campaign.os.name == 'nt', 'Windows sharing semantics')
    def test_windows_releases_a_locked_file_only_in_owned_temporary_profile(self):
        client = campaign.CampaignClient.__new__(campaign.CampaignClient)
        client.owner = Mock()
        client.owner.config = {"limits":{}}
        with campaign.tempfile.TemporaryDirectory() as parent:
            client.profile_dir = campaign.tempfile.TemporaryDirectory(dir=parent)
            profile = campaign.Path(client.profile_dir.name)
            with (profile/'synthetic.txt').open('wb') as handle:
                with patch.object(campaign.time, 'sleep', side_effect=lambda _: handle.close()) as delay:
                    client.cleanup_profile()
            delay.assert_called_once_with(0.25)
            self.assertFalse(profile.exists())
            self.assertTrue(campaign.Path(parent).is_dir())

    def test_owned_profile_cleanup_after_windows_sharing_violation(self):
        for persistent in (False, True):
            with self.subTest(persistent=persistent):
                client = campaign.CampaignClient.__new__(campaign.CampaignClient)
                client.owner, client.profile_dir = Mock(), Mock()
                locked = PermissionError("private path must stay private")
                locked.winerror = 32
                client.profile_dir.cleanup.side_effect = [locked, locked if persistent else None]
                with patch.object(campaign.time, 'sleep') as delay:
                    if persistent:
                        with self.assertRaisesRegex(RuntimeError, 'CLIENT_PROFILE_CLEANUP_FAILED'):
                            client.cleanup_profile()
                    else:
                        client.cleanup_profile()
                delay.assert_called_once_with(0.25)
                self.assertEqual(client.profile_dir.cleanup.call_count, 2)
                facts = client.owner.fact.call_args.args
                self.assertEqual(facts[0], 'client_profile_cleanup')
                self.assertEqual(facts[1]['removal_confirmed'], not persistent)
                self.assertNotIn('private', str(facts))

    def setUp(self):
        self.rev = "ritomer-m12-synthetic"
        self.revisions = dict.fromkeys(campaign.STEPS, self.rev)
        self.rows = []
        t = datetime.datetime.now(datetime.timezone.utc)
        for phase, steps in campaign.STEPS.items():
            for index, step in enumerate(steps + (campaign.SHARING if phase == "BEFORE" else ())):
                who, status, op = step.split(":")
                second = phase == "BEFORE" and index >= len(steps)
                self.rows.append(dict(phase=phase, actor=who[0], session="REPLACEMENT" if who=="A2" else "ORIGINAL",
                    status=int(status), operation=op, sequence=len(self.rows)+1, startedAt=t.isoformat(), utc=t.isoformat(),
                    challenge=str(uuid.uuid4()), revision=self.rev, bootId="boot-b" if second else "boot-a",
                    instanceId="instance-b" if second else "instance-a"))

    def test_two_independent_attributions_per_authenticated_operation(self):
        self.assertEqual(campaign.verdict(self.rows,self.revisions)["mode"], "BROWSER_UI")
        for key in ("bootId","instanceId"):
            with self.subTest(key=key):
                changed = [dict(r, **{key:"same"}) if r["actor"]=="B" and r["operation"]=="EXPORT" else r for r in self.rows]
                with self.assertRaisesRegex(RuntimeError, "TWO_INSTANCES_NOT_PROVEN"):
                    campaign.verdict(changed,self.revisions)

    def test_wrong_revision_or_result_is_not_a_browser_verdict(self):
        for change in ({"revision":"ritomer-m12-other"}, {"status":200}, {"operation":"ME"}):
            changed = copy.deepcopy(self.rows)
            next(r for r in changed if r["operation"]=="LOGOUT").update(change)
            with self.assertRaises(RuntimeError):
                campaign.verdict(changed,self.revisions)

    def test_message_arriving_after_deadline_is_rejected(self):
        client = campaign.CampaignClient.__new__(campaign.CampaignClient)
        client.owner = Mock()
        client.owner.config = {"limits":{}}
        client.messages = queue.Queue()
        client.messages.put({"event":"ADMITTED","actor":"B"})
        client.reader_failed = False
        with patch.object(campaign.time,"monotonic",side_effect=[10,12]), self.assertRaisesRegex(RuntimeError,"CLIENT_CONTROL_TIMEOUT"):
            client.receive(11, {})

    def test_window_expiry_during_invitation_blocks_go(self):
        client = campaign.CampaignClient.__new__(campaign.CampaignClient)
        client.owner = Mock()
        client.owner.config = {"limits":{}}
        client.owner.await_open.return_value = {"end":"2030-01-01T00:00:00Z"}
        client.owner.inputs = {"appointment":{"start_utc":"2020-01-01T00:00:00Z"}}
        client.owner.personal_time.side_effect = [None, RuntimeError("WINDOW_CLOSED")]
        client.settings = {"origin":"https://example.invalid"}
        client.send = Mock()
        with self.assertRaisesRegex(RuntimeError,"WINDOW_CLOSED"):
            client.login("A")
        client.send.assert_not_called()

    def test_admission_progress_survives_interruption_and_cannot_replace_identity(self):
        for interrupted in (False, True):
            with self.subTest(interrupted=interrupted):
                client = campaign.CampaignClient.__new__(campaign.CampaignClient)
                client.owner = Mock()
                client.settings = {"origin": "https://example.invalid"}
                client.owner.inputs = {"appointment": {"start_utc": "2020-01-01T00:00:00Z"}}
                client.owner.await_open.return_value = {"end": "2030-01-01T00:00:00Z"}
                client.owner.personal_deadlines = {"B": 99}
                client.owner.config = {"limits":{"verification_seconds":30}}
                client.owner.facts = {"admission:B":{"data":{"revision":self.rev}}}
                client.send = Mock()
                progress = [{"event": "LOGIN_PROGRESS", "actor": "B", "stage": stage} for stage in
                            ("WINDOW_READY", "WITNESS_READY", "LOGIN_STARTED")]
                progress.append({"event":"WORKBENCH_READY", "actor":"B", "page":"witness"})
                client.receive = Mock(side_effect=progress + ([RuntimeError("CLIENT_PROCESS_EOF")] if interrupted
                                                             else [{"event": "ADMITTED", "actor": "B"}]))
                if interrupted:
                    with self.assertRaisesRegex(RuntimeError, "CLIENT_PROCESS_EOF"):
                        client.login("B")
                    client.owner.admission_if_finished.assert_called_once()
                    expected = ("WORKBENCH_READY", "EXPECTED_IDENTITY_TENANT_ROLES")
                else:
                    client.login("B")
                    client.owner.admission_if_finished.assert_called_once()
                    expected = ("PROVIDER_VERIFIED", "NONE")
                label, state = client.owner.fact.call_args.args
                self.assertEqual((label, state["actor"], state["observed"], state["awaiting"], state["page"]),
                                 ("client_login:B", "B", *expected, "witness"))
                self.assertIs(state["server_admitted"], True)
                self.assertEqual(client.send.call_args.args, ({"command":"VERIFY","actor":"B","revision":self.rev},))
                self.assertEqual(state.get("failure"), "CLIENT_PROCESS_EOF" if interrupted else None)
                calls = client.receive.call_args_list
                self.assertEqual([c.args[0] for c in calls], [99]*3 + [129]*2)
                self.assertEqual([c.kwargs["verification"] for c in calls], [False]*3 + [True]*2)
                self.assertTrue(all(c.args[1] == client.owner.await_open.return_value for c in calls))

    def test_timeout_records_which_window_was_ready_before_login(self):
        for stages, missing in ((["WINDOW_READY"], "WITNESS_READY"),
                                (["WINDOW_READY", "WITNESS_READY"], "LOGIN_STARTED")):
            with self.subTest(missing=missing):
                client = campaign.CampaignClient.__new__(campaign.CampaignClient)
                client.owner = Mock()
                client.owner.config = {"limits":{}}
                client.settings = {"origin": "https://example.invalid"}
                client.owner.inputs = {"appointment": {"start_utc": "2020-01-01T00:00:00Z"}}
                client.owner.await_open.return_value = {"end": "2030-01-01T00:00:00Z"}
                client.owner.personal_deadlines = {"A": 99}
                client.send = Mock()
                progress = [{"event":"LOGIN_PROGRESS", "actor":"A1", "stage":stage} for stage in stages]
                client.receive = Mock(side_effect=[*progress, RuntimeError("CLIENT_CONTROL_TIMEOUT")])
                with self.assertRaisesRegex(RuntimeError, "CLIENT_CONTROL_TIMEOUT"):
                    client.login("A")
                label, state = client.owner.fact.call_args.args
                self.assertEqual((label, state["observed"], state["awaiting"], state["failure"]),
                                 ("client_login:A", stages[-1], missing, "CLIENT_CONTROL_TIMEOUT"))
                self.assertFalse(state["server_admitted"])
                client.owner.admission_if_finished.assert_not_called()

    def test_admission_rejects_out_of_order_or_unredacted_message(self):
        client = campaign.CampaignClient.__new__(campaign.CampaignClient)
        client.owner = Mock()
        client.owner.config = {"limits":{}}
        client.settings = {"origin": "https://example.invalid"}
        client.owner.inputs = {"appointment": {"start_utc": "2020-01-01T00:00:00Z"}}
        client.owner.await_open.return_value = {"end": "2030-01-01T00:00:00Z"}
        client.owner.personal_deadlines = {"B": 99}
        client.send = Mock()
        for msg in ({"event":"ADMITTED","actor":"B"}, {"event":"LOGIN_PROGRESS","actor":"A1","stage":"WINDOW_READY"},
                    {"event":"LOGIN_PROGRESS","actor":"B","stage":"WINDOW_READY","extra":"unexpected"}):
            client.receive = Mock(return_value=msg)
            with self.assertRaisesRegex(RuntimeError, "CLIENT_ADMISSION_REJECTED"):
                client.login("B")
        client.owner.admission_if_finished.assert_not_called()
        client.send.side_effect = BrokenPipeError()
        with self.assertRaises(BrokenPipeError):
            client.login("B")
        self.assertEqual(client.owner.fact.call_args.args[1]["awaiting"], "GO_SENT")


if __name__ == "__main__":
    unittest.main()
