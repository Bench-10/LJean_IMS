import json
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAYLOAD = {
    "history": [
        {"period": "2025-09-01", "value": 120},
        {"period": "2025-09-02", "value": 150},
        {"period": "2025-09-03", "value": 170},
        {"period": "2025-09-04", "value": 200},
        {"period": "2025-09-05", "value": 210},
        {"period": "2025-09-06", "value": 190},
    ],
    "periods": 7,
    "frequency": "D",
}

proc = subprocess.run(
    [sys.executable, os.path.join(os.path.dirname(__file__), "prophetForecast.py")],
    input=json.dumps(PAYLOAD).encode(),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    check=False,
)

print("STDOUT:\n", proc.stdout.decode())
print("STDERR:\n", proc.stderr.decode(), file=sys.stderr)
print("RETURN CODE:", proc.returncode)
