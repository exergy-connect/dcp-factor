#!/usr/bin/env python3
"""
Test and trace the adaptive base algorithm for 11 * 13 = 143
"""

def number_to_base_digits(n, base):
    """Convert a number to digits in a given base (LSD-first)"""
    if n == 0:
        return [0]
    digits = []
    num = n
    while num > 0:
        digits.append(int(num % base))
        num //= base
    return digits

def power_of_base(base, exponent):
    """Compute base^exponent as BigInt"""
    return base ** exponent

def integer_sqrt(n):
    """Compute integer square root"""
    if n < 0:
        raise ValueError("Square root of negative number")
    if n == 0:
        return 0
    x = n
    y = (x + 1) // 2
    while y < x:
        x = y
        y = (x + n // x) // 2
    return x

def compute_successors_for_base(branch, k, base, N_digits, N, sqrtN):
    """
    Compute successor states for a branch in a given base
    Returns tuple: (next_states, pruning_stats)
    """
    if k < 1 or k > len(N_digits):
        return [], {}
    
    target_digit = N_digits[k - 1]
    is_last_digit = k == len(N_digits)
    next_states = []
    
    # Initialize pruning statistics
    pruning_stats = {
        'total_candidates': 0,
        'pruned_ivi_constraint': 0,  # total < target_digit
        'pruned_carry_invalid': 0,   # invalid carry_out
        'pruned_product_overshoot': 0,  # P*Q > N
        'pruned_sqrt_bound': 0,      # P > sqrtN
    }
    
    # Pre-compute base sum for terms i=2 to k-1
    base_sum = 0
    for i in range(2, k):
        p_idx = i - 1
        q_idx = k - i
        if p_idx < len(branch['p_history']) and q_idx >= 0 and q_idx < len(branch['q_history']):
            base_sum += branch['p_history'][p_idx] * branch['q_history'][q_idx]
    
    p1 = branch['p_history'][0] if len(branch['p_history']) > 0 else 0
    q1 = branch['q_history'][0] if len(branch['q_history']) > 0 else 0
    
    # Explore all possible digit pairs
    for pk in range(base):
        for qk in range(base):
            pruning_stats['total_candidates'] += 1
            
            if k == 1:
                sum_of_products = pk * qk
            else:
                sum_of_products = base_sum + p1 * qk + pk * q1
            
            total = sum_of_products + branch['carry_in']
            
            if total < target_digit:
                pruning_stats['pruned_ivi_constraint'] += 1
                continue
            
            remainder = total - target_digit
            if remainder % base == 0:
                carry_out = remainder // base
                
                # Basic validation
                max_carry = base * 2
                if carry_out < 0 or carry_out > max_carry:
                    pruning_stats['pruned_carry_invalid'] += 1
                    continue
                if is_last_digit and carry_out != 0:
                    pruning_stats['pruned_carry_invalid'] += 1
                    continue
                
                # Update values
                power_k = power_of_base(base, k - 1)
                new_P_value = branch['P_value'] + pk * power_k
                new_Q_value = branch['Q_value'] + qk * power_k
                
                # Basic pruning
                # Note: Symmetry pruning (P > Q) is invalid because partial values
                # don't determine final ordering (e.g., P=3, Q=1 at k=2, but final P=11 < Q=17)
                if new_P_value * new_Q_value > N:
                    pruning_stats['pruned_product_overshoot'] += 1
                    continue
                if new_P_value > sqrtN:
                    pruning_stats['pruned_sqrt_bound'] += 1
                    continue
                
                # Check solution
                if is_last_digit and new_P_value * new_Q_value == N and new_P_value > 1 and new_Q_value > 1:
                    next_states.append({
                        'k': k + 1,
                        'p_history': branch['p_history'] + [pk],
                        'q_history': branch['q_history'] + [qk],
                        'P_value': new_P_value,
                        'Q_value': new_Q_value,
                        'carry_in': carry_out,
                        'is_solution': True
                    })
                else:
                    next_states.append({
                        'k': k + 1,
                        'p_history': branch['p_history'] + [pk],
                        'q_history': branch['q_history'] + [qk],
                        'P_value': new_P_value,
                        'Q_value': new_Q_value,
                        'carry_in': carry_out,
                        'is_solution': False
                    })
            else:
                pruning_stats['pruned_ivi_constraint'] += 1
    
    return next_states, pruning_stats

def convert_branch_to_base(branch, from_base, to_base, N, N_digits_new_base):
    """Convert a branch from one base to another"""
    k = branch['k']
    
    # Reconstruct partial P_value and Q_value from p_history and q_history in original base
    partial_P_value = 0
    partial_Q_value = 0
    
    for i in range(min(len(branch['p_history']), k - 1)):
        partial_P_value += branch['p_history'][i] * (from_base ** i)
    
    for i in range(min(len(branch['q_history']), k - 1)):
        partial_Q_value += branch['q_history'][i] * (from_base ** i)
    
    # Convert to new base
    p_digits_to_base = number_to_base_digits(partial_P_value, to_base)
    q_digits_to_base = number_to_base_digits(partial_Q_value, to_base)
    
    # Recompute P_value and Q_value from converted digits
    P_value_to_base = 0
    Q_value_to_base = 0
    
    for i in range(len(p_digits_to_base)):
        P_value_to_base += p_digits_to_base[i] * (to_base ** i)
    
    for i in range(len(q_digits_to_base)):
        Q_value_to_base += q_digits_to_base[i] * (to_base ** i)
    
    # Recompute carry_in
    recomputed_carry = 0
    
    if k > 1 and N_digits_new_base:
        # Compute carry by simulating digit-by-digit multiplication for positions 1 through k-1
        for pos in range(1, min(k, len(N_digits_new_base) + 1)):
            target_digit = N_digits_new_base[pos - 1]
            base_sum = 0
            
            # Sum all products p_i * q_j where i + j - 1 = pos
            for i in range(1, pos + 1):
                j = pos - i + 1
                p_idx = i - 1
                q_idx = j - 1
                if p_idx < len(p_digits_to_base) and q_idx >= 0 and q_idx < len(q_digits_to_base):
                    base_sum += p_digits_to_base[p_idx] * q_digits_to_base[q_idx]
            
            # IVI constraint: baseSum + carry_in = target_digit + toBase * carry_out
            total = base_sum + recomputed_carry
            if total < target_digit:
                # Invalid - the digit histories don't satisfy IVI constraint in new base
                return None
            remainder = total - target_digit
            if remainder % to_base != 0:
                # Invalid - remainder must be divisible by base
                return None
            recomputed_carry = remainder // to_base
    elif k == 1:
        recomputed_carry = 0
    else:
        return None
    
    return {
        'k': branch['k'],
        'p_history': p_digits_to_base,
        'q_history': q_digits_to_base,
        'P_value': P_value_to_base,
        'Q_value': Q_value_to_base,
        'carry_in': recomputed_carry,
        'base': to_base
    }

def trace_adaptive_algorithm(p, q):
    """Trace the adaptive base algorithm step by step"""
    N = p * q
    initial_base = 3
    N_digits = number_to_base_digits(N, initial_base)
    sqrtN = integer_sqrt(N)
    
    print(f"Testing adaptive base algorithm with {p} * {q} = {N}")
    print(f"N in base {initial_base}: {N_digits} (LSD-first)")
    print(f"sqrt(N) = {sqrtN}")
    print()
    
    # Initialize
    state = {
        'current_base': initial_base,
        'N_digits': N_digits,
        'N': N,
        'sqrtN': sqrtN,
        'k': 1,
        'frontier': [{
            'k': 1,
            'p_history': [],
            'q_history': [],
            'P_value': 0,
            'Q_value': 0,
            'carry_in': 0
        }],
        'solutions': [],
        'base_switches': [],
        'done': False
    }
    
    step = 0
    max_steps = 20
    
    while not state['done'] and step < max_steps:
        step += 1
        k = state['k']
        current_base = state['current_base']
        next_base = current_base * 3
        
        # Check if we're at or past the last digit
        if k > len(state['N_digits']):
            # Check for solutions in current frontier
            solutions = []
            for branch in state['frontier']:
                if branch['carry_in'] == 0 and branch['P_value'] * branch['Q_value'] == N and branch['P_value'] > 1 and branch['Q_value'] > 1:
                    solutions.append(branch)
            
            if solutions:
                state['solutions'] = solutions
                print(f"\n✓ SOLUTIONS FOUND: {len(solutions)}")
                for sol in solutions:
                    print(f"  P={sol['P_value']}, Q={sol['Q_value']}")
                state['done'] = True
            else:
                print(f"\nAll digits processed - no solution found")
                state['done'] = True
            break
        
        # Also check if we're at the last digit - check current frontier for solutions
        if k == len(state['N_digits']):
            solutions_in_frontier = []
            for branch in state['frontier']:
                if branch['carry_in'] == 0 and branch['P_value'] * branch['Q_value'] == N and branch['P_value'] > 1 and branch['Q_value'] > 1:
                    solutions_in_frontier.append(branch)
            
            if solutions_in_frontier:
                state['solutions'] = solutions_in_frontier
                print(f"\n✓ SOLUTIONS FOUND: {len(solutions_in_frontier)}")
                for sol in solutions_in_frontier:
                    print(f"  P={sol['P_value']}, Q={sol['Q_value']}")
                state['done'] = True
                break
        
        print(f"{'='*60}")
        print(f"Step {step} (k={k}, current_base={current_base})")
        print(f"{'='*60}")
        print(f"Frontier size: {len(state['frontier'])}")
        
        # Convert N to next base for comparison
        N_digits_next_base = number_to_base_digits(N, next_base)
        print(f"N in base {next_base}: {N_digits_next_base} (LSD-first)")
        print()
        
        base_comparison = []
        nodes_visited = 0
        nodes_pruned = 0
        
        # Process each branch in frontier
        for branch_idx, branch in enumerate(state['frontier']):
            print(f"  Branch {branch_idx}:")
            print(f"    p_history: {branch['p_history']}")
            print(f"    q_history: {branch['q_history']}")
            print(f"    P_value: {branch['P_value']}, Q_value: {branch['Q_value']}")
            print(f"    carry_in: {branch['carry_in']}")
            
            # Compute successors in current base
            candidates_current = compute_successors_for_base(
                branch, k, current_base, state['N_digits'], N, sqrtN
            )
            print(f"    Current base {current_base} successors: {len(candidates_current)}")
            
            # Convert branch to next base
            branch_next_base = convert_branch_to_base(
                branch, current_base, next_base, N, N_digits_next_base
            )
            
            if branch_next_base is None:
                print(f"    Conversion to base {next_base} failed - branch invalid")
                nodes_visited += current_base * current_base
                nodes_pruned += next_base * next_base
                base_comparison.append({
                    'branch_idx': branch_idx,
                    'current_count': len(candidates_current),
                    'next_count': 0,
                    'conversion_valid': False
                })
                continue
            
            print(f"    Converted to base {next_base}:")
            print(f"      p_history: {branch_next_base['p_history']}")
            print(f"      q_history: {branch_next_base['q_history']}")
            print(f"      P_value: {branch_next_base['P_value']}, Q_value: {branch_next_base['Q_value']}")
            print(f"      carry_in: {branch_next_base['carry_in']}")
            
            # Compute successors in next base
            candidates_next = compute_successors_for_base(
                branch_next_base, k, next_base, N_digits_next_base, N, sqrtN
            )
            print(f"    Next base {next_base} successors: {len(candidates_next)}")
            
            nodes_visited += current_base * current_base + next_base * next_base
            
            base_comparison.append({
                'branch_idx': branch_idx,
                'current_count': len(candidates_current),
                'next_count': len(candidates_next),
                'conversion_valid': True
            })
            
            print()
        
        # Decide which base to use
        total_current = sum(comp['current_count'] for comp in base_comparison)
        total_next = sum(comp['next_count'] for comp in base_comparison)
        valid_conversions = sum(1 for comp in base_comparison if comp['conversion_valid'])
        
        print(f"Base comparison:")
        print(f"  Total current base {current_base} successors: {total_current}")
        print(f"  Total next base {next_base} successors: {total_next}")
        print(f"  Valid conversions: {valid_conversions}/{len(state['frontier'])}")
        
        # Don't switch if no branches converted successfully or if next base has 0 successors
        # (switching to a base with 0 successors would exhaust the frontier)
        use_next_base = valid_conversions > 0 and total_next > 0 and total_next <= total_current
        selected_base = next_base if use_next_base else current_base
        selected_N_digits = N_digits_next_base if use_next_base else state['N_digits']
        
        if use_next_base and selected_base != current_base:
            print(f"  → Switching to base {next_base} ({'fewer' if total_next < total_current else 'same'} successors)")
            state['base_switches'].append({
                'step': step,
                'from_base': current_base,
                'to_base': next_base,
                'reason': f"{'Fewer' if total_next < total_current else 'Same'} successors: {total_next} {'<' if total_next < total_current else '='} {total_current}"
            })
            state['current_base'] = next_base
            state['N_digits'] = selected_N_digits
        
        # Collect next frontier from selected base
        next_frontier = []
        solutions = []
        
        # Process all branches - use selected base for valid conversions, current base for invalid ones
        for branch_idx, branch in enumerate(state['frontier']):
            comp = next((c for c in base_comparison if c['branch_idx'] == branch_idx), None)
            
            if comp and comp['conversion_valid'] and use_next_base:
                # Use next base
                branch_converted = convert_branch_to_base(
                    branch, current_base, next_base, N, selected_N_digits
                )
                if branch_converted is not None:
                    candidates = compute_successors_for_base(
                        branch_converted, k, next_base, selected_N_digits, N, sqrtN
                    )
                else:
                    candidates = []
            else:
                # Use current base (either because we're staying in current base, or conversion failed)
                candidates = compute_successors_for_base(
                    branch, k, current_base, state['N_digits'], N, sqrtN
                )
            
            for candidate in candidates:
                if candidate.get('is_solution', False):
                    solutions.append(candidate)
                else:
                    next_frontier.append(candidate)
        
        state['frontier'] = next_frontier
        state['k'] = k + 1
        
        if solutions:
            state['solutions'] = solutions
            print(f"\n✓ SOLUTIONS FOUND: {len(solutions)}")
            for sol in solutions:
                print(f"  P={sol['P_value']}, Q={sol['Q_value']}")
            state['done'] = True
        elif len(next_frontier) == 0:
            print(f"\nFrontier exhausted - no solution found")
            state['done'] = True
        elif state['k'] > len(state['N_digits']):
            # Check for solutions in next_frontier before stopping
            final_solutions = []
            for branch in next_frontier:
                if branch['carry_in'] == 0 and branch['P_value'] * branch['Q_value'] == N and branch['P_value'] > 1 and branch['Q_value'] > 1:
                    final_solutions.append(branch)
            
            if final_solutions:
                state['solutions'] = final_solutions
                print(f"\n✓ SOLUTIONS FOUND: {len(final_solutions)}")
                for sol in final_solutions:
                    print(f"  P={sol['P_value']}, Q={sol['Q_value']}")
                state['done'] = True
            else:
                print(f"\nAll digits processed - no solution found")
                state['done'] = True
        else:
            print(f"\nNext frontier size: {len(next_frontier)}")
        
        print()
    
    if not state['done']:
        print(f"Stopped after {max_steps} steps")
    
    return state

def generate_primes(limit):
    """Generate all primes up to limit"""
    if limit < 2:
        return []
    primes = []
    sieve = [True] * (limit + 1)
    sieve[0] = sieve[1] = False
    for i in range(2, int(limit ** 0.5) + 1):
        if sieve[i]:
            for j in range(i * i, limit + 1, i):
                sieve[j] = False
    for i in range(2, limit + 1):
        if sieve[i]:
            primes.append(i)
    return primes

def trace_adaptive_algorithm_with_base(p, q, initial_base, verbose=True):
    """Trace the algorithm starting from a specific base without switching"""
    N = p * q
    N_digits = number_to_base_digits(N, initial_base)
    sqrtN = integer_sqrt(N)
    
    if verbose:
        print(f"Testing with base {initial_base} (no switching)")
        print(f"N in base {initial_base}: {N_digits} (LSD-first)")
        print(f"sqrt(N) = {sqrtN}")
        print()
    
    # Initialize
    state = {
        'current_base': initial_base,
        'N_digits': N_digits,
        'N': N,
        'sqrtN': sqrtN,
        'k': 1,
        'frontier': [{
            'k': 1,
            'p_history': [],
            'q_history': [],
            'P_value': 0,
            'Q_value': 0,
            'carry_in': 0
        }],
        'solutions': [],
        'done': False
    }
    
    step = 0
    max_steps = 20
    step_data = []  # Store data for each step
    
    while not state['done'] and step < max_steps:
        step += 1
        k = state['k']
        current_base = state['current_base']
        
        # Check if we're at or past the last digit
        if k > len(state['N_digits']):
            # Check for solutions in current frontier
            solutions = []
            for branch in state['frontier']:
                if branch['carry_in'] == 0 and branch['P_value'] * branch['Q_value'] == N and branch['P_value'] > 1 and branch['Q_value'] > 1:
                    solutions.append(branch)
            
            if solutions:
                state['solutions'] = solutions
                if verbose:
                    print(f"Step {step} (k={k}): {len(state['frontier'])} branches → {len(solutions)} solution(s)")
                step_data.append({
                    'step': step,
                    'k': k,
                    'branches': len(state['frontier']),
                    'successors': len(solutions),
                    'continue': 0,
                    'solutions': len(solutions)
                })
                state['done'] = True
            else:
                if verbose:
                    print(f"Step {step} (k={k}): {len(state['frontier'])} branches → 0 solutions")
                step_data.append({
                    'step': step,
                    'k': k,
                    'branches': len(state['frontier']),
                    'successors': 0,
                    'continue': 0,
                    'solutions': 0
                })
                state['done'] = True
            break
        
        # Also check if we're at the last digit - check current frontier for solutions
        if k == len(state['N_digits']):
            solutions_in_frontier = []
            for branch in state['frontier']:
                if branch['carry_in'] == 0 and branch['P_value'] * branch['Q_value'] == N and branch['P_value'] > 1 and branch['Q_value'] > 1:
                    solutions_in_frontier.append(branch)
            
            if solutions_in_frontier:
                state['solutions'] = solutions_in_frontier
                if verbose:
                    print(f"Step {step} (k={k}): {len(state['frontier'])} branches → {len(solutions_in_frontier)} solution(s)")
                step_data.append({
                    'step': step,
                    'k': k,
                    'branches': len(state['frontier']),
                    'successors': len(solutions_in_frontier),
                    'continue': 0,
                    'solutions': len(solutions_in_frontier)
                })
                state['done'] = True
                break
        
        # Compute successors for all branches in current base
        next_frontier = []
        solutions = []
        total_successors = 0
        total_pruning = {
            'total_candidates': 0,
            'pruned_ivi_constraint': 0,
            'pruned_carry_invalid': 0,
            'pruned_product_overshoot': 0,
            'pruned_sqrt_bound': 0,
        }
        
        for branch in state['frontier']:
            candidates, pruning_stats = compute_successors_for_base(
                branch, k, current_base, state['N_digits'], N, sqrtN
            )
            total_successors += len(candidates)
            
            # Aggregate pruning stats
            for key in total_pruning:
                total_pruning[key] += pruning_stats.get(key, 0)
            
            for candidate in candidates:
                if candidate.get('is_solution', False):
                    solutions.append(candidate)
                else:
                    next_frontier.append(candidate)
        
        # Calculate total pruning opportunities
        total_pruned = (total_pruning['pruned_ivi_constraint'] + 
                       total_pruning['pruned_carry_invalid'] + 
                       total_pruning['pruned_product_overshoot'] + 
                       total_pruning['pruned_sqrt_bound'])
        
        # Calculate total candidates (branches * base^2)
        total_candidates = len(state['frontier']) * (current_base * current_base)
        pruning_percentage = (total_pruned / total_candidates * 100) if total_candidates > 0 else 0
        
        # Store step data
        step_data.append({
            'step': step,
            'k': k,
            'branches': len(state['frontier']),
            'successors': total_successors,
            'continue': len(next_frontier),
            'solutions': len(solutions),
            'pruned': total_pruned,
            'total_candidates': total_candidates,
            'pruning_percentage': pruning_percentage,
            'pruning_stats': total_pruning
        })
        
        # Report number of successors
        if verbose:
            print(f"Step {step} (k={k}): {len(state['frontier'])} branches → {total_successors} successors ({len(next_frontier)} continue, {len(solutions)} solution(s))")
        
        state['frontier'] = next_frontier
        state['k'] = k + 1
        
        if solutions:
            state['solutions'] = solutions
            state['done'] = True
        elif len(next_frontier) == 0:
            state['done'] = True
        elif state['k'] > len(state['N_digits']):
            # Check for solutions in next_frontier before stopping
            final_solutions = []
            for branch in next_frontier:
                if branch['carry_in'] == 0 and branch['P_value'] * branch['Q_value'] == N and branch['P_value'] > 1 and branch['Q_value'] > 1:
                    final_solutions.append(branch)
            
            if final_solutions:
                state['solutions'] = final_solutions
                state['done'] = True
            else:
                state['done'] = True
    
    state['step_data'] = step_data
    return state

if __name__ == '__main__':
    # Test with 23 * 29 = 667
    p = 23
    q = 29
    N = p * q
    
    print(f"Testing adaptive base algorithm with {p} * {q} = {N}")
    print(f"Testing all prime bases up to max({p}, {q}) = {max(p, q)}, plus bases 10 and 15")
    print()
    
    # Generate primes up to max(p, q)
    primes = generate_primes(max(p, q))
    # Add base 10 and 15 if not already in the list
    additional_bases = [10, 15]
    for base in additional_bases:
        if base not in primes:
            primes.append(base)
    primes.sort()
    print(f"Bases to test: {primes}")
    print()
    
    results = []
    all_step_data = {}
    
    for initial_base in primes:
        print(f"{'='*60}")
        print(f"Testing with initial base {initial_base}")
        print(f"{'='*60}")
        
        result = trace_adaptive_algorithm_with_base(p, q, initial_base, verbose=True)
        
        solutions_found = len(result['solutions'])
        
        results.append({
            'initial_base': initial_base,
            'solutions_found': solutions_found
        })
        
        all_step_data[initial_base] = result['step_data']
        
        if solutions_found > 0:
            print(f"\n✓ SOLUTIONS FOUND: {solutions_found}")
            for sol in result['solutions']:
                print(f"  P={sol['P_value']}, Q={sol['Q_value']}, P*Q={sol['P_value'] * sol['Q_value']}")
        else:
            print("\n✗ No solution found")
        
        print()
    
    # Summary table showing successors per step for each base
    print(f"{'='*80}")
    print("Successors per Step Comparison:")
    print(f"{'='*80}")
    
    # Find max steps across all bases
    max_steps = max(len(data) for data in all_step_data.values())
    
    # Header
    header = f"{'Step':<6} {'k':<4}"
    for base in primes:
        header += f" Base {base:<8}"
    print(header)
    print("-" * len(header))
    
    # Data rows - show successors and pruning
    for step_idx in range(max_steps):
        step_num = step_idx + 1
        row = f"{step_num:<6} "
        
        # Get k value from first base that has this step
        k_val = "?"
        for base in primes:
            if step_idx < len(all_step_data[base]):
                k_val = str(all_step_data[base][step_idx]['k'])
                break
        
        row += f"{k_val:<4}"
        
        for base in primes:
            if step_idx < len(all_step_data[base]):
                data = all_step_data[base][step_idx]
                successors = data['successors']
                pruning_pct = data.get('pruning_percentage', 0)
                solutions = data['solutions']
                if solutions > 0:
                    row += f" {successors:>3}/{pruning_pct:>5.1f}%✓"
                else:
                    row += f" {successors:>3}/{pruning_pct:>5.1f}% "
            else:
                row += f" {'-':>11}"
        
        print(row)
    
    print()
    print("Legend: Number/Percentage = successors/pruning %, ✓ = solution found at this step")
    print("        Pruning % = (pruned candidates / total candidates) * 100")
    print("        Total candidates = branches * base^2")
    print()
    
    # Summary
    print(f"{'='*60}")
    print("Summary:")
    print(f"{'='*60}")
    for res in results:
        status = "✓" if res['solutions_found'] > 0 else "✗"
        print(f"{status} Base {res['initial_base']}: {res['solutions_found']} solution(s)")
