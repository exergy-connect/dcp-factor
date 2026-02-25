/**
 * IVI Base Benchmark Utility
 * Compares Decimal (Base-10) vs. Hex (Base-16) branching factors.
 */

// Note: This benchmark uses a base-agnostic version of the algorithm
// The main algorithm.js is optimized for base 10 only

/**
 * Base-agnostic work function for IVI algorithm
 */
function workFunctionBase(input, base) {
    const { k, p_history, q_history, carry_in, N_digits } = input;
    
    if (!N_digits || k < 1 || k > N_digits.length) return [];
    
    const target_digit = N_digits[k - 1];
    const nextStates = [];
    const isLastDigit = k === N_digits.length;
    
    // Pre-compute base sum for terms i=2 to k-1
    let baseSum = 0;
    for (let i = 2; i < k; i++) {
        const p_idx = i - 1;
        const q_idx = k - i;
        if (p_idx < p_history.length && q_idx >= 0 && q_idx < q_history.length) {
            baseSum += p_history[p_idx] * q_history[q_idx];
        }
    }
    
    const q1 = q_history.length > 0 ? q_history[0] : 0;
    const p1 = p_history.length > 0 ? p_history[0] : 0;

    // Explore all possible digit pairs (0 to base-1 for each)
    for (let pk = 0; pk < base; pk++) {
        for (let qk = 0; qk < base; qk++) {
            const sumOfProducts = k === 1 
                ? pk * qk 
                : baseSum + p1 * qk + pk * q1;

            const total = sumOfProducts + carry_in;
            const remainder = total - target_digit;

            // IVI Constraint: total = n_k + base*c_{k+1}
            if (remainder >= 0 && remainder % base === 0) {
                const carry_out = remainder / base;
                const maxCarry = base * 2; // Allow reasonable carry range
                if (carry_out >= 0 && carry_out <= maxCarry && (!isLastDigit || carry_out === 0)) {
                    nextStates.push({
                        k: k + 1,
                        p_history: [...p_history, pk],
                        q_history: [...q_history, qk],
                        carry_in: carry_out,
                        pk: pk,
                        qk: qk
                    });
                }
            }
        }
    }

    return nextStates;
}

/**
 * Run benchmark for a given number and base
 */
function runBenchmark(N, base) {
    const start = Date.now();
    const N_str = N.toString(base);
    const digits = N_str.split('').reverse().map(d => parseInt(d, base));
    
    // Initial State
    let frontier = [{ k: 1, p_history: [], q_history: [], carry_in: 0, N_digits: digits }];
    let maxBranching = 0;
    let totalBranches = 0;
    const branchingByPosition = [];

    // Run for all digits
    for (let k = 1; k <= digits.length; k++) {
        let nextFrontier = [];
        for (let state of frontier) {
            const successors = workFunctionBase({ ...state, k, N_digits: digits }, base);
            nextFrontier.push(...successors);
        }
        frontier = nextFrontier;
        const branchCount = frontier.length;
        maxBranching = Math.max(maxBranching, branchCount);
        totalBranches += branchCount;
        branchingByPosition.push({ k, branches: branchCount });
        
        if (branchCount === 0) {
            break; // No valid paths
        }
    }

    const end = Date.now();
    const solution = frontier.find(s => s.carry_in === 0 && s.k > digits.length);
    
    return {
        base,
        N,
        N_base: N_str,
        time: (end - start).toFixed(2) + ' ms',
        maxBranches: maxBranching,
        totalBranches,
        avgBranches: (totalBranches / digits.length).toFixed(2),
        efficiencyScore: (digits.length / maxBranching).toFixed(2),
        branchingByPosition,
        solved: solution ? true : false
    };
}

// Run benchmarks
const N = 199 * 199; // 39601

console.log('='.repeat(60));
console.log(`Benchmarking IVI Algorithm for N = ${N} (199 × 199)`);
console.log('='.repeat(60));
console.log();

const result8 = runBenchmark(N, 8);
const result10 = runBenchmark(N, 10);

console.log('Base 8 Results:');
console.log(JSON.stringify(result8, null, 2));
console.log();
console.log('Base 10 Results:');
console.log(JSON.stringify(result10, null, 2));
console.log();
console.log('Comparison:');
console.log(`Max Branches: Base 8 = ${result8.maxBranches}, Base 10 = ${result10.maxBranches}`);
console.log(`Time: Base 8 = ${result8.time}, Base 10 = ${result10.time}`);
console.log(`Efficiency: Base 8 = ${result8.efficiencyScore}, Base 10 = ${result10.efficiencyScore}`);
