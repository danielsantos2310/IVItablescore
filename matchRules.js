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
    getCourtWithLibero
  };
})(typeof window !== "undefined" ? window : globalThis);
