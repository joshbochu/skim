#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FUNCTION_WORDS = new Set([
	"a", "an", "the", "is", "are", "was", "were", "be", "been",
	"being", "am", "has", "have", "had", "do", "does", "did", "will",
	"would", "should", "could", "may", "might", "that", "which", "who",
	"i", "we", "you", "it",
]);

const POLISHED_OPENERS = [
	/^sure[!,.:\s]/i,
	/^certainly[!,.:\s]/i,
	/^of course[!,.:\s]/i,
	/^i(?:'d| would) be happy/i,
	/^here (?:is|are)(?: a| an| the| your)?\b/i,
	/^i(?:'ve| have)\b/i,
];

function stripProtected(text) {
	return text
		.replace(/`[^`]*`/g, "")
		.replace(/https?:\/\/\S+/g, "")
		.replace(/["“][^"”]*["”]/g, "");
}

function wordCount(text) {
	return stripProtected(text).match(/[\p{L}\p{N}_-]+/gu)?.length ?? 0;
}

function extractTextBlock(output) {
	const match = /```text[ \t]*\r?\n([\s\S]*?)\r?\n```/m.exec(output);
	if (!match) return null;
	return {
		body: match[1],
		headline: output.slice(0, match.index).trim(),
		trailing: output.slice(match.index + match[0].length).trim(),
	};
}

export function lintOutput(output, options = {}) {
	const expectedShape = options.expectedShape ?? "auto";
	const maxBodyLines = options.maxBodyLines ?? 18;
	const errors = [];
	const warnings = [];
	const block = extractTextBlock(output);

	if (expectedShape === "block" && !block) {
		errors.push("missing fenced text body");
	}
	if (expectedShape === "plain" && block) {
		errors.push("unexpected fenced text body");
	}

	const headline = block ? block.headline : output.trim();
	const headlineLines = headline.split(/\r?\n/).filter((line) => line.trim());
	const headlineLimit = 1;
	if (headlineLines.length > headlineLimit) {
		errors.push(`headline lines ${headlineLines.length} > ${headlineLimit}`);
	}
	if (POLISHED_OPENERS.some((pattern) => pattern.test(headline))) {
		errors.push("polished introduction detected");
	}

	if (block?.trailing) {
		const closeLines = block.trailing.split(/\r?\n/).filter((line) => line.trim());
		if (closeLines.length > 1) errors.push("close exceeds 1 line");
	}

	let anchors = 0;
	let bodyLines = 0;
	let maxDepth = 0;
	let fullSentenceLines = 0;
	const siblingCounts = new Map();
	const stack = [];

	if (block) {
		for (const [index, rawLine] of block.body.split(/\r?\n/).entries()) {
			if (!rawLine.trim()) continue;
			bodyLines += 1;
			if (rawLine.includes("\t")) {
				errors.push(`line ${index + 1}: tab indentation`);
			}
			const spaces = rawLine.match(/^ */)?.[0].length ?? 0;
			if (spaces % 2 !== 0) {
				errors.push(`line ${index + 1}: indentation not multiple of 2`);
			}
			const depth = Math.floor(spaces / 2);
			maxDepth = Math.max(maxDepth, depth);
			if (depth > 3) errors.push(`line ${index + 1}: depth ${depth} > 3`);
			if (depth === 0) anchors += 1;

			const parent = depth === 0 ? "root" : stack[depth - 1] ?? "orphan";
			const count = (siblingCounts.get(parent) ?? 0) + 1;
			siblingCounts.set(parent, count);
			if (count > 5) {
				errors.push(`line ${index + 1}: parent has >5 children`);
			}
			stack[depth] = `${index}:${rawLine.trim()}`;
			stack.length = depth + 1;

			if (rawLine.length > 72 && !/https?:\/\//.test(rawLine)) {
				warnings.push(`line ${index + 1}: ${rawLine.length} chars > 72`);
			}
			if (/[.!]$/.test(rawLine.trim())) fullSentenceLines += 1;
		}
	}

	if (anchors > 5) errors.push(`top-level anchors ${anchors} > 5`);
	if (bodyLines > maxBodyLines) {
		errors.push(`body fact lines ${bodyLines} > ${maxBodyLines}`);
	}
	if (block && anchors === 0) errors.push("body has no top-level anchor");

	const analyzedText = `${headline}\n${block?.body ?? ""}`;
	const words = stripProtected(analyzedText).toLowerCase().match(/[\p{L}]+/gu) ?? [];
	const functionWords = words.filter((word) => FUNCTION_WORDS.has(word)).length;
	const functionWordRate = words.length === 0 ? 0 : (functionWords / words.length) * 100;
	const sentenceRate = bodyLines === 0 ? 0 : (fullSentenceLines / bodyLines) * 100;

	if (functionWordRate > 8) {
		warnings.push(`function-word rate ${functionWordRate.toFixed(1)}% > 8%`);
	}
	if (sentenceRate > 15) {
		warnings.push(`body sentence rate ${sentenceRate.toFixed(1)}% > 15%`);
	}

	for (const term of options.requiredTerms ?? []) {
		if (!output.toLocaleLowerCase().includes(term.toLocaleLowerCase())) {
			errors.push(`missing required term: ${term}`);
		}
	}

	return {
		pass: errors.length === 0,
		errors,
		warnings,
		metrics: {
			anchors,
			bodyLines,
			maxDepth,
			headlineLines: headlineLines.length,
			functionWordRate: Number(functionWordRate.toFixed(1)),
			bodySentenceRate: Number(sentenceRate.toFixed(1)),
			words: wordCount(analyzedText),
		},
	};
}

async function loadCases() {
	const here = fileURLToPath(new URL(".", import.meta.url));
	return JSON.parse(await readFile(resolve(here, "cases.json"), "utf8"));
}

async function main() {
	const args = process.argv.slice(2);
	const json = args.includes("--json");
	const strict = args.includes("--strict");
	let paths = args.filter((arg) => !arg.startsWith("--"));
	if (args.includes("--gold")) {
		const here = fileURLToPath(new URL(".", import.meta.url));
		const goldDir = resolve(here, "gold");
		paths = (await readdir(goldDir))
			.filter((name) => name.endsWith(".txt"))
			.sort()
			.map((name) => resolve(goldDir, name));
	}
	if (paths.length === 0) {
		console.error("Usage: node evals/lint.mjs [--gold] [--strict] [--json] <output...>");
		process.exitCode = 2;
		return;
	}

	const cases = await loadCases();
	const reports = [];
	for (const path of paths) {
		const id = basename(path).replace(/\.txt$/, "");
		const testCase = cases.find((item) => item.id === id) ?? {};
		const output = await readFile(path, "utf8");
		const report = lintOutput(output, testCase);
		reports.push({ path, id, ...report });
	}

	if (json) {
		console.log(JSON.stringify(reports, null, 2));
	} else {
		for (const report of reports) {
			const failed = !report.pass || (strict && report.warnings.length > 0);
			console.log(`${failed ? "FAIL" : "PASS"} ${report.path}`);
			for (const error of report.errors) console.log(`  error: ${error}`);
			for (const warning of report.warnings) console.log(`  warn: ${warning}`);
			console.log(`  metrics: ${JSON.stringify(report.metrics)}`);
		}
	}

	if (reports.some((report) => !report.pass || (strict && report.warnings.length))) {
		process.exitCode = 1;
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await main();
}
