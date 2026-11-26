"""Pinned browser transport for DirectCampaign; the provider retains all authority/effects.

This module never receives a cookie, CSRF token, Google credential or HTTP body.
The same campaign sequence drives local fixtures and native collection.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import tempfile
import threading
import time
import uuid
from urllib.parse import urlsplit


def require(ok, code):
    if not ok:
        raise RuntimeError(code)


def instant(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|\+00:00)", value),
            "CLIENT_TIME_REJECTED")
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def origin(value):
    require(isinstance(value, str), "CLIENT_ORIGIN_REJECTED")
    u = urlsplit(value)
    require(u.scheme == "https" and u.hostname and not u.username and not u.password and
            not u.path and not u.query and not u.fragment and value == "https://" + u.netloc,
            "CLIENT_ORIGIN_REJECTED")
    return value


def validate_config(config, workspace, expected_origin, *, files=True):
    """Read-only capability check, not an execution or budget authorization."""
    value = config.get("browser_transport")
    require(isinstance(value, dict), "CLIENT_RECEIPT_PRODUCER_UNAVAILABLE")
    fields = {"schema", "empty_probe", "origin", "node", "chromium", "client", "chromium_version", "actors", "idp_origins"}
    require(isinstance(value, dict) and value.keys() == fields and value["schema"] == "M12_BROWSER_UI_STANDARD_V1",
            "CLIENT_TRANSPORT_CONFIG_MISSING")
    require(origin(value["origin"]) == expected_origin, "CLIENT_ORIGIN_REJECTED")
    require(isinstance(value["idp_origins"], list) and 0 < len(value["idp_origins"]) <= 12 and
            len(set(value["idp_origins"])) == len(value["idp_origins"]), "CLIENT_IDP_SCOPE")
    for item in value["idp_origins"]:
        origin(item)
        require(item == "https://" + urlsplit(item).hostname and item != expected_origin and urlsplit(item).hostname in {
            "accounts.google.com", "accounts.google.ch", "accounts.gstatic.com", "ssl.gstatic.com", "www.gstatic.com",
            "apis.google.com", "fonts.googleapis.com", "fonts.gstatic.com"}, "CLIENT_IDP_SCOPE")
    require("https://accounts.google.com" in value["idp_origins"], "CLIENT_IDP_SCOPE")
    root = Path(workspace).resolve()
    expected = {"client": root / "frontend/e2e/shared-oidc-campaign.mjs",
                "empty_probe": root / "frontend/e2e/shared-oidc-campaign-probe.mjs"}
    for key in ("empty_probe", "node", "chromium", "client"):
        ref = value[key]
        require(isinstance(ref, dict) and ref.keys() == {"path", "sha256"} and isinstance(ref["path"], str)
                and re.fullmatch(r"[0-9a-f]{64}", ref["sha256"] or ""), "CLIENT_RUNTIME_BINDING")
        path = Path(ref["path"])
        require(path.is_absolute(), "CLIENT_RUNTIME_PATH")
        if key in expected:
            require(path.resolve() == expected[key].resolve(), "CLIENT_RUNTIME_PATH")
        if key == "chromium":
            chrome = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe"
            require(path.resolve() == chrome.resolve(), "CLIENT_STANDARD_BROWSER_REQUIRED")
        if files:
            require(path.is_file(), "CLIENT_RUNTIME_CHANGED")
            with path.open("rb") as stream:
                require(hashlib.file_digest(stream, "sha256").hexdigest() == ref["sha256"], "CLIENT_RUNTIME_CHANGED")
    require(re.fullmatch(r"\d+\.\d+\.\d+\.\d+", value["chromium_version"] or ""), "CLIENT_RUNTIME_VERSION")
    uuid = re.compile(r"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}")
    require(isinstance(value["actors"], dict) and value["actors"].keys() == {"A", "B"}, "CLIENT_ACTORS_REJECTED")
    for key in ("A", "B"):
        actor = value["actors"][key]
        require(isinstance(actor, dict) and actor.keys() == {"user_id", "tenant_id", "roles"} and
                all(isinstance(actor[k], str) and uuid.fullmatch(actor[k]) for k in ("user_id", "tenant_id")) and
                actor["tenant_id"] == config.get("tenants", {}).get(key), "CLIENT_ACTOR_SCOPE")
        roles = actor["roles"]
        require(isinstance(roles, list) and 0 < len(roles) <= 16 and len(set(roles)) == len(roles) and
                all(isinstance(r, str) and re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", r) for r in roles), "CLIENT_ROLES_REJECTED")
        fixture = config.get("fixtures", {}).get(key, {})
        require(fixture.keys() == {"folder", "document", "export", "documentBytes", "exportBytes", "documentHash", "exportHash"}
                and all(isinstance(fixture[k], str) and uuid.fullmatch(fixture[k]) for k in ("folder", "document", "export"))
                and all(type(fixture[k + "Bytes"]) is int and 0 < fixture[k + "Bytes"] <= 4194304 and
                        isinstance(fixture[k + "Hash"], str) and re.fullmatch(r"[0-9a-f]{64}", fixture[k + "Hash"])
                        for k in ("document", "export")), "CLIENT_FIXTURE_SCOPE")
    require(value["actors"]["A"]["user_id"] != value["actors"]["B"]["user_id"] and
            value["actors"]["A"]["tenant_id"] != value["actors"]["B"]["tenant_id"], "CLIENT_ACTORS_NOT_DISTINCT")
    require(not any(v and re.match(r"(?:https?_proxy|all_proxy|node_options|node_debug|node_extra_ca_certs|"
                                  r"node_tls_reject_unauthorized|sslkeylogfile|pwdebug|debug|playwright_)", k, re.I)
                    for k, v in os.environ.items()), "CLIENT_ENV_REJECTED")
    a, b = config["fixtures"]["A"], config["fixtures"]["B"]
    require(all(a[k] != b[k] for k in ("folder", "document", "export")), "CLIENT_FIXTURES_NOT_DISTINCT")
    return dict(value, fixtures=config["fixtures"])


def validate_parameters(auth, appointment, *, at_entry=False):
    params = auth.get("parameters", {})
    require(params.keys() == {"observer_until_utc"}, "CLIENT_CAMPAIGN_PARAMETERS")
    observer = instant(params["observer_until_utc"])
    begin, end = instant(appointment["start_utc"]), instant(appointment["end_utc"])
    require(begin < end < observer < min(instant(auth["valid_until_utc"]),
            instant(auth["valid_from_utc"]) + datetime.timedelta(hours=2)), "CLIENT_OBSERVER_WINDOW")
    if at_entry:
        require(now() < end, "CLIENT_APPOINTMENT_EXPIRED")


def access(who):
    return tuple(who + ":200:" + op for op in ("ME", "DOCUMENT", "EXPORT"))


STEPS = {
    "BEFORE": (*access("A1"), *access("B"), "A1:404:FOREIGN_DOCUMENT", "A1:404:FOREIGN_EXPORT",
               "B:404:FOREIGN_DOCUMENT", "B:404:FOREIGN_EXPORT"),
    "REVOKED": ("A1:403:ME", *access("B")),
    "RESTORED": ("A1:401:ME", *access("B")),
    "RELOGIN": (*access("A2"), *access("B")),
    "LOGOUT": ("A2:204:LOGOUT", "A2:401:ME", *access("B")),
}
SHARING = (*access("A1"), *access("B"))
FIELDS = {"event","phase","actor","session","operation","status","sequence","traced","challenge","startedAt","utc"}


def step_for(row):
    who = "A2" if row["session"] == "REPLACEMENT" else "A1" if row["actor"] == "A" else "B"
    return f"{who}:{row['status']}:{row['operation']}"


def check_row(row, phase, step, sequence, challenges):
    who, status, operation = step.split(":")
    require(isinstance(row, dict) and row.keys() == FIELDS and row["event"] == "REQUEST" and row["traced"] is True
            and row["phase"] == phase and type(row["sequence"]) is int and row["sequence"] == sequence <= 394
            and row["actor"] == who[0] and row["session"] == ("REPLACEMENT" if who == "A2" else "ORIGINAL")
            and row["operation"] == operation and type(row["status"]) is int and row["status"] == int(status),
            "CLIENT_BROWSER_RECEIPT")
    nonce = row["challenge"]
    require(isinstance(nonce,str) and re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",nonce)
            and nonce not in challenges and instant(row["startedAt"]) <= instant(row["utc"]), "CLIENT_BROWSER_CHALLENGE")
    challenges.add(nonce)


def check_sequence(rows):
    offset = 0
    seen = set()
    for phase, steps in STEPS.items():
        start = offset
        while offset < len(rows) and rows[offset]["phase"] == phase:
            index = offset - start
            row = rows[offset]
            if index < len(steps):
                step = steps[index]
            else:
                step = step_for(row)
                require(phase == "BEFORE" and step in SHARING, "CLIENT_EXTRA_OBSERVATION")
            check_row(row, phase, step, offset + 1, seen)
            require(not offset or instant(rows[offset-1]["utc"]) <= instant(row["startedAt"]), "CLIENT_RECEIPT_ORDER")
            offset += 1
        require(offset - start >= len(steps), "CLIENT_BROWSER_PHASE_INCOMPLETE")
    require(offset == len(rows), "CLIENT_BROWSER_PHASE_ORDER")


def missing_sharing(correlated, revision):
    missing = []
    for step in SHARING:
        group = [r for r in correlated if r["phase"] == "BEFORE" and r["revision"] == revision and step_for(r) == step]
        if not any(a["bootId"] != b["bootId"] and a["instanceId"] != b["instanceId"] for a in group for b in group):
            missing.append(step)
    return missing


def verdict(correlated, revisions):
    raw = [{k: r[k] for k in FIELDS if k not in ("event","traced")} | {"event":"REQUEST","traced":True} for r in correlated]
    check_sequence(raw)
    require(revisions.keys() == STEPS.keys() and all(r["revision"] == revisions[r["phase"]] for r in correlated),
            "BROWSER_REVISION_CHANGED")
    require(not missing_sharing(correlated, revisions["BEFORE"]), "TWO_INSTANCES_NOT_PROVEN")
    return {"mode":"BROWSER_UI", "normal_logout":True, "shared_authenticated_contexts":["A","B"],
            "exact_cookie_replay_after_logout_on_another_cloud_instance":"UNMEASURED"}


def conduct(client, prepare, binding, rest):
    try:
        prepare()
        binding("BIND_A")
        binding("BIND_B")
        rows = []
        for phase in STEPS:
            if phase in ("REVOKED","RESTORED"):
                binding("REVOKE_A" if phase == "REVOKED" else "RESTORE_A")
            rows.extend(client.phase(phase))
        check_sequence(rows)
        client.finish()
        return rows
    finally:
        try:
            client.close()
        finally:
            rest()


class CampaignClient:
    def __init__(self, owner, processes, settings):
        self.owner = owner
        self.settings, self.rows, self.correlated, self.revisions = settings, [], [], {}
        self.challenges = set()
        self.native_entries = {}
        self.closed = False
        self.family = None
        self.profile_dir = None
        self.messages = queue.Queue(maxsize=16)
        self.reader_failed = False
        validate_parameters(owner.auth, owner.inputs["appointment"], at_entry=True)
        grants = {}
        commitments = []
        for actor in ("A1", "B", "A2"):
            who = actor[0]
            scope = json.dumps({"actor":settings["actors"][who], "own":settings["fixtures"][who],
                                "other":settings["fixtures"]["B" if who == "A" else "A"]},
                               sort_keys=True, separators=(",", ":"))
            scope_hash = hashlib.sha256(scope.encode()).hexdigest()
            invitation = str(uuid.uuid4())
            grants[actor] = dict(invitation=invitation, scope=scope, scopeHash=scope_hash)
            commitments.append(hashlib.sha256(f"{actor}\n{invitation}\n{scope_hash}".encode()).hexdigest())
        # Only commitments may enter a service template, receipt or log.
        owner.browser_commitments = ",".join(commitments)
        allowed = {"SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE", "TEMP", "TMP", "PROGRAMFILES",
                   "PROGRAMFILES(X86)", "LOCALAPPDATA", "APPDATA", "USERPROFILE"}
        env = {name: value for name, value in os.environ.items() if name.upper() in allowed}
        try:
            self.profile_dir = tempfile.TemporaryDirectory(prefix="ritomer-m12-browser-")
            self.family = processes.OwnedProcess([settings["node"]["path"], settings["client"]["path"]], env,
                                                 stdout=subprocess.PIPE)
            self.reader = threading.Thread(target=self._read, daemon=True)
            self.reader.start()
            until = min(instant(owner.auth["valid_until_utc"]), now() + datetime.timedelta(seconds=max(0, owner.nominal_deadline - time.monotonic())))
            self.send({"command": "START", "config": dict(settings, grants=grants, profile_root=self.profile_dir.name), "end_utc": until.isoformat()})
            require(self.receive(time.monotonic() + 30) == {"event": "READY", "schema": "M12_BROWSER_UI_STANDARD_V1"},
                    "CLIENT_STARTUP_REJECTED")
        except BaseException:
            self.close()
            raise

    def _read(self):
        try:
            while True:
                raw = self.family.child.stdout.readline(8193)
                if not raw:
                    self.messages.put_nowait(None)
                    return
                require(len(raw) <= 8192 and raw.endswith(b"\n"), "CLIENT_CONTROL_LIMIT")
                value = json.loads(raw)
                require(isinstance(value, dict), "CLIENT_CONTROL_SCHEMA")
                self.messages.put_nowait(value)
        except BaseException:
            self.reader_failed = True

    def send(self, message):
        self.family.send((json.dumps(message, separators=(",", ":")) + "\n").encode())

    def receive(self, deadline, personal=None, *, verification=False):
        while time.monotonic() < deadline:
            self.owner.guard()
            if personal is not None:
                self.owner.personal_time(personal,verification=verification)
            require(not self.reader_failed, "CLIENT_CONTROL_REJECTED")
            try:
                value = self.messages.get(timeout=.25)
            except queue.Empty:
                require(self.family.child.poll() is None, "CLIENT_PROCESS_EXITED")
                continue
            self.owner.guard()
            require(time.monotonic() < deadline, "CLIENT_CONTROL_TIMEOUT")
            if personal is not None:
                self.owner.personal_time(personal,verification=verification)
            require(value is not None, "CLIENT_PROCESS_EOF")
            if value.get("event") == "FAILURE":
                code = value.get("code")
                raise RuntimeError(code if isinstance(code, str) and re.fullmatch(r"CLIENT_[A-Z_]{1,70}", code)
                                   else "CLIENT_INCOMPLETE")
            return value
        raise RuntimeError("CLIENT_CONTROL_TIMEOUT")

    def login(self, actor):
        if actor == "A":
            self.owner.prepare_first_login()
        earliest = instant(self.owner.inputs["appointment"]["start_utc"])
        while now() < earliest:
            self.owner.guard()
            time.sleep(min(1, max(0, (earliest - now()).total_seconds())))
        ready = self.owner.personal_ready(actor)
        window = self.owner.await_open(ready)
        self.owner.personal_time(window)
        self.owner.fact("client_login_invitation", {"actor": actor, "end": window["end"],
                                                   "url": self.settings["origin"], "personal_entry_only": True})
        who = "A1" if actor == "A" else actor
        self.owner.guard()
        self.owner.personal_time(window)
        state = {"actor": who, "server_admitted": False, "page": None,
                 "observed": "INVITED", "awaiting": "GO_SENT"}
        def record():
            self.owner.fact("client_login:" + actor, state.copy())

        grace = self.owner.config["limits"].get("verification_seconds", 0)

        def expect(message, stage, following, *, verification=False):
            deadline = self.owner.personal_deadlines[actor] + (grace if verification else 0)
            received = self.receive(deadline, window, verification=verification)
            require(received == message, "CLIENT_ADMISSION_REJECTED")
            state.update(observed=stage, awaiting=following)
            if stage == "WORKBENCH_READY":
                state["page"] = "witness"
            record()

        record()
        go = {"command": "GO", "actor": who, "end_utc": window["end"]}
        if grace:
            go["verify_until_utc"] = (instant(window["end"]) + datetime.timedelta(seconds=grace)).isoformat()
        self.send(go)
        state.update(observed="GO_SENT", awaiting="WINDOW_READY")
        record()
        try:
            expect({"event":"LOGIN_PROGRESS","actor":who,"stage":"WINDOW_READY"}, "WINDOW_READY", "WITNESS_READY")
            expect({"event":"LOGIN_PROGRESS","actor":who,"stage":"WITNESS_READY"}, "WITNESS_READY", "LOGIN_STARTED")
            expect({"event":"LOGIN_PROGRESS","actor":who,"stage":"LOGIN_STARTED"}, "LOGIN_STARTED", "SPRING_ADMISSION")
            # This is the existing strict callback/revision/window proof, including denials.
            while self.owner.admission_if_finished(window) is None:
                deadline = self.owner.personal_time(window,verification=True)
                time.sleep(min(2, max(0, deadline-time.monotonic())))
            state.update(server_admitted=True, observed="SPRING_ADMISSION", awaiting="WORKBENCH_READY")
            record()
            self.owner.personal_time(window,verification=True)
            revision = self.owner.facts["admission:" + actor]["data"]["revision"]
            self.send({"command":"VERIFY", "actor":who, "revision":revision})
            expect({"event":"WORKBENCH_READY","actor":who,"page":"witness"}, "WORKBENCH_READY", "EXPECTED_IDENTITY_TENANT_ROLES", verification=True)
            expect({"event":"ADMITTED","actor":who}, "PROVIDER_VERIFIED", "NONE", verification=True)
        except RuntimeError as error:
            code = str(error)
            state["failure"] = code if re.fullmatch(r"[A-Z][A-Z0-9_]{1,79}", code) else "CHECK_INCOMPLETE"
            record()
            raise

    def observation(self, phase, step):
        self.owner.guard()
        # Bootstrap and identity admission consume six HTTP requests as well.
        require(len(self.rows) < 394, "CLIENT_REQUEST_LIMIT")
        self.send({"command": "OBSERVE", "phase": phase, "step": step, "sequence": len(self.rows) + 1})
        row = self.receive(time.monotonic() + 20)
        check_row(row, phase, step, len(self.rows) + 1, self.challenges)
        require(not self.rows or instant(self.rows[-1]["utc"]) <= instant(row["startedAt"]),
                "CLIENT_RECEIPT_ORDER")
        self.rows.append(row)
        return row

    def correlate_phase(self, rows, revision):
        entries = self.native_entries.setdefault(rows[0]["phase"], {})
        end = time.monotonic() + 120
        while True:
            self.owner.guard()
            require(time.monotonic() < end, "NATIVE_INGESTION_DEADLINE")
            for offset in range(0, len(rows), 50):
                selected = rows[offset:offset + 50]
                scope = ('resource.type="cloud_run_revision" AND resource.labels.project_id="' + self.owner.config["project"]
                         + '" AND resource.labels.service_name="ritomer-m12" AND resource.labels.location="europe-west6"'
                         + ' AND resource.labels.revision_name="' + revision + '" AND logName="projects/'
                         + self.owner.config["project"] + '/logs/run.googleapis.com%2Fstdout" AND ('
                         + ' OR '.join('jsonPayload.challenge="' + r["challenge"] + '"' for r in selected) + ')')
                previous = getattr(self.owner, "read_deadline", float("inf"))
                self.owner.read_deadline = min(previous, end)
                try:
                    observed = self.owner.native_logs(scope)
                finally:
                    self.owner.read_deadline = previous
                require(time.monotonic() < end, "NATIVE_INGESTION_DEADLINE")
                for entry in observed:
                    key = entry["insertId"]
                    require(key not in entries or entries[key] == entry, "NATIVE_ENTRY_CHANGED")
                    require("textPayload" not in entry and isinstance(entry.get("receiveTimestamp"), str)
                            and self.owner.oracle.instant(entry["receiveTimestamp"]) >=
                            self.owner.oracle.instant(entry["timestamp"]) - datetime.timedelta(seconds=5), "NATIVE_RECEIVE_TIME_REJECTED")
                    entries[key] = entry
            try:
                correlated = self.owner.oracle.correlate(list(entries.values()), rows, {revision})
                require(time.monotonic() < end, "NATIVE_INGESTION_DEADLINE")
                return correlated
            except RuntimeError as error:
                # Only ingestion delay is retriable. Contradictions are terminal.
                if str(error) != "NATIVE_CORRELATION_INCOMPLETE":
                    raise
                require(time.monotonic() + 1 < end, "NATIVE_INGESTION_DEADLINE")
                time.sleep(1)

    def phase(self, phase):
        if phase == "BEFORE":
            self.login("A")
            self.login("B")
            self.owner.privacy_facts()
            self.owner.sql_metadata()
            self.owner.photo("BOUND_FIXTURES")
            # Start the non-renewable lease after both admissions and the photo.
            self.owner.sql_metadata()
            self.owner.service_transition("UP")
        elif phase == "RELOGIN":
            self.login("A2")
        revision = self.owner.service()["latestReadyRevision"].rsplit("/", 1)[-1]
        require(self.owner.oracle.REVISION.fullmatch(revision), "CLIENT_REVISION_REJECTED")
        self.revisions[phase] = revision
        result = []
        for step in STEPS[phase]:
            result.append(self.observation(phase, step))
        # Cap load on a sticky or single-instance service. The final collector
        # independently refuses qualification if sharing remains unobserved.
        for attempt in range(4):
            correlated = self.correlate_phase(result, revision)
            missing = missing_sharing(correlated, revision) if phase == "BEFORE" else []
            if not missing or attempt == 3:
                if phase == "BEFORE":
                    self.owner.fact("browser_sharing_sample", {"missing":missing, "rounds":attempt+1})
                self.correlated.extend(correlated)
                return result
            for step in missing:
                result.append(self.observation(phase, step))

    def finish(self):
        self.send({"command": "CLOSE"})
        require(self.receive(time.monotonic() + 15) == {"event": "CLOSED"}, "CLIENT_CLOSE_RECEIPT")
        result = self.family.close(force=False, seconds=15)
        self.closed = True
        self.owner.fact("client_closure", result)
        if result["tree_terminated"]:
            self.cleanup_profile()
        require(result["exit"] == 0 and result["tree_terminated"] and not result["forced_tree_termination"],
                "CLIENT_CLOSURE_UNPROVEN")
        self.owner.service_transition("DOWN")
        self.owner.privacy_facts()
        self.owner.sql_metadata()
        self.owner.photo("AFTER_LOGOUT")

    def close(self):
        if not self.closed and self.family is not None:
            result = self.family.close(force=True, seconds=15)
            self.closed = True
            self.owner.fact("client_closure", result)
            if result["tree_terminated"] and self.profile_dir:
                self.cleanup_profile()
        elif self.family is None and self.profile_dir:
            self.cleanup_profile()

    def cleanup_profile(self):
        try:
            self.profile_dir.cleanup()
        except PermissionError as error:
            if getattr(error, "winerror", None) != 32:
                raise
            time.sleep(0.25)
            try:
                self.profile_dir.cleanup()
            except OSError as final_error:
                self.owner.fact("client_profile_cleanup", {"removal_confirmed": False, "attempts": 2})
                raise RuntimeError("CLIENT_PROFILE_CLEANUP_FAILED") from final_error
        self.owner.fact("client_profile_cleanup", {"removal_confirmed": True})
