# Joy Templates for VS Code

Syntax highlighting for [joy](https://www.npmjs.com/package/joytpl) templates (`.joy` files),
see https://github.com/homobel/joy for details.

Joy constructs are highlighted on top of the built-in HTML highlighting:

- variables `@var`, `@!var`, `@(var)`, function calls `@fn(...)`, `@import`, `@* comments *@` and `@@` escapes;
- `@if` / `else if` / `else`, `@each` and `@fn() {…}` blocks, in html content, between tag attributes
  (`<input @if a {disabled}>`) and inside attribute values (`class="tab @if a {current}"`);
- inline constructs inside `<script>`, `<style>`, `style="…"`, `on*="…"` attributes and html comments.

## Known limitations

- `else` is recognized right after `}` or at the start of a line, followed by `{` or `if` on the same line.
- Inside `<script>` and `<style>`, `@if` / `@each` are highlighted as keywords, but their `{ }` blocks keep
  the js/css highlighting.
- Joy tokens inside attribute values keep the string scope, color themes usually still show them
  distinctly (`variable`, `punctuation.definition.variable`).

## Installation

Install the `.vsix` package via Extensions → `…` → Install from VSIX, or copy this folder to
`~/.vscode/extensions/homobel.joy-<version>`.

To use emmet in joy files, add to settings:

```json
"emmet.includeLanguages": { "joy": "html" }
```

## Tests

`npm install && npm test` runs the assertions in `test/*.joy` against the grammar, using the html,
css and js grammars of the installed VS Code (set `VSCODE_APP` if it's not found automatically).
