/**
 * Common utilities shared between basic and pruning IVI algorithms
 * 
 * @module common
 */

/**
 * Precomputed lookup table for multiplying two digits (0-9).
 * Returns an object with {d: result_digit, c: carry_value, p: product}
 * where d is the ones place, c is the tens place, and p is the full product.
 * 
 * @type {Array<Array<{d: number, c: number, p: number}>>}
 */
const DIGIT_MULT_TABLE = [
    [{d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}, {d: 0, c: 0, p: 0}],
    [{d: 0, c: 0, p: 0}, {d: 1, c: 0, p: 1}, {d: 2, c: 0, p: 2}, {d: 3, c: 0, p: 3}, {d: 4, c: 0, p: 4}, {d: 5, c: 0, p: 5}, {d: 6, c: 0, p: 6}, {d: 7, c: 0, p: 7}, {d: 8, c: 0, p: 8}, {d: 9, c: 0, p: 9}],
    [{d: 0, c: 0, p: 0}, {d: 2, c: 0, p: 2}, {d: 4, c: 0, p: 4}, {d: 6, c: 0, p: 6}, {d: 8, c: 0, p: 8}, {d: 0, c: 1, p: 10}, {d: 2, c: 1, p: 12}, {d: 4, c: 1, p: 14}, {d: 6, c: 1, p: 16}, {d: 8, c: 1, p: 18}],
    [{d: 0, c: 0, p: 0}, {d: 3, c: 0, p: 3}, {d: 6, c: 0, p: 6}, {d: 9, c: 0, p: 9}, {d: 2, c: 1, p: 12}, {d: 5, c: 1, p: 15}, {d: 8, c: 1, p: 18}, {d: 1, c: 2, p: 21}, {d: 4, c: 2, p: 24}, {d: 7, c: 2, p: 27}],
    [{d: 0, c: 0, p: 0}, {d: 4, c: 0, p: 4}, {d: 8, c: 0, p: 8}, {d: 2, c: 1, p: 12}, {d: 6, c: 1, p: 16}, {d: 0, c: 2, p: 20}, {d: 4, c: 2, p: 24}, {d: 8, c: 2, p: 28}, {d: 2, c: 3, p: 32}, {d: 6, c: 3, p: 36}],
    [{d: 0, c: 0, p: 0}, {d: 5, c: 0, p: 5}, {d: 0, c: 1, p: 10}, {d: 5, c: 1, p: 15}, {d: 0, c: 2, p: 20}, {d: 5, c: 2, p: 25}, {d: 0, c: 3, p: 30}, {d: 5, c: 3, p: 35}, {d: 0, c: 4, p: 40}, {d: 5, c: 4, p: 45}],
    [{d: 0, c: 0, p: 0}, {d: 6, c: 0, p: 6}, {d: 2, c: 1, p: 12}, {d: 8, c: 1, p: 18}, {d: 4, c: 2, p: 24}, {d: 0, c: 3, p: 30}, {d: 6, c: 3, p: 36}, {d: 2, c: 4, p: 42}, {d: 8, c: 4, p: 48}, {d: 4, c: 5, p: 54}],
    [{d: 0, c: 0, p: 0}, {d: 7, c: 0, p: 7}, {d: 4, c: 1, p: 14}, {d: 1, c: 2, p: 21}, {d: 8, c: 2, p: 28}, {d: 5, c: 3, p: 35}, {d: 2, c: 4, p: 42}, {d: 9, c: 4, p: 49}, {d: 6, c: 5, p: 56}, {d: 3, c: 6, p: 63}],
    [{d: 0, c: 0, p: 0}, {d: 8, c: 0, p: 8}, {d: 6, c: 1, p: 16}, {d: 4, c: 2, p: 24}, {d: 2, c: 3, p: 32}, {d: 0, c: 4, p: 40}, {d: 8, c: 4, p: 48}, {d: 6, c: 5, p: 56}, {d: 4, c: 6, p: 64}, {d: 2, c: 7, p: 72}],
    [{d: 0, c: 0, p: 0}, {d: 9, c: 0, p: 9}, {d: 8, c: 1, p: 18}, {d: 7, c: 2, p: 27}, {d: 6, c: 3, p: 36}, {d: 5, c: 4, p: 45}, {d: 4, c: 5, p: 54}, {d: 3, c: 6, p: 63}, {d: 2, c: 7, p: 72}, {d: 1, c: 8, p: 81}]
];

/**
 * Multiplies two digits using the precomputed lookup table.
 * 
 * @param {number} a - First digit (0-9)
 * @param {number} b - Second digit (0-9)
 * @returns {number} The product a * b
 */
function multiplyDigits(a, b) {
    return DIGIT_MULT_TABLE[a][b].p;
}

/**
 * Cache for powers of 10 as BigInt to avoid repeated computation
 * @type {Map<number, bigint>}
 */
const POWER_10_CACHE = new Map();

/**
 * Gets 10^k as BigInt, using cache
 * @param {number} k - Exponent
 * @returns {bigint} 10^k as BigInt
 */
function powerOf10(k) {
    if (POWER_10_CACHE.has(k)) {
        return POWER_10_CACHE.get(k);
    }
    const result = 10n ** BigInt(k);
    POWER_10_CACHE.set(k, result);
    return result;
}

/**
 * Computes integer square root of a BigInt using Newton's method.
 * Returns floor(sqrt(n)) for n >= 0.
 * 
 * @param {bigint} n - Number to compute square root of
 * @returns {bigint} floor(sqrt(n))
 */
function integerSqrt(n) {
    if (n < 0n) {
        throw new Error('Square root of negative number');
    }
    if (n === 0n) return 0n;
    if (n === 1n) return 1n;
    
    // Newton's method: x_{k+1} = (x_k + n/x_k) / 2
    let x = n;
    let prev = 0n;
    while (x !== prev) {
        prev = x;
        x = (x + n / x) / 2n;
    }
    return x;
}

/**
 * Converts a digit array (LSD-first) to a BigInt.
 * 
 * The digits array represents a number in least-significant-digit-first order.
 * For example, [3, 5] represents 3*10^0 + 5*10^1 = 53.
 * 
 * @param {number[]} digits - Array of digits in LSD-first order (index 0 = LSD)
 * @returns {bigint} The number represented by the digit array as BigInt
 * @example
 * digitsToBigInt([3, 5]) // returns 53n
 * digitsToBigInt([9, 0, 0, 8, 3]) // returns 38009n
 */
function digitsToBigInt(digits) {
    if (!digits?.length) return 0n;
    let result = 0n;
    for (let i = 0; i < digits.length; i++) {
        result += BigInt(digits[i]) * powerOf10(i);
    }
    return result;
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
        qk: branch.q_history[i] || 0
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
        pk: b.pk || 0,
        qk: b.qk || 0,
        lastTwoDigits: b.lastTwoDigits,
        carry: b.carry_in || 0,
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
 * @param {bigint|number} N - Target number to factorize
 * @returns {boolean} True if branch is a valid solution, false otherwise
 */
function checkSolution(branch, N) {
    const p = branch.P_value;
    const q = branch.Q_value;
    const N_big = typeof N === 'bigint' ? N : BigInt(N);
    return p > 1n && q > 1n && p * q === N_big;
}
