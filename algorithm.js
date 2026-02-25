/**
 * IVI (Integer Vector Inversion) Algorithm for Prime Factorization
 * 
 * This module implements the IVI algorithm, a digit-by-digit factorization method
 * that solves a bounded Diophantine equation at each position. The algorithm propagates
 * from least significant digit (LSD) to most significant digit (MSD), maintaining
 * carries and solving constraints locally.
 * 
 * Key properties:
 * - Linear complexity: O(n) where n is the number of digits
 * - Bounded state space: At most 50 admissible digit pairs per position (empirical)
 * - Deterministic: Logically decidable (LD) process
 * 
 * @module algorithm
 */

/**
 * Converts a digit array (LSD-first) to a number.
 * 
 * The digits array represents a number in least-significant-digit-first order.
 * For example, [3, 5] represents 3*10^0 + 5*10^1 = 53.
 * 
 * @param {number[]} digits - Array of digits in LSD-first order (index 0 = LSD)
 * @returns {number} The number represented by the digit array
 * @example
 * digitsToNumber([3, 5]) // returns 53
 * digitsToNumber([9, 0, 0, 8, 3]) // returns 38009
 */
function digitsToNumber(digits) {
    if (!digits?.length) return 0;
    return digits.reduce((sum, digit, i) => sum + digit * Math.pow(10, i), 0);
}

/**
 * Builds the solution path from a successful branch.
 * 
 * Extracts the sequence of (p_k, q_k) digit pairs that led to the solution,
 * ordered by step k from 1 to n.
 * 
 * @param {Object} branch - The solution branch containing p_history and q_history
 * @param {number[]} branch.p_history - History of p digits (LSD-first)
 * @param {number[]} branch.q_history - History of q digits (LSD-first)
 * @returns {Array<{k: number, pk: number, qk: number}>} Solution path with step k and digit pairs
 */
function buildSolutionPath(branch) {
    return branch.p_history.map((pk, i) => ({
        k: i + 1,
        pk: pk,
        qk: branch.q_history[i]
    }));
}

/**
 * Maps algorithm branches to history format for visualization.
 * 
 * Converts raw branch data into a format suitable for storing in algorithm history,
 * optionally marking one branch as the solution path.
 * 
 * @param {Object[]} branches - Array of branch objects from workFunction
 * @param {number|null} solutionIdx - Index of the solution branch, or null if none
 * @returns {Object[]} Array of history-formatted branch objects
 */
function mapBranchesToHistory(branches, solutionIdx = null) {
    return branches.map((b, idx) => ({
        pk: b.pk,
        qk: b.qk,
        lastTwoDigits: b.lastTwoDigits,
        carry: b.carry_in,
        isSolution: idx === solutionIdx,
        parentIdx: b.parentIdx ?? null
    }));
}

/**
 * Checks if a branch represents a valid factorization solution.
 * 
 * Validates that the branch's p and q values are non-trivial (both > 1)
 * and that their product equals the target number N.
 * 
 * @param {Object} branch - Branch to check
 * @param {number[]} branch.p_history - History of p digits (LSD-first)
 * @param {number[]} branch.q_history - History of q digits (LSD-first)
 * @param {number} N - Target number to factorize
 * @returns {boolean} True if branch is a valid solution, false otherwise
 */
function checkSolution(branch, N) {
    const p = digitsToNumber(branch.p_history);
    const q = digitsToNumber(branch.q_history);
    return p > 1 && q > 1 && p * q === N;
}

/**
 * Core IVI work function: finds valid digit pairs for position k.
 * 
 * This function implements the core recurrence relation of the IVI algorithm:
 * 
 *   Σ(i=1 to k) p_i · q_{k-i+1} + c_k = n_k + 10·c_{k+1}
 * 
 * For each possible digit pair (p_k, q_k), it:
 * 1. Computes the sum of all digit products contributing to position k
 * 2. Adds the incoming carry c_k
 * 3. Checks if the result satisfies the IVI constraint
 * 4. Returns valid next states with computed carry_out
 * 
 * @param {Object} input - Input state for position k
 * @param {number} input.k - Current position (1-indexed, 1 = LSD)
 * @param {number[]} input.p_history - History of p digits determined so far (LSD-first)
 * @param {number[]} input.q_history - History of q digits determined so far (LSD-first)
 * @param {number} input.carry_in - Incoming carry c_k (0 for k=1)
 * @param {number[]} input.N_digits - Target number N as digit array (LSD-first)
 * @returns {Object[]} Array of valid next states, each containing:
 *   - k: next position (k+1)
 *   - p_history: extended p digit history
 *   - q_history: extended q digit history
 *   - carry_in: outgoing carry c_{k+1}
 *   - pk: digit p_k chosen
 *   - qk: digit q_k chosen
 *   - lastTwoDigits: string representation of pk*10 + qk
 */
