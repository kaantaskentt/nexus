# Contributing

Nexus is a safety-sensitive full-stack application. Keep changes focused, preserve the trust and disclosure boundaries, and include proof for behavior changes.

## Before opening a pull request

1. Read `docs/ARCHITECTURE.md`, `docs/EVALS.md`, and the relevant pipeline or prompt documentation.
2. Add or update regression tests for code changes.
3. Run the backend and frontend quality gates documented in the README.
4. Confirm no credentials, respondent material, or private tenant data are included.
5. Explain any migration, feature gate, provider, or safety-boundary impact in the pull request.

Use a feature branch and keep commits small enough to review. Product claims in documentation must match code and verified runtime behavior.
