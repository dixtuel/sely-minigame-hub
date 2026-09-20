## What does this PR change?

<!-- Short description of the change and why. -->

## Type of change

- [ ] Bug fix
- [ ] New game / gameplay change
- [ ] Backend (Rust) change
- [ ] Frontend (React/TS) change
- [ ] CI/tooling/docs

## Checklist

- [ ] `pnpm check && pnpm test && pnpm run audit:public && pnpm build` pass locally
- [ ] `cargo check && cargo test` pass locally (if Rust code touched)
- [ ] If this changes a game's level generator or solver, both `src/games/` (backend/WASM) and `client/src/lib/levelGenerators/` (JS fallback) were updated together
- [ ] No real names, emails, or credentials added outside package manifests/LICENSE/README (see `scripts/audit-public-release.mjs`)

## Screenshots / recording (for gameplay or UI changes)

<!-- Optional but appreciated. -->
