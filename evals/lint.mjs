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

const BANNED_ABBREVIATIONS = ["cfg", "req", "fn", "impl"];
const SOFT_LINE_LENGTH = 72;
const HARD_PROSE_LINE_LENGTH = 100;
const DEFAULT_MAX_LONG_PROSE_LINES = 2;

function normalizeOutput(text) {
	return text
		.split(/\r?\n/)
		.map((line) => line.replace(/[ \t]+$/, ""))
		.join("\n")
		.replace(/^\n+|\n+$/g, "");
}

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
	const match = /^[ \t]{0,3}```text[ \t]*\n([\s\S]*?)\n[ \t]{0,3}```[ \t]*$/m.exec(output);
	if (!match) return null;
	return {
		body: match[1],
		headline: output.slice(0, match.index).trim(),
		trailing: output.slice(match.index + match[0].length).trim(),
	};
}

function extractMarkdownBody(output) {
	const lines = output.split("\n");
	const start = lines.findIndex((line) => /^-\s+\S/.test(line));
	if (start === -1) return null;

	let end = start;
	for (; end < lines.length; end += 1) {
		const line = lines[end];
		if (!line.trim() || /^ *(?:-\s+|\d+[.)]\s+)\S/.test(line)) continue;
		break;
	}

	return {
		body: lines.slice(start, end).join("\n").trimEnd(),
		headline: lines.slice(0, start).join("\n").trim(),
		trailing: lines.slice(end).join("\n").trim(),
	};
}

export function lintOutput(output, options = {}) {
	output = normalizeOutput(output);
	const expectedShape = options.expectedShape ?? "auto";
	const maxBodyLines = options.maxBodyLines ?? 18;
	const errors = [];
	const warnings = [];
	const block = extractTextBlock(output);
	const markdown = block ? null : extractMarkdownBody(output);
	const structured = block ?? markdown;
	const bodyKind = block ? "block" : markdown ? "markdown" : "plain";

	if (expectedShape === "plain" && block) {
		errors.push("unexpected fenced text body");
	}
	if (expectedShape === "markdown" && block) {
		errors.push("unexpected fenced text body; markdown container required");
	}
	if (expectedShape === "markdown" && !markdown) {
		errors.push("missing markdown bullet body");
	}
	if (expectedShape === "plain" && markdown) {
		errors.push("unexpected markdown bullet body");
	}

	const headline = structured ? structured.headline : output.trim();
	const headlineLines = headline.split(/\r?\n/).filter((line) => line.trim());
	const headlineLimit = structured ? 1 : 2;
	if (headlineLines.length > headlineLimit) {
		errors.push(`headline lines ${headlineLines.length} > ${headlineLimit}`);
	}
	if (POLISHED_OPENERS.some((pattern) => pattern.test(headline))) {
		errors.push("polished introduction detected");
	}

	if (structured?.trailing) {
		const closeLines = structured.trailing.split(/\r?\n/).filter((line) => line.trim());
		if (closeLines.length > 1) errors.push("close exceeds 1 line");
		if (wordCount(structured.trailing) > 12) errors.push("close not terse");
	}

	let anchors = 0;
	let bodyLines = 0;
	let maxDepth = 0;
	let fullSentenceLines = 0;
	let longProseLines = 0;
	let orderedItems = 0;
	const siblingCounts = new Map();
	const stack = [];

	if (structured) {
		for (const [index, sourceLine] of structured.body.split(/\r?\n/).entries()) {
			const rawLine = bodyKind === "markdown"
				? sourceLine.replace(/^( *)(?:-\s+|\d+[.)]\s+)/, "$1")
				: sourceLine;
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
			if (/^ *\d+[.)]\s+\S/.test(sourceLine)) orderedItems += 1;
			maxDepth = Math.max(maxDepth, depth);
			if (depth > 3) errors.push(`line ${index + 1}: depth ${depth} > 3`);
			if (depth === 0) anchors += 1;
			if (bodyKind === "markdown" && depth === 0 && !/\*\*[^*]+\*\*/.test(rawLine)) {
				errors.push(`line ${index + 1}: markdown anchor missing bold label`);
			}

			const parent = depth === 0 ? "root" : stack[depth - 1] ?? "orphan";
			const count = (siblingCounts.get(parent) ?? 0) + 1;
			siblingCounts.set(parent, count);
			if (count > 5) {
				errors.push(`line ${index + 1}: parent has >5 children`);
			}
			stack[depth] = `${index}:${rawLine.trim()}`;
			stack.length = depth + 1;

			if (rawLine.length > SOFT_LINE_LENGTH && !/https?:\/\//.test(rawLine)) {
				warnings.push(
					`line ${index + 1}: ${rawLine.length} chars > ${SOFT_LINE_LENGTH}`,
				);
			}

			const proseLine = stripProtected(rawLine).trimEnd();
			if (proseLine.trim().length > 0 && proseLine.length > SOFT_LINE_LENGTH) {
				longProseLines += 1;
			}
			const hardProseLineLength =
				options.hardProseLineLength ?? HARD_PROSE_LINE_LENGTH;
			if (proseLine.length > hardProseLineLength) {
				errors.push(
					`line ${index + 1}: prose length ${proseLine.length} > ${hardProseLineLength}`,
				);
			}
			if (/[.!]$/.test(rawLine.trim())) fullSentenceLines += 1;
		}
	}

	const maxLongProseLines =
		options.maxLongProseLines ?? DEFAULT_MAX_LONG_PROSE_LINES;
	if (longProseLines > maxLongProseLines) {
		errors.push(
			`overlong prose lines ${longProseLines} > ${maxLongProseLines}`,
		);
	}

	if (anchors > 5) errors.push(`top-level anchors ${anchors} > 5`);
	if (bodyLines > maxBodyLines) {
		errors.push(`body fact lines ${bodyLines} > ${maxBodyLines}`);
	}
	if (structured && anchors === 0) errors.push("body has no top-level anchor");
	const minOrderedItems = options.minOrderedItems ?? 0;
	if (orderedItems < minOrderedItems) {
		errors.push(`ordered items ${orderedItems} < ${minOrderedItems}`);
	}

	const analyzedText = `${headline}\n${structured?.body ?? ""}\n${structured?.trailing ?? ""}`;
	const abbreviationText = stripProtected(analyzedText).toLocaleLowerCase();
	for (const abbreviation of BANNED_ABBREVIATIONS) {
		if (new RegExp(`\\b${abbreviation}\\b`, "u").test(abbreviationText)) {
			errors.push(`invented abbreviation: ${abbreviation}`);
		}
	}
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
			bodyKind,
			anchors,
			bodyLines,
			maxDepth,
			headlineLines: headlineLines.length,
			functionWordRate: Number(functionWordRate.toFixed(1)),
			bodySentenceRate: Number(sentenceRate.toFixed(1)),
			longProseLines,
			orderedItems,
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
