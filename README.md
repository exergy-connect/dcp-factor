# Φ^DCP: Factoring the Universe through the Web of the Adjacent Possible

**Φ^DCP** (Phi-DCP) is a revolutionary approach to integer factorization that combines **Integer Vector Inversion (IVI)** with the **Distributive Compute Protocol (DCP)** to achieve linear-time factorization of semiprimes through decentralized computation.

## Overview

Traditional factorization methods like the General Number Field Sieve (GNFS) require massive computational resources and sub-exponential time. Φ^DCP transforms this problem by:

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

## How It Works

### The Expanding Web

1. **Initialization**: Start with digit position $k=1$ (least significant digit), empty histories, and zero carry
2. **Expansion**: For each position $k$, workers explore all 100 possible digit pairs $(p_k, q_k)$
3. **Filtering**: Only pairs satisfying the IVI constraint are kept (typically ≤50 per position)
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

## Implementation

### Work Function

The core work function runs in each DCP worker sandbox:

```javascript
function workFunction(input) {
  const { k, p_history, q_history, carry_in, N_digits } = input;
  const target_digit = N_digits[k - 1];
  const nextStates = [];

  // Explore all 100 possible digit pairs
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

| Feature | Traditional (GNFS) | Φ^DCP (IVI + DCP) |
|---------|-------------------|-------------------|
| **Logic** | Global Search | Local Digit Propagation |
| **Complexity** | Sub-exponential | Linear $O(n)$ |
| **Hardware** | Supercomputers | Global Idle Web |
| **Philosophy** | Brute Force | Adjacent Possible |

## References

For detailed mathematical foundations and proofs, see:

- Gerck, E. (2026). "IVI: Integer Vector Inversion by Diophantine Digit Propagation." Planalto Research.
- van Bemmel, J. (2026). "Φ^DCP: Factoring the Universe through the Web of the Adjacent Possible." Exergy ∞ LLC.

## License

See [LICENSE](LICENSE) file for details.

## Contributing

This is an experimental framework. Contributions, questions, and discussions are welcome.

---

*"The impossible is simply a series of adjacent possibilities waiting to be explored."*
