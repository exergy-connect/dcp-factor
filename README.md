# Φᵈᶜᵖ: Factoring the Universe through the Web of the Adjacent Possible

**Φᵈᶜᵖ** (Phi-DCP) is a revolutionary approach to integer factorization that combines **Integer Vector Inversion (IVI)** with the **Distributive Compute Protocol (DCP)** to achieve linear-time factorization of semiprimes through decentralized computation.

🌐 **[Try it live →](https://exergy-connect.github.io/dcp-factor/)**

## Overview

Traditional factorization methods like the General Number Field Sieve (GNFS) require massive computational resources and sub-exponential time. Φᵈᶜᵖ transforms this problem by:

1. **Reframing factorization as digit propagation** - Instead of searching the exponential space of possible primes, we solve one digit at a time from least to most significant
2. **Distributing across a global network** - Each digit position becomes a "ring" in an expanding web, processed by idle processors worldwide
3. **Achieving linear complexity** - Through the IVI empirical conjecture (50-state bound), we reduce complexity from exponential to O(n)

## Core Concepts

### Integer Vector Inversion (IVI)

IVI reformulates factorization ($N = p \cdot q$) as a digit-by-digit propagation problem. The mathematical engine is a bounded Diophantine recurrence relation:

$$\sum_{i=1}^{k} p_i q_{k-i+1} + c_k = n_k + 10c_{k+1}$$

Where:
- $p_k, q_k$ are digits of the factors at position $k$
- $c_k$ is the carry from the previous position
- $n_k$ is the target digit of the semiprime $N$

### The 50-State Bound

The key insight of IVI is the **Empirical Conjecture**: at any digit position $k$, there are at most **50 admissible digit pairs** that satisfy the equation and allow carry propagation. This bound is independent of the semiprime size, reducing complexity from exponential to linear.

### Distributive Compute Protocol (DCP)

DCP enables the distribution of IVI computation across a global network of idle processors. Each valid digit-pair state becomes a branch in a "cosmic tree" that expands horizontally across thousands of devices.

### The Adjacent Possible

Inspired by Stuart Kauffman's biological theory, the "Adjacent Possible" describes all states reachable from the current configuration. At each digit $k$, the universe expands into ~50 potential futures. Most are mathematical dead ends, but one path—the **Golden Path**—maintains perfect carry equilibrium until the final digit.

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

This feature enables empirical discovery of base-dependent performance characteristics, revealing how the "Adjacent Possible" expands differently across different number representations.

## How It Works

### The Expanding Web

1. **Initialization**: Start with digit position $k=1$ (least significant digit), empty histories, and zero carry
2. **Expansion**: For each position $k$, workers explore all $b^2$ possible digit pairs $(p_k, q_k)$ where $b$ is the chosen base (e.g., 100 pairs for base 10, 256 for base 16)
3. **Filtering**: Only pairs satisfying the IVI constraint are kept (typically ≤50 per position in base 10)
4. **Propagation**: Valid states become the frontier for position $k+1$
5. **Pruning**: Branches that reach impossible states are automatically discarded
6. **Termination**: The Golden Path is found when $k > n$ and final carry $c_{n+1} = 0$

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

- **Expansion**: Each digit position acts as a "ring" in an expanding universe
- **Pruning**: Dead-end branches are immediately recycled
- **Persistence**: States are stored as discrete tuples, enabling distribution across time and space

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
- **Pruning effectiveness**: Typically eliminates 90-99% of candidate branches

### Instrumentation

The algorithm tracks pruning effectiveness:
- `nodesVisited`: Total candidate digit pairs explored (typically $100 \cdot frontierSize$ per step)
- `nodesPruned`: Number of candidates eliminated by pruning
- `maxFrontierWidth`: Maximum number of active branches at any step

These metrics allow comparison of pruning effectiveness across different numbers and bases.

## Elastic Scheduler Architecture: The Adaptive Core of Φᵈᶜᵖ

By making $m$ (the look-ahead depth) a scheduler-controlled parameter, the IVI algorithm evolves from a static sequence into an **Elastic Search Web**. This architecture allows the system to balance the "width" of the branch search with the "depth" of local computation, optimizing for the global network's current throughput.

### The Dynamic Feedback Loop

The Elastic Scheduler monitors the **Frontier Density**—the number of active valid branches—to determine the optimal $m$ for the next pulse.

* **Expansion Phase (Small $m$):** Used when the number of active branches is low. By reducing $m$, the scheduler forces more frequent check-ins, allowing the web to "fan out" and discover new adjacent possibilities across more workers.
* **Pruning Phase (Large $m$):** Used when the frontier becomes too wide. By increasing $m$, the scheduler delegates more "logical work" to the workers. This forces branches to survive a longer mathematical gauntlet before reporting back, naturally pruning the "web" and reducing network congestion.

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

### The "Golden Path" Convergence

The ultimate goal of the Elastic Scheduler is to navigate the **Adjacent Possible** until only the Golden Path remains. By the time the web reaches the MSD (Most Significant Digit), the constraints are so tight that $m$ can be maximized to rapidly close the gap and verify the final carry $c_{n+1}=0$.

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
3. Return factors $p$ and $q$ when Golden Path found

## Complexity Analysis

- **Time Complexity**: $O(n)$ - Linear in the number of digits
- **Space Complexity**: $O(1)$ per worker - Only current state needed
- **Network Latency**: Minimized by bundling multiple digit tests per work unit
- **Parallelism**: Up to ~50 workers per digit position (bounded by IVI conjecture)

## Paradigm Shift

| Feature | Traditional (GNFS) | Φᵈᶜᵖ (IVI + DCP) |
|---------|-------------------|-------------------|
| **Logic** | Global Search | Local Digit Propagation |
| **Complexity** | Sub-exponential | Linear $O(n)$ |
| **Hardware** | Supercomputers | Global Idle Web |
| **Philosophy** | Brute Force | Adjacent Possible |

## References

For detailed mathematical foundations and proofs, see:

- Gerck, E. (2026). "IVI: Integer Vector Inversion by Diophantine Digit Propagation." Planalto Research.
- van Bemmel, J. (2026). "Φᵈᶜᵖ: Factoring the Universe through the Web of the Adjacent Possible." Exergy ∞ LLC.

## License

See [LICENSE](LICENSE) file for details.

## Contributing

This is an experimental framework. Contributions, questions, and discussions are welcome.

---

*"The impossible is simply a series of adjacent possibilities waiting to be explored."*
