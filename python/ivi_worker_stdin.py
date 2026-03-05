#!/usr/bin/env python3
"""
IVI worker: read JSON input lines from stdin, write JSON output lines to stdout.
Each line is one input state; output is one line with a JSON array of next states.
Used by the Node DCP-Mojo variant to run the base algorithm (Mojo or Python fallback).
"""

import json
import sys

# Add parent so we can import ivi_bridge
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from ivi_bridge import compute_next_states


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            input_dict = json.loads(line)
            # Normalize: P_value, Q_value may be numbers or strings
            for key in ("P_value", "Q_value"):
                if key in input_dict and isinstance(input_dict[key], (int, float)):
                    input_dict[key] = str(int(input_dict[key]))
            result = compute_next_states(input_dict)
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
