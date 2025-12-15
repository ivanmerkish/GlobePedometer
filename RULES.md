# Development Rules & Guidelines

## 1. Git Workflow
*   **Active Branch:** All development work must be done in the **`dev`** branch.
*   **Main Branch:** The `main` branch is for production deployment only.
*   **Merge Policy:** NEVER merge `dev` into `main` automatically. Wait for an explicit instruction from the user (e.g., "Merge to main", "Deploy").
*   **Commit Messages:** clear and descriptive messages explaining *what* changed and *why*.

## 2. Documentation Maintenance
*   **File:** `PROJECT_SPECS.md` is the source of truth for the project architecture.
*   **Structure Updates:** If a new file is created, renamed, or deleted, the **"Project Structure"** section in `PROJECT_SPECS.md` MUST be updated immediately in the same turn.
*   **TODO Tracking:** Mark completed items in the "Roadmap & TODO" section as `[x]`.

## 3. Architecture & Code Style
*   **Modularity:** Use ES6 Modules (`import`/`export`). Avoid monolithic files.
*   **Separation of Concerns:**
    *   `config.js`: Constants only.
    *   `dbapi.js`: Database/Auth interactions only.
    *   `globe.js`: Visualization logic only (no business logic).
    *   `main.js`: Controller (connecting UI, DB, and Globe).
    *   `utils.js`: Pure helper functions (math, formatting).
*   **Global Scope:** Minimize usage of `window`. Only attach functions to `window` if they are required for HTML event handlers (e.g., `onclick="saveData()"`).

## 4. User Experience (UX) Rules
*   **Login Flow:**
    *   **Pre-login:** Show only the empty globe (visuals only, no user data).
    *   **Post-login:** Fetch data, draw markers/paths, and center the camera on the user.
*   **Camera Control:**
    *   **No Auto-Rotation:** The globe should not rotate automatically after the initial load/login.
    *   **Centering:** The camera centers on the user *once* upon login. Subsequent updates should NOT hijack the camera unless the user clicks the "Recenter" (🎯) button.
*   **Visual Stability:**
    *   **Paths:** Ensure dotted lines do not flicker. Do not render paths with 0 length.
    *   **Updates:** Check for data changes before triggering a heavy 3D scene update.

## 5. Error Handling
*   **WebGL:** Always wrap 3D initialization in `try-catch` to handle driver crashes or unsupported devices gracefully (show a fallback UI message).
*   **Auth:** Handle redirect loops and session errors robustly using `onAuthStateChange`.

## 6. Secrets & Environment Variables
*   **Public:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are safe to expose in client-side code (`config.js`).
*   **Private:** ALL other keys (`TELEGRAM_BOT_TOKEN`, `SERVICE_ROLE_KEY`, `JWT_SECRET`) must be stored in **Supabase Secrets**.
*   **Edge Functions:**
    *   Use `Deno.env.get('MY_SECRET')` to access secrets.
    *   Do not rely on system prefixes like `SUPABASE_` if they are inconsistent; set explicit secrets (e.g., `JWT_SECRET`) via CLI.
    *   Always verify secrets presence at the start of the function execution.

## 7. Tool Usage (Agent Internal)
*   **Environment:** The development environment is **Windows**.
    *   Shell: `PowerShell` or `git bash` (via `run_shell_command`).
    *   Path separators: Be mindful of `\` vs `/`, though Node.js usually handles them.
*   **Shell Commands:** Do NOT chain commands using `&&`, `|`, or `;` in `run_shell_command`. The parser rejects them. Always execute commands in separate, sequential tool calls.
    *   *Bad:* `git add . && git commit -m "..."`
    *   *Good:* Call `run_shell_command("git add .")` -> Call `run_shell_command("git commit ...")`
