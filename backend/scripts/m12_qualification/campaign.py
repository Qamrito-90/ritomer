"""Progression and redacted evidence for the M1.2 session qualification."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import uuid


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


PHASES = ("BEFORE", "REVOKED", "RESTORED", "RELOGIN", "LOGOUT")
FIELDS = {"event", "operation", "phase", "actor", "session", "sequence", "challenge",
          "traced", "startedAt", "utc", "status"}
STEPS = {
    "BEFORE": ("A1:200", "B:200"),
    "REVOKED": ("A1:403", "B:200"),
    "RESTORED": ("A1:401", "B:200"),
    "RELOGIN": ("A2:200", "A1:401", "A2:403:LOGOUT", "A2:200", "B:200"),
    "LOGOUT": ("A2:204:LOGOUT", "A2:401", "B:200"),
}


def observations(phase):
    for_phase = []
    for step in STEPS[phase]:
        for_phase.append(step)
        if step in ("A1:200", "B:200", "A2:200"):
            for_phase.extend(step + ":" + operation for operation in ("DOCUMENT_CONTENT", "EXPORT_CONTENT"))
    return for_phase


def instant(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z", value),
            "CLIENT_RECEIPT_TIME")
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def check_row(row, phase, index, sequence, challenges):
    require(isinstance(row, dict) and row.keys() == FIELDS, "CLIENT_RECEIPT_FIELDS")
    who, status, *operation = observations(phase)[index].split(":")
    require(row["event"] == "REQUEST" and row["traced"] is True and row["phase"] == phase and
            row["actor"] == who[0] and row["session"] == ("REPLACEMENT" if who == "A2" else "ORIGINAL") and
            row["operation"] == (operation[0] if operation else "ME") and type(row["status"]) is int and
            row["status"] == int(status) and type(row["sequence"]) is int and row["sequence"] == sequence,
            "CLIENT_RECEIPT_ORDER")
    nonce = row["challenge"]
    require(isinstance(nonce, str) and re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", nonce)
            and nonce not in challenges, "CLIENT_RECEIPT_CHALLENGE")
    require(instant(row["startedAt"]) <= instant(row["utc"]), "CLIENT_RECEIPT_TIME")
    challenges.add(nonce)


def activate(client, binding, rest, observe_phase=None):
    """Only confirmed effects advance the browser. Recovery also runs after partial binding."""
    rows = []
    challenges = set()
    try:
        binding("BIND_A")
        binding("BIND_B")
        for phase in PHASES:
            if phase == "REVOKED":
                binding("REVOKE_A")
            if phase == "RESTORED":
                binding("RESTORE_A")
            if observe_phase is not None:
                observe_phase(phase)
            phase_rows = client.phase(phase)
            require(len(phase_rows) == len(observations(phase)), "CLIENT_PHASE_COUNT_REJECTED")
            for index, row in enumerate(phase_rows):
                check_row(row, phase, index, len(rows) + 1, challenges)
                require(not rows or instant(rows[-1]["utc"]) <= instant(row["startedAt"]), "CLIENT_RECEIPT_ORDER")
                rows.append(row)
        client.finish()
    finally:
        try:
            client.close()
        finally:
            rest()
    return rows


def local_candidate():
    root = Path(__file__).resolve().parents[3]
    paths = [Path(__file__).with_name(name) for name in (
        "campaign.py", "loopback_driver.py", "owned_process.py", "qualification_oracle.py", "native_http.py",
    )]
    paths.extend(root / p for p in (
        "frontend/e2e/shared-oidc-client.mjs", "frontend/package.json", "frontend/pnpm-lock.yaml",
        "backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/SharedOidcBrowserTest.kt",
        "backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/SharedOidcSessionSecurityTest.kt",
        "backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/BrowserQualificationFiles.kt",
        "backend/build.gradle.kts",
    ))
    hashes = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    return hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()


def publish_local(directory, run_id, candidate, rows):
    require(str(uuid.UUID(run_id)) == run_id and candidate == local_candidate(), "LOCAL_RUN_BINDING")
    challenges = set()
    sequence = 0
    for phase in PHASES:
        for index in range(len(observations(phase))):
            require(sequence < len(rows), "CLIENT_PHASE_COUNT_REJECTED")
            check_row(rows[sequence], phase, index, sequence + 1, challenges)
            require(sequence == 0 or instant(rows[sequence - 1]["utc"]) <= instant(rows[sequence]["startedAt"]),
                    "CLIENT_RECEIPT_ORDER")
            sequence += 1
    require(sequence == len(rows), "CLIENT_PHASE_COUNT_REJECTED")
    data = {"schema": "M12_LOCAL_CLIENT_RECEIPTS", "run": run_id, "candidate": candidate, "rows": rows}
    raw = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    path = directory / (run_id + ".receipts.json")
    with path.open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return hashlib.sha256(raw).hexdigest()


def read_local(directory, run_id, candidate, expected_sha):
    require(str(uuid.UUID(run_id)) == run_id and candidate == local_candidate(), "LOCAL_RUN_BINDING")
    path = directory / (run_id + ".receipts.json")
    require(not path.is_symlink() and path.is_file(), "LOCAL_RECEIPT_FILE")
    with path.open("rb") as stream:
        raw = stream.read(32769)
    require(len(raw) <= 32768 and hashlib.sha256(raw).hexdigest() == expected_sha, "LOCAL_RECEIPT_CHANGED")
    data = json.loads(raw)
    require(data.keys() == {"schema", "run", "candidate", "rows"} and data["run"] == run_id and
            data["candidate"] == candidate and data["schema"] == "M12_LOCAL_CLIENT_RECEIPTS", "LOCAL_RUN_BINDING")
    return data["rows"]
