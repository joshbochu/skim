# Caveman-full wording contract

Caveman governs wording. Skim governs layout.
Apply Caveman wording to headline, anchors, and facts.

## Default grammar

- Drop articles: a, an, the.
- Drop copulas and auxiliaries when meaning survives.
- Drop pronouns, filler, pleasantries, and hedging.
- Prefer fragments, short verbs, and concrete noun stacks.
- State each fact once.
- Use numerals, not number-words.
- Keep technical meaning complete.

Target:

```text
Pool reuses open DB connections.
No new connection per request.
Handshake cost gone.
```

Avoid:

```text
The pool is able to reuse open database connections, which means
that a new connection does not need to be created for each request.
```

## Never compress

- Code, commands, URLs, identifiers, and error strings.
- Technical terms whose shorter form changes meaning.
- Commit messages, PR text, documentation, or code comments.

No invented abbreviations: `cfg`, `req`, `fn`, `impl`.
Established acronyms remain valid: DB, API, HTTP.

Keep only grammar required to preserve exact factual meaning.
No prose escape mode.
