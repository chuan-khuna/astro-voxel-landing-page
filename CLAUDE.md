# CLAUDE.md

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Tools

### Python

Use `uv` for everything Python: `uv run <script>`, `uv add <pkg>`, `uv sync`. Don't call `python`, `pip`, or `venv` directly.

### Node

Use `bun` as the package manager (`bun install`, `bun add`, `bun run`). `npm` is available but use it only when bun can't do the job.

Whenever you set up a Node project or add a package manager config, set a minimum release age of 7 days for both tools, so freshly published (possibly compromised) versions are never installed:

- `bunfig.toml`:
  ```toml
  [install]
  minimumReleaseAge = 604800 # 7 days, in seconds
  ```
- `.npmrc` (needs npm >= 11.10):
  ```ini
  min-release-age=7
  ```

## Code conventions

### Imports

In `site/`, import from another folder through the `@/` alias, which points at `site/src/` (e.g. `import { generateWorld } from '@/world'`), not a relative path climbing out of the current folder (`../../world`). A `./` import of a file in the same folder is fine. The alias is set in `site/tsconfig.json` (`paths`) and `site/vitest.config.ts` (`resolve.alias`); keep the two in step. Convert existing `../` imports when you touch a file; don't do sweeping import-only rewrites.

## Project docs

### Documents

Documents about this project, including how it is implemented, live in
`docs/documents/<slug>.md` (or `.html`). `docs/documents/INDEX.md` is the
entry point: it lists every document as one bullet, `- Title — one-line summary`.

- Read the index before working on an area, and open the documents
  relevant to it.
- When you add, rename or remove a document, update INDEX.md in the same
  change.
- Keep documents in step with the code they describe: if a change makes
  a document wrong, fix the document in the same change.

### HTML documents

When a document is generated as HTML:

- Theme: Rosé Pine Moon (dark) and Dawn (light) only, with an icon theme
  switcher: Auto (monitor), Moon (moon), Dawn (sun). Each name is the
  icon's tooltip and aria-label.
- Code blocks: highlight with Shiki; one code-theme icon button cycles
  Rosé Pine, Catppuccin and Everforest.
- Diagrams: write them in Mermaid and render with Pele (pele.run/api).
  Make them expandable and zoomable, with expand, close and zoom icon
  controls.
- Styling: small border radius (about 3–6px), and thin scrollbars styled
  to match the theme.
- Include a table of contents.
- Thai body text: use a looped Thai font (e.g. Noto Sans Thai Looped).

### Records

Discussion records live at `docs/records/yyyy-mm-dd-<slug>.md`, dated the
day the discussion took place. Each record captures one discussion: what
was discussed, what was decided, and any open questions.
