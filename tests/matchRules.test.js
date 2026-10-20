const assert = require("node:assert/strict");
const test = require("node:test");

require("../matchRules.js");

const {
  getSetCompletion,
  getMatchScoreAfterSet,
  getServeOrder,
  evaluateOverlapPositions,
  getCourtWithLibero
} = globalThis.matchRules;

test("regular sets finish at 25 with a two-point lead", () => {
  assert.deepEqual(getSetCompletion({ setNumber: 1, homePoints: 25, awayPoints: 23 }), {
    valid: true,
    target: 25,
    winner: "home"
  });
  assert.equal(getSetCompletion({ setNumber: 1, homePoints: 25, awayPoints: 24 }).valid, false);
  assert.equal(getSetCompletion({ setNumber: 1, homePoints: 24, awayPoints: 22 }).valid, false);
});

test("the fifth-set tiebreak finishes at 15 with a two-point lead", () => {
  assert.deepEqual(getSetCompletion({ setNumber: 5, homePoints: 13, awayPoints: 15 }), {
    valid: true,
    target: 15,
    winner: "away"
  });
  assert.equal(getSetCompletion({ setNumber: 5, homePoints: 15, awayPoints: 14 }).valid, false);
  assert.deepEqual(getSetCompletion({ setNumber: 5, homePoints: 17, awayPoints: 15 }), {
    valid: true,
    target: 15,
    winner: "home"
  });
});

test("a set cannot finish tied", () => {
  assert.equal(getSetCompletion({ setNumber: 5, homePoints: 15, awayPoints: 15 }).valid, false);
});

test("the final completed set is included in best-of-five match results", () => {
  assert.deepEqual(getMatchScoreAfterSet(2, 0, "home"), { homeSetsWon: 3, awaySetsWon: 0 });
  assert.deepEqual(getMatchScoreAfterSet(2, 1, "home"), { homeSetsWon: 3, awaySetsWon: 1 });
  assert.deepEqual(getMatchScoreAfterSet(2, 2, "away"), { homeSetsWon: 2, awaySetsWon: 3 });
  assert.deepEqual(getMatchScoreAfterSet(3, 1, "home", true), { homeSetsWon: 3, awaySetsWon: 1 });
});

test("serve order starts with position one and follows the rotation", () => {
  assert.deepEqual(getServeOrder(["12", "7", "4", "9", "2", "6"]), ["12", "7", "4", "9", "2", "6"]);
  assert.deepEqual(getServeOrder(["1", "2"]), []);
});

test("overlap checker validates front/back and lateral relationships", () => {
  const legal = {
    p4: { x: 20, y: 30 }, p3: { x: 50, y: 30 }, p2: { x: 80, y: 30 },
    p5: { x: 20, y: 70 }, p6: { x: 50, y: 70 }, p1: { x: 80, y: 70 }
  };
  assert.deepEqual(evaluateOverlapPositions(legal), { valid: true, issues: [] });

  const overlap = { ...legal, p1: { x: 45, y: 20 } };
  const result = evaluateOverlapPositions(overlap);
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("P1 must remain behind P2."));
  assert.ok(result.issues.includes("P6 must remain left of P1."));
});

test("libero waits through service, covers the back row, and leaves before the front row", () => {
  assert.deepEqual(getCourtWithLibero(["2", "3", "4", "5", "6", "1"], "13", ["2"], true), {
    court: ["2", "3", "4", "5", "6", "1"],
    liberoPos: null
  });
  assert.deepEqual(getCourtWithLibero(["2", "3", "4", "5", "6", "1"], "13", ["2"], false), {
    court: ["13", "3", "4", "5", "6", "1"],
    liberoPos: 0
  });
  assert.equal(getCourtWithLibero(["3", "4", "5", "6", "1", "2"], "13", ["2"], true).liberoPos, 5);
  assert.equal(getCourtWithLibero(["4", "5", "6", "1", "2", "3"], "13", ["2"], false).liberoPos, 4);
  assert.deepEqual(getCourtWithLibero(["5", "6", "1", "2", "3", "4"], "13", ["2"], false), {
    court: ["5", "6", "1", "2", "3", "4"],
    liberoPos: null
  });
});

