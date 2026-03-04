#!/usr/bin/env python3
"""
IVI (Integer Vector Inversion) Algorithm for Prime Factorization with Global Feasibility Pruning

This module implements the IVI algorithm with comprehensive global feasibility pruning.
Python port of pruning_algorithm.js
"""

import math
from typing import List, Dict, Tuple, Optional, Any


# Precomputed lookup table for multiplying two digits (0-9)
DIGIT_MULT_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
    [0, 3, 6, 9, 12, 15, 18, 21, 24, 27],
    [0, 4, 8, 12, 16, 20, 24, 28, 32, 36],
    [0, 5, 10, 15, 20, 25, 30, 35, 40, 45],
    [0, 6, 12, 18, 24, 30, 36, 42, 48, 54],
    [0, 7, 14, 21, 28, 35, 42, 49, 56, 63],
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 72],
    [0, 9, 18, 27, 36, 45, 54, 63, 72, 81]
]


def multiply_digits(a: int, b: int) -> int:
    """Multiply two digits (0-9) using lookup table."""
    return DIGIT_MULT_TABLE[a][b]


# Cache for powers of 10
POWER_10_CACHE = {}


def power_of_10(k: int) -> int:
    """Get 10^k, using cache."""
    if k not in POWER_10_CACHE:
        POWER_10_CACHE[k] = 10 ** k
    return POWER_10_CACHE[k]


