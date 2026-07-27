#!/usr/bin/env node

/**
 * Fail fast with a clear message when npm trusted-publisher OIDC is not ready.
 * Prints the registry exchange error instead of a generic ENEEDAUTH.
 */

import { spawnSync } from "node:child_process";

const packageName = "@joshbochu/skim";
const registry = "https://registry.npmjs.org";
const audience = `npm:${new URL(registry).hostname}`;

function fail(message) {
	console.error(`::error::${message}`);
	process.exit(1);
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
	fail(
		[
			`npm refused the GitHub Actions OIDC token exchange for ${packageName} (HTTP ${exchangeResponse.status}).`,
			`Detail: ${detail}`,
			"Fix: on https://www.npmjs.com/package/@joshbochu/skim/access configure Trusted Publisher → GitHub Actions with:",
			"  repository: joshbochu/skim",
			"  workflow filename: publish.yml",
			"  environment: (blank)",
			"  allowed action: npm publish",
			"Or set repository secret NPM_TOKEN to a granular automation token with publish permission.",
		].join("\n"),
	);
}

console.log("npm trusted-publisher OIDC exchange succeeded.");

// Keep a cheap sanity check that npm CLI is new enough.
const version = spawnSync("npm", ["--version"], { encoding: "utf8" });
console.log(`npm ${version.stdout.trim()}`);