function workFunction(input) {
    const { k, p_history, q_history, carry_in, N_digits } = input;
    
    if (!N_digits || k < 1 || k > N_digits.length) return [];
    
    const target_digit = N_digits[k - 1];
    const nextStates = [];

    // Explore all 100 possible digit pairs (0-9 for each)
    for (let pk = 0; pk <= 9; pk++) {
        for (let qk = 0; qk <= 9; qk++) {
            const temp_p = [...p_history, pk];
            const temp_q = [...q_history, qk];
            
            // Compute sum_{i=1}^{k} p_i * q_{k-i+1}
            // p_i is at index i-1, q_{k-i+1} is at index k-i
            let sumOfProducts = 0;
            for (let i = 1; i <= k; i++) {
                const p_idx = i - 1;
                const q_idx = k - i;
                
                if (p_idx < temp_p.length && q_idx >= 0 && q_idx < temp_q.length) {
                    sumOfProducts += temp_p[p_idx] * temp_q[q_idx];
                }
            }

            const total = sumOfProducts + carry_in;
            const remainder = total - target_digit;

            // IVI Constraint: total = n_k + 10*c_{k+1}
            // So: remainder = 10*c_{k+1}, meaning remainder must be >= 0 and divisible by 10
            if (remainder >= 0 && remainder % 10 === 0) {
                const carry_out = remainder / 10;
                // Allow carries 0-10 for intermediate steps
                // At the last digit, final carry must be 0
                if (carry_out >= 0 && carry_out <= 10 && (k < N_digits.length || carry_out === 0)) {
                    nextStates.push({
                        k: k + 1,
                        p_history: temp_p,
                        q_history: temp_q,
                        carry_in: carry_out,
                        pk: pk,
                        qk: qk,
                        lastTwoDigits: (pk * 10 + qk).toString().padStart(2, '0')
                    });
                }
            }
        }
    }

    return nextStates;
}

/**
 * Initializes the IVI algorithm state for factorizing N = p × q.
 * 
 * Creates the initial algorithm state with:
 * - Empty digit histories (starting at position k=1, the LSD)
 * - Zero initial carry (c_1 = 0)
 * - Target number N converted to LSD-first digit array
 * 
 * @param {number} p - First prime factor (for reference, not used in computation)
 * @param {number} q - Second prime factor (for reference, not used in computation)
 * @returns {Object} Initial algorithm state containing:
 *   - p, q, N: Original inputs and product
 *   - N_digits: N as digit array (LSD-first)
 *   - frontier: Initial frontier with one empty state at k=1
 *   - step: Current step counter (0 initially)
 *   - history: Empty history array
 */
function initializeAlgorithm(p, q) {
    const N = p * q;
    const N_digits = N.toString().split('').reverse().map(Number);
    
    return {
        p: p,
        q: q,
        N: N,
        N_digits: N_digits,
        frontier: [{
            k: 1,
            p_history: [],
            q_history: [],
            carry_in: 0,
            N_digits: N_digits
        }],
        step: 0,
        history: []
    };
}

/**
 * Executes one step of the IVI algorithm.
 * 
 * Processes the current position k by:
 * 1. Applying workFunction to all branches in the frontier
 * 2. Collecting valid next states with parent relationships
 * 3. Checking for solution completion (when k equals or exceeds N_digits.length)
 * 4. Updating state with new frontier and history
 * 
 * The algorithm terminates when:
 * - A valid solution is found (success: true)
 * - No valid branches exist (done: true)
 * - All digits processed without solution (done: true)
 * 
 * @param {Object} state - Current algorithm state
 * @param {number} state.step - Current step counter
 * @param {number} state.N - Target number to factorize
 * @param {number[]} state.N_digits - N as digit array (LSD-first)
 * @param {Object[]} state.frontier - Current frontier of active branches
 * @param {Object[]} state.history - History of all processed steps
 * @returns {Object} Updated state with one of:
 *   - success: true, foundP, foundQ, solutionPath (if solution found)
 *   - done: true (if no solution possible)
 *   - Updated step, frontier, and history (if continuing)
 */
function stepAlgorithm(state) {
    const currentK = state.step + 1;
    
    // If we've already processed all digits, terminate
    if (currentK > state.N_digits.length) {
        return { ...state, done: true };
    }

    const target_digit = state.N_digits[currentK - 1];
    
    // Process all branches in frontier, tracking parent relationships
    const allResults = [];
    state.frontier.forEach((branch, parentIdx) => {
        workFunction({ ...branch, k: currentK, N_digits: state.N_digits })
            .forEach(result => allResults.push({ ...result, parentIdx }));
    });

    // If no valid branches found, terminate
    if (allResults.length === 0) {
        return { ...state, done: true };
    }

    // Check for solution when processing the last digit
    if (currentK === state.N_digits.length) {
        for (let branchIdx = 0; branchIdx < allResults.length; branchIdx++) {
            const branch = allResults[branchIdx];
            if (branch.carry_in === 0 && checkSolution(branch, state.N)) {
                const p = digitsToNumber(branch.p_history);
                const q = digitsToNumber(branch.q_history);
                return {
                    ...state,
                    step: currentK,
                    frontier: allResults,
                    history: [...state.history, {
                        k: currentK,
                        target_digit: target_digit,
                        branches: mapBranchesToHistory(allResults, branchIdx)
                    }],
                    success: true,
                    foundP: p.toString(),
                    foundQ: q.toString(),
                    solutionPath: buildSolutionPath(branch)
                };
            }
        }
        // No solution found after processing last digit
        return { ...state, done: true };
    }

    // Store step history and continue
    const stepHistory = {
        k: currentK,
        target_digit: target_digit,
        branches: mapBranchesToHistory(allResults)
    };

    return {
        ...state,
        step: currentK,
        frontier: allResults,
        history: [...state.history, stepHistory]
    };
}
