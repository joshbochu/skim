/**
 * @typedef {{ ok: true, prompt: string } | { ok: false, error: string }} PrCommand
 */

/**
 * Build the one-shot agent request for `/skim pr [github_pr_url]`.
 *
 * @param {string} rawTarget
 * @returns {PrCommand}
 */
export function buildPrCommand(rawTarget) {
	const target = rawTarget.trim();
	if (!target) {
		return {
			ok: true,
			prompt:
				"Find the GitHub pull request for the current branch, apply skim to its description, and update the description in place.",
		};
	}

	let normalizedUrl;
	try {
		const url = new URL(target);
		const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
		if (url.protocol !== "https:" || url.hostname !== "github.com" || !match) {
			throw new Error("not a GitHub PR URL");
		}
		normalizedUrl = `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`;
	} catch {
		return {
			ok: false,
			error: "Expected a GitHub pull request URL: https://github.com/owner/repo/pull/123",
		};
	}

	return {
		ok: true,
		prompt: `Apply skim to this GitHub pull request description and update it in place: ${normalizedUrl}`,
	};
}
