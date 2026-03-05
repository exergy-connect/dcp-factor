"""
IVI (Integer Vector Inversion) base work function in Mojo.
Returns list of (pk, qk, carry_out) for digit pairs satisfying the IVI constraint.
Called from Python; Python builds full state dicts for DCP/JS.
"""

from python import PythonObject, Python
from python.bindings import PythonModuleBuilder
from os import abort

fn multiply_digits(a: Int, b: Int) -> Int:
    return a * b

fn ivi_candidates_mojo(
    k: Int,
    p_history: PythonObject,
    q_history: PythonObject,
    carry_in: Int,
    target_digit: Int,
    is_last_digit: Bool,
) raises -> PythonObject:
    """Compute valid (pk, qk, carry_out) for position k. Returns Python list of tuples."""
    var base_sum: Int = 0
    var len_ph = len(p_history)
    var len_qh = len(q_history)
    if k > 1:
        for i in range(2, k):
            var p_idx = i - 1
            var q_idx = k - i
            if p_idx < len_ph and q_idx >= 0 and q_idx < len_qh:
                var pv = Int(p_history[p_idx])
                var qv = Int(q_history[q_idx])
                base_sum += multiply_digits(pv, qv)
    var q1: Int = 0
    var p1: Int = 0
    if len_qh > 0:
        q1 = Int(q_history[0])
    if len_ph > 0:
        p1 = Int(p_history[0])

    var builtins = Python.import_module("builtins")
    var result = builtins.list()

    for pk in range(10):
        for qk in range(10):
            var sum_of_products: Int
            if k == 1:
                sum_of_products = multiply_digits(pk, qk)
            else:
                sum_of_products = base_sum + multiply_digits(p1, qk) + multiply_digits(pk, q1)
            var total = sum_of_products + carry_in
            if total < target_digit:
                continue
            var remainder = total - target_digit
            if remainder % 10 != 0:
                continue
            var carry_out = remainder // 10
            if carry_out < 0 or carry_out > 10:
                continue
            if is_last_digit and carry_out != 0:
                continue
            var item = builtins.list()
            item.append(builtins.int(pk))
            item.append(builtins.int(qk))
            item.append(builtins.int(carry_out))
            result.append(builtins.tuple(item))
    return result


@export
fn PyInit_ivi_base() -> PythonObject:
    try:
        var m = PythonModuleBuilder("ivi_base")
        m.def_function[ivi_candidates_mojo](
            "ivi_candidates",
            docstring="Return list of (pk, qk, carry_out) for valid digit pairs at position k",
        )
        return m.finalize()
    except e:
        abort(String("error creating ivi_base module: ", e))
