# IVI Pruning Heuristics: Mathematical Specification

This document explains the pruning heuristics used in the IVI (Integer Vector Inversion) factorization algorithm and the mathematics behind them. All arithmetic is exact (BigInt); no floating point or probabilistic reasoning is used.

---

## 1. Problem and Notation

### 1.1 Goal

Factor a positive integer **N** into two factors **P** and **Q** such that **N = P × Q**, with **1 < P ≤ Q**. The algorithm explores digit-by-digit from least significant digit (LSD) to most significant digit (MSD).

### 1.2 Notation

- **N**: target product; **n** = number of digits of N.
- **N_digits**: digits of N in **LSD-first** order, so `N_digits[0]` is the units digit.
- **P, Q**: factors; written in base 10 as digit sequences. We enforce **P ≤ Q** (symmetry breaking).
- **p_i, q_i**: digits of P and Q (1-indexed), LSD-first:  
  **P** = p₁·10⁰ + p₂·10¹ + … + pₙ·10^(n−1), and similarly for Q.
- **k**: current position (1-indexed). After processing position k we have chosen p₁…pₖ and q₁…qₖ.
- **P_value (Pₖ), Q_value (Qₖ)**: partial values formed by the first k digits:
  - **Pₖ** = p₁·10⁰ + … + pₖ·10^(k−1)
  - **Qₖ** = q₁·10⁰ + … + qₖ·10^(k−1)
- **remainingDigits**: **r** = n − k (digits still to be chosen).
- **10^r − 1**: maximum value of any r-digit tail in base 10; we denote this by **M** in the code (so **M** = 10^r − 1).
- **√N**: integer square root; **sqrtN** = ⌊√N⌋ (BigInt, e.g. via Newton’s method).

### 1.3 IVI Recurrence (Core Constraint)

At each position **k**, the algorithm enforces that the convolution of P and Q digits matches the k-th digit of N, with carry. The recurrence is:

```
∑_{i=1}^{k}  p_i · q_{k−i+1}  +  c_k  =  n_k  +  10·c_{k+1}
```

- **n_k**: target digit of N at position k (LSD-first index k−1).
- **c_k**: carry into position k (c₁ = 0).
- **c_{k+1}**: carry out; must be a nonnegative integer.
- The sum is over all pairs (p_i, q_j) whose product contributes to the k-th digit of P×Q (i.e. j = k−i+1).

So for each candidate (pₖ, qₖ) we compute the left-hand sum; the right-hand side must equal **n_k + 10·c_{k+1}** for some nonnegative integer **c_{k+1}**. This yields the **IVI constraint** used in the work function to accept or reject (pₖ, qₖ).

---

## 2. Global Feasibility Pruning Overview

After extending a branch by one digit pair (pₖ, qₖ), we have new partial values **Pₖ**, **Qₖ** (each with k digits). The **global feasibility** check answers: *can any completion of the remaining digits ever yield P, Q such that P×Q = N and 1 < P ≤ Q?*

If not, the branch is **pruned**. Checks are applied in a fixed order for **fail-fast** behavior (cheapest and most decisive first). The following sections give the math for each pruning step.

---

## 3. Symmetry (Accept and Swap)

At termination we **accept** branches with **P > Q** and do **not** prune them. When returning the solution, the implementation swaps so that the result is always reported as (p, q) with **p ≤ q**. So there is no pruning step for symmetry; the following steps are numbered 1–8.

---

## 4. Pruning Step 1: Exact Termination Rule

**When:** At termination (remainingDigits === 0).

**Rules:**

1. Reject if **P ≤ 1** or **Q ≤ 1** (trivial factors).
2. Reject if **P = 0** or **Q = 0**.
3. Accept **only if** **P × Q = N**; otherwise reject.

**Math:** At the last digit we have fixed P and Q. The only acceptable outcome is that they are positive, nontrivial, and their product equals N. So we require **P ≥ 2**, **Q ≥ 2**, and **P·Q = N**. The implementation returns **true** on exact match (solution); otherwise it prunes with step 1.

---

## 5. Pruning Step 2: Immediate Overshoot

**When:** Every time we have partial values Pₖ, Qₖ (any k).

**Rule:** If **Pₖ × Qₖ > N**, prune.

**Math:** Any completion of P and Q satisfies P ≥ Pₖ and Q ≥ Qₖ (we add nonnegative digit contributions). So **P·Q ≥ Pₖ·Qₖ**. If already **Pₖ·Qₖ > N**, then **P·Q > N** for every completion; the branch can never reach N. This is the simplest and cheapest global check, so it is applied early (fail-fast).

---

## 6. Pruning Step 3: Sqrt-Based Hard Bound

**When:** Every time (after step 3).

**Rule:** If **Pₖ > √N**, prune.

