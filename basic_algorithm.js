/**
 * Basic IVI Algorithm - Simplest implementation without pruning
 * 
 * This is the minimal IVI implementation that only enforces the core
 * IVI constraint without any global feasibility pruning.
 * 
 * Requires common.js to be loaded first.
 * 
 * @module basic_algorithm
 */

(function() {
    'use strict';

/**
 * Basic work function - only enforces IVI constraint, no pruning
 */
function workFunction(input) {
    const { k, p_history, q_history, P_value, Q_value, carry_in, N_digits, N } = input;
    
    if (!N_digits || k < 1 || k > N_digits.length) return [];
    if (P_value === undefined || Q_value === undefined || N === undefined) {
        throw new Error('P_value, Q_value, and N (BigInt) are required');
    }
    
    const target_digit = N_digits[k - 1];
    const nextStates = [];
    const isLastDigit = k === N_digits.length;
    
    // Pre-compute base sum for terms i=2 to k-1
    let baseSum = 0;
    for (let i = 2; i < k; i++) {
        const p_idx = i - 1;
        const q_idx = k - i;
        if (p_idx < p_history.length && q_idx >= 0 && q_idx < q_history.length) {
            baseSum += multiplyDigits(p_history[p_idx], q_history[q_idx]);
        }
    }
    
    const q1 = q_history.length > 0 ? q_history[0] : 0;
    const p1 = p_history.length > 0 ? p_history[0] : 0;
    
    // Explore all possible digit pairs (0-9 for each)
    for (let pk = 0; pk <= 9; pk++) {
        for (let qk = 0; qk <= 9; qk++) {
            const sumOfProducts = k === 1 
                ? multiplyDigits(pk, qk)
                : baseSum + multiplyDigits(p1, qk) + multiplyDigits(pk, q1);

            const total = sumOfProducts + carry_in;
            
            // IVI Constraint: total = n_k + 10*c_{k+1}
            if (total < target_digit) {
                continue;
            }
            
            const remainder = total - target_digit;
            if (remainder % 10 === 0) {
                const carry_out = remainder / 10;
                // At the last digit, final carry must be 0
                if (carry_out >= 0 && carry_out <= 10 && (!isLastDigit || carry_out === 0)) {
                    const next_p_history = [...p_history, pk];
                    const next_q_history = [...q_history, qk];
                    
                    // Update P_value and Q_value incrementally
                    const powerK = powerOf10(k - 1);
                    const new_P_value = P_value + BigInt(pk) * powerK;
                    const new_Q_value = Q_value + BigInt(qk) * powerK;
                    
                    const lastTwoDigits = `${pk}${qk}`.padStart(2, '0');
                    const next_k = k + 1;
                    
                    nextStates.push({
                        k: next_k,
                        p_history: next_p_history,
                        q_history: next_q_history,
                        P_value: new_P_value,
                        Q_value: new_Q_value,
                        carry_in: carry_out,
                        pk: pk,
                        qk: qk,
                        lastTwoDigits: lastTwoDigits
                    });
                }
            }
        }
    }
    
    return nextStates;
}

function initializeAlgorithm(p, q) {
    const N = p * q;
    const N_big = BigInt(N);
    const N_digits = N.toString().split('').reverse().map(Number);
    
    return {
        p: p,
        q: q,
        N: N,
        N_big: N_big,
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
        maxFrontierWidth: 1
    };
}

function stepAlgorithm(state) {
    const currentK = state.step + 1;
    
    if (currentK > state.N_digits.length) {
        return { ...state, done: true };
    }

    const target_digit = state.N_digits[currentK - 1];
    
    const allResults = [];
    let nodesVisited = state.nodesVisited || 0;
    let nodesPruned = state.nodesPruned || 0;
    
    state.frontier.forEach((branch, parentIdx) => {
        const candidates = workFunction({ 
            ...branch, 
            k: currentK, 
            N_digits: state.N_digits,
            N: state.N_big || BigInt(state.N)
        });
        
        nodesVisited += 100; // 10*10 digit pairs per branch
        nodesPruned += (100 - candidates.length);
        
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
            if (branch.carry_in === 0 && checkSolution(branch, state.N)) {
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
                    maxFrontierWidth: maxFrontierWidth
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

    // Export functions to window for browser use
    if (typeof window !== 'undefined') {
        window.initializeAlgorithm = initializeAlgorithm;
        window.stepAlgorithm = stepAlgorithm;
    }
})();
