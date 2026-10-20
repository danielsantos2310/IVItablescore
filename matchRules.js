(function exposeMatchRules(root) {
  function getSetCompletion(set) {
    const target = set.setNumber === 5 ? 15 : 25;
    const highScore = Math.max(set.homePoints, set.awayPoints);
    const difference = Math.abs(set.homePoints - set.awayPoints);

    if (set.homePoints === set.awayPoints) {
      return { valid: false, target, message: "Set cannot end tied." };
    }
    if (highScore < target || difference < 2) {
      return {
        valid: false,
        target,
        message: `Set cannot end yet. Need at least ${target} points and a 2-point lead.`
      };
    }
    return {
      valid: true,
      target,
      winner: set.homePoints > set.awayPoints ? "home" : "away"
    };
  }

  function getMatchScoreAfterSet(homeSetsWon, awaySetsWon, winner, alreadyFinalized = false) {
    return {
      homeSetsWon: homeSetsWon + (!alreadyFinalized && winner === "home" ? 1 : 0),
      awaySetsWon: awaySetsWon + (!alreadyFinalized && winner === "away" ? 1 : 0)
    };
  }

  function getServeOrder(rotation) {
    if (!Array.isArray(rotation) || rotation.length !== 6) return [];
    return [rotation[0], rotation[1], rotation[2], rotation[3], rotation[4], rotation[5]]
      .map(player => player == null ? "" : String(player).trim());
  }

  function evaluateOverlapPositions(positions) {
    const required = ["p1", "p2", "p3", "p4", "p5", "p6"];
    if (!positions || required.some(key => !positions[key])) {
      return { valid: false, issues: ["Position data is incomplete."] };
    }

    const issues = [];
    const behind = [
      ["p5", "p4", "P5 must remain behind P4."],
      ["p6", "p3", "P6 must remain behind P3."],
      ["p1", "p2", "P1 must remain behind P2."]
    ];
    behind.forEach(([back, front, message]) => {
      if (positions[back].y <= positions[front].y) issues.push(message);
    });

    const leftToRight = [
      ["p4", "p3", "P4 must remain left of P3."],
      ["p3", "p2", "P3 must remain left of P2."],
      ["p5", "p6", "P5 must remain left of P6."],
      ["p6", "p1", "P6 must remain left of P1."]
    ];
    leftToRight.forEach(([left, right, message]) => {
      if (positions[left].x >= positions[right].x) issues.push(message);
    });

    return { valid: issues.length === 0, issues };
  }

  function getCourtWithLibero(rotation, libero, replacementPlayers, isServing) {
    const base = Array.isArray(rotation) ? rotation.slice(0, 6) : [];
    while (base.length < 6) base.push(null);
    const court = base.slice();
    const partners = Array.isArray(replacementPlayers) ? replacementPlayers.filter(Boolean) : [];
    const backRow = [4, 5, 0];
    let liberoPos = null;

    if (libero && partners.length) {
      for (const partner of partners) {
        const partnerIndex = base.indexOf(partner);
        const canReplace = partnerIndex !== -1 &&
          backRow.includes(partnerIndex) &&
          !(partnerIndex === 0 && isServing);
        if (canReplace) {
          court[partnerIndex] = libero;
          liberoPos = partnerIndex;
          break;
        }
      }
    }

    return { court, liberoPos };
  }

  root.matchRules = {
    getSetCompletion,
    getMatchScoreAfterSet,
    getServeOrder,
    evaluateOverlapPositions,
    getCourtWithLibero
  };
})(typeof window !== "undefined" ? window : globalThis);

