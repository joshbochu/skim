# Releasing Skim from npm

Pi installs Skim from `@joshbochu/skim`. The npm package is the canonical
distribution for the extension, stable rules, and candidate `skim-v2` rules.

## Automatic merge release

`.github/workflows/publish.yml` runs after a publishable change reaches
`main`. Every successful run publishes a **new** version:

1. Choose a free version with `scripts/release-version.mjs`
   (higher of `package.json` and npm latest; bump patch if that version
   already exists).
2. Verify GitHub Actions → npm OIDC with `scripts/oidc-preflight.mjs`
   (skipped when `NPM_TOKEN` is set).
3. Run `prepublishOnly` gates via `npm publish`
   (tests, gold lint, dry-run eval plans).
4. Publish through npm trusted-publisher OIDC (provenance is automatic).
5. Commit the chosen version back to `main` as
   `chore: release vX.Y.Z [skip ci]` so the repo tracks what shipped.

You do **not** need to bump `package.json` in feature PRs. The publish
workflow owns release versions. Manual bumps are still honored when they are
ahead of the registry.

## Required one-time npm setup

Publishing cannot succeed until **one** of these is configured:

### Option A — Trusted Publisher (preferred)

On https://www.npmjs.com/package/@joshbochu/skim/access :

1. Open **Trusted Publisher**
2. Choose **GitHub Actions**
3. Set:
   - organization or user: `joshbochu`
   - repository: `skim`
   - workflow filename: `publish.yml` (filename only, including `.yml`)
   - environment: leave blank
   - allowed action: **npm publish** (required for configs created after
     2026-05-20)
4. Save

The workflow grants `id-token: write` on the publish job and uses Node 24 /
npm 11.5+, so npm authenticates with short-lived OIDC credentials.

Do **not** use `actions/setup-node`'s `registry-url` input in this workflow.
That input injects a placeholder `NODE_AUTH_TOKEN` which forces classic token
auth and makes trusted publishing fail with `E404` / `ENEEDAUTH`.

### Option B — Automation token fallback

Create a granular npm automation token with publish permission for
`@joshbochu/skim`, then add it as the repository secret `NPM_TOKEN`.
When that secret is present, the workflow publishes with the token instead of
OIDC.

## Verify a release

After the merge workflow succeeds:

```bash
npm view @joshbochu/skim version
npm view @joshbochu/skim dist-tags --json
```

Pi users install or refresh the npm package with:

```bash
pi install npm:@joshbochu/skim
```