**Math:** We return the solution with **P ≤ Q** (swap if needed). So in any valid solution, **P ≤ Q** and **P·Q = N**. Hence **P² ≤ P·Q = N**, so **P ≤ √N**. Thus **Pₖ ≤ P ≤ √N**. If **Pₖ > √N**, no completion can yield a valid (p, q) with p ≤ q. So we require **Pₖ ≤ sqrtN** (with **sqrtN** = ⌊√N⌋). This uses the precomputed integer square root (e.g. Newton’s method in `integerSqrt`).

---

## 7. Pruning Step 4: Explicit Growth Envelope (Maximum Future Contribution)

**When:** After steps 1–3, and after computing the **gap** (see below).

**Setup:**  
- **base** = Pₖ × Qₖ (already checked ≤ N in step 3).  
- **gap** = N − base ≥ 0.  
- **r** = remainingDigits; **M** = 10^r − 1.  
- Remaining digits form two “tails”: we can write  
  **P** = Pₖ + A·10^k,  
  **Q** = Qₖ + B·10^k,  
  where **A** and **B** are nonnegative integers with **0 ≤ A, B ≤ M** (at most r digits each).

**Product:**

- **P·Q** = (Pₖ + A·10^k)(Qₖ + B·10^k)  
  = **Pₖ·Qₖ** + Pₖ·B·10^k + Qₖ·A·10^k + A·B·10^(2k).

So the **future contribution** (relative to current base) is:

**contribution** = 10^k·(Pₖ·B + Qₖ·A) + 10^(2k)·A·B.

**Maximum over 0 ≤ A, B ≤ M:**  
- The linear part **Pₖ·B + Qₖ·A** is maximized at **A = B = M**.  
- The quadratic part **A·B** is maximized at **A = B = M**.  

So:

- **maxLinearTerm** = 10^k · (Pₖ·M + Qₖ·M) = 10^k · M · (Pₖ + Qₖ).  
- **maxQuadraticTerm** = 10^(2k) · M².  
- **maxContribution** = maxLinearTerm + maxQuadraticTerm.

**Rule:** If **maxContribution < gap**, then no matter how we choose the remaining digits (A, B within 0..M), we can never add enough to reach N. So we prune (step 4).

**Inequality:** We prune when **maxContribution < N − Pₖ·Qₖ**.

---

## 8. Pruning Step 5: Minimum Contribution Pruning

**When:** When **gap > 0** (so we are not already at the solution).

**Setup:** Same **gap**, **A**, **B**, **contribution** as in step 4.

**Minimum contribution:**  
- In general, the minimum over **0 ≤ A, B ≤ M** is at **A = B = 0**, giving **minContribution = 0**.  
- **Special case (r = 1):** The next digit is the last. Each of P and Q must be at least 1 (nontrivial factors), and with P ≤ Q both MSDs must be at least 1. So we tighten: **minA = minB = 1** when **remainingDigits === 1**. Then:

  **minContribution** = 10^k·(Pₖ·1 + Qₖ·1) + 10^(2k)·(1·1) = 10^k·(Pₖ + Qₖ) + 10^(2k).

**Rule:** If **minContribution > gap**, then even the smallest allowed future contribution exceeds what we need; the branch can never hit N exactly. So we prune (step 5).

---

## 9. Pruning Step 6: Linear-Term Gap Feasibility

**When:** After step 4 and 5.

**Math:** The total possible contribution is **maxLinearTerm + maxQuadraticTerm** (as in step 4). Step 4 already checks **maxContribution < gap**. Step 6 is a redundant check for optional instrumentation (e.g. counting how often the “linear-term gap” would have pruned). So the math is the same as step 4; it does not add a new inequality.

---

## 10. Pruning Step 7: Upper Tail Tightening (Division-Based Coupling)

**When:** After the growth envelope and min-contribution checks.

**Idea:** We bound the **maximum possible P** and **minimum required Q** for the product to reach N.

**Definitions:**  
- **Pmax** = Pₖ + M·10^k  (maximum P achievable with current Pₖ and r more digits).  
- **Qmax** = Qₖ + M·10^k  (maximum Q achievable similarly).

**Fact:** If **Pmax ≤ √N**, then in any completion we have **P ≤ Pmax ≤ √N**, so **P ≤ Q** implies **Q ≥ N/P** (for the product to equal N). The smallest Q that can work with this P-bound is **Q_min** = ⌈N / Pmax⌉. So we need **Qmax ≥ Q_min** for feasibility.

**Computation:**  
- **minRequiredQ** = ⌈N / Pmax⌉. For BigInt: **minRequiredQ** = (N + Pmax − 1) / Pmax (integer division).  
- If **Qmax < minRequiredQ**, then even the largest possible Q we can build from this branch is too small to ever have P·Q = N with P ≤ Pmax. So we prune.

