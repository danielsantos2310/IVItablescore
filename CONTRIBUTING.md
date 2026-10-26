# Contributing

## Working Agreement

- Keep changes scoped to the requested match workflow. Do not refactor unrelated behavior during a feature change.
- Preserve the existing static HTML/CSS/JavaScript approach unless a recorded decision changes it.
- Use ASCII unless an existing file requires another character set.
- Do not commit credentials, generated tokens, or personal match data.

## Workflow

1. Start from the local server and reproduce the current behavior.
2. Change the smallest relevant files.
3. Update documentation when behavior, data, deployment, or security changes.
4. Run syntax checks and the rule tests.
5. Manually test the affected dashboard flow at desktop and mobile widths.

## Branches and Commits

- Use short branches such as `feature/referee-share` or `fix/substitution-limit`.
- Use focused, imperative commits: `Add referee QR sharing` or `Fix visitor logo fallback`.
- Keep pull requests limited to one logical change and include test evidence and screenshots for visual changes.

## Formatting and Tests

- Follow local formatting: two-space indentation in JavaScript and readable CSS rules.
- Use `apply_patch` for manual edits in automation contexts.
- Run the commands in [TESTING.md](TESTING.md). Add or update `tests/matchRules.test.js` for any changed rule helper.
