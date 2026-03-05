# Φᵈᶜᵖ: Exploring Algorithmic Structure in Integer Factorization

**Φᵈᶜᵖ** (Phi-DCP) is an experimental framework that explores **Integer Vector Inversion (IVI)**—a digit-propagation formulation of semiprime factorization—in combination with the **Distributive Compute Protocol (DCP)** for decentralized execution. The project investigates whether the *structure* of the IVI recurrence admits bounded branching and what that implies for complexity.

🌐 **[Try it live →](https://exergy-connect.github.io/dcp-factor/)**

## Overview

Established methods such as the General Number Field Sieve (GNFS) have sub-exponential complexity and require large-scale resources. This project examines an alternative *structural* view:

1. **Factorization as digit propagation** — Reformulate $N = p \cdot q$ as a digit-by-digit recurrence (IVI); explore one digit position at a time from least to most significant instead of searching the full space of candidates.
2. **Distribution via DCP** — Map each digit position to a layer of work that can be farmed out to many workers; study how frontier size and network shape interact.
3. **Complexity as an open question** — If the number of admissible digit pairs per position were bounded by a constant (e.g. the empirical “50-state” bound), total work would scale linearly in the number of digits. That bound is *empirically observed* and *conjectural*; the algorithm’s value is in exploring whether such structure holds and how pruning affects the search.

## Core Concepts

### Integer Vector Inversion (IVI)

IVI is a formulation of factorization ($N = p \cdot q$) as a digit-by-digit propagation problem. The core is a Diophantine recurrence:

$$\sum_{i=1}^{k} p_i q_{k-i+1} + c_k = n_k + 10c_{k+1}$$

Where:
- $p_k, q_k$ are digits of the factors at position $k$
- $c_k$ is the carry from the previous position
- $n_k$ is the target digit of the semiprime $N$

### The 50-State Bound (Empirical Conjecture)

In practice, at each digit position $k$ only a subset of the $b^2$ digit pairs satisfy the IVI equation and carry constraint. Empirically, in base 10 this subset is often **at most ~50 pairs** per position; the same order of magnitude appears across many tested semiprimes. If this bound held *in general* and independently of $N$, the recurrence would yield **O(n)** work in the number of digits. This is an **empirical observation and conjecture**, not a proven theorem; the implementation exists partly to test how often and under what conditions the branching stays bounded.

### Distributive Compute Protocol (DCP)

DCP is used to distribute IVI work across many workers. Each valid digit-pair state is a branch that can be processed on a separate node; the scheduler manages frontier size and look-ahead depth.

### The Adjacent Possible (Metaphor)

Borrowing from Stuart Kauffman’s idea of the “adjacent possible”: at each digit $k$, the recurrence defines the set of next admissible states from the current one. In that sense, the search explores “adjacent” configurations step by step. One path—sometimes called the **Golden Path**—corresponds to a full factorization (carry propagation consistent to the end); most branches are pruned when they violate feasibility bounds.

### Base Selection

The IVI algorithm can operate in any base $b \geq 2$. The choice of base significantly impacts performance:

- **Fewer digits**: Higher bases (e.g., base 16) reduce the number of digit positions, potentially decreasing total computation
- **Branching factor**: The number of valid digit pairs per position varies with base, affecting the search space width
- **Optimal base**: The ideal base depends on the specific number being factored—there's no universal "best" base

**Trade-offs:**
- **Base 8**: Often good for smaller numbers, can reduce branching in some cases
- **Base 10**: Natural for human-readable results, balanced performance
- **Base 16**: Fewer digits for large numbers, but higher branching per position (up to 256 pairs vs 100 in base 10)

The algorithm adapts the IVI constraint to any base: $\sum_{i=1}^{k} p_i q_{k-i+1} + c_k = n_k + b \cdot c_{k+1}$, where carries propagate in base $b$.

### Parallel Base Exploration

The algorithm can explore multiple bases simultaneously to discover interference patterns and identify the optimal base for a given number. This parallel exploration:

- **Runs concurrently**: Multiple bases are processed in parallel, allowing real-time comparison
- **Identifies winners**: The first base to find a solution is highlighted, showing which base was most efficient
- **Reveals patterns**: By comparing performance across bases, you can observe how different number representations affect the search space
- **Optimizes selection**: The results help identify which base works best for similar numbers

This feature supports empirical comparison of base-dependent branching and runtime, i.e. how the recurrence’s admissible set varies with the representation base.

## How It Works

### Step-by-Step Structure

1. **Initialization**: Digit position $k=1$ (least significant), empty digit histories, carry $c_1 = 0$.
2. **Expansion**: For position $k$, consider all $b^2$ digit pairs $(p_k, q_k)$; in base 10 that’s 100 pairs per state, 256 in base 16.
3. **Filtering**: Keep only pairs that satisfy the IVI recurrence and carry update; in base 10 the number kept is often ≤50 per state (empirically).
4. **Propagation**: Those states form the frontier for $k+1$.
5. **Pruning**: States that fail `globalFeasible()` are discarded and not extended.
6. **Termination**: A solution is found when all digits are processed and final carry $c_{n+1} = 0$.

### State Structure

Each state in the frontier is a compact JSON tuple:

```javascript
{
  k: integer,              // Current digit position
  p_history: [digits],     // Digits p₁ to p_{k-1}
  q_history: [digits],     // Digits q₁ to q_{k-1}
  carry_in: integer,       // Carry from position k-1
  N_digits: [digits]       // Target semiprime digits
}
```

### Topology

- **Expansion**: Each digit position is one layer; the frontier is the set of states at that layer.
- **Pruning**: Branches that fail global feasibility are discarded as soon as they are detected.
- **Persistence**: States are self-contained tuples, so they can be sent to workers and merged without shared memory.

## Global Feasibility Pruning: Mathematical Soundness

The IVI algorithm employs **globally-sound pruning** to eliminate branches that cannot possibly lead to valid factorizations. All pruning logic is consolidated in a single deterministic function `globalFeasible()` that ensures:

- **No false negatives**: Valid solutions are never eliminated
- **Early reduction**: Search width is reduced as early as possible
- **Mathematical rigor**: All bounds are mathematically proven, not heuristic
- **BigInt safety**: All arithmetic uses BigInt to handle arbitrarily large numbers
- **Distributed compatibility**: Pruning decisions are deterministic and independent of worker identity

### Pruning Strategy Overview

The pruning system implements multiple layers of mathematical bounds:

1. **Core Product Bounding**: Ensures the current and maximum possible products bracket the target
2. **Square Root Envelope**: Eliminates geometrically unreachable regions
3. **Exact Termination**: Validates final state when all digits are processed
4. **Leading Digit Constraint**: Rejects invalid fixed-length completions
5. **Carry Envelope Tightening**: Uses position-dependent bounds for carry values

### Detailed Pruning Rules

#### 1. Core Product Bounding (Mandatory)

At depth $k$ (after processing $k$ digits), let:
- $P_k$ = current partial value of factor $p$
- $Q_k$ = current partial value of factor $q$
- $N$ = target semiprime
- $remaining = totalDigits - k$ = digits remaining to process

If $remaining > 0$, compute maximum possible completions:
- $maxTail = 10^{remaining} - 1$ (all remaining digits are 9)
- $P_{max} = P_k + maxTail \cdot 10^k$
- $Q_{max} = Q_k + maxTail \cdot 10^k$

**Pruning checks:**
1. If $P_k \cdot Q_k > N$ → **prune** (current product already too large)
2. If $P_{max} \cdot Q_{max} < N$ → **prune** (maximum possible product too small)

These bounds ensure that the target $N$ lies within the feasible rectangle defined by $(P_k, Q_k)$ and $(P_{max}, Q_{max})$.

#### 2. Square Root Envelope Pruning (Mandatory)

Since valid factorizations satisfy $P \leq \sqrt{N} \leq Q$, we can eliminate geometrically unreachable regions.

Precompute once: $\sqrt{N} = \lfloor \sqrt{N} \rfloor$ (integer square root)

**Pruning checks:**
1. If $P_{max} < \sqrt{N}$ **AND** $Q_{max} < \sqrt{N}$ → **prune** (unreachable lower-left region)
2. If $P_k > \sqrt{N}$ **AND** $Q_k > \sqrt{N}$ → **prune** (unreachable upper-right region)

This removes entire quadrants of the product space that cannot contain valid solutions.

#### 3. Exact Termination Rule

When $remaining = 0$ (all digits processed), accept only if:
- $P_k \cdot Q_k = N$ (exact product match)
- $carry_{in} = 0$ (checked separately in work function)
- $P_k > 1$ and $Q_k > 1$ (reject trivial factors)

Otherwise → **prune**.

This ensures that only complete, valid factorizations are accepted at termination.

#### 4. Leading Digit Constraint

When $remaining = 0$, reject branches where:
- $P_k = 0$ or $Q_k = 0$ (actual zero values, not just leading zeros)

This eliminates invalid fixed-length completions. Note: Numbers with fewer digits (e.g., $007 = 7$) are allowed, as they represent valid values.

#### 5. Carry Envelope Tightening

At depth $k$, the maximum convolution sum is bounded by:
- $maxDigitContribution = 81 \cdot k$ (maximum product contribution from $k$ digit pairs, each at most $9 \cdot 9 = 81$)
- $maxSum = maxDigitContribution + carry_{in}$
- $maxCarryOut = \lfloor maxSum / 10 \rfloor$

**Pruning check:**
- If $carry_{out} > maxCarryOut$ → **prune**

Additionally, at the final digit position, $carry_{out}$ must equal $0$ for a valid solution.

This replaces hard-coded carry bounds with position-dependent dynamic bounds, ensuring mathematical soundness at all depths.

### Pruning Implementation Details

#### BigInt Discipline

All arithmetic involving $P$, $Q$, $N$, or powers of 10 uses `BigInt` to avoid precision loss:
- Powers of 10 are cached: `pow10[k] = 10n ** BigInt(k)`
- All comparisons use BigInt: `P_value * Q_value > N` (not JavaScript `number`)
- No floating-point approximations
- No implicit type coercion

#### Incremental Value Maintenance

Values are maintained incrementally to avoid expensive recomputation:
- $P_{new} = P_{old} + digit_P \cdot 10^{k-1}$
- $Q_{new} = Q_{old} + digit_Q \cdot 10^{k-1}$

Digit arrays (`p_history`, `q_history`) are used only for display/debugging, not for value computation.

#### Determinism for Distributed Execution

Pruning decisions depend only on:
- Current state ($P_k$, $Q_k$, $k$)
- Target $N$ and $\sqrt{N}$
- Total digits $totalDigits$

They are **independent** of:
- Worker ID
- Depth scheduling
- Runtime timing
- Exploration order

This ensures that distributed workers make identical pruning decisions, regardless of when or where they execute.

### Forbidden Pruning Techniques

The following are explicitly **not** used, as they violate mathematical rigor:

- ❌ Floating-point approximations
- ❌ Heuristic thresholds
- ❌ Probability-based pruning
- ❌ Empirical tuning
- ❌ Assumptions about digit distribution
- ❌ "Residual magnitude" checks that reduce to already-checked bounds
- ❌ Cross-bounds like $P_k \cdot Q_{max} < N$ (unsafe in bidirectional growth model)

### Performance Characteristics

- **Time per node**: $O(1)$ - All bound computations are constant time
- **Space**: $O(1)$ - Only current state values needed, no temporary arrays
- **Cache efficiency**: Powers of 10 are cached, avoiding repeated exponentiation
- **Pruning effectiveness**: In practice, a large fraction of candidate branches are eliminated (metrics are logged for analysis)

### Instrumentation

The algorithm tracks pruning effectiveness:
- `nodesVisited`: Total candidate digit pairs explored (typically $100 \cdot frontierSize$ per step)
- `nodesPruned`: Number of candidates eliminated by pruning
- `maxFrontierWidth`: Maximum number of active branches at any step

These metrics allow comparison of pruning effectiveness across different numbers and bases.

## Elastic Scheduler: Adapting Look-Ahead to Frontier Size

The look-ahead depth $m$ is a scheduler parameter: each task can advance up to $m$ digit positions before returning. Tuning $m$ trades off per-worker cost (and latency) against the number of round-trips and the width of the frontier.

### Feedback Based on Frontier Density

The scheduler can adjust $m$ using the current number of active branches (frontier size):

- **Small $m$** when the frontier is small: more frequent syncs, more chances to grow the frontier across workers.
- **Large $m$** when the frontier is large: fewer round-trips, more pruning per task so that only branches that survive several steps return.

### Implementation: The Task Payload

The Task Object now includes the `m` parameter, allowing the worker to calibrate its local recursion stack.

**Payload Schema:**

```json
{
  "k": 128,              // Current digit position
  "m": 10,               // Dynamic look-ahead depth
  "N_digits": [...],     // Target semiprime digits
  "state": {
    "p_history": [...],
    "q_history": [...],
    "carry_in": 4
  }
}
```

### State Space Compression Table

As $m$ increases, the number of required network round-trips for an RSA-scale number (e.g., 617 digits) drops drastically:

| Look-ahead ($m$) | Network Pulses (Round-trips) | Compute Effort per Worker | Network Overhead |
| --- | --- | --- | --- |
| **1** | 617 | Negligible | Critical |
| **4** | 154 | Low | Moderate |
| **10** | 62 | Medium | Low |
| **20** | 31 | High | **Optimal** |

### Convergence at the Most Significant Digit

Near the end of the recurrence, the number of surviving branches often drops. The scheduler can increase $m$ there to reduce round-trips and quickly check the final carry $c_{n+1}=0$ for any candidate solution.

## Implementation

### Work Function

The core work function runs in each DCP worker sandbox. The example below shows base-10 implementation; the algorithm can be adapted for any base $b$ by:
- Changing the digit range from `0..9` to `0..(b-1)`
- Replacing `% 10` and `/ 10` with `% b` and `/ b` in the IVI constraint

```javascript
function workFunction(input) {
  const { k, p_history, q_history, carry_in, N_digits } = input;
  const target_digit = N_digits[k - 1];
  const nextStates = [];

  // Explore all 100 possible digit pairs (for base 10)
  for (let pk = 0; pk <= 9; pk++) {
    for (let qk = 0; qk <= 9; qk++) {
      // Calculate sum of products for position k
      let sumOfProducts = 0;
      sumOfProducts += (pk * q_history[0]);
      if (k > 1) {
        sumOfProducts += (p_history[0] * qk);
      }
      for (let i = 2; i < k; i++) {
        sumOfProducts += p_history[i - 1] * q_history[k - i];
      }

      const total = sumOfProducts + carry_in;

      // IVI Constraint: Does this pair satisfy the target digit?
      // For base b: total % b === target_digit, carry_out = Math.floor(total / b)
      if (total % 10 === target_digit) {
        const carry_out = Math.floor(total / 10);
        nextStates.push({
          k: k + 1,
          p_history: [...p_history, pk],
          q_history: [...q_history, qk],
          carry_in: carry_out
        });
      }
    }
  }

  return nextStates; // Empty array = pruned branch
}
```

### Deployment Flow

1. Initialize frontier with seed state ($k=1$, empty histories, $c_1=0$)
2. For each digit position $k$ from 1 to $n$:
   - Distribute frontier states to DCP workers
   - Collect results (valid next states)
   - Flatten into new frontier
   - Check for termination (final carry = 0)
3. Return factors $p$ and $q$ when a full solution is found

## Complexity Analysis

- **Time complexity**: *Conditional* on the branching bound. If the number of admissible pairs per position is $O(1)$, then total work is **O(n)** in the number of digits. Without a proven bound, complexity remains open; the implementation is intended to gather evidence.
- **Space per worker**: $O(1)$ — only the current state and fixed-size buffers.
- **Network**: Look-ahead $m$ reduces round-trips (e.g. $n/m$ pulses for $n$ digits).
- **Parallelism**: Bounded by frontier width; empirically often on the order of tens of branches per layer in base 10.

## Algorithmic Contrast

| Aspect | GNFS (reference) | IVI + DCP (this project) |
|--------|-------------------|---------------------------|
| **Structure** | Global algebraic / sieve | Digit-by-digit recurrence, local propagation |
| **Complexity** | Sub-exponential (proven) | Linear in $n$ *if* constant branching holds (conjectural) |
| **Execution** | Single large machine / cluster | Many small workers, DCP |
| **Goal** | Production factorization | Exploring recurrence structure and pruning effectiveness |

## References

For mathematical formulation and context:

- Gerck, E. (2026). "IVI: Integer Vector Inversion by Diophantine Digit Propagation." Planalto Research.
- van Bemmel, J. (2026). "Φᵈᶜᵖ: Factoring the Universe through the Web of the Adjacent Possible." Exergy ∞ LLC.

## License

See [LICENSE](LICENSE) file for details.

## Contributing

This is an experimental framework for studying algorithmic structure and pruning. Contributions, questions, and rigorous analysis are welcome.
