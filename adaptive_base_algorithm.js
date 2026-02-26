/**
 * Adaptive Base Switching IVI Algorithm
 * 
 * This algorithm starts with N in base 3 and at each step compares
 * successor states in the current base and base*3. If base*3 yields
 * the same number or fewer successors, it switches to base*3 for the next step.
 * 
 * This adaptive approach explores interference patterns between bases
 * and dynamically selects the base that provides better or equivalent
 * branching options. The algorithm stays in the current base when it
 * performs better (fewer successors), otherwise switches to base*3
 * 
 * IMPORTANT LIMITATION: This algorithm has a fundamental problem:
 * The state at each step (P_value, Q_value, p_history, q_history, carry_in)
 * is dependent on the base used. When switching bases mid-flight, the
 * digit representations change, making it impossible to correctly convert
 * the state from one base to another. The partial values P_value and Q_value
 * are base-10 representations, but the digit histories (p_history, q_history)
 * are base-specific. This mismatch means base switching cannot work correctly.
 * 
 * Requires common.js to be loaded first.
 * Uses base-agnostic utilities (numberToBaseDigits, workFunctionBase, powerOfBase)
 * which are defined in common.js.
 * 
 * @module adaptive_base_algorithm
 */

(function() {
    'use strict';

    /**
     * Initializes the adaptive base algorithm state
     * 
     * @param {number} p - First prime factor
     * @param {number} q - Second prime factor
     * @returns {Object} Initial algorithm state
     */
    function initializeAlgorithm(p, q) {
        const N = BigInt(p) * BigInt(q);
        const initialBase = 3;
        const N_digits = numberToBaseDigits(N, initialBase);
        const sqrtN = integerSqrt(N);
        
        return {
            p: p,
            q: q,
            N: Number(N),
            N_big: N,
            sqrtN: sqrtN,
            currentBase: initialBase,
            N_digits: N_digits,
            frontier: [{
                k: 1,
                p_history: [],
                q_history: [],
                P_value: 0n,
                Q_value: 0n,
                carry_in: 0,
                N_digits: N_digits,
                base: initialBase
            }],
            step: 0,
            history: [],
            activeBranches: 1,
            maxActiveBranches: 1,
            nodesVisited: 0,
            nodesPruned: 0,
            maxFrontierWidth: 1,
            baseSwitches: [],
            startTime: Date.now(),
            success: false
        };
    }

    /**
     * Computes successor states for a given base
     * 
     * @param {Object} branch - Current branch state
     * @param {number} k - Current digit position
     * @param {number} base - Base to use for computation
     * @param {number[]} N_digits - Target number digits in the given base
     * @param {bigint} N - Target number as BigInt
     * @param {bigint} sqrtN - Square root of N as BigInt
     * @returns {Object} Object with states array and pruningStats
     */
    function computeSuccessorsForBase(branch, k, base, N_digits, N, sqrtN) {
        return workFunctionBase({
            ...branch,
            k: k,
            N_digits: N_digits,
            N: N,
            sqrtN: sqrtN
        }, base);
    }

    /**
     * Executes one step of the adaptive base algorithm
     * 
     * @param {Object} state - Current algorithm state
     * @returns {Object} Updated state
     */
    function stepAlgorithm(state) {
        const currentK = state.step + 1;
        
        if (currentK > state.N_digits.length) {
            return { ...state, done: true };
        }
        
        const target_digit = state.N_digits[currentK - 1];
        const currentBase = state.currentBase;
        const nextBase = currentBase * 3;
        
        // Convert N to nextBase for comparison (computed fresh each step)
        const N_digits_nextBase = numberToBaseDigits(state.N_big, nextBase);
        
        const allResults = [];
        let nodesVisited = state.nodesVisited || 0;
        let nodesPruned = state.nodesPruned || 0;
        const totalPruningStats = {};
        
        // For each branch, compute successors in both bases
        const baseComparison = [];
        
        state.frontier.forEach((branch, parentIdx) => {
            // Compute successors in current base first (needed for comparison)
            const resultCurrent = computeSuccessorsForBase(
                branch,
                currentK,
                currentBase,
                state.N_digits,
                state.N_big,
                state.sqrtN
            );
            const candidatesCurrent = resultCurrent.states || [];
            
            // Convert branch to next base
            // If P_value and Q_value are correct (P * Q = N), conversion will always succeed
            // If conversion fails, it means the branch is invalid (not on the golden path)
            const branchNextBase = convertBranchToBase(branch, currentBase, nextBase, state.N_big, N_digits_nextBase);
            
            if (branchNextBase === null) {
                // Conversion failed - this branch is invalid in the next base
                // Still include it in comparison with nextCount=0
                nodesVisited += currentBase * currentBase;
                nodesPruned += nextBase * nextBase;
                
                baseComparison.push({
                    parentIdx: parentIdx,
                    currentBase: currentBase,
                    nextBase: nextBase,
                    currentCount: candidatesCurrent.length,
                    nextCount: 0, // Dead end in next base
                    candidatesCurrent: candidatesCurrent,
                    candidatesNext: [],
                    resultCurrent: resultCurrent,
                    resultNext: { states: [], pruningStats: {} },
                    conversionValid: false
                });
                return; // Skip computing next base successors
            }
            
            // Compute successors in next base (base*3)
            const resultNext = computeSuccessorsForBase(
                branchNextBase,
                currentK,
                nextBase,
                N_digits_nextBase,
                state.N_big,
                state.sqrtN
            );
            const candidatesNext = resultNext.states || [];
            
            nodesVisited += currentBase * currentBase + nextBase * nextBase;
            
            // Compare number of successors
            const currentCount = candidatesCurrent.length;
            const nextCount = candidatesNext.length;
            
            baseComparison.push({
                parentIdx: parentIdx,
                currentBase: currentBase,
                nextBase: nextBase,
                currentCount: currentCount,
                nextCount: nextCount,
                candidatesCurrent: candidatesCurrent,
                candidatesNext: candidatesNext,
                resultCurrent: resultCurrent,
                resultNext: resultNext,
                conversionValid: true
            });
        });
        
        // Decide which base to use based on total successors
        // Switch to base*3 when it yields the same number or less successors
        // baseComparison contains all branches (both valid and invalid conversions)
        const totalCurrent = baseComparison.reduce((sum, comp) => sum + comp.currentCount, 0);
        const totalNext = baseComparison.reduce((sum, comp) => sum + comp.nextCount, 0);
        const validConversions = baseComparison.filter(comp => comp.conversionValid).length;
        
        // Don't switch if no branches converted successfully or if next base has 0 successors
        // (switching to a base with 0 successors would exhaust the frontier)
        const useNextBase = validConversions > 0 && totalNext > 0 && totalNext <= totalCurrent;
        const selectedBase = useNextBase ? nextBase : currentBase;
        const selectedN_digits = useNextBase ? N_digits_nextBase : state.N_digits;
        
        // Record base switch if it occurred
        if (useNextBase && selectedBase !== currentBase) {
            state.baseSwitches = state.baseSwitches || [];
            state.baseSwitches.push({
                step: currentK,
                fromBase: currentBase,
                toBase: nextBase,
                reason: totalNext < totalCurrent 
                    ? `Fewer successors: ${totalNext} < ${totalCurrent}` 
                    : `Same successors: ${totalNext} = ${totalCurrent}`
            });
        }
        
        // Collect results from selected base
        // Process ALL branches - use selected base for valid conversions, current base for invalid ones
        state.frontier.forEach((branch, branchIdx) => {
            const comp = baseComparison.find(c => c.parentIdx === branchIdx);
            
            let candidates = [];
            let result = null;
            
            if (comp && comp.conversionValid && useNextBase) {
                // Use next base - branch was successfully converted
                candidates = comp.candidatesNext;
                result = comp.resultNext;
            } else {
                // Use current base - either staying in current base or conversion failed
                // Reuse already-computed resultCurrent from baseComparison
                if (comp) {
                    candidates = comp.candidatesCurrent;
                    result = comp.resultCurrent;
                } else {
                    // Should not happen - all branches should be in baseComparison
                    // But handle it gracefully by recomputing
                    const resultCurrent = computeSuccessorsForBase(
                        branch,
                        currentK,
                        currentBase,
                        state.N_digits,
                        state.N_big,
                        state.sqrtN
                    );
                    candidates = resultCurrent.states || [];
                    result = resultCurrent;
                }
            }
            
            const stats = result?.pruningStats || {};
            
            nodesPruned += (selectedBase * selectedBase - candidates.length);
            
            // Aggregate pruning stats
            Object.keys(stats).forEach(key => {
                totalPruningStats[key] = (totalPruningStats[key] || 0) + stats[key];
            });
            
            candidates.forEach(candidate => {
                // Ensure the result has the correct base and N_digits
                const resultWithBase = {
                    ...candidate,
                    base: selectedBase,
                    N_digits: selectedN_digits,
                    parentIdx: branchIdx
                };
                allResults.push(resultWithBase);
            });
        });
        
        if (allResults.length === 0) {
            return {
                ...state,
                done: true,
                activeBranches: 0,
                maxActiveBranches: state.maxActiveBranches || 0,
                nodesVisited: nodesVisited,
                nodesPruned: nodesPruned,
                maxFrontierWidth: state.maxFrontierWidth || 0
            };
        }
        
        // Update N_digits if base changed - each step uses only one base
        // No need to cache N_digits_nextBase since we only use one base per step
        
        if (currentK === state.N_digits.length) {
            for (let branchIdx = 0; branchIdx < allResults.length; branchIdx++) {
                const branch = allResults[branchIdx];
                if (branch.carry_in === 0 && checkSolution(branch, state.N_big)) {
                    const p = branch.P_value;
                    const q = branch.Q_value;
                    const activeBranches = allResults.length;
                    const maxActiveBranches = Math.max(state.maxActiveBranches || 0, activeBranches);
                    const maxFrontierWidth = Math.max(state.maxFrontierWidth || 0, activeBranches);
                    
                    return {
                        ...state,
                        step: currentK,
                        frontier: allResults,
                        currentBase: selectedBase,
                        history: [...state.history, {
                            k: currentK,
                            target_digit: target_digit,
                            base: selectedBase,
                            baseComparison: {
                                currentBase: currentBase,
                                nextBase: nextBase,
                                currentCount: totalCurrent,
                                nextCount: totalNext,
                                selected: selectedBase
                            },
                            branches: mapBranchesToHistory(allResults, branchIdx)
                        }],
                        success: true,
                        foundP: p.toString(),
                        foundQ: q.toString(),
                        solutionPath: buildSolutionPath(branch),
                        activeBranches: activeBranches,
                        maxActiveBranches: maxActiveBranches,
                        nodesVisited: nodesVisited,
                        nodesPruned: nodesPruned,
                        maxFrontierWidth: maxFrontierWidth,
                        elapsedTime: Date.now() - state.startTime
                    };
                }
            }
            const activeBranches = allResults.length;
            const maxActiveBranches = Math.max(state.maxActiveBranches || 0, activeBranches);
            const maxFrontierWidth = Math.max(state.maxFrontierWidth || 0, activeBranches);
            return {
                ...state,
                done: true,
                currentBase: selectedBase,
                activeBranches: activeBranches,
                maxActiveBranches: maxActiveBranches,
                nodesVisited: nodesVisited,
                nodesPruned: nodesPruned,
                maxFrontierWidth: maxFrontierWidth
            };
        }
        
        const stepHistory = {
            k: currentK,
            target_digit: target_digit,
            base: selectedBase,
            baseComparison: {
                currentBase: currentBase,
                nextBase: nextBase,
                currentCount: totalCurrent,
                nextCount: totalNext,
                selected: selectedBase
            },
            branches: mapBranchesToHistory(allResults)
        };
        
        const activeBranches = allResults.length;
        const maxActiveBranches = Math.max(state.maxActiveBranches || 0, activeBranches);
        const maxFrontierWidth = Math.max(state.maxFrontierWidth || 0, activeBranches);
        
        return {
            ...state,
            step: currentK,
            frontier: allResults,
            currentBase: selectedBase,
            N_digits: selectedN_digits, // Each step uses only one base
            history: [...state.history, stepHistory],
            activeBranches: activeBranches,
            maxActiveBranches: maxActiveBranches,
            nodesVisited: nodesVisited,
            nodesPruned: nodesPruned,
            maxFrontierWidth: maxFrontierWidth
        };
    }

    /**
     * Converts a branch from one base to another
     * 
     * P_value and Q_value are stored as BigInt (base-10 representation of the actual values),
     * so we can directly convert them to the target base digits.
     * 
     * The key challenge is recomputing the carry_in, which is base-specific.
     * We recompute it by simulating the digit-by-digit multiplication in the new base.
     * 
     * @param {Object} branch - Branch in source base
     * @param {number} fromBase - Source base (for reference)
     * @param {number} toBase - Target base
     * @param {bigint} N - Target number (for validation)
     * @param {number[]} N_digits_newBase - N digits in the new base
     * @returns {Object} Branch converted to target base
     */
    function convertBranchToBase(branch, fromBase, toBase, N, N_digits_newBase) {
        const k = branch.k;
        
        // Reconstruct the partial P_value and Q_value from p_history and q_history in the original base
        // These represent the values of the first k-1 digits that have been processed
        let partial_P_value = 0n;
        let partial_Q_value = 0n;
        
        for (let i = 0; i < branch.p_history.length && i < k - 1; i++) {
            partial_P_value += BigInt(branch.p_history[i]) * (BigInt(fromBase) ** BigInt(i));
        }
        
        for (let i = 0; i < branch.q_history.length && i < k - 1; i++) {
            partial_Q_value += BigInt(branch.q_history[i]) * (BigInt(fromBase) ** BigInt(i));
        }
        
        // Now convert these partial values to the new base
        const p_digits_toBase = numberToBaseDigits(partial_P_value, toBase);
        const q_digits_toBase = numberToBaseDigits(partial_Q_value, toBase);
        
        // Recompute P_value and Q_value from the converted digits
        let P_value_toBase = 0n;
        let Q_value_toBase = 0n;
        
        for (let i = 0; i < p_digits_toBase.length; i++) {
            P_value_toBase += BigInt(p_digits_toBase[i]) * (BigInt(toBase) ** BigInt(i));
        }
        
        for (let i = 0; i < q_digits_toBase.length; i++) {
            Q_value_toBase += BigInt(q_digits_toBase[i]) * (BigInt(toBase) ** BigInt(i));
        }
        
        // Recompute carry_in by directly computing P * Q digit-by-digit in the new base
        // Since P_value and Q_value are correct (P * Q = N), the digit-by-digit multiplication
        // will always satisfy the IVI constraint in any base. We just need to compute the carry.
        let recomputed_carry = 0;
        
        if (k > 1 && N_digits_newBase) {
            // Compute carry by simulating digit-by-digit multiplication for positions 1 through k-1
            // This directly computes what the carry should be based on the first k-1 digits
            for (let pos = 1; pos < k && pos <= N_digits_newBase.length; pos++) {
                const target_digit = N_digits_newBase[pos - 1];
                let baseSum = 0;
                
                // Sum all products p_i * q_j where i + j - 1 = pos
                // This is the same as the IVI constraint: Σ(i=1 to pos) p_i * q_{pos-i+1}
                for (let i = 1; i <= pos; i++) {
                    const j = pos - i + 1;
                    const p_idx = i - 1;
                    const q_idx = j - 1;
                    if (p_idx < p_digits_toBase.length && q_idx >= 0 && q_idx < q_digits_toBase.length) {
                        baseSum += p_digits_toBase[p_idx] * q_digits_toBase[q_idx];
                    }
                }
                
                // IVI constraint: baseSum + carry_in = target_digit + toBase * carry_out
                // Since P_value * Q_value = N, this will always be satisfied
                const total = baseSum + recomputed_carry;
                const remainder = total - target_digit;
                recomputed_carry = Math.floor(remainder / toBase);
            }
        } else if (k === 1) {
            // At k=1, carry is always 0
            recomputed_carry = 0;
        } else {
            // k <= 0 or missing N_digits - can't recompute
            return null;
        }
        
        return {
            k: branch.k,
            p_history: p_digits_toBase,
            q_history: q_digits_toBase,
            P_value: P_value_toBase,
            Q_value: Q_value_toBase,
            carry_in: recomputed_carry,
            base: toBase,
            N_digits: null // Will be set by the caller
        };
    }

    // Export functions
    if (typeof window !== 'undefined') {
        window.initializeAlgorithmAdaptive = initializeAlgorithm;
        window.stepAlgorithmAdaptive = stepAlgorithm;
    }
})();
