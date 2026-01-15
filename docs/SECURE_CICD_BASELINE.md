# Secure CI/CD Baseline (Agent 10)

This is the minimum recommended CI/CD hardening for “bank-grade” claims. Some items require GitHub org/repo settings (not enforceable via code alone).

## Branch protections (required)

For `main` (and any release branches):

- Require PRs (no direct pushes)
- Require status checks:
  - `wire2-ci` (frontend + backend fast + backend DB)
  - `security-gates` (dependency review/secret scanning/CodeQL/SBOM)
- Require code owner reviews for sensitive paths:
  - `wire2/backend/src/modules/security/**`
  - `wire2/backend/prisma/**`
  - `.github/workflows/**`
- Require signed commits (recommended) and linear history (optional)

## Artifact integrity (recommended)

### Signed images/artifacts

- Use Sigstore **cosign** to sign container images and/or release artifacts.
- Store public verification key (or use keyless signing) and require verification in deploy.

### Provenance (SLSA)

- Generate build provenance/attestations (SLSA level depends on deployment environment).
- Keep provenance with the artifact (registry attestations or release attachments).

## Dependency & secret hygiene (required)

- **Dependency Review** on PRs (blocks known-bad deps)
- **Secret scanning** on every PR + main branch (gitleaks)
- **SAST** (CodeQL) on main + scheduled weekly
- **SBOM** (CycloneDX) generated per build and stored as an artifact

## DAST & pen tests (required for production readiness)

- Run baseline DAST against staging (public surface) on a schedule and/or before prod deploy
- Run periodic external pen tests and track findings to closure

See also:
- `wire2/docs/VULNERABILITY_TRIAGE_SLAS.md`
- `wire2/docs/INCIDENT_RESPONSE.md`

