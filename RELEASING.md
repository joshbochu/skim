# Releasing Skim from npm

Pi installs Skim from `@joshbochu/skim`. The npm package is the canonical
distribution for the extension, stable rules, and `skim-v2` rules.

## Automatic merge release

`.github/workflows/publish.yml` runs after a publishable change reaches
`main`. `npm publish` automatically runs `prepublishOnly`, which requires:

- all Node tests
- gold-output lint
- stable dry-run evaluation planning
- skim-v2 dry-run evaluation planning

The workflow then publishes the exact version declared in `package.json`.
Every publishable pull request must increase that version; npm rejects attempts
to overwrite an existing version. If that version is already on the registry
(for example after a re-run or a docs-only path trigger), the workflow skips
publish and exits successfully.

## One-time npm trusted publisher setup

Configure the existing `@joshbochu/skim` package on npmjs.com:

- provider: GitHub Actions
- organization or user: `joshbochu`
- repository: `skim`
- workflow filename: `publish.yml`
- environment: leave blank
- allowed action: `npm publish`

The workflow grants `id-token: write` and uses Node 24 on a GitHub-hosted
runner, so npm authenticates it with short-lived OIDC credentials. No
`NPM_TOKEN` repository secret is needed.

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
