#!/usr/bin/env python3
"""Local Laya sidecar. Bind loopback only. Load once, lock around predict."""

from __future__ import annotations

import json
import os
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

HOST = "127.0.0.1"
PORT = int(os.environ.get("LAYA_PORT", "8765"))

LOCK = threading.Lock()
AGENT = None
READY = False
LOAD_ERROR = None
DEVICE = "unknown"


def load_agent():
    global AGENT, READY, LOAD_ERROR, DEVICE
    try:
        import laya

        print("Loading Laya English checkpoint. First run downloads weights.", flush=True)
        AGENT = laya.load("convaiinnovations/laya")
        DEVICE = str(getattr(AGENT, "device", "unknown"))
        warmup = {
            "falling_piece": "a T-shaped piece",
            "next_piece": "a long straight bar",
            "current_well": "The stack is low. The floor is even. No buried empty cells.",
            "candidate_wells": {
                "p0": "Clears one row. No buried cells. Floor even.",
                "p1": "No full row. Buries empty cells. Floor spiky.",
            },
        }
        questions = {
            "playable_well": {
                "type": "choice",
                "instructions": "Which well in `candidate_wells` is the most playable?",
                "criteria": warmup["candidate_wells"],
            },
            "stack_danger": {
                "type": "score",
                "instructions": "How close is `current_well` to topping out?",
                "criteria": [
                    "The stack is low. Plenty of room.",
                    "The stack is mid-height. Comfortable.",
                    "The stack is high. Mistakes are costly.",
                    "The stack is near the top. The next few drops may end the game.",
                ],
            },
            "clear_is_available": {
                "type": "noul",
                "instructions": "Does at least one well complete a full row?",
                "criteria": {
                    "true": "At least one candidate completes a full row.",
                    "false": "No candidate completes a full row.",
                },
            },
            "burial_is_avoidable": {
                "type": "noul",
                "instructions": "Does at least one well avoid burying empty cells?",
                "criteria": {
                    "true": "A placement exists that does not bury empty cells.",
                    "false": "Every placement buries empty cells.",
                },
            },
        }
        try:
            AGENT.predict(warmup, questions, lang="en")
        except TypeError:
            AGENT.predict(warmup, questions)
        flappy_questions = {
            "relative_to_gap": {
                "type": "choice",
                "instructions": "Where is the bird relative to the gap?",
                "criteria": {"below": "the bird is below the gap", "above": "the bird is above the gap"},
            }
        }
        try:
            AGENT.predict("The bird is below the gap.", flappy_questions, lang="en")
        except TypeError:
            AGENT.predict("The bird is below the gap.", flappy_questions)
        READY = True
        print("Laya ready on http://%s:%s" % (HOST, PORT), flush=True)
    except Exception as exc:  # noqa: BLE001
        LOAD_ERROR = str(exc)
        traceback.print_exc()
        print("Laya failed to load: %s" % exc, flush=True)


def predict(state, questions, lang="en"):
    if AGENT is None:
        raise RuntimeError(LOAD_ERROR or "Laya is still loading")
    with LOCK:
        try:
            return AGENT.predict(state, questions, lang=lang)
        except TypeError:
            return AGENT.predict(state, questions)


def jsonable(value):
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if hasattr(value, "item"):
        return value.item()
    return value


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/health":
            self._send(404, {"ok": False, "error": "not found"})
            return
        self._send(
            200,
            {
                "ok": LOAD_ERROR is None,
                "ready": READY,
                "detail": (
                    "Laya listo"
                    if READY
                    else LOAD_ERROR or "Cargando checkpoint de Laya"
                ),
                "device": DEVICE,
            },
        )

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/predict":
            self._send(404, {"ok": False, "error": "not found"})
            return
        if not READY:
            self._send(
                503,
                {
                    "ok": False,
                    "error": LOAD_ERROR or "Laya still loading",
                },
            )
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send(400, {"ok": False, "error": "invalid json"})
            return
        try:
            result = predict(body.get("state"), body.get("questions"), body.get("lang") or "en")
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._send(500, {"ok": False, "error": str(exc)})
            return
        answers = result.get("answers", {}) if isinstance(result, dict) else {}
        usage = result.get("usage") if isinstance(result, dict) else None
        self._send(
            200,
            {
                "model": "convaiinnovations/laya",
                "answers": jsonable(answers),
                "usage": jsonable(usage),
            },
        )


def main():
    loader = threading.Thread(target=load_agent, name="laya-load", daemon=True)
    loader.start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print("Sidecar listening on http://%s:%s (model loading in background)" % (HOST, PORT), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye", flush=True)


if __name__ == "__main__":
    main()