**Rule:** If **Pmax ≤ sqrtN** and **Qmax < minRequiredQ**, prune (step 7).

---

## 11. Pruning Step 8: Length Split Feasibility

**When:** Reserved in the code; currently no active condition (returns feasible).

**Math (intended):** Valid factorizations satisfy **digit_length(P) + digit_length(Q)** equal to **digit_length(N)** or **digit_length(N) + 1** (because of possible carry in the top digit of the product). A future refinement could track or estimate lengths of P and Q and prune when the current partial lengths already make such a length split impossible. The code leaves this as a placeholder (e.g. for a conservative length check).

---

**Removed: Cross-base check (formerly step 9).** A check that (P_B·Q_B) mod B^k = N mod B^k with B = 11 was tried, but P_B and Q_B are the digit sequences interpreted in base 11, so P_B ≠ P and Q_B ≠ Q. Hence (P_B·Q_B) mod B^k need not equal N mod B^k for valid factors; the check wrongly pruned cases such as 53×59 = 3127.

---

**Tried and failed — Mod-11 feasibility (formerly step 9).** A check using a 121-bit mask of (P mod 11, Q mod 11) pairs was implemented: prune if no pair (a,b) in the set has a·b ≡ N (mod 11). It did not help in practice and is commented out in the code.

---

## 12. Carry Envelope Tightening (in the Work Function)

**Where:** Applied when checking each candidate (pₖ, qₖ) before calling the global feasibility function.

**Constraint:** At position k, the convolution sum plus carry-in must equal **n_k + 10·c_{k+1}** for some nonnegative integer **c_{k+1}**. We also need **c_{k+1}** to be bounded above so that future digits (all ≤ 9) can “absorb” the carry.

**Bound on convolution sum:**  
- Each term in **∑_{i=1}^{k} p_i·q_{k−i+1}** is at most 9·9 = 81.  
- So **maxDigitContribution** = 81·k.  
- **maxSum** = maxDigitContribution + carry_in.  
- **maxCarryOut** = ⌊maxSum / 10⌋.

**Rules:**  
1. **c_{k+1}** must be nonnegative and at most **maxCarryOut**.  
2. On the **last** digit (k = n), we must have **c_{k+1} = 0** (no carry out of the top digit).

So after solving **total = n_k + 10·c_{k+1}** (with **total** = sum of products + carry_in), we require **0 ≤ c_{k+1} ≤ maxCarryOut** and, if **isLastDigit**, **c_{k+1} = 0**. Otherwise we reject the (pₖ, qₖ) pair.

---

## 13. Order of Application and Fail-Fast

The global checks are applied in this order:

1. **Exact termination** (only at r = 0): trivial/zero factors and P·Q ≠ N.  
2. **Immediate overshoot:** Pₖ·Qₖ > N.  
3. **Sqrt bound:** Pₖ > √N.  
4. **Growth envelope:** maxContribution < gap.  
5. **Minimum contribution:** minContribution > gap (when gap > 0).  
6. **Linear-term gap** (redundant with 4; for stats).  
7. **Upper tail tightening:** Pmax ≤ √N and Qmax < ⌈N/Pmax⌉.  
8. **Length split** (reserved).

Checks 2 and 3 are very cheap (one product and one comparison; sqrtN is precomputed). They run before the more expensive gap and contribution computations. This ordering minimizes work per branch when many branches are pruned early.

---

## 14. Auxiliary Functions (Reference)

- **powerOf10(k):** Returns **10^k** as BigInt; cached for repeated use.  
- **integerSqrt(n):** Returns **⌊√n⌋** for n ≥ 0 (BigInt), e.g. via Newton’s method: **x_{k+1} = (x_k + n/x_k) / 2** until convergence.  
- **multiplyDigits(a, b):** Returns **a·b** for digits a, b ∈ {0,…,9}; implemented via a precomputed table.  
- **comparePartialNumbers(p_history, q_history):** Lexicographic comparison of two LSD-first digit arrays (MSD compared first); used for ordering, not in the pruning steps above.

---

## 15. Summary Table

| Step | Name                         | When        | Condition (prune if true) |
|------|------------------------------|------------|----------------------------|
| 1    | Exact termination            | r = 0      | P·Q ≠ N or P,Q trivial    |
| 2    | Immediate overshoot          | always     | Pₖ·Qₖ > N                  |
| 3    | Sqrt hard bound              | always     | Pₖ > √N                    |
| 4    | Growth envelope              | always     | maxContribution < gap      |
| 5    | Min contribution             | gap > 0    | minContribution > gap      |
| 6    | Linear-term gap              | always     | (same as 4, for stats)     |
| 7    | Upper tail tightening        | when applicable | Pmax ≤ √N and Qmax < ⌈N/Pmax⌉ |
| 8    | Length split                 | reserved   | (not implemented)          |
| —    | Carry envelope               | per (pₖ,qₖ)| c_{k+1} ∉ [0, maxCarryOut] or (last digit and c_{k+1} ≠ 0) |

