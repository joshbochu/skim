import assert from "node:assert/strict";
import test from "node:test";
import { buildPrCommand } from "../extensions/skim-pr-command.mjs";

test("empty target resolves the current branch PR", () => {
	assert.deepEqual(buildPrCommand(""), {
		ok: true,
		prompt:
			"Find the GitHub pull request for the current branch, apply skim to its description, and update the description in place.",
	});
});

test("GitHub PR URL targets that PR", () => {
	const url = "https://github.com/joshbochu/skim/pull/2";
	assert.deepEqual(buildPrCommand(`  ${url}  `), {
		ok: true,
		prompt: `Apply skim to this GitHub pull request description and update it in place: ${url}`,
	});
});

test("GitHub PR URL is normalized", () => {
	assert.deepEqual(
		buildPrCommand(
			"https://github.com/joshbochu/skim/pull/2/?notification_referrer_id=1#discussion",
		),
		{
			ok: true,
			prompt:
				"Apply skim to this GitHub pull request description and update it in place: https://github.com/joshbochu/skim/pull/2",
		},
	);
});

test("non-PR input is rejected", () => {
	for (const target of [
		"#2",
		"joshbochu/skim#2",
		"https://github.com/joshbochu/skim/issues/2",
		"please rewrite this body",
	]) {
		assert.deepEqual(buildPrCommand(target), {
			ok: false,
			error:
				"Expected a GitHub pull request URL: https://github.com/owner/repo/pull/123",
		});
	}
});
