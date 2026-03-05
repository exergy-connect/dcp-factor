# Mojo IVI implementations

## Standalone basic algorithm: `ivi_standalone.mojo`

Self-contained implementation of the basic IVI factorization algorithm (no Python, no JS). Run from the project root:

```bash
mojo run mojo/ivi_standalone.mojo <N>
```

**Example:**

```bash
mojo run mojo/ivi_standalone.mojo 3127
```

**Output:**

```
Factoring N = 3127 ...
p = 53
q = 59
p * q = 3127
```

**Requirements:** [Mojo SDK](https://docs.modular.com/mojo/manual/get-started) installed and `mojo` on your PATH.

**What it does:** Initializes state from N (LSD-first digits), keeps a frontier of branches, and at each digit position expands branches via the IVI constraint (valid digit pairs and carry). Stops when a branch reaches the last digit with P×Q = N and carry 0, or when the frontier is empty.

---

## Python-callable work function: `ivi_base.mojo`

Used by the Python bridge (and thus the Node DCP–Mojo variant). Exports `ivi_candidates(k, p_history, q_history, carry_in, target_digit, is_last_digit)` for use from Python. See `python/ivi_bridge.py` and `dcp-mojo-variant/README.md`.