Symmetry is handled by accepting P > Q at termination and swapping when returning the solution, so (p, q) is always reported with p ≤ q. Together, these rules ensure that only branches that can mathematically lead to a valid factorization **P·Q = N** with **1 < P ≤ Q** are kept; all others are pruned with a precise, deterministic reason.

---

## 16. Possible Future Pruning Steps

Ideas that are mathematically sound and could be added (with care to avoid wrong prunes):

### 16.1 Mod 9 (digit-sum) feasibility

**Fact:** For any integer X, X ≡ digit_sum(X) (mod 9). So P·Q = N implies **digit_sum(P)·digit_sum(Q) ≡ digit_sum(N) (mod 9)**.

**Idea:** From the current branch we have partial digit sums s_P and s_Q (sum of p₁…pₖ and q₁…qₖ). The remaining digits contribute 0 to 9·r each, so **s_P + [0, 9r]** and **s_Q + [0, 9r]** are the possible full digit sums. We need some pair (S_P, S_Q) in those ranges with **S_P·S_Q ≡ digit_sum(N) (mod 9)**. If the product of the two ranges (mod 9) never equals digit_sum(N) mod 9, prune.

**Care:** Only prune when the *ranges* of possible residues (mod 9) for digit_sum(P) and digit_sum(Q) have no pair whose product ≡ digit_sum(N) (mod 9). Implementation: compute the sets of possible residues for P and Q digit sums; if for all (r_P, r_Q) in those sets we have r_P·r_Q ≢ digit_sum(N) (mod 9), then prune.

### 16.2 Length split (implement step 8)

**Fact:** If N has d digits, then digit_length(P) + digit_length(Q) is either d or d+1 (the +1 from possible carry in the top digit of P·Q).

**Idea:** From Pₖ and Qₖ we can bound the final lengths: e.g. P has at least the number of digits of Pₖ (and at most that + r). So we get **len_P ∈ [L_min_P, L_min_P + r]** and similarly for Q. If **min(len_P) + min(len_Q) > d+1** or **max(len_P) + max(len_Q) < d**, prune. Requires a clear definition of “length” for partial values (e.g. treat leading zeros as not yet present).

### 16.3 Lower-tail coupling (symmetric to step 7)

**Step 7** uses: when Pmax ≤ √N, require Qmax ≥ ⌈N/Pmax⌉. Symmetrically, we can require a *lower* bound on Q so that some P is possible: **Qmin** = Qₖ (or Qₖ + 1 if we forbid leading zero in the next digit). Then we need **Pmax ≥ ⌈N / Qmin⌉** for feasibility. So if **Pmax < ⌈N / Qmin⌉**, prune. Care: Qmin must be a true lower bound on any completion (e.g. if remainingDigits ≥ 1 and we allow MSD 0, Qmin = Qₖ; if we require MSD ≥ 1, Qmin = Qₖ + 10^k).

### 16.4 Tighter minimum contribution for r > 1

**Current:** We use minA = minB = 1 only when remainingDigits === 1 (so the next digit is the MSD and must be ≥ 1).

**Idea:** For remainingDigits = 2, the two remaining digits form a number in [10, 99] if we forbid leading zero (MSD ≥ 1). So we could set minA = 10n, minB = 10n for r = 2, and similarly for larger r (e.g. min tail = 10^(r−1)). Then **minContribution** increases and we might prune more. Care: only valid if we assume both factors have no leading zero in their MSD.

### 16.5 Modular checks with small moduli (e.g. 11) — **tried and failed**

**Fact:** P·Q ≡ N (mod m) for any m. So (P mod m)·(Q mod m) ≡ N (mod m).

**Tried:** For m = 11, the set of possible (P mod 11, Q mod 11) pairs was computed and represented as a 121-bit mask; prune if no pair (a,b) has a·b ≡ N (mod 11). **Result: did not help**; implementation is commented out in the code.

### 16.6 Pmax·Qmax < N (maximum product too small)

**Fact:** The maximum product achievable from this branch is Pmax·Qmax. If **Pmax·Qmax < N**, we can never reach N.

**Note:** This is already implied by the growth envelope (step 4): maxContribution = (Pmax·Qmax − Pₖ·Qₖ), so maxContribution < gap ⟺ Pmax·Qmax < N. So no separate step is needed unless we want an earlier, coarser check (e.g. before computing gap) using a cheap upper bound on Pmax·Qmax.

---

**Summary:** The most promising and low-risk additions are **mod 9 feasibility** (16.1), **length split** (16.2), and **lower-tail coupling** (16.3). **Tighter minimum contribution** (16.4) and **mod m state** (16.5) need careful handling of leading zeros and state size.
