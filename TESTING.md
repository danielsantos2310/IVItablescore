# Testing

## Automated Tests

The current automated suite is Node's built-in test runner in `tests/matchRules.test.js`.

```powershell
& 'C:\Users\ferreoda\Desktop\daniel-santos-portfolio-master\.tools\node-v22.23.3-win-x64\node.exe' tests\matchRules.test.js
```

It covers set completion, tiebreaks, final-set results, service order, overlap relationships, and libero court transitions.

## Syntax Checks

```powershell
& 'C:\Users\ferreoda\Desktop\daniel-santos-portfolio-master\.tools\node-v22.23.3-win-x64\node.exe' --check script.js
& 'C:\Users\ferreoda\Desktop\daniel-santos-portfolio-master\.tools\node-v22.23.3-win-x64\node.exe' --check referee.js
```

## Manual Regression Checklist

- Start a new match, assign teams, and confirm matching logos appear only for registered names.
- Score a side-out and confirm serve, rotation, libero, and 5-1/6-0 displays update correctly.
- Check two timeouts, timeout introduction/audio timing, cards, substitutes, paired-substitution lock, and set reset.
- Open the auxiliary scoreboard, resize it, and confirm large names, set counts, scores, and serving ball remain readable.
- Generate a referee QR session, open the link on another device, change the score, and confirm refresh within two seconds.
- Test narrow mobile layout: score controls must stay accessible and the timeline must not dominate the page.

## Expectations

Every rule change requires an automated test when it can be isolated in `matchRules.js`. UI-heavy changes require manual desktop and mobile verification until browser E2E tests are added.
