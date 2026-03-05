#!/usr/bin/env node
/**
 * Run IVI factorization using the base algorithm implemented in Mojo,
 * invoked via a Python worker (PythonMonkey-style: Node passes work to Python,
 * which calls Mojo when available). This variant runs the "worker" locally
 * by spawning the Python process; the same worker could be used by a
 * DCP-compatible scheduler that delegates to this process.
 *
 * Usage: node run-factor-mojo.js <N>
 * Example: node run-factor-mojo.js 3127
 */

const { spawn } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PYTHON_WORKER = path.join(PROJECT_ROOT, "python", "ivi_worker_stdin.py");

function startWorker() {
  return spawn("python3", ["-u", PYTHON_WORKER], {
    cwd: PROJECT_ROOT,
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function runFactorize(N) {
  const N_str = String(N).replace(/\D/g, "");
  if (!N_str) {
    console.error("Usage: node run-factor-mojo.js <N>");
    process.exit(1);
  }
  const N_big = BigInt(N_str);
  const N_digits = N_str.split("").reverse().map(Number);

  const frontier = [
    {
      k: 1,
      p_history: [],
      q_history: [],
      P_value: "0",
      Q_value: "0",
      carry_in: 0,
      N_digits,
    },
  ];

  const worker = startWorker();
  let buffer = "";
  let pending = null;
  const queue = [];

  worker.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      let result;
      try {
        result = JSON.parse(line);
      } catch (e) {
        if (pending) pending.reject(e);
        continue;
      }
      if (result && result.error && pending) {
        pending.reject(new Error(result.error));
        pending = null;
        continue;
      }
      if (pending) {
        pending.resolve(result);
        pending = null;
      } else {
        queue.push(result);
      }
    }
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err.message);
    if (pending) pending.reject(err);
    process.exit(1);
  });

  worker.on("close", (code) => {
    if (code !== 0 && code !== null) {
      if (pending) pending.reject(new Error(`Worker exited ${code}`));
    }
  });

  function callWorker(input) {
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      const payload = JSON.stringify(input) + "\n";
      worker.stdin.write(payload, (err) => {
        if (err) {
          pending = null;
          reject(err);
        }
      });
    });
  }

  async function stepFrontier(currentFrontier) {
    const allResults = [];
    for (const branch of currentFrontier) {
      const nextStates = await callWorker(branch);
      if (Array.isArray(nextStates)) {
        for (const s of nextStates) {
          s.N_digits = N_digits;
          allResults.push(s);
        }
      }
    }
    return allResults;
  }

  async function run() {
    let currentFrontier = frontier;
    const totalDigits = N_digits.length;
    let stepCount = 0;
    const maxSteps = 1000;

    while (currentFrontier.length > 0 && stepCount < maxSteps) {
      stepCount++;
      const k = stepCount;
      if (k > totalDigits) {
        for (const b of currentFrontier) {
          if (Number(b.carry_in) === 0) {
            const P = BigInt(b.P_value);
            const Q = BigInt(b.Q_value);
            if (P * Q === N_big && P > 1n && Q > 1n) {
              const [p, q] = P <= Q ? [P, Q] : [Q, P];
              console.log(`Factors: p = ${p}, q = ${q}`);
              worker.stdin.end();
              return;
            }
          }
        }
        break;
      }

      const nextFrontier = await stepFrontier(currentFrontier);
      if (nextFrontier.length === 0) {
        console.log("No solution found (no valid branches).");
        worker.stdin.end();
        return;
      }
      currentFrontier = nextFrontier;
    }

    if (stepCount >= maxSteps) {
      console.log(`Stopped after ${maxSteps} steps.`);
    } else {
      console.log("No solution found.");
    }
    worker.stdin.end();
  }

  run().catch((err) => {
    console.error(err);
    worker.stdin.end();
    process.exit(1);
  });
}

const N = process.argv[2] || "3127";
runFactorize(N);
