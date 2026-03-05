# IVI base algorithm in WebAssembly

Same IVI work function as the Mojo and JS implementations, compiled to WASM so the browser can run it. Used by the **Basic (WASM)** algorithm option in the app.

## Build (Rust + wasm-pack)

Prerequisites: [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/).

From the **project root** (not inside `ivi_wasm/`):

```bash
# Install wasm-pack if needed
cargo install wasm-pack

# Build for the web (output goes to project root pkg/)
wasm-pack build ivi_wasm --target web --out-dir pkg
```

This creates `pkg/ivi_wasm.js` and `pkg/ivi_wasm_bg.wasm` next to `index.html`. Reload the app and select **Basic (WASM)**; the work function will run in WASM. If the `pkg/` folder is missing or the WASM load fails, the algorithm falls back to the JS implementation.

## Serve the app

WASM and ES modules require a real HTTP (or HTTPS) origin. Open the app via a local server, e.g.:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080` and choose **Basic (WASM)**.
