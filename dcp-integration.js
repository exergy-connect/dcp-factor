/**
 * DCP Integration for IVI Factorization
 * 
 * This module handles the integration with the Distributive Compute Protocol (DCP)
 * to run factorization jobs on the DCP network.
 * 
 * @module dcp-integration
 */

(function() {
    'use strict';

    /**
     * Initializes DCP integration by making the DCP link clickable
     * 
     * @param {Object} dependencies - Required functions and variables
     * @param {Function} dependencies.loadAlgorithm - Function to load algorithm
     * @param {Function} dependencies.initializeAlgorithm - Function to initialize algorithm state
     * @param {Function} dependencies.checkSolution - Function to check if a branch is a solution
     * @param {Function} dependencies.buildSolutionPath - Function to build solution path
     * @param {Function} dependencies.drawVisualization - Function to draw visualization
     * @param {Function} dependencies.updateInfo - Function to update info display
     * @param {Function} dependencies.drawPruningChart - Function to draw pruning chart
     * @param {Function} dependencies.getCurrentAlgorithm - Function to get current algorithm name
     * @param {Function} dependencies.getAlgorithmState - Function to get current algorithm state
     * @param {Function} dependencies.setAlgorithmState - Function to set algorithm state
     */
    function initDCPIntegration(dependencies) {
        const {
            loadAlgorithm,
            initializeAlgorithm,
            checkSolution,
            buildSolutionPath,
            drawVisualization,
            updateInfo,
            drawPruningChart,
            getCurrentAlgorithm,
            getAlgorithmState,
            setAlgorithmState
        } = dependencies;

        const dcpLink = document.getElementById('dcpLink');
        if (!dcpLink) {
            console.warn('DCP link element not found');
            return;
        }

        dcpLink.addEventListener('click', async function() {
            const p = parseInt(document.getElementById('primeP').value);
            const q = parseInt(document.getElementById('primeQ').value);
            const algorithmSelect = document.getElementById('algorithmSelect');
            const selectedAlgorithm = algorithmSelect.value;
            
            if (!p || !q) {
                alert('Please select primes for p and q first');
                return;
            }
            
            // Check if dcp-client is available (may need to be loaded separately)
            if (typeof dcp === 'undefined') {
                // Try to load dcp-client from CDN or show helpful message
                alert('DCP client not available in browser.\n\n' +
                      'To use DCP, you need to:\n' +
                      '1. Use Node.js backend with dcp-client package, OR\n' +
                      '2. Load dcp-client via a bundler (webpack/rollup), OR\n' +
                      '3. Use the Node.js script: node dcp-client.js\n\n' +
                      'For now, the algorithm will run locally in the browser.');
                return;
            }
            
            // Only pruning algorithm is supported for DCP
            if (selectedAlgorithm !== 'pruning') {
                const usePruning = confirm('DCP execution currently only supports the pruning algorithm. Switch to pruning algorithm?');
                if (usePruning) {
                    algorithmSelect.value = 'pruning';
                    await loadAlgorithm('pruning');
                } else {
                    return;
                }
            }
            
            const status = document.getElementById('status');
            status.textContent = 'Initializing DCP job...';
            status.className = 'status processing';
            
            try {
                // Load algorithm if needed
                const currentAlgorithm = getCurrentAlgorithm();
                if (currentAlgorithm !== 'pruning') {
                    await loadAlgorithm('pruning');
                }
                
                // Initialize algorithm state
                let state = initializeAlgorithm(p, q);
                state.algorithm = 'pruning';
                
                status.textContent = `Running on DCP: Step 1/${state.N_digits.length}...`;
                
                // DCP work function - must be serializable and self-contained
                // This function runs on DCP workers, so all dependencies must be inlined
                async function dcpWorkFunction(input) {
                    // Report progress to scheduler (required by DCP)
                    progress();
                    
                    // Extract input parameters
                    const { k, p_history, q_history, P_value, Q_value, carry_in, N_digits, N, sqrtN } = input;
                    
                    // Convert BigInt strings back to BigInt if needed
                    const P_val = typeof P_value === 'string' ? BigInt(P_value) : BigInt(P_value);
                    const Q_val = typeof Q_value === 'string' ? BigInt(Q_value) : BigInt(Q_value);
                    const N_val = typeof N === 'string' ? BigInt(N) : BigInt(N);
                    const sqrtN_val = typeof sqrtN === 'string' ? BigInt(sqrtN) : BigInt(sqrtN);
                    
                    // Inline common utilities (must be self-contained for DCP workers)
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
                    
                    function multiplyDigits(a, b) {
                        return DIGIT_MULT_TABLE[a][b].p;
                    }
                    
                    const POWER_10_CACHE = new Map();
                    function powerOf10(k) {
                        if (POWER_10_CACHE.has(k)) {
                            return POWER_10_CACHE.get(k);
                        }
                        const result = 10n ** BigInt(k);
                        POWER_10_CACHE.set(k, result);
                        return result;
                    }
                    
                    // Inline workFunction logic (simplified version without pruning for now)
                    if (!N_digits || k < 1 || k > N_digits.length) return [];
                    
                    const target_digit = N_digits[k - 1];
                    const nextStates = [];
                    const isLastDigit = k === N_digits.length;
                    const totalDigits = N_digits.length;
                    
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
                    
                    // Explore all possible digit pairs
                    for (let pk = 0; pk <= 9; pk++) {
                        for (let qk = 0; qk <= 9; qk++) {
                            const sumOfProducts = k === 1 
                                ? multiplyDigits(pk, qk)
                                : baseSum + multiplyDigits(p1, qk) + multiplyDigits(pk, q1);
                            
                            const total = sumOfProducts + carry_in;
                            
                            if (total < target_digit) continue;
                            
                            const remainder = total - target_digit;
                            if (remainder % 10 === 0) {
                                const carry_out = remainder / 10;
                                
                                // Basic carry validation
                                const maxDigitContribution = 81 * k;
                                const maxSum = maxDigitContribution + (carry_in || 0);
                                const maxCarryOut = Math.floor(maxSum / 10);
                                
                                if (carry_out < 0 || carry_out > maxCarryOut || (isLastDigit && carry_out !== 0)) {
                                    continue;
                                }
                                
                                const next_p_history = [...p_history, pk];
                                const next_q_history = [...q_history, qk];
                                
                                const powerK = powerOf10(k - 1);
                                const new_P_value = P_val + BigInt(pk) * powerK;
                                const new_Q_value = Q_val + BigInt(qk) * powerK;
                                
                                // Basic feasibility check (P <= Q, product bounds)
                                if (new_P_value > new_Q_value) continue;
                                if (new_P_value * new_Q_value > N_val) continue;
                                if (new_P_value > sqrtN_val) continue;
                                
                                // Check if maximum possible completion is too small
                                const remainingDigits = totalDigits - k;
                                if (remainingDigits > 0) {
                                    const M = powerOf10(remainingDigits) - 1n;
                                    const Pmax = new_P_value + M * powerK;
                                    const Qmax = new_Q_value + M * powerK;
                                    if (Pmax * Qmax < N_val) continue;
                                }
                                
                                nextStates.push({
                                    k: k,
                                    p_history: next_p_history,
                                    q_history: next_q_history,
                                    P_value: new_P_value,
                                    Q_value: new_Q_value,
                                    carry_in: carry_out,
                                    N: N_val,
                                    sqrtN: sqrtN_val
                                });
                            }
                        }
                    }
                    
                    return nextStates;
                }
                
                // Run on DCP
                const compute = dcp.compute;
                
                for (let step = 1; step <= state.N_digits.length; step++) {
                    status.textContent = `DCP Step ${step}/${state.N_digits.length}: Processing ${state.frontier.length} branches...`;
                    
                    if (state.frontier.length === 0) {
                        status.textContent = 'DCP: No valid branches found';
                        status.className = 'status';
                        return;
                    }
                    
                    // Prepare frontier for DCP (ensure BigInt values are serializable)
                    const serializableFrontier = state.frontier.map(branch => ({
                        ...branch,
                        P_value: branch.P_value.toString(),
                        Q_value: branch.Q_value.toString(),
                        N: branch.N ? branch.N.toString() : state.N.toString(),
                        sqrtN: branch.sqrtN ? branch.sqrtN.toString() : state.sqrtN.toString()
                    }));
                    
                    // Create DCP job
                    const job = compute.for(serializableFrontier, dcpWorkFunction);
                    
                    // Configure job metadata
                    job.public = {
                        name: 'IVI Factorization',
                        description: 'Integer Vector Inversion factorization using distributed computation',
                        link: window.location.href
                    };
                    
                    // Note: job.requires() expects module registry names or full URLs
                    // For now, we inline all dependencies in dcpWorkFunction to make it self-contained
                    // If you have a DCP module registry, you can use:
                    // job.requires(['your-registry/common', 'your-registry/pruning-algorithm']);
                    
                    // Attach event listeners for monitoring and logging
                    job.on('readystatechange', (ev) => {
                        console.log(`[DCP] Ready state: ${ev}`);
                        status.textContent = `DCP: ${ev}`;
                    });
                    
                    job.on('accepted', () => {
                        console.log(`[DCP] Job accepted. Job ID: ${job.id}`);
                        status.textContent = `DCP: Job ${job.id} accepted. Processing ${state.frontier.length} branches...`;
                    });
                    
                    job.on('result', (ev) => {
                        console.log(`[DCP] Result received:`, ev);
                    });
                    
                    job.on('error', (err) => {
                        console.error(`[DCP] Job error:`, err);
                        status.textContent = `DCP Error: ${JSON.stringify(err)}`;
                        status.className = 'status';
                    });
                    
                    job.on('console', (con) => {
                        // Capture console.log calls from workers
                        console.log(`[DCP Worker Console]:`, con);
                    });
                    
                    job.on('nofunds', (ev) => {
                        console.warn(`[DCP] No funds:`, ev);
                        status.textContent = `DCP: Insufficient funds. Please top up your account.`;
                        status.className = 'status';
                    });
                    
                    job.on('stop', (ev) => {
                        console.log(`[DCP] Job stopped:`, ev);
                        status.textContent = `DCP: Job stopped`;
                        status.className = 'status';
                    });
                
                // Execute on DCP network
                console.log(`[DCP] Executing job with ${serializableFrontier.length} slices...`);
                const results = await job.exec();
                console.log(`[DCP] Job completed. Received ${results.length} results.`);
                    
                    // Flatten results and convert BigInt strings back
                    const nextFrontier = [];
                    
                    results.forEach((branchCandidates) => {
                        if (Array.isArray(branchCandidates)) {
                            branchCandidates.forEach(candidate => {
                                // Convert BigInt strings back to BigInt
                                if (candidate.P_value) candidate.P_value = BigInt(candidate.P_value);
                                if (candidate.Q_value) candidate.Q_value = BigInt(candidate.Q_value);
                                if (candidate.N) candidate.N = BigInt(candidate.N);
                                if (candidate.sqrtN) candidate.sqrtN = BigInt(candidate.sqrtN);
                                nextFrontier.push(candidate);
                            });
                        }
                    });
                    
                    state.frontier = nextFrontier;
                    
                    // Check for solution
                    if (step === state.N_digits.length) {
                        for (let branchIdx = 0; branchIdx < nextFrontier.length; branchIdx++) {
                            const branch = nextFrontier[branchIdx];
                            if (branch.carry_in === 0 && checkSolution(branch, state.N)) {
                                const foundP = branch.P_value.toString();
                                const foundQ = branch.Q_value.toString();
                                status.textContent = `DCP SUCCESS! Found factors: p = ${foundP}, q = ${foundQ}`;
                                status.className = 'status success';
                                
                                // Update UI with solution
                                const algorithmState = {
                                    ...state,
                                    success: true,
                                    foundP: foundP,
                                    foundQ: foundQ,
                                    solutionPath: buildSolutionPath(branch),
                                    pruningStats: state.pruningStats || {}
                                };
                                setAlgorithmState(algorithmState);
                                drawVisualization(algorithmState);
                                updateInfo(algorithmState);
                                drawPruningChart(algorithmState);
                                return;
                            }
                        }
                    }
                    
                    if (nextFrontier.length === 0) {
                        status.textContent = 'DCP: Algorithm completed (no factors found)';
                        status.className = 'status';
                        return;
                    }
                }
                
                status.textContent = 'DCP: Algorithm completed (no factors found)';
                status.className = 'status';
                
            } catch (error) {
                console.error('DCP error:', error);
                status.textContent = `DCP Error: ${error.message}`;
                status.className = 'status';
                alert('DCP execution failed: ' + error.message + '\n\nNote: DCP client may require Node.js environment or additional setup.');
            }
        });
    }

    // Export initialization function
    if (typeof window !== 'undefined') {
        window.initDCPIntegration = initDCPIntegration;
    }
})();
