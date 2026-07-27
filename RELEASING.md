# Releasing Skim from npm

Pi installs Skim from `@joshbochu/skim`. The npm package is the canonical
distribution for the extension, stable rules, and candidate `skim-v2` rules.

## Automatic merge release

`.github/workflows/publish.yml` runs after a publishable change reaches
`main`. Every successful run publishes a **new** version:

1. Choose a free version with `scripts/release-version.mjs`
   (higher of `package.json` and npm latest; bump patch if that version
   already exists).
2. Run `prepublishOnly` gates via `npm publish`
   (tests, gold lint, dry-run eval plans).
3. Publish with npm trusted-publisher OIDC (`--provenance`).
4. Commit the chosen version back to `main` as
   `chore: release vX.Y.Z [skip ci]` so the repo tracks what shipped.

You do **not** need to bump `package.json` in feature PRs. The publish
workflow owns release versions. Manual bumps are still honored when they are
ahead of the registry.

## One-time npm trusted publisher setup

Configure the existing `@joshbochu/skim` package on npmjs.com:

- provider: GitHub Actions
- organization or user: `joshbochu`
- repository: `skim`
- workflow filename: `publish.yml`
- environment: leave blank
- allowed action: `npm publish`

The workflow grants `id-token: write` and uses Node 24 on a GitHub-hosted
runner, so npm authenticates with short-lived OIDC credentials.

Important: the workflow must **not** use `actions/setup-node`'s
`registry-url` input. That input injects a placeholder `NODE_AUTH_TOKEN`
which forces classic token auth and makes trusted publishing fail with
`E404`.

Optional fallback: set a repository secret `NPM_TOKEN` (granular npm
automation token with publish permission). When present, the workflow uses
it instead of OIDC.

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
