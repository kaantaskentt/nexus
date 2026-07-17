# Security policy

Security fixes are applied to the latest commit on `main`.

Report suspected vulnerabilities through GitHub's private vulnerability reporting flow. Do not open a public issue containing credentials, personal data, respondent material, or an unpatched exploit.

## High-sensitivity boundaries

Nexus handles company interviews, recordings, claim records, identity, and potentially sensitive disclosures. Production operators must review:

- Supabase authentication, service-role key custody, row-level security, and storage policy;
- respondent token lifetime, invite-link handling, and workspace authorization;
- the quarantine and sealed-flag paths for person-attributed sentiment and harm disclosures;
- VAPI, model-provider, email, transcript, and scraping-provider retention policies;
- audit logging, deletion behavior, backups, and incident response.

Do not use demo fixtures or local bypasses against a real tenant. Never place service-role, model-provider, VAPI, email, or database credentials in browser-visible environment variables.

## Automated checks

Pull requests run backend lint and tests against an isolated pgvector database, frontend lint/tests/build, npm audit, Python dependency audit, and CodeQL.
