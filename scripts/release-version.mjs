#!/usr/bin/env node

/**
 * Choose the version to publish for a main-branch release.
 *
 * Rules:
 * 1. Start from the higher of package.json and the latest npm version.
 * 2. If that version is already on npm, bump the patch.
 * 3. Write the chosen version back to package.json when it differs.
 *
 * Prints GitHub Actions outputs:
 *   version=<semver>
 *   changed=true|false
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function parseSemver(value) {
	const match = String(value).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
	if (!match) throw new Error(`Invalid semver: ${value}`);
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a, b) {
	const left = parseSemver(a);
	const right = parseSemver(b);
	for (let i = 0; i < 3; i += 1) {
		if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
	}
	return 0;
}

function bumpPatch(version) {
	const [major, minor, patch] = parseSemver(version);
	return `${major}.${minor}.${patch + 1}`;
}

function npmViewVersion(name) {
	const result = spawnSync(
		"npm",
		["view", name, "version", "--silent"],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) return null;
	const version = result.stdout.trim();
	return version.length > 0 ? version : null;
}

function npmVersionExists(name, version) {
	const result = spawnSync(
		"npm",
		["view", `${name}@${version}`, "version", "--silent"],
		{ encoding: "utf8" },
	);
	return result.status === 0 && result.stdout.trim() === version;
}

const packagePath = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const localVersion = pkg.version;
const publishedVersion = npmViewVersion(pkg.name);

let nextVersion = localVersion;
if (publishedVersion && compareSemver(publishedVersion, nextVersion) > 0) {
	nextVersion = publishedVersion;
}
if (npmVersionExists(pkg.name, nextVersion)) {
	nextVersion = bumpPatch(nextVersion);
}

const changed = nextVersion !== localVersion;
if (changed) {
	pkg.version = nextVersion;
	writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

process.stdout.write(`version=${nextVersion}\n`);
process.stdout.write(`changed=${changed ? "true" : "false"}\n`);
process.stderr.write(
	[
		`local=${localVersion}`,
		`published=${publishedVersion ?? "(none)"}`,
		`release=${nextVersion}`,
		`package.json ${changed ? "updated" : "unchanged"}`,
	].join("\n") + "\n",
);
