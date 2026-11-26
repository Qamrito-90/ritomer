"""Spring HTTPS fixture adapter. Cloud effects and personal GO are synthetic."""
import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time

import browser_campaign as recipe
import owned_process


def send(value):
    print(json.dumps(value, separators=(",", ":")), flush=True)


def barrier(name):
    send({"next":name})
    recipe.require(sys.stdin.readline(128).strip() == name, "FIXTURE_BARRIER")


def run(args):
    origin, issuer, exe, user_a, tenant_a, user_b, tenant_b, version, *options = args
    recipe.require(re.fullmatch(r"https://localhost:\d+", origin) and re.fullmatch(r"http://127\.0\.0\.1:\d+", issuer),
                   "FIXTURE_ORIGIN")
    root = owned_process.WORKSPACE
    provider_path = root / "out/m1-2-termination-20261011-01/recette-navigateur.py"
    spec = importlib.util.spec_from_file_location("fixture_provider", provider_path)
    provider = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(provider)
    fixtures = json.loads(os.environ["RITOMER_M12_SYNTHETIC_FILES"])
    for data in fixtures.values():
        for kind in ("document","export"):
            data[kind+"Hash"] = data.pop(kind+"Sha")
            data[kind+"Bytes"] = int(data.pop(kind+"Size"))
    settings = {"origin":origin, "idp_origins":[issuer], "chromium":{"path":exe}, "chromium_version":version,
                "node":{"path":shutil.which("node.exe")}, "client":{"path":str(root/"frontend/e2e/shared-oidc-campaign.fixture.mjs")},
                "actors":{who:{"user_id":user,"tenant_id":tenant,"roles":["ACCOUNTANT" if who=="A" else "ADMIN"]}
                          for who,user,tenant in (("A",user_a,tenant_a),("B",user_b,tenant_b))}, "fixtures":fixtures}
    settings["testSpki"] = os.environ["RITOMER_M12_TEST_SPKI"]
    now = recipe.now()
    stamp = lambda seconds: (now + datetime.timedelta(seconds=seconds)).isoformat()
    output = Path(os.environ["RITOMER_M12_BROWSER_RESULT"]).resolve(strict=True)
    run_id = os.environ["RITOMER_M12_RUN_ID"]
    revision = "ritomer-m12-loopback"

    class Fixture(provider.DirectCampaign):
        def __init__(self):
            self.config = {"project":provider.P, "limits":{"verification_seconds":30}}
            self.auth = {"operation":"ACTIVATE","valid_from_utc":stamp(-10),"valid_until_utc":stamp(1200),
                         "_path":str(provider_path), "parameters":{"observer_until_utc":stamp(700)}}
            self.nominal_deadline = self.deadline = time.monotonic() + 120
            self.auth["config_sha256"] = provider.digest(settings)
            self.inputs = {"appointment":{"start_utc":stamp(-5),"end_utc":stamp(600)}}
            self.effects, self.owned, self.lease = [], [], None
            self.personal_deadlines = {}
            self.facts = {"canary":{"data":{"revision":revision,"proof":{"events":[]}}}}
            self.logs = {}
            self.delayed_a_delivery = False
            self.outputs = {"terminal":output/(run_id+".json")}
            self.run_anchor = stamp(-1)
            self.oracle = provider.finite_leaf({}, "oracle")
            self.rest_verified_this_invocation = False

        def activation_client(self):
            return recipe.CampaignClient(self, owned_process, settings)

        def activation_prepare(self):
            # The fixture hosts the exact filter in-process; publish only public commitments.
            send({"windowCommitments":self.browser_commitments})
            recipe.require(sys.stdin.readline(128).strip() == "WINDOWS_BOUND", "FIXTURE_WINDOW_AUTHORITY")

        def prepare_first_login(self):
            self.guard()  # Cloud readiness and the OPEN/GO envelope are synthetic.

        def activation_binding(self, mode):
            self.effects.append(mode)
            barrier(mode)
            if mode == "REVOKE_A" and options == ["--fixture-interrupt-after-revoke"]:
                raise KeyboardInterrupt

        def guard(self):
            recipe.require(time.monotonic() < self.nominal_deadline, "FIXTURE_TIMEOUT")

        def personal_ready(self, actor):
            if actor == "B":
                recipe.require(self.facts["admission:A"]["data"]["revision"] == revision, "FIXTURE_SERVER_ADMISSION")
                proof = self.facts["client_login:A"]["data"]
                recipe.require(proof["observed"] == "PROVIDER_VERIFIED" and proof["page"] == "witness"
                               and proof["server_admitted"] is True and proof["awaiting"] == "NONE", "FIXTURE_ADMISSION_A")
            if actor == "B" and not options:
                recipe.require(0 < time.monotonic()-self.personal_deadlines["A"] < 30 and self.delayed_a_delivery,
                               "FIXTURE_A_VERIFICATION_GRACE")
            barrier("READY_" + actor)
            self.fact("personal_ready", {"data":{"revision":revision}})
            return actor

        def await_open(self, actor):
            self.personal_deadlines[actor] = min(self.nominal_deadline, time.monotonic() + 25)
            start = recipe.now() - datetime.timedelta(seconds=275)
            window = {"schema":"DIRECT31_PERSONAL_OPEN", "actor":actor, "start":start.isoformat(),
                      "end":(start + datetime.timedelta(minutes=5)).isoformat(),
                      "source_sha256":provider.sha(provider_path), "config_sha256":self.auth["config_sha256"]}
            self.fact("personal_go:"+actor, {"revision":revision, "window_sha256":provider.digest(window),
                                             "provider_timestamp":recipe.now().isoformat()})
            return window

        def service(self,read_until=None):
            return {"latestReadyRevision":revision}

        def privacy_facts(self): pass
        def sql_metadata(self): pass
        def service_transition(self, mode): pass
        def photo(self, mode): pass

        def native_logs(self, scope, limit=None, *, purpose=None):
            if purpose == "MANUAL":
                # The filter emits real Spring OIDC stages. Only the Logging envelope is synthetic.
                send({"read":"loginEvents"})
                events = json.loads(sys.stdin.readline(65536))
                recipe.require(len(events) <= limit, "FIXTURE_LOG_LIMIT")
                # Delay only delivery of this real local Spring callback, once for A.
                if ("A" in self.personal_deadlines and not self.delayed_a_delivery and not options
                    and any(row["payload"]["stage"] == "CALLBACK_FINISHED" for row in events)):
                    self.delayed_a_delivery = True
                    time.sleep(max(0, self.personal_deadlines["A"] + 2.280897 - time.monotonic()))
                return [{"insertId":row["payload"]["bootId"] + ":" + str(row["payload"]["sequence"]),
                         "timestamp":row["timestamp"], "receiveTimestamp":row["timestamp"], "jsonPayload":row["payload"],
                         "labels":{"instanceId":"0"*16}, "logName":"projects/"+provider.P+"/logs/run.googleapis.com%2Fstdout",
                         "resource":{"type":"cloud_run_revision","labels":{"project_id":provider.P,"location":provider.R,
                                     "service_name":"ritomer-m12","revision_name":revision}}} for row in events]
            wanted = re.findall(r'jsonPayload.challenge="([0-9a-f-]+)"', scope)
            for nonce in wanted:
                if nonce not in self.logs:
                    send({"lookup":nonce})
                    event = json.loads(sys.stdin.readline(2048))
                    self.logs[nonce] = {"insertId":nonce, "jsonPayload":event["payload"], "timestamp":event["timestamp"],
                        "receiveTimestamp":event["timestamp"], "labels":{"instanceId":"0"*16},
                        "logName":"projects/"+provider.P+"/logs/run.googleapis.com%2Fstdout",
                        "resource":{"type":"cloud_run_revision","labels":{"project_id":provider.P,"location":"europe-west6",
                                                                         "service_name":"ritomer-m12","revision_name":revision}}}
            return [self.logs[n] for n in wanted]

        def fact(self, label, value):
            self.facts[label] = {"data":value}
            return value

        def rest(self):
            closure = self.facts["client_closure"]["data"]
            recipe.require(closure["terminated"] and closure["tree_terminated"], "FIXTURE_TREE_ALIVE")
            # Retain diagnostic milestones even on the expected red run, before the fixture closes.
            report = {"last_A":self.facts.get("client_login:A", {}).get("data"), "closure":closure,
                      "server_A_stages":[row["data"]["stage"] for row in self.facts.get("admission:A", {}).get("data", {}).get("events", [])],
                      "entered_B":"client_login:B" in self.facts,
                      "simulated_delayed_delivery_A":self.delayed_a_delivery}
            with (output/(run_id+".admission.json")).open("x",encoding="utf8") as receipt:
                json.dump(report,receipt)
            barrier("REST")
            self.fact("final_rest", {"simulated":True})
            self.rest_verified_this_invocation = True

    owner = Fixture()
    try:
        receipt = owner.dispatch()
    except KeyboardInterrupt:
        recipe.require(owner.rest_verified_this_invocation and not owner.outputs["terminal"].with_suffix(".client-receipts.json").exists(),
                       "FIXTURE_INTERRUPTION_UNCLOSED")
        send({"closure":owner.facts["client_closure"]["data"]})
        return 41
    send({"published":receipt["sha256"],"run":run_id,"closure":owner.facts["client_closure"]["data"],
          "sharing":owner.facts["browser_sharing_sample"]["data"]})
    return 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1:]))
