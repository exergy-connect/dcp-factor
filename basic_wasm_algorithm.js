/**
 * Basic IVI Algorithm with optional WASM work function.
 * Uses window.__ivi_wasm_workFunction when set (after pkg/ivi_wasm.js loads),
 * otherwise falls back to the same JS work function as basic_algorithm.js.
 * @module basic_wasm_algorithm
 */

(function() {
    'use strict';

    function workFunctionJS(input) {
        const { k, p_history, q_history, P_value, Q_value, carry_in, N_digits, N } = input;
        if (!N_digits || k < 1 || k > N_digits.length) return [];
        if (P_value === undefined || Q_value === undefined || N === undefined) {
            throw new Error('P_value, Q_value, and N (BigInt) are required');
        }
        const target_digit = N_digits[k - 1];
        const nextStates = [];
        const isLastDigit = k === N_digits.length;
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
        for (let pk = 0; pk <= 9; pk++) {
            for (let qk = 0; qk <= 9; qk++) {
                const sumOfProducts = k === 1
                    ? multiplyDigits(pk, qk)
                    : baseSum + multiplyDigits(p1, qk) + multiplyDigits(pk, q1);
                const total = sumOfProducts + carry_in;
                if (total < target_digit) continue;
                const remainder = total - target_digit;
                if (remainder % 10 !== 0) continue;
                const carry_out = remainder / 10;
                if (carry_out < 0 || carry_out > 10 || (isLastDigit && carry_out !== 0)) continue;
                const powerK = powerOf10(k - 1);
                nextStates.push({
                    k: k + 1,
                    p_history: [...p_history, pk],
                    q_history: [...q_history, qk],
                    P_value: P_value + BigInt(pk) * powerK,
                    Q_value: Q_value + BigInt(qk) * powerK,
                    carry_in: carry_out,
                    pk: pk,
                    qk: qk,
                    lastTwoDigits: (pk + '' + qk).padStart(2, '0')
                });
            }
        }
        return nextStates;
    }

    function workFunction(input) {
        var w = window.__ivi_wasm_workFunction;
        if (w) {
            var copy = { ...input, P_value: String(input.P_value), Q_value: String(input.Q_value) };
            var out = w(copy);
            return out.map(function(s) { return { ...s, P_value: BigInt(s.P_value), Q_value: BigInt(s.Q_value) }; });
        }
        return workFunctionJS(input);
    }

    function initializeAlgorithm(N) {
        const N_big = typeof N === 'bigint' ? N : BigInt(N);
        const N_digits = N_big.toString().split('').reverse().map(Number);
        const N_display = N_big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(N_big) : N_big.toString();
        return {
            p: null,
            q: null,
            N: N_display,
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
        if (state.maxSteps != null && state.step >= state.maxSteps) {
            return { ...state, done: true };
        }
        const currentK = state.step + 1;
        if (currentK > state.N_digits.length) {
            return { ...state, done: true };
        }
        const target_digit = state.N_digits[currentK - 1];
        const allResults = [];
        let nodesVisited = state.nodesVisited || 0;
        let nodesPruned = state.nodesPruned || 0;
        state.frontier.forEach(function(branch, parentIdx) {
            const candidates = workFunction({
                ...branch,
                k: currentK,
                N_digits: state.N_digits,
                N: state.N_big || BigInt(state.N)
            });
            nodesVisited += 100;
            nodesPruned += (100 - candidates.length);
            candidates.forEach(function(result) { allResults.push({ ...result, parentIdx }); });
        });
        var capped = allResults;
        if (state.maxFrontierSize != null && allResults.length > state.maxFrontierSize) {
            capped = allResults.slice(0, state.maxFrontierSize);
        }
        if (capped.length === 0) {
            return { ...state, done: true, activeBranches: 0, maxActiveBranches: state.maxActiveBranches || 0, nodesVisited: nodesVisited, nodesPruned: nodesPruned, maxFrontierWidth: state.maxFrontierWidth || 0 };
        }
        if (currentK === state.N_digits.length) {
            for (let branchIdx = 0; branchIdx < capped.length; branchIdx++) {
                const branch = capped[branchIdx];
                if (branch.carry_in === 0 && checkSolution(branch, state.N)) {
                    let foundP = branch.P_value;
                    let foundQ = branch.Q_value;
                    if (foundP > foundQ) { var t = foundP; foundP = foundQ; foundQ = t; }
                    return {
                        ...state,
                        step: currentK,
                        frontier: capped,
                        history: [...state.history, { k: currentK, target_digit: target_digit, branches: mapBranchesToHistory(capped, branchIdx) }],
                        success: true,
                        foundP: foundP.toString(),
                        foundQ: foundQ.toString(),
                        solutionPath: buildSolutionPath(branch),
                        activeBranches: capped.length,
                        maxActiveBranches: Math.max(state.maxActiveBranches || 0, capped.length),
                        nodesVisited: nodesVisited,
                        nodesPruned: nodesPruned,
                        maxFrontierWidth: Math.max(state.maxFrontierWidth || 0, capped.length)
                    };
                }
            }
            return { ...state, done: true, activeBranches: capped.length, maxActiveBranches: Math.max(state.maxActiveBranches || 0, capped.length), nodesVisited: nodesVisited, nodesPruned: nodesPruned, maxFrontierWidth: Math.max(state.maxFrontierWidth || 0, capped.length) };
        }
        return {
            ...state,
            step: currentK,
            frontier: capped,
            history: [...state.history, { k: currentK, target_digit: target_digit, branches: mapBranchesToHistory(capped) }],
            activeBranches: capped.length,
            maxActiveBranches: Math.max(state.maxActiveBranches || 0, capped.length),
            nodesVisited: nodesVisited,
            nodesPruned: nodesPruned,
            maxFrontierWidth: Math.max(state.maxFrontierWidth || 0, capped.length)
        };
    }

    if (typeof window !== 'undefined') {
        window.initializeAlgorithm = initializeAlgorithm;
        window.stepAlgorithm = stepAlgorithm;
    }
})();
