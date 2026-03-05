# DCP–Mojo variant: base algorithm in Mojo, worker via Python

This variant implements the **base IVI work function** in **Mojo** and runs it as a local “worker” that Node (or a DCP scheduler) can call. Work is passed to the worker via a **Python bridge** (stdin/stdout JSON), so the flow is:

- **Node** (or DCP client) sends one branch state → **Python** process → **Mojo** (when available) or pure Python does the digit-step → result back to Node.

PythonMonkey is for running **JavaScript from Python**; here we do the reverse (Node calls Python). So this variant uses **Node `child_process`** to spawn the Python worker. To use PythonMonkey you would host the DCP client in Python and have the work function call back into Python (which then calls Mojo); that would be a separate entry point.

## Layout

- **`mojo/ivi_base.mojo`** – Mojo implementation of the IVI constraint (returns list of `(pk, qk, carry_out)` for valid digit pairs). Built and loaded by Python when the Mojo SDK is available.
- **`python/ivi_bridge.py`** – Bridge used by the worker: `compute_next_states(input_dict)` → list of next-state dicts. Uses `ivi_base.ivi_candidates` from Mojo when importable, else pure Python.
- **`python/ivi_worker_stdin.py`** – Worker process: reads one JSON object per line from stdin, writes one JSON array of next states per line to stdout.
- **`dcp-mojo-variant/run-factor-mojo.js`** – Node script that runs factorization by maintaining the frontier and calling the Python worker for each branch (same algorithm as the in-browser version, worker = Mojo/Python).

## Requirements

- **Node.js** (for `run-factor-mojo.js`)
- **Python 3** with `python/` on the path so `ivi_bridge` can be imported
- **Mojo SDK** (optional): if installed and `mojo.importer` is available, the bridge uses the Mojo implementation; otherwise it uses the pure-Python implementation in `ivi_bridge.py`.

## Run locally (Node → Python → Mojo)

From the project root:

```bash
node dcp-mojo-variant/run-factor-mojo.js 3127
```

Example output:

```
Factors: p = 53, q = 59
```

The script runs the same IVI algorithm as the browser: it keeps a frontier of states and, at each digit position, sends each branch to the Python worker (which uses Mojo or Python to compute the next valid digit pairs and returns the next states).

## Using this worker with DCP

Standard DCP workers run JavaScript in the cloud and cannot run Mojo or Python. To use this Mojo-backed worker with DCP you would need either:

1. **Local worker only** – Run the scheduler in Node (or in the browser) and have it send work to this local Python process instead of to the DCP network (as `run-factor-mojo.js` does), or  
2. **Custom DCP worker image** – A worker image that includes Python + Mojo and exposes the same stdin/stdout protocol, so the scheduler can send work to those workers instead of JS work functions.

## PythonMonkey (Python hosting JS)

To run the DCP client **inside Python** and have the work function implemented in Mojo:

1. Install: `pip install pythonmonkey`
2. In Python, load the DCP client JS and your scheduler script.
3. Expose a JS-callable function that calls `ivi_bridge.compute_next_states` and returns the result.
4. Pass that function as the DCP work function when running the job locally (workers would still need to support this if you use the network).

That setup would be a separate script (e.g. `python/run_dcp_with_mojo_worker.py`); the current variant uses Node as the driver and Python as the worker process.
