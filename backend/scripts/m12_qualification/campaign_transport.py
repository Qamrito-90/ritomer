"""Offline RACCORD77 preflight for an empty visible browser on Windows."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import tempfile

WORKSPACE = Path(__file__).resolve().parents[3]


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def verify_runtime(config):
    frontend = WORKSPACE / "frontend"
    node = shutil.which("node.exe")
    require(node is not None, "CLIENT_NODE_MISSING")
    expected = {"client": frontend / "e2e/shared-oidc-campaign-probe.mjs",
                "campaign": frontend / "e2e/shared-oidc-campaign.mjs", "node": Path(node),
                "chromium": Path(os.environ["ProgramFiles"]) / "Google/Chrome/Application/chrome.exe"}
    require(config.keys() == {*expected, "chromium_version"}, "CLIENT_PROBE_CONFIG")
    for name, reference in expected.items():
        ref = config[name]
        require(ref.keys() == {"path", "sha256"} and re.fullmatch("[0-9a-f]{64}", ref["sha256"]),
                "CLIENT_RUNTIME_BINDING")
        path = Path(ref["path"])
        require(path.is_absolute() and path.resolve() == reference.resolve() and path.is_file(), "CLIENT_RUNTIME_PATH")
        with path.open("rb") as stream:
            require(hashlib.file_digest(stream, "sha256").hexdigest() == ref["sha256"], "CLIENT_RUNTIME_CHANGED")
    require(re.fullmatch(r"\d+\.\d+\.\d+\.\d+", config["chromium_version"]), "CLIENT_CHROMIUM_VERSION")


def probe_runtime(config, processes=None):
    if processes is None:
        import owned_process as processes
    verify_runtime(config)
    allowed = {"SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE", "TEMP", "TMP",
               "PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA", "APPDATA", "USERPROFILE"}
    env = {name: value for name, value in os.environ.items() if name.upper() in allowed}
    profile = tempfile.TemporaryDirectory(prefix="ritomer-m12-probe-")
    message = {"profile_root": profile.name, "command": "PROBE", "chromium": config["chromium"]["path"], "version": config["chromium_version"]}
    deadline = time.monotonic() + 30
    family = None
    try:
        family = processes.OwnedProcess([config["node"]["path"], config["client"]["path"]], env, stdout=subprocess.PIPE)
        # Only the fixed probe writes stdout. The control pipe is closed after its single message.
        output, _ = family.child.communicate((json.dumps(message) + "\n").encode(),
                                             timeout=max(0, deadline - time.monotonic()))
        result = family.close(seconds=min(15, max(0, deadline - time.monotonic())))
        require(time.monotonic() < deadline, "CLIENT_PROBE_DEADLINE")
        require(len(output) <= 4096, "CLIENT_PROBE_OUTPUT_LIMIT")
        events = [json.loads(line) for line in output.splitlines()]
        for event in events:
            if event.get("event") == "FAILURE" and event.get("stage") in ("START", "OPEN", "CLOSE") and event.get("code") in (
                "CLIENT_CONTROL_TIMEOUT","CLIENT_CLOSE","PROBE_INPUT","EADDRINUSE","CLIENT_PROBE_FAILED"
            ):
                raise RuntimeError("CLIENT_PROBE_FAILED_" + event["stage"] + "_" + event["code"])
        require(result["exit"] == 0 and result["tree_terminated"] and not result["forced_tree_termination"],
                "CLIENT_PROBE_FAILED")
        require(events == [{"event": "READY", "version": config["chromium_version"], "destination": "LOOPBACK_ONLY"},
                           {"event": "CLOSED"}], "CLIENT_PROBE_EVENTS")
        return {"events": events, "process": result}
    finally:
        if family is not None and not family.disposed:
            family.close(force=True, seconds=15)
        for attempt in range(11):
            try:
                profile.cleanup()
                break
            except PermissionError:
                if attempt == 10:
                    raise
                time.sleep(.2)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: campaign_transport.py RUNTIME.json")
    print(json.dumps(probe_runtime(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))))
