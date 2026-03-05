//! IVI (Integer Vector Inversion) base work function for WebAssembly.
//! Same logic as mojo/ivi_base.mojo and basic_algorithm.js workFunction.
//! Exposes `compute_next_states(input)` -> array of next state objects.

use num_bigint::BigInt;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
struct WorkInput {
    k: u32,
    #[serde(rename = "p_history")]
    p_history: Vec<u8>,
    #[serde(rename = "q_history")]
    q_history: Vec<u8>,
    #[serde(rename = "P_value")]
    p_value: String,
    #[serde(rename = "Q_value")]
    q_value: String,
    #[serde(rename = "carry_in")]
    carry_in: u32,
    #[serde(rename = "N_digits")]
    n_digits: Vec<u8>,
}

#[derive(Serialize)]
struct WorkOutput {
    k: u32,
    #[serde(rename = "p_history")]
    p_history: Vec<u8>,
    #[serde(rename = "q_history")]
    q_history: Vec<u8>,
    #[serde(rename = "P_value")]
    p_value: String,
    #[serde(rename = "Q_value")]
    q_value: String,
    #[serde(rename = "carry_in")]
    carry_in: u32,
    pk: u8,
    qk: u8,
    #[serde(rename = "lastTwoDigits")]
    last_two_digits: String,
}

fn multiply_digits(a: u8, b: u8) -> u32 {
    (a as u32) * (b as u32)
}

#[wasm_bindgen]
/// Compute next valid states from one branch. Input and output are JS objects
/// (passed as JsValue). Use from JS: ivi_wasm.compute_next_states(input) -> array.
pub fn compute_next_states(input: JsValue) -> Result<JsValue, JsValue> {
    let inp: WorkInput = serde_wasm_bindgen::from_value(input)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    if inp.n_digits.is_empty() || inp.k < 1 || inp.k as usize > inp.n_digits.len() {
        return Ok(serde_wasm_bindgen::to_value(&[] as &[WorkOutput])?);
    }

    let target_digit = inp.n_digits[(inp.k as usize) - 1];
    let is_last_digit = inp.k as usize == inp.n_digits.len();

    let mut base_sum: u32 = 0;
    let k = inp.k as usize;
    if k > 1 {
        for i in 2..k {
            let p_idx = i - 1;
            let q_idx = k - i;
            if p_idx < inp.p_history.len() && q_idx < inp.q_history.len() {
                base_sum += multiply_digits(inp.p_history[p_idx], inp.q_history[q_idx]);
            }
        }
    }

    let p1 = inp.p_history.first().copied().unwrap_or(0);
    let q1 = inp.q_history.first().copied().unwrap_or(0);

    let p_val: BigInt = inp.p_value.parse().map_err(|e: std::num::ParseIntError| JsValue::from_str(&e.to_string()))?;
    let q_val: BigInt = inp.q_value.parse().map_err(|e: std::num::ParseIntError| JsValue::from_str(&e.to_string()))?;
    let power_k = BigInt::from(10u32).pow((k - 1) as u32);

    let mut results = Vec::<WorkOutput>::new();
    for pk in 0u8..=9 {
        for qk in 0u8..=9 {
            let sum_of_products = if k == 1 {
                multiply_digits(pk, qk)
            } else {
                base_sum + multiply_digits(p1, qk) + multiply_digits(pk, q1)
            };
            let total = sum_of_products + inp.carry_in;
            if total < target_digit as u32 {
                continue;
            }
            let remainder = total - (target_digit as u32);
            if remainder % 10 != 0 {
                continue;
            }
            let carry_out = remainder / 10;
            if carry_out > 10 {
                continue;
            }
            if is_last_digit && carry_out != 0 {
                continue;
            }

            let new_p = &p_val + BigInt::from(pk as u32) * &power_k;
            let new_q = &q_val + BigInt::from(qk as u32) * &power_k;

            let mut next_p = inp.p_history.clone();
            next_p.push(pk);
            let mut next_q = inp.q_history.clone();
            next_q.push(qk);

            results.push(WorkOutput {
                k: inp.k + 1,
                p_history: next_p,
                q_history: next_q,
                p_value: new_p.to_string(),
                q_value: new_q.to_string(),
                carry_in: carry_out,
                pk,
                qk,
                last_two_digits: format!("{}{}", pk, qk),
            });
        }
    }

    serde_wasm_bindgen::to_value(&results).map_err(|e| JsValue::from_str(&e.to_string()))
}
