const STORAGE_KEY = "ivi_current_match_v3";
const TEAM_LOGOS = {
  dinosaurs: "images/teams/DINOSAURS_transparent.png",
  dragons: "images/teams/DRAGONS_transparent.png",
  lynx: "images/teams/LYNX_transparent.png",
  phoenix: "images/teams/PHOENIX_transparent.png",
  ravens: "images/teams/RAVENS_transparent.png",
  vixen: "images/teams/VIXEN_transparent.png",
  visitors: "images/Visitor teams/Visitors.png"
};

function byId(id) { return document.getElementById(id); }

function getTeamLogo(name) {
  const key = String(name || "").trim().toLowerCase().replace(/^ivi\s+/, "");
  return TEAM_LOGOS[key] || "";
}

function setTeamLogo(id, teamName) {
  const logo = byId(id);
  const src = getTeamLogo(teamName);
  logo.classList.toggle("hidden", !src);
  if (src) {
    logo.src = src;
    logo.alt = `${teamName} logo`;
  } else {
    logo.removeAttribute("src");
    logo.alt = "";
  }
}

function loadMatch() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function renderEmpty() {
  byId("matchTitle").textContent = "Live score";
  byId("leftTeamName").textContent = "Team A";
  byId("rightTeamName").textContent = "Team B";
  byId("leftScore").textContent = "–";
  byId("rightScore").textContent = "–";
  byId("leftSets").textContent = "0";
  byId("rightSets").textContent = "0";
  byId("setNumber").textContent = "–";
  setTeamLogo("leftTeamLogo", "");
  setTeamLogo("rightTeamLogo", "");
  byId("leftServeIndicator").classList.add("hidden");
  byId("rightServeIndicator").classList.add("hidden");
  byId("connectionState").textContent = "Waiting";
  byId("connectionState").style.borderColor = "#8fa2c2";
  byId("connectionState").style.color = "#8fa2c2";
  byId("matchState").textContent = "Waiting for match";
}

function renderScore() {
  const match = loadMatch();
  if (!match?.sets?.length) {
    renderEmpty();
    return;
  }
  const set = match.sets[match.sets.length - 1];
  const homeOnLeft = match.homeOnLeft !== false;
  const left = homeOnLeft
    ? { name: match.homeTeam, score: set.homePoints, sets: match.homeSetsWon }
    : { name: match.awayTeam, score: set.awayPoints, sets: match.awaySetsWon };
  const right = homeOnLeft
    ? { name: match.awayTeam, score: set.awayPoints, sets: match.awaySetsWon }
    : { name: match.homeTeam, score: set.homePoints, sets: match.homeSetsWon };

  byId("matchTitle").textContent = match.id || "Live score";
  byId("leftTeamName").textContent = left.name || "Team A";
  byId("rightTeamName").textContent = right.name || "Team B";
  setTeamLogo("leftTeamLogo", left.name);
  setTeamLogo("rightTeamLogo", right.name);
  byId("leftScore").textContent = left.score ?? 0;
  byId("rightScore").textContent = right.score ?? 0;
  byId("leftSets").textContent = left.sets ?? 0;
  byId("rightSets").textContent = right.sets ?? 0;
  byId("setNumber").textContent = set.setNumber || match.currentSet || 1;
  const leftServing = match.serving === (homeOnLeft ? "home" : "away");
  const rightServing = match.serving === (homeOnLeft ? "away" : "home");
  byId("leftServeIndicator").classList.toggle("hidden", !leftServing);
  byId("rightServeIndicator").classList.toggle("hidden", !rightServing);
  const servingName = leftServing ? left.name : rightServing ? right.name : "";
  byId("matchState").textContent = match.status === "finished" ? "Match complete" : servingName ? `${servingName} serving` : "Live";
  byId("connectionState").textContent = match.status === "finished" ? "Final" : "Live";
  byId("connectionState").style.borderColor = match.status === "finished" ? "#8fa2c2" : "#00a651";
  byId("connectionState").style.color = match.status === "finished" ? "#e5f0ff" : "#82f2b7";
  document.title = `${left.name} ${left.score} – ${right.score} ${right.name} | IVI Live`;
}

window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY) renderScore();
});

renderScore();
window.setInterval(renderScore, 750);
