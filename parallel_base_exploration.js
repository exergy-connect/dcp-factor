/**
 * Parallel Base Exploration for IVI Algorithm
 * 
 * This module enables running the IVI factorization algorithm with multiple
 * bases simultaneously to explore interference patterns and find the optimal
 * base for a given number.
 * 
 * @module parallel_base_exploration
 */

(function() {
    'use strict';

    // Base-agnostic utilities are now in common.js
    // Use them from the global scope (they're defined in common.js)

    /**
     * Initializes algorithm state for a specific base
     * 
     * @param {number} p - First prime factor
     * @param {number} q - Second prime factor
     * @param {number} base - Base for computation
     * @returns {Object} Initial algorithm state
     */
    function initializeAlgorithmBase(p, q, base) {
        const N = BigInt(p) * BigInt(q);
        const N_digits = numberToBaseDigits(N, base);
        const sqrtN = integerSqrt(N);
        
        return {
            base: base,
            p: p,
            q: q,
            N: Number(N),
            N_big: N,
            sqrtN: sqrtN,
            N_digits: N_digits,
            frontier: [{
                k: 1,
                p_history: [],
                q_history: [],
                P_value: 0n,
                Q_value: 0n,
                carry_in: 0,
                N_digits: N_digits
            }],
            step: 0,
            history: [],
            activeBranches: 1,
            maxActiveBranches: 1,
            nodesVisited: 0,
            nodesPruned: 0,
            maxFrontierWidth: 1,
            startTime: Date.now(),
            success: false
        };
    }

    /**
     * Executes one step of the algorithm for a specific base
     * 
     * @param {Object} state - Current algorithm state
     * @param {number} base - Base for computation
     * @returns {Object} Updated state
     */
    function stepAlgorithmBase(state, base) {
        const currentK = state.step + 1;
        
        if (currentK > state.N_digits.length) {
            return { ...state, done: true };
        }
        
        const target_digit = state.N_digits[currentK - 1];
        const allResults = [];
        let nodesVisited = state.nodesVisited || 0;
        let nodesPruned = state.nodesPruned || 0;
        const totalPruningStats = {};
        
        state.frontier.forEach((branch, parentIdx) => {
            const result = workFunctionBase({
                ...branch,
                k: currentK,
                N_digits: state.N_digits,
                N: state.N_big,
                sqrtN: state.sqrtN
            }, base);
            
            const candidates = result.states || [];
            const stats = result.pruningStats || {};
            
            nodesVisited += base * base; // base^2 digit pairs per branch
            nodesPruned += (base * base - candidates.length);
            
            // Aggregate pruning stats
            Object.keys(stats).forEach(key => {
                totalPruningStats[key] = (totalPruningStats[key] || 0) + stats[key];
            });
            
            candidates.forEach(result => allResults.push({ ...result, parentIdx }));
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
                        history: [...state.history, {
                            k: currentK,
                            target_digit: target_digit,
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
            branches: mapBranchesToHistory(allResults)
        };
        
        const activeBranches = allResults.length;
        const maxActiveBranches = Math.max(state.maxActiveBranches || 0, activeBranches);
        const maxFrontierWidth = Math.max(state.maxFrontierWidth || 0, activeBranches);
        
        return {
            ...state,
            step: currentK,
            frontier: allResults,
            history: [...state.history, stepHistory],
            activeBranches: activeBranches,
            maxActiveBranches: maxActiveBranches,
            nodesVisited: nodesVisited,
            nodesPruned: nodesPruned,
            maxFrontierWidth: maxFrontierWidth
        };
    }

    /**
     * Runs the algorithm for a single base until completion or solution found
     * 
     * @param {number} p - First prime factor
     * @param {number} q - Second prime factor
     * @param {number} base - Base to use
     * @param {Function} onProgress - Optional callback for progress updates
     * @returns {Promise<Object>} Final algorithm state
     */
    async function runAlgorithmForBase(p, q, base, onProgress) {
        let state = initializeAlgorithmBase(p, q, base);
        
        while (!state.done && !state.success && state.step < state.N_digits.length) {
            state = stepAlgorithmBase(state, base);
            
            if (onProgress) {
                onProgress({
                    base: base,
                    step: state.step,
                    totalSteps: state.N_digits.length,
                    activeBranches: state.activeBranches,
                    maxFrontierWidth: state.maxFrontierWidth
                });
            }
            
            // Yield to event loop to allow other bases to progress
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        if (state.success) {
            state.elapsedTime = Date.now() - state.startTime;
        }
        
        return state;
    }

    /**
     * Runs the algorithm with multiple bases in parallel
     * 
     * @param {number} p - First prime factor
     * @param {number} q - Second prime factor
     * @param {number[]} bases - Array of bases to explore (e.g., [8, 10, 16])
     * @param {Function} onProgress - Optional callback for progress updates
     * @returns {Promise<Object>} Results object with results for each base
     */
    async function runParallelBases(p, q, bases, onProgress) {
        const results = {};
        const promises = bases.map(async (base) => {
            try {
                const result = await runAlgorithmForBase(p, q, base, (progress) => {
                    if (onProgress) {
                        onProgress({
                            base: base,
                            ...progress,
                            allResults: { ...results }
                        });
                    }
                });
                results[base] = result;
                return { base, result };
            } catch (error) {
                results[base] = { error: error.message, base: base };
                return { base, error: error.message };
            }
        });
        
        await Promise.all(promises);
        
        // Find which base found the solution first
        let winner = null;
        let fastestTime = Infinity;
        for (const [base, result] of Object.entries(results)) {
            if (result.success && result.elapsedTime < fastestTime) {
                fastestTime = result.elapsedTime;
                winner = { base: parseInt(base), result: result };
            }
        }
        
        return {
            results: results,
            winner: winner,
            bases: bases,
            allCompleted: Object.values(results).every(r => r.done || r.success)
        };
    }

    // Export functions
    if (typeof window !== 'undefined') {
        window.runParallelBases = runParallelBases;
        window.runAlgorithmForBase = runAlgorithmForBase;
        window.initializeAlgorithmBase = initializeAlgorithmBase;
        window.stepAlgorithmBase = stepAlgorithmBase;
        // workFunctionBase and numberToBaseDigits are now in common.js
    }
})();
