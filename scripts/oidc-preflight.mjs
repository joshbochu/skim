#!/usr/bin/env node

/**
 * Fail fast with a clear message when npm trusted-publisher OIDC is not ready.
 * Prints the registry exchange error and GitHub OIDC claims for matching.
 */

import { spawnSync } from "node:child_process";

const packageName = "@joshbochu/skim";
const registry = "https://registry.npmjs.org";
const audience = `npm:${new URL(registry).hostname}`;

function fail(message) {
	console.error(`::error::${message}`);
	process.exit(1);
}

function decodeJwtPayload(token) {
	const [, payload] = token.split(".");
	if (!payload) return null;
	const json = Buffer.from(payload, "base64url").toString("utf8");
	return JSON.parse(json);
}

if (!process.env.GITHUB_ACTIONS) {
	console.log("Not running in GitHub Actions; skipping OIDC preflight.");
	process.exit(0);
}

if (
	!process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
	!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
) {
	fail(
		"GitHub OIDC is unavailable. Ensure the publish job has permissions.id-token: write.",
	);
}

const requestUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
requestUrl.searchParams.set("audience", audience);

const idTokenResponse = await fetch(requestUrl, {
	headers: {
		Accept: "application/json",
		Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
	},
});
const idTokenBody = await idTokenResponse.json().catch(() => ({}));
if (!idTokenResponse.ok || !idTokenBody.value) {
	fail(
		`Failed to mint GitHub OIDC token for audience ${audience}: HTTP ${idTokenResponse.status}`,
	);
}

const claims = decodeJwtPayload(idTokenBody.value) ?? {};
const claimSummary = {
	aud: claims.aud,
	sub: claims.sub,
	repository: claims.repository,
	repository_owner: claims.repository_owner,
	workflow: claims.workflow,
	workflow_ref: claims.workflow_ref,
	ref: claims.ref,
	environment: claims.environment ?? "(none)",
	job_workflow_ref: claims.job_workflow_ref,
};
console.log("GitHub OIDC claims presented to npm:");
console.log(JSON.stringify(claimSummary, null, 2));

const escapedName = packageName.replace("/", "%2f");
const exchangeUrl = `${registry}/-/npm/v1/oidc/token/exchange/package/${escapedName}`;
const exchangeResponse = await fetch(exchangeUrl, {
	method: "POST",
	headers: {
		Accept: "application/json",
		Authorization: `Bearer ${idTokenBody.value}`,
		"Content-Type": "application/json",
	},
});
const exchangeText = await exchangeResponse.text();
let exchangeBody = {};
try {
	exchangeBody = JSON.parse(exchangeText);
} catch {
	exchangeBody = { raw: exchangeText.slice(0, 500) };
}

if (!exchangeResponse.ok || !exchangeBody.token) {
	const detail =
		exchangeBody.message ||
		exchangeBody.error ||
		exchangeBody.raw ||
		exchangeText.slice(0, 500) ||
		"(no body)";
	const workflowFile =
		String(claims.workflow_ref || claims.job_workflow_ref || "")
			.split("/")
			.pop()
			?.split("@")[0] || "publish.yml";
	fail(
		[
			`npm refused the GitHub Actions OIDC token exchange for ${packageName} (HTTP ${exchangeResponse.status}).`,
			`Detail: ${detail}`,
			"",
			"This is NOT the same as linking your npm account login to GitHub.",
			"Configure Trusted Publisher on the package page:",
			"https://www.npmjs.com/package/@joshbochu/skim/access",
			"",
			"Exact values that must match this run:",
			`  repository: ${claims.repository || "joshbochu/skim"}`,
			`  workflow filename: ${workflowFile}   (filename only, not a path)`,
			"  environment: (leave blank)",
			"  allowed action: npm publish",
			"",
			"Or set repository secret NPM_TOKEN to a granular automation token with publish permission.",
		].join("\n"),
	);
}

console.log("npm trusted-publisher OIDC exchange succeeded.");

const version = spawnSync("npm", ["--version"], { encoding: "utf8" });
console.log(`npm ${version.stdout.trim()}`);
