const TEXT_FENCE = /(^|\n)([ \t]{0,3})(`{3,})text[ \t]*\r?\n([\s\S]*?)\r?\n\2\3[ \t]*(?=\r?\n|$)/g;

/**
 * Remove fenced `text` containers while preserving their contents.
 *
 * Stable Skim uses native Markdown, so `text` fences are presentation
 * wrappers rather than code fences. Other fence languages remain unchanged.
 */
export function unwrapTextFences(text) {
	return text.replace(TEXT_FENCE, (_match, leadingNewline, _indent, _fence, body) => {
		return `${leadingNewline}${body}`;
	});
}
