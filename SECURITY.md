# Security Policy

## Supported Versions

SELY MiniGame Hub is deployed continuously from the `main` branch — there is no version-pinned support window. Security fixes only target `main`; the archived `nodejs-legacy` branch is frozen for reference and does not receive fixes.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting instead:
1. Go to the [Security tab](https://github.com/dixtuel/sely-minigame-hub/security) of this repository.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected component (frontend, Rust backend, WASM game core), and steps to reproduce if possible.

If you can't use GitHub's reporting flow, you can reach the maintainer at `asrinklcc@sely.tr`.

You should expect an initial response within a few days. There is no bug bounty program — this is a small, independently maintained open-source project.

## Scope

This project has no user accounts, passwords, or stored personal data — most of what matters here is: score/leaderboard integrity, XSS/injection in server-rendered routes (OG images, share pages, SEO routes), and dependency vulnerabilities (tracked via Dependabot and CodeQL, which scan both the JavaScript/TypeScript frontend and the Rust backend/WASM crate).
