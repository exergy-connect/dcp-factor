# Φᵈᶜᵖ: Factoring the Universe through the Web of the Adjacent Possible

**Φᵈᶜᵖ** (Phi-DCP) is a revolutionary approach to integer factorization that combines **Integer Vector Inversion (IVI)** with the **Distributive Compute Protocol (DCP)** to achieve linear-time factorization of semiprimes through decentralized computation.

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