def integer_sqrt(n: int) -> int:
    """Compute integer square root using Newton's method. Returns floor(sqrt(n))."""
    if n < 0:
        raise ValueError('Square root of negative number')
    if n == 0:
        return 0
    if n == 1:
        return 1
    
    # Newton's method: x_{k+1} = (x_k + n/x_k) / 2
    x = n
    prev = 0
    while x != prev:
        prev = x
        x = (x + n // x) // 2
    return x


def global_feasible(state: Dict, P_value: int, Q_value: int, N: int, k: int, 
                    total_digits: int, sqrtN: int, debug: bool = False) -> Tuple[int, Optional[str]]:
    """
    Global feasibility pruning: checks if a branch can possibly lead to a valid factorization.
    
    Returns: (result, reason)
    - result: 0 if feasible, 1-9 if pruned by that step, True if exact match at termination
    - reason: optional debug string
    """
    remaining_digits = total_digits - k
    
    # #1. Symmetry Elimination - ONLY at termination
    # NOTE: Symmetry elimination (P > Q) is invalid for partial values because
    # partial values don't determine final ordering. For example, at k=2:
    # P=81, Q=59 (P > Q), but this is valid if final P=181, Q=59.
    # Only enforce P <= Q when we're done (remainingDigits == 0).
    if remaining_digits == 0 and P_value > Q_value:
        if debug:
            return (1, f"Symmetry at termination: P={P_value} > Q={Q_value}")
        return (1, None)
    
    # #2. Exact Termination Rule
    if remaining_digits == 0:
        if P_value <= 1 or Q_value <= 1:
            if debug:
                return (2, f"Termination: trivial factor P={P_value}, Q={Q_value}")
            return (2, None)
        
        if P_value == 0 or Q_value == 0:
            if debug:
                return (2, f"Termination: zero value P={P_value}, Q={Q_value}")
            return (2, None)
        
        product = P_value * Q_value
        if product == N:
            if debug:
                return (True, f"Exact match: P={P_value}, Q={Q_value}, P*Q={product}")
            return (True, None)
        else:
            if debug:
                return (2, f"Termination: product mismatch P={P_value}, Q={Q_value}, P*Q={product} != N={N}")
            return (2, None)
    
    # #3. Immediate Overshoot Check (fail fast)
    base = P_value * Q_value
    if base > N:
        if debug:
            return (3, f"Overshoot: P={P_value}, Q={Q_value}, P*Q={base} > N={N}")
        return (3, None)
    
    # #4. Sqrt-Based Hard Bound
    if P_value > sqrtN:
        if debug:
            return (4, f"Sqrt bound: P={P_value} > sqrtN={sqrtN}")
        return (4, None)
    
    # Compute gap once
    gap = N - base
    
    if gap < 0:
        if debug:
            return (3, f"Negative gap: gap={gap}")
        return (3, None)
    
    # Compute M = 10^remaining - 1 (maximum tail value)
    M = power_of_10(remaining_digits) - 1
    powerK = power_of_10(k)
    power2K = power_of_10(2 * k)
    
    # #5. Explicit Growth Envelope
    max_linear_term = powerK * (P_value * M + Q_value * M)
    max_quadratic_term = power2K * (M * M)
    max_contribution = max_linear_term + max_quadratic_term
    
    if max_contribution < gap:
        if debug:
            return (5, f"Growth envelope: maxContribution={max_contribution} < gap={gap}")
        return (5, None)
    
    # #6. Minimum Contribution Pruning
    if gap > 0:
        minA = 0
        minB = 0
        if remaining_digits == 1:
            minA = 1
            minB = 1
        
        min_contribution = powerK * (P_value * minB + Q_value * minA) + power2K * (minA * minB)
        if min_contribution > gap:
            if debug:
                return (6, f"Min contribution: minContribution={min_contribution} > gap={gap}")
            return (6, None)
    
    # #7. Linear-Term Gap Feasibility (redundant with 5, but check anyway)
    if max_linear_term + max_quadratic_term < gap:
        if debug:
            return (5, f"Linear-term gap: maxLinear+maxQuad={max_linear_term + max_quadratic_term} < gap={gap}")
        return (5, None)
    
    # #8. Upper Tail Tightening (Division-Based Coupling)
    Pmax = P_value + M * powerK
    if Pmax <= sqrtN:
        # Compute minRequiredQ = ceil(N / Pmax)
        min_required_Q = (N + Pmax - 1) // Pmax
        Qmax = Q_value + M * powerK
        if Qmax < min_required_Q:
            if debug:
                return (8, f"Upper tail: Qmax={Qmax} < minRequiredQ={min_required_Q}")
            return (8, None)
    
    # #9. Length Split Feasibility (not fully implemented)
    
    if debug:
        return (0, f"Feasible: P={P_value}, Q={Q_value}, gap={gap}")
    return (0, None)


def check_solution(branch: Dict, N: int) -> bool:
    """Check if a branch represents a valid solution."""
    p = branch['P_value']
    q = branch['Q_value']
    return p > 1 and q > 1 and p * q == N


def work_function(input_data: Dict, debug: bool = False, verbose: bool = False) -> Dict:
    """
    Core IVI work function: finds valid digit pairs for position k.
    
    Returns dict with 'states' and 'pruningStats'.
    """
    k = input_data['k']
    p_history = input_data.get('p_history', [])
    q_history = input_data.get('q_history', [])
    P_value = input_data['P_value']
    Q_value = input_data['Q_value']
    carry_in = input_data.get('carry_in', 0)
    N_digits = input_data['N_digits']
    N = input_data['N']
    sqrtN = input_data['sqrtN']
    
    if not N_digits or k < 1 or k > len(N_digits):
        return {'states': [], 'pruningStats': {}}
    
    if P_value is None or Q_value is None or N is None or sqrtN is None:
        raise ValueError('P_value, Q_value, N, and sqrtN are required')
    
    target_digit = N_digits[k - 1]
    next_states = []
    is_last_digit = k == len(N_digits)
    total_digits = len(N_digits)
    
    # Initialize pruning statistics
    pruning_stats = {i: 0 for i in range(1, 10)}
    
    # #6. Carry Envelope Tightening (Mandatory)
    max_digit_contribution = 81 * k
    max_sum = max_digit_contribution + carry_in
    max_carry_out = max_sum // 10
    
    # Pre-compute base sum for terms i=2 to k-1
    base_sum = 0
    for i in range(2, k):
        p_idx = i - 1  # p_i is at index i-1
        q_idx = k - i  # q_{k-i+1} is at index k-i
        if p_idx < len(p_history) and q_idx >= 0 and q_idx < len(q_history):
            base_sum += multiply_digits(p_history[p_idx], q_history[q_idx])
    
    # Pre-compute q_1 and p_1
    q1 = q_history[0] if len(q_history) > 0 else 0
    p1 = p_history[0] if len(p_history) > 0 else 0
    
    # Explore all possible digit pairs (0-9 for each)
    for pk in range(10):
        for qk in range(10):
            # Compute sum_{i=1}^{k} p_i * q_{k-i+1}
            if k == 1:
                sum_of_products = multiply_digits(pk, qk)
            else:
                sum_of_products = base_sum + multiply_digits(p1, qk) + multiply_digits(pk, q1)
            
            total = sum_of_products + carry_in
            
            # IVI Constraint: total = n_k + 10*c_{k+1}
            if total < target_digit:
                if verbose and debug:
                    print(f"  k={k}, pk={pk}, qk={qk}: IVI constraint failed: total={total} < target={target_digit}")
                continue
            
            remainder = total - target_digit
            # remainder = 10*c_{k+1}, meaning remainder must be >= 0 and divisible by 10
            if remainder % 10 == 0:
                carry_out = remainder // 10
                
                # Carry validation
                if carry_out < 0 or carry_out > max_carry_out or (is_last_digit and carry_out != 0):
                    if verbose and debug:
                        print(f"  k={k}, pk={pk}, qk={qk}: Carry validation failed: carry_out={carry_out}, max={max_carry_out}, isLast={is_last_digit}")
                    continue
                
                # Create arrays for new state
                next_p_history = p_history + [pk]
                next_q_history = q_history + [qk]
                
                # Update P_value and Q_value incrementally
                powerK = power_of_10(k - 1)
                new_P_value = P_value + pk * powerK
                new_Q_value = Q_value + qk * powerK
                
                # Global feasibility pruning
                digits_processed = k  # k is 1-indexed position, equals number of digits after adding
                new_state = {
                    'k': digits_processed,
                    'p_history': next_p_history,
                    'q_history': next_q_history
                }
                
                feasible_result, reason = global_feasible(
                    new_state, new_P_value, new_Q_value, N, 
                    digits_processed, total_digits, sqrtN, debug=debug
                )
                
                if verbose and reason:
                    print(f"  k={k}, pk={pk}, qk={qk}: {reason}")
                
                if feasible_result != 0 and feasible_result is not True:
                    # Pruned by step feasible_result
                    pruning_stats[feasible_result] = pruning_stats.get(feasible_result, 0) + 1
                    continue
                
                if feasible_result is False:
                    continue
                
                last_two_digits = f"{pk}{qk}".zfill(2)
                next_k = k + 1
                
                next_states.append({
                    'k': next_k,
                    'p_history': next_p_history,
                    'q_history': next_q_history,
                    'P_value': new_P_value,
                    'Q_value': new_Q_value,
                    'carry_in': carry_out,
                    'pk': pk,
                    'qk': qk,
                    'lastTwoDigits': last_two_digits
                })
    
    return {'states': next_states, 'pruningStats': pruning_stats}


def initialize_algorithm(p: int, q: int) -> Dict:
    """Initialize the IVI algorithm state for factorizing N = p × q."""
    N = p * q
    N_digits = [int(d) for d in str(N)[::-1]]  # LSD-first
    
    # Precompute sqrtN once
    sqrtN = integer_sqrt(N)
    
    return {
        'p': p,
        'q': q,
        'N': N,
        'N_big': N,
        'sqrtN': sqrtN,
        'N_digits': N_digits,
        'frontier': [{
            'k': 1,
            'p_history': [],
            'q_history': [],
            'P_value': 0,
            'Q_value': 0,
            'carry_in': 0,
            'N_digits': N_digits
        }],
        'step': 0,
        'history': [],
        'activeBranches': 1,
        'maxActiveBranches': 1,
        'nodesVisited': 0,
        'nodesPruned': 0,
        'maxFrontierWidth': 1,
        'pruningStats': {i: 0 for i in range(1, 10)}
    }


def step_algorithm(state: Dict, debug: bool = False, verbose: bool = False) -> Dict:
    """Execute one step of the IVI algorithm."""
    current_k = state['step'] + 1
    
    # If we've already processed all digits, terminate
    if current_k > len(state['N_digits']):
        return {**state, 'done': True}
    
    target_digit = state['N_digits'][current_k - 1]
    
    if verbose:
        print(f"\n=== Step {current_k} (target digit: {target_digit}) ===")
        print(f"Frontier size: {len(state['frontier'])}")
    
    # Process all branches in frontier
    all_results = []
    nodes_visited = state.get('nodesVisited', 0)
    nodes_pruned = state.get('nodesPruned', 0)
    
    # Aggregate pruning statistics
    step_pruning_stats = {i: 0 for i in range(1, 10)}
    
    for branch_idx, branch in enumerate(state['frontier']):
        if verbose:
            print(f"\nBranch {branch_idx}: P={branch['P_value']}, Q={branch['Q_value']}, "
                  f"p_history={branch['p_history']}, q_history={branch['q_history']}, "
                  f"carry_in={branch.get('carry_in', 0)}")
        
        work_result = work_function({
            **branch,
            'k': current_k,
            'N_digits': state['N_digits'],
            'N': state['N_big'],
            'sqrtN': state['sqrtN']
        }, debug=debug, verbose=verbose)
        
        candidates = work_result.get('states', [])
        pruning_stats = work_result.get('pruningStats', {})
        
        # Aggregate pruning statistics
        for step in range(1, 10):
            step_pruning_stats[step] = step_pruning_stats.get(step, 0) + pruning_stats.get(step, 0)
        
        # Track visited and pruned nodes
        nodes_visited += 100  # 10*10 digit pairs per branch
        nodes_pruned += (100 - len(candidates))
        
        if verbose:
            print(f"  -> {len(candidates)} valid states found")
            if pruning_stats:
                print(f"  Pruning stats: {pruning_stats}")
        
        for result in candidates:
            all_results.append({**result, 'parentIdx': branch_idx})
    
    # Update cumulative pruning statistics
    updated_pruning_stats = state.get('pruningStats', {i: 0 for i in range(1, 10)}).copy()
    for step in range(1, 10):
        updated_pruning_stats[step] = updated_pruning_stats.get(step, 0) + step_pruning_stats.get(step, 0)
    
    # If no valid branches found, terminate
    if len(all_results) == 0:
        if verbose:
            print("\nNo valid branches found - terminating")
        return {
            **state,
            'done': True,
            'activeBranches': 0,
            'maxActiveBranches': state.get('maxActiveBranches', 0),
            'nodesVisited': nodes_visited,
            'nodesPruned': nodes_pruned,
            'maxFrontierWidth': state.get('maxFrontierWidth', 0),
            'pruningStats': updated_pruning_stats
        }
    
    # Check for solution when processing the last digit
    if current_k == len(state['N_digits']):
        for branch_idx, branch in enumerate(all_results):
            if branch['carry_in'] == 0 and check_solution(branch, state['N']):
                p = branch['P_value']
                q = branch['Q_value']
                active_branches = len(all_results)
                max_active_branches = max(state.get('maxActiveBranches', 0), active_branches)
                max_frontier_width = max(state.get('maxFrontierWidth', 0), active_branches)
                
                if verbose:
                    print(f"\n✓ SOLUTION FOUND: P={p}, Q={q}, P*Q={p*q}")
                
                return {
                    **state,
                    'step': current_k,
                    'frontier': all_results,
                    'success': True,
                    'foundP': str(p),
                    'foundQ': str(q),
                    'activeBranches': active_branches,
                    'maxActiveBranches': max_active_branches,
                    'nodesVisited': nodes_visited,
                    'nodesPruned': nodes_pruned,
                    'maxFrontierWidth': max_frontier_width,
                    'pruningStats': updated_pruning_stats
                }
        
        # No solution found after processing last digit
        if verbose:
            print("\nNo solution found after processing last digit")
        active_branches = len(all_results)
        max_active_branches = max(state.get('maxActiveBranches', 0), active_branches)
        max_frontier_width = max(state.get('maxFrontierWidth', 0), active_branches)
        return {
            **state,
            'done': True,
            'activeBranches': active_branches,
            'maxActiveBranches': max_active_branches,
            'nodesVisited': nodes_visited,
            'nodesPruned': nodes_pruned,
            'maxFrontierWidth': max_frontier_width,
            'pruningStats': updated_pruning_stats
        }
    
    # Store step history and continue
    active_branches = len(all_results)
    max_active_branches = max(state.get('maxActiveBranches', 0), active_branches)
    max_frontier_width = max(state.get('maxFrontierWidth', 0), active_branches)
    
    return {
        **state,
        'step': current_k,
        'frontier': all_results,
        'activeBranches': active_branches,
        'maxActiveBranches': max_active_branches,
        'nodesVisited': nodes_visited,
        'nodesPruned': nodes_pruned,
        'maxFrontierWidth': max_frontier_width,
        'pruningStats': updated_pruning_stats
    }


def test_factorization(p: int, q: int, verbose: bool = True, debug: bool = False):
    """Test the pruning algorithm with given factors."""
    N = p * q
    print(f"\n{'='*60}")
    print(f"Testing pruning algorithm with {p} * {q} = {N}")
    print(f"{'='*60}")
    print(f"N = {N}")
    print(f"N_digits (LSD-first): {[int(d) for d in str(N)[::-1]]}")
    print(f"sqrt(N) = {integer_sqrt(N)}")
    print()
    
    state = initialize_algorithm(p, q)
    max_steps = 20
    
    step_count = 0
    while not state.get('done') and not state.get('success') and step_count < max_steps:
        state = step_algorithm(state, debug=debug, verbose=verbose)
        step_count += 1
        
        if verbose:
            print(f"\nAfter step {step_count}:")
            print(f"  Active branches: {state.get('activeBranches', 0)}")
            print(f"  Max frontier width: {state.get('maxFrontierWidth', 0)}")
            if state.get('pruningStats'):
                print(f"  Cumulative pruning stats: {state.get('pruningStats')}")
    
    if state.get('success'):
        print(f"\n✓ SUCCESS: Found P={state['foundP']}, Q={state['foundQ']}")
        print(f"  Steps: {step_count}")
        print(f"  Nodes visited: {state.get('nodesVisited', 0)}")
        print(f"  Nodes pruned: {state.get('nodesPruned', 0)}")
        print(f"  Max frontier width: {state.get('maxFrontierWidth', 0)}")
    elif state.get('done'):
        print(f"\n✗ FAILED: No solution found")
        print(f"  Steps: {step_count}")
        print(f"  Nodes visited: {state.get('nodesVisited', 0)}")
        print(f"  Nodes pruned: {state.get('nodesPruned', 0)}")
        print(f"  Max frontier width: {state.get('maxFrontierWidth', 0)}")
        print(f"  Final pruning stats: {state.get('pruningStats')}")
    else:
        print(f"\n⚠ TIMEOUT: Reached max steps ({max_steps})")
    
    return state


if __name__ == '__main__':
    # Test with 181 * 59
    test_factorization(181, 59, verbose=True, debug=True)
