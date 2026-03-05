"""
Bridge: IVI work function callable from JavaScript (PythonMonkey).
Uses Mojo for the hot loop when available, else pure Python.
Returns list of next-state dicts compatible with DCP/JS (BigInts as strings).
"""

from __future__ import annotations

import sys
from pathlib import Path

# Optional: use Mojo implementation for the inner loop (requires Mojo SDK)
_ivi_mojo = None
try:
    import mojo.importer  # noqa: F401  # enables .mojo import
    _root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(_root / "mojo"))
    import ivi_base  # ivi_base.mojo in mojo/
    _ivi_mojo = ivi_base
except Exception:
    pass


def _multiply_digits(a: int, b: int) -> int:
    return a * b


def _ivi_candidates_python(
    k: int,
    p_history: list[int],
    q_history: list[int],
    carry_in: int,
    target_digit: int,
    is_last_digit: bool,
) -> list[tuple[int, int, int]]:
    """Pure Python: return list of (pk, qk, carry_out)."""
    base_sum = 0
    if k > 1:
        for i in range(2, k):
            p_idx = i - 1
            q_idx = k - i
            if p_idx < len(p_history) and 0 <= q_idx < len(q_history):
                base_sum += _multiply_digits(p_history[p_idx], q_history[q_idx])
    q1 = q_history[0] if q_history else 0
    p1 = p_history[0] if p_history else 0

    result = []
    for pk in range(10):
        for qk in range(10):
            if k == 1:
                sum_of_products = _multiply_digits(pk, qk)
            else:
                sum_of_products = base_sum + _multiply_digits(p1, qk) + _multiply_digits(pk, q1)
            total = sum_of_products + carry_in
            if total < target_digit:
                continue
            remainder = total - target_digit
            if remainder % 10 != 0:
                continue
            carry_out = remainder // 10
            if not (0 <= carry_out <= 10):
                continue
            if is_last_digit and carry_out != 0:
                continue
            result.append((pk, qk, carry_out))
    return result


def compute_next_states(input_dict: dict) -> list[dict]:
    """
    IVI work function: one branch in, list of next branches out.
    input_dict: k, p_history, q_history, P_value (str), Q_value (str), carry_in, N_digits
    Returns list of next state dicts (P_value, Q_value as strings for JS/BigInt).
    """
    k = int(input_dict["k"])
    p_history = list(input_dict.get("p_history", []))
    q_history = list(input_dict.get("q_history", []))
    P_value = int(input_dict["P_value"]) if isinstance(input_dict["P_value"], str) else int(input_dict["P_value"])
    Q_value = int(input_dict["Q_value"]) if isinstance(input_dict["Q_value"], str) else int(input_dict["Q_value"])
    carry_in = int(input_dict["carry_in"])
    N_digits = list(input_dict["N_digits"])

    if not N_digits or k < 1 or k > len(N_digits):
        return []

    target_digit = N_digits[k - 1]
    is_last_digit = k == len(N_digits)

    if _ivi_mojo is not None:
        try:
            raw = _ivi_mojo.ivi_candidates(
                k,
                p_history,
                q_history,
                carry_in,
                target_digit,
                is_last_digit,
            )
            candidates = [tuple(x) for x in raw]
        except Exception:
            candidates = _ivi_candidates_python(
                k, p_history, q_history, carry_in, target_digit, is_last_digit
            )
    else:
        candidates = _ivi_candidates_python(
            k, p_history, q_history, carry_in, target_digit, is_last_digit
        )

    power_k = 10 ** (k - 1)
    next_states = []
    for pk, qk, carry_out in candidates:
        new_P = P_value + pk * power_k
        new_Q = Q_value + qk * power_k
        next_states.append({
            "k": k + 1,
            "p_history": p_history + [pk],
            "q_history": q_history + [qk],
            "P_value": str(new_P),
            "Q_value": str(new_Q),
            "carry_in": carry_out,
            "pk": pk,
            "qk": qk,
            "lastTwoDigits": f"{pk:02d}",
        })
    return next_states
