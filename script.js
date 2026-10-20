try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }

function loadMatchFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading localStorage:", e);
    return null;
  }
}

function saveMatchToStorage() {
  if (!match) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
}

let match = null;
let matchTimerInterval = null;
let timeoutTimerInterval = null;
let scoreboardWindow = null;
let audioPanelWindow = null;
let pendingCardEntry = null;
const scoreboardInvert = true;
let activeSfxKey = null;

// Sync current score and sets to OBS
function syncScoreToOBS() {
  if (!match || !window.obsClient) return;
  const set = match.sets[match.sets.length - 1];
  const leftTeam = match.homeOnLeft ? 'home' : 'away';
  const rightTeam = match.homeOnLeft ? 'away' : 'home';
  const leftScore = leftTeam === 'home' ? set.homePoints : set.awayPoints;
  const rightScore = rightTeam === 'home' ? set.homePoints : set.awayPoints;
  const leftSets = leftTeam === 'home' ? match.homeSetsWon : match.awaySetsWon;
  const rightSets = rightTeam === 'home' ? match.homeSetsWon : match.awaySetsWon;
  window.obsClient.updateScore(leftScore, rightScore, leftSets, rightSets);
}

// Sync team names to OBS
function syncNamesToOBS() {
  if (!match || !window.obsClient) return;
  const leftTeam = match.homeOnLeft ? 'home' : 'away';
  const rightTeam = match.homeOnLeft ? 'away' : 'home';
  const leftName = leftTeam === 'home' ? match.homeTeam : match.awayTeam;
  const rightName = rightTeam === 'home' ? match.homeTeam : match.awayTeam;
  window.obsClient.updateTeams(leftName, rightName);
}

function getCardEmoji(color) {
  return color === "yellow" ? "🟨" : "🟥";
}

const SFX_TRACKS = {
  ace: "Ace Ace.mpeg",
  block: "Monster Block.mp3",
  boom: "Boom.mp3",
  brasilSil: "Vinheta Brasil Sil Sil - Globo (Anos 2000).mp3"
};
const SFX_LABELS = {
  ace: "Ace Ace 🎯🏐",
  block: "Monster Block 🧱🛑",
  boom: "Boom 🔊💥",
  brasilSil: "Brasil Vibe 🇧🇷"
};
const SFX_VISUALS = {
  ace: { image: "aceace.png", label: "ACE ACE" },
  block: { image: "monsterblock.png", label: "MONSTER BLOCK" },
  boom: { image: "boom.png", label: "BOOM" }
};
const sfxPlayers = Object.fromEntries(
  Object.entries(SFX_TRACKS).map(([key, src]) => [key, new Audio(src)])
);
Object.values(sfxPlayers).forEach(player => {
  player.preload = "auto";
});

function setSfxButtonState(activeKey) {
  activeSfxKey = activeKey || null;
  const map = {
    ace: document.getElementById("btnSfxAce"),
    block: document.getElementById("btnSfxBlock"),
    boom: document.getElementById("btnSfxBoom"),
    brasilSil: document.getElementById("btnSfxBrasil")
  };
  Object.entries(map).forEach(([key, btn]) => {
    if (!btn) return;
    btn.classList.toggle("sfx-active", key === activeKey);
  });
  updateAudioPanelWindow();
}

function showSfxOnScoreboard(key) {
  if (!match || !SFX_VISUALS[key]) return;
  match.sfxNotice = {
    key
  };
  const payload = getScoreboardPayload();
  if (payload) updateScoreboardWindow(payload);
}

function stopAllSfx() {
  Object.values(sfxPlayers).forEach(p => {
    if (!p.paused) {
      p.pause();
    }
    p.currentTime = 0;
  });
  if (match) {
    match.sfxNotice = null;
    const payload = getScoreboardPayload();
    if (payload) updateScoreboardWindow(payload);
  }
  setSfxButtonState(null);
}

function toggleSfx(key) {
  const player = sfxPlayers[key];
  if (!player) return;

  if (!player.paused && player.currentTime > 0) {
    stopAllSfx();
    return;
  }

  stopAllSfx();
  player.currentTime = 0;
  player.play().then(() => {
    showSfxOnScoreboard(key);
    setSfxButtonState(key);
    player.onended = () => {
      if (match) {
        match.sfxNotice = null;
        const payload = getScoreboardPayload();
        if (payload) updateScoreboardWindow(payload);
      }
      setSfxButtonState(null);
    };
  }).catch(() => { });
}

function getSfxPayload() {
  return {
    type: "audio-panel:update",
    activeKey: activeSfxKey,
    tracks: Object.entries(SFX_TRACKS).map(([key]) => ({ key, label: SFX_LABELS[key] || key }))
  };
}

function updateAudioPanelWindow() {
  if (!audioPanelWindow || audioPanelWindow.closed) return;
  audioPanelWindow.postMessage(getSfxPayload(), "*");
}

const TEAM_LOGOS = {
  "caramel dogs": "caramel-dogs.png",
  "rolling thunder": "Rolling-Thunders.jpg",
  "g/g": "gg.jpg",
  "msvc rats": "MSVC-Rats.png",
  "fireball": "fireball.jpeg",
  "nata": "nata.jpeg",
  "next level": "nextlevel.jpeg",
  "msvc beavers": "MSVC-Beavers.png",
  "ucd": "ucd.jpg",
  "ivi dinosaurs": "Brasão - PNG.png",
  "ivi vixen": "Brasão - PNG.png",
  "ivi dragons": "Brasão - PNG.png",
  "cork lions": "corklions.png"
};

const TEAM_LOGO_ALIASES = {
  "gg": "g/g",
  "g g": "g/g",
  "g-g": "g/g",
  "rolling thunders": "rolling thunder",
  "rolling-thunder": "rolling thunder",
  "nextlevel": "next level",
  "next-level": "next level",
  "msvc-rats": "msvc rats",
  "msvc beavers": "msvc beavers",
  "msvc-beavers": "msvc beavers",
  "ivi dino": "ivi dinosaurs",
  "ivi dinosaur": "ivi dinosaurs",
  "dinosaurs": "ivi dinosaurs",
  "vixen": "ivi vixen",
  "ivi vixens": "ivi vixen",
  "ivi dragons": "ivi dragons",
  "dragons": "ivi dragons",
  "cork lions": "cork lions"
};

function normalizeTeamName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getTeamLogo(name) {
  const key = normalizeTeamName(name);
  const aliasKey = TEAM_LOGO_ALIASES[key] || key;
  return TEAM_LOGOS[aliasKey] || "";
}

function applyLogo(imgEl, teamName) {
  if (!imgEl) return;
  const src = getTeamLogo(teamName);
  if (!src) {
    imgEl.classList.add("hidden");
    imgEl.removeAttribute("src");
    imgEl.alt = "";
    return;
  }
  imgEl.classList.remove("hidden");
  imgEl.src = src;
  imgEl.alt = `${teamName} logo`;
  imgEl.onerror = () => {
    imgEl.classList.add("hidden");
  };
}

function createNewMatch() {
  const homeName = document.getElementById("homeNameInput").value || "Team A";
  const awayName = document.getElementById("awayNameInput").value || "Team B";
  const matchId = document.getElementById("matchIdInput").value || ("IVI-" + Date.now());
  const serveChoice = document.querySelector('input[name="firstServe"]:checked')
    ? document.querySelector('input[name="firstServe"]:checked').value
    : "home";

  if (matchTimerInterval) clearInterval(matchTimerInterval);
  if (timeoutTimerInterval) clearInterval(timeoutTimerInterval);

  match = {
    id: matchId,
    homeTeam: homeName,
    awayTeam: awayName,
    bestOf: 5,
    status: "live", // "live" | "finished"
    firstServer: serveChoice,
    currentSet: 1,
    sets: [
      { setNumber: 1, homePoints: 0, awayPoints: 0, winner: null }
    ],
    homeSetsWon: 0,
    awaySetsWon: 0,
    homeTimeouts: 0,
    awayTimeouts: 0,
    serving: serveChoice || "home", // "home" | "away"
    homeOnLeft: true,
    events: [],

    // Lineups / rotation
    homeRoster: [],
    awayRoster: [],
    homeBaseRotation: [null, null, null, null, null, null],
    awayBaseRotation: [null, null, null, null, null, null],
    homeLibero: null,
    awayLibero: null,
    homeLiberoPartner: null,
    homeLiberoPartner2: null,
    awayLiberoPartner: null,
    awayLiberoPartner2: null,
    homeCourt: [null, null, null, null, null, null],
    awayCourt: [null, null, null, null, null, null],
    homeLiberoPos: null,
    awayLiberoPos: null,
    homeStartingSix: [null, null, null, null, null, null],
    awayStartingSix: [null, null, null, null, null, null],
    homeSubsUsed: 0,
    awaySubsUsed: 0,
    maxSubsPerSet: 6,
    homePlayerNames: {},
    awayPlayerNames: {},

    // Timers
    matchStartTime: null, // ISO string
    matchEndTime: null,
    timeoutTeam: null,  // "home" | "away" | null
    timeoutEnd: null,   // timestamp ms
    cardNotice: null,
    sfxNotice: null
  };

  match.matchStartTime = new Date().toISOString();
  saveMatchToStorage();
  renderAll();
  addEvent("SYSTEM", `New match started: ${homeName} vs ${awayName}`);
  updateTimers();
  syncNamesToOBS();
  syncScoreToOBS();
}

// ---- Lineups & Rotation ----
function syncPlayerNamesWithRoster(team) {
  if (!match) return;
  const rosterKey = team === "home" ? "homeRoster" : "awayRoster";
  const namesKey = team === "home" ? "homePlayerNames" : "awayPlayerNames";
  const roster = match[rosterKey] || [];
  const names = match[namesKey] || {};
  // Remove names for players no longer in roster
  Object.keys(names).forEach(k => {
    if (!roster.includes(k)) delete names[k];
  });
  match[namesKey] = names;
}

function promptPlayerName(team, num) {
  if (!match || !num) return;
  const namesKey = team === "home" ? "homePlayerNames" : "awayPlayerNames";
  const names = match[namesKey] || {};
  const existing = names[num] || "";
  const nm = prompt(`Enter name for #${num} (${team === "home" ? match.homeTeam : match.awayTeam}):`, existing);
  if (nm === null) return;
  const val = nm.trim();
  if (val) {
    names[num] = val;
  } else {
    delete names[num];
  }
  match[namesKey] = names;
  saveMatchToStorage();
  renderSquads();
}

function setLineups() {
  if (!match) {
    alert("Create or load a match first.");
    return;
  }

  const homeRosterStr = prompt(
    "Enter Team A players (jersey numbers, max 14, separated by commas):",
    match.homeRoster && match.homeRoster.length ? match.homeRoster.join(",") : ""
  );
  if (!homeRosterStr) return;
  const homeRoster = homeRosterStr.split(",").map(s => s.trim()).filter(s => s);
  if (homeRoster.length > 14) {
    alert("Maximum 14 players for Team A. Extra numbers will be ignored.");
  }
  match.homeRoster = homeRoster.slice(0, 14);

  const awayRosterStr = prompt(
    "Enter Team B players (jersey numbers, max 14, separated by commas):",
    match.awayRoster && match.awayRoster.length ? match.awayRoster.join(",") : ""
  );
  if (!awayRosterStr) return;
  const awayRoster = awayRosterStr.split(",").map(s => s.trim()).filter(s => s);
  if (awayRoster.length > 14) {
    alert("Maximum 14 players for Team B. Extra numbers will be ignored.");
  }
  match.awayRoster = awayRoster.slice(0, 14);

  const homeStartStr = prompt(
    "Enter Team A starting six (6 jersey numbers, separated by commas) in rotation order:",
    match.homeBaseRotation && match.homeBaseRotation.some(x => x)
      ? match.homeBaseRotation.join(",")
      : (homeRoster.slice(0, 6).join(","))
  );
  if (!homeStartStr) return;
  const homeStart = homeStartStr.split(",").map(s => s.trim()).filter(s => s);
  if (homeStart.length !== 6) {
    alert("You must enter exactly 6 numbers for Team A starting six.");
    return;
  }
  match.homeBaseRotation = homeStart;
  match.homeStartingSix = homeStart.slice();

  const awayStartStr = prompt(
    "Enter Team B starting six (6 jersey numbers, separated by commas) in rotation order:",
    match.awayBaseRotation && match.awayBaseRotation.some(x => x)
      ? match.awayBaseRotation.join(",")
      : (awayRoster.slice(0, 6).join(","))
  );
  if (!awayStartStr) return;
  const awayStart = awayStartStr.split(",").map(s => s.trim()).filter(s => s);
  if (awayStart.length !== 6) {
    alert("You must enter exactly 6 numbers for Team B starting six.");
    return;
  }
  match.awayBaseRotation = awayStart;
  match.awayStartingSix = awayStart.slice();

  const homeLibero = prompt(
    "Enter Team A libero jersey number (or leave blank if no libero):",
    match.homeLibero || ""
  );
  match.homeLibero = homeLibero && homeLibero.trim() ? homeLibero.trim() : null;

  const homePartner = prompt(
    "Enter jersey number that libero replaces in back row for Team A (usually a middle):",
    match.homeLiberoPartner || ""
  );
  match.homeLiberoPartner = homePartner && homePartner.trim() ? homePartner.trim() : null;

  const homePartner2 = prompt(
    "Enter SECOND jersey number libero can replace in back row for Team A (optional):",
    match.homeLiberoPartner2 || ""
  );
  match.homeLiberoPartner2 = homePartner2 && homePartner2.trim() ? homePartner2.trim() : null;

  const awayLibero = prompt(
    "Enter Team B libero jersey number (or leave blank if no libero):",
    match.awayLibero || ""
  );
  match.awayLibero = awayLibero && awayLibero.trim() ? awayLibero.trim() : null;

  const awayPartner = prompt(
    "Enter jersey number that libero replaces in back row for Team B:",
    match.awayLiberoPartner || ""
  );
  match.awayLiberoPartner = awayPartner && awayPartner.trim() ? awayPartner.trim() : null;

  const awayPartner2 = prompt(
    "Enter SECOND jersey number libero can replace in back row for Team B (optional):",
    match.awayLiberoPartner2 || ""
  );
  match.awayLiberoPartner2 = awayPartner2 && awayPartner2.trim() ? awayPartner2.trim() : null;

  // After numbers are set, allow names entry (click-to-edit later as well)
  syncPlayerNamesWithRoster("home");
  syncPlayerNamesWithRoster("away");

  updateCurrentCourt("home");
  updateCurrentCourt("away");

  saveMatchToStorage();
  renderAll();
  addEvent("SYSTEM", "Lineups and libero settings updated.");
}

function confirmLineupsForNextSet() {
  if (!match) return;
  const ok = confirm("Confirm starting players/positions for the next set?\n\nOK = keep same starters/positions (reset to starting order)\nCancel = re-enter lineups and libero");
  if (!ok) {
    setLineups();
  } else {
    // Reset rotations to the stored starting six so we don't carry over the last set's end position
    if (match.homeStartingSix && match.homeStartingSix.length === 6) {
      match.homeBaseRotation = match.homeStartingSix.slice();
    }
    if (match.awayStartingSix && match.awayStartingSix.length === 6) {
      match.awayBaseRotation = match.awayStartingSix.slice();
    }
    updateCurrentCourt("home");
    updateCurrentCourt("away");
    saveMatchToStorage();
    renderAll();
  }
}

function rotateBaseOnce(team) {
  const baseKey = team === "home" ? "homeBaseRotation" : "awayBaseRotation";
  const arr = match[baseKey];
  if (!arr || arr.length !== 6) return;
  // Rotation is clockwise: 2->1, 3->2, 4->3, 5->4, 6->5, 1->6
  arr.push(arr.shift());
  updateCurrentCourt(team);
}

function updateCurrentCourt(team) {
  if (!match) return;
  const baseKey = team === "home" ? "homeBaseRotation" : "awayBaseRotation";
  const liberoKey = team === "home" ? "homeLibero" : "awayLibero";
  const courtKey = team === "home" ? "homeCourt" : "awayCourt";
  const liberoPosKey = team === "home" ? "homeLiberoPos" : "awayLiberoPos";
  const liberoPartnerKeys = team === "home"
    ? ["homeLiberoPartner", "homeLiberoPartner2"]
    : ["awayLiberoPartner", "awayLiberoPartner2"];
  const base = match[baseKey] || [];
  const liberoNum = match[liberoKey];
  const partners = liberoPartnerKeys
    .map(k => match[k])
    .filter(Boolean);
  let court = base.slice();
  let liberoPos = null;

  // Mapping: 0=Pos1 (back-right/server), 1=Pos2 (front-right), 2=Pos3 (front-middle),
  // 3=Pos4 (front-left), 4=Pos5 (back-left), 5=Pos6 (back-middle)
  // Front row: [1,2,3], Back row: [4,5,0]
  const backRow = [4, 5, 0];
  const frontRow = [1, 2, 3];

  if (liberoNum && partners.length) {
    const isServing = match.serving === team;

    // Find the first partner currently in the back row (0 -> 5 -> 4 order by rotation logic).
    for (const partner of partners) {
      const partnerIdx = base.indexOf(partner);
      const eligible =
        partnerIdx !== -1 &&
        backRow.includes(partnerIdx) &&
        base[partnerIdx] !== liberoNum &&
        !(partnerIdx === 0 && isServing); // do not replace server when serving
      if (eligible) {
        court[partnerIdx] = liberoNum;
        liberoPos = partnerIdx;
        break;
      }
    }
  }

  match[courtKey] = court;
  match[liberoPosKey] = liberoPos;
}

// ---- Events / actions ----
function addEvent(type, text, team = null, extra = {}) {
  if (!match) return;
  const now = new Date();
  const ev = {
    type,
    text,
    team,
    setNumber: match.currentSet,
    time: now.toISOString(),
    ...extra
  };
  match.events.push(ev);
  renderLog();
}

function ensureMatchTimerStarted() {
  if (!match.matchStartTime) {
    match.matchStartTime = new Date().toISOString();
    startMatchTimer();
  }
}

function addPoint(team) {
  if (!match || match.status === "finished") {
    alert("Match is already finished.");
    return;
  }

  ensureMatchTimerStarted();

  const set = match.sets[match.sets.length - 1];
  const prevServing = match.serving;
  let rotationHappened = false;

  if (team === "home") {
    set.homePoints++;
  } else {
    set.awayPoints++;
  }

  // Scoring logic:
  // If serving team scores, they keep serve, no rotation.
  // If receiving team scores, they rotate and gain serve.
  if (team !== prevServing) {
    // receiving team scored
    rotationHappened = true;
    if (team === "home") {
      rotateBaseOnce("home");
    } else {
      rotateBaseOnce("away");
    }
    match.serving = team;
  }
  // Re-evaluate courts whenever serve status may change so libero in/out is correct
  updateCurrentCourt("home");
  updateCurrentCourt("away");

  const teamName = team === "home" ? match.homeTeam : match.awayTeam;
  addEvent(
    "POINT",
    `+1 ${teamName} (Set ${set.setNumber}: ${set.homePoints}–${set.awayPoints})` +
    (rotationHappened ? " – receiving team rotated." : ""),
    team,
    {
      prevServing,
      rotationHappened,
      homePoints: set.homePoints,
      awayPoints: set.awayPoints
    }
  );

  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
}

function addPointForSide(side) {
  if (!match) return;
  const leftTeam = match.homeOnLeft ? "home" : "away";
  const rightTeam = match.homeOnLeft ? "away" : "home";
  const team = side === "left" ? leftTeam : rightTeam;
  addPoint(team);
}

function callTimeout(team) {
  if (!match || match.status === "finished") return;
  if (team === "home") {
    if (match.homeTimeouts >= 2) {
      alert("Team A already used 2 timeouts this set.");
      return;
    }
    match.homeTimeouts++;
  } else {
    if (match.awayTimeouts >= 2) {
      alert("Team B already used 2 timeouts this set.");
      return;
    }
    match.awayTimeouts++;
  }
  const teamName = team === "home" ? match.homeTeam : match.awayTeam;
  addEvent("TIMEOUT", `Timeout by ${teamName}`, team);
  startTimeoutTimer(team);
  saveMatchToStorage();
  renderAll();
}

function callTimeoutForSide(side) {
  if (!match) return;
  const leftTeam = match.homeOnLeft ? "home" : "away";
  const rightTeam = match.homeOnLeft ? "away" : "home";
  const team = side === "left" ? leftTeam : rightTeam;
  callTimeout(team);
}

function substitutePlayer(team) {
  if (!match || match.status === "finished") return;

  const roster = team === "home" ? match.homeRoster : match.awayRoster;
  const courtKey = team === "home" ? "homeCourt" : "awayCourt";
  const baseKey = team === "home" ? "homeBaseRotation" : "awayBaseRotation";
  const subsKey = team === "home" ? "homeSubsUsed" : "awaySubsUsed";
  const maxSubs = match.maxSubsPerSet || 6;

  const currentCourt = match[courtKey] || [];
  const onCourt = currentCourt.filter(Boolean);

  if ((match[subsKey] || 0) >= maxSubs) {
    alert("No substitutions remaining this set.");
    return;
  }

  const outStr = prompt(`Choose OUT (on court): ${onCourt.join(", ")}`);
  if (!outStr) return;
  const outNum = outStr.trim();
  if (!onCourt.includes(outNum)) {
    alert("Player is not on court.");
    return;
  }

  const bench = (roster || []).filter(p => p && !onCourt.includes(p) || p === outNum); // allow return of same player
  const inStr = prompt(`Choose IN (bench): ${bench.join(", ")}`);
  if (!inStr) return;
  const inNum = inStr.trim();
  if (!bench.includes(inNum)) {
    alert("Player not eligible to come in.");
    return;
  }

  // Apply swap in both court and base rotation to preserve order
  const baseArr = match[baseKey];
  const courtArr = match[courtKey];
  const baseIdx = baseArr.indexOf(outNum);
  const courtIdx = courtArr.indexOf(outNum);

  if (baseIdx === -1 || courtIdx === -1) {
    alert("Could not find player on court/rotation.");
    return;
  }

  baseArr[baseIdx] = inNum;
  courtArr[courtIdx] = inNum;
  match[subsKey] = (match[subsKey] || 0) + 1;

  addEvent("SUB", `Sub ${team === "home" ? match.homeTeam : match.awayTeam}: OUT #${outNum}, IN #${inNum}`, team, {
    out: outNum,
    in: inNum,
    subsUsed: match[subsKey]
  });

  updateCurrentCourt(team);
  saveMatchToStorage();
  renderAll();
}

function openCardEntryModal(team, color) {
  if (!match || match.status === "finished") return;
  pendingCardEntry = { team, color };
  const overlay = document.getElementById("cardEntryOverlay");
  const title = document.getElementById("cardEntryTitle");
  const teamLabel = document.getElementById("cardEntryTeam");
  const emoji = document.getElementById("cardEntryEmoji");
  const input = document.getElementById("cardPlayerNumberInput");
  const teamName = team === "home" ? match.homeTeam : match.awayTeam;
  const label = color === "yellow" ? "Yellow Card" : "Red Card";
  if (title) title.textContent = label;
  if (teamLabel) teamLabel.textContent = teamName;
  if (emoji) emoji.textContent = getCardEmoji(color);
  if (input) {
    input.value = "";
    input.focus();
    input.select();
  }
  overlay?.classList.remove("hidden");
}

function closeCardEntryModal() {
  pendingCardEntry = null;
  document.getElementById("cardEntryOverlay")?.classList.add("hidden");
}

function confirmCardEntry() {
  if (!pendingCardEntry || !match) return;
  const input = document.getElementById("cardPlayerNumberInput");
  const playerNumber = input && input.value.trim() ? input.value.trim() : null;
  card(pendingCardEntry.team, pendingCardEntry.color, playerNumber);
  closeCardEntryModal();
}

function card(team, color, playerNumber = null) {
  if (!match || match.status === "finished") return;
  const teamName = team === "home" ? match.homeTeam : match.awayTeam;
  const label = color === "yellow" ? "Yellow card" : "Red card";
  const target = playerNumber ? `#${playerNumber}` : "(team/coach)";
  match.cardNotice = {
    team,
    color,
    playerNumber,
    shownUntil: Date.now() + 10 * 1000
  };
  addEvent("CARD", `${label} - ${teamName} ${target}`, team, { color, playerNumber });
  saveMatchToStorage();
  renderAll();
}

function cardForSide(side, color) {
  if (!match) return;
  const leftTeam = match.homeOnLeft ? "home" : "away";
  const rightTeam = match.homeOnLeft ? "away" : "home";
  const team = side === "left" ? leftTeam : rightTeam;
  openCardEntryModal(team, color);
}

function undoLast() {
  if (!match || !match.events.length) return;
  const last = match.events.pop();

  const set = match.sets[match.sets.length - 1];

  if (last.type === "POINT") {
    // revert score
    if (last.team === "home") {
      set.homePoints = Math.max(0, set.homePoints - 1);
    } else {
      set.awayPoints = Math.max(0, set.awayPoints - 1);
    }
    // revert serving and rotation if there was a side-out
    if (last.rotationHappened) {
      // revert rotation: reverse of rotateBaseOnce
      const team = last.team;
      const baseKey = team === "home" ? "homeBaseRotation" : "awayBaseRotation";
      const arr = match[baseKey];
      if (arr && arr.length === 6) {
        // reverse rotation of rotateBaseOnce (counter-clockwise)
        arr.unshift(arr.pop());
        updateCurrentCourt(team);
      }
      match.serving = last.prevServing;
      // Re-evaluate courts after serve changes so libero in/out is correct
      updateCurrentCourt("home");
      updateCurrentCourt("away");
    }
  } else if (last.type === "TIMEOUT") {
    if (last.team === "home") {
      match.homeTimeouts = Math.max(0, match.homeTimeouts - 1);
    } else {
      match.awayTimeouts = Math.max(0, match.awayTimeouts - 1);
    }
    // cancel timeout timer if it was active
    if (timeoutTimerInterval) clearInterval(timeoutTimerInterval);
    match.timeoutTeam = null;
    match.timeoutEnd = null;
    document.getElementById("timeoutTimer").textContent = "--";
  } else if (last.type === "CARD") {
    match.cardNotice = null;
  } else if (last.type === "END_SET" || last.type === "END_MATCH") {
    // For simplicity, do not fully undo set/match end here
    alert("Undo for end of set/match is not fully supported. Last event removed from log only.");
  }

  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
}

function endCurrentSet() {
  if (!match) return;
  const set = match.sets[match.sets.length - 1];
  const h = set.homePoints;
  const a = set.awayPoints;
  if (h === a) {
    alert("Set cannot end tied.");
    return;
  }
  const isTieBreak = (match.currentSet === 5);
  const target = isTieBreak ? 15 : 25;
  const max = Math.max(h, a);
  const diff = Math.abs(h - a);

  if (max < target || diff < 2) {
    alert(`Set cannot end yet. Need at least ${target} points and a 2-point lead.`);
    return;
  }

  set.winner = h > a ? "home" : "away";
  if (set.winner === "home") match.homeSetsWon++;
  else match.awaySetsWon++;

  addEvent("END_SET", `End of set ${set.setNumber}: ${match.homeTeam} ${h} – ${a} ${match.awayTeam}`);

  const needed = Math.ceil(match.bestOf / 2); // 3 in best of 5
  if (match.homeSetsWon >= needed || match.awaySetsWon >= needed || match.currentSet >= match.bestOf) {
    match.status = "finished";
    match.matchEndTime = new Date().toISOString();
    addEvent("END_MATCH", `Match finished: ${match.homeTeam} ${match.homeSetsWon} - ${match.awaySetsWon} ${match.awayTeam}`);
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    saveMatchToStorage();
    renderAll();
    syncScoreToOBS();
    showMatchSummary();
    return;
  }

  match.currentSet++;
  match.homeTimeouts = 0;
  match.awayTimeouts = 0;
  match.homeSubsUsed = 0;
  match.awaySubsUsed = 0;
  match.sets.push({
    setNumber: match.currentSet,
    homePoints: 0,
    awayPoints: 0,
    winner: null
  });

  // Alternate first server each set based on initial choice
  const first = match.firstServer || "home";
  const alternate = first === "home" ? "away" : "home";
  match.serving = (match.currentSet % 2 === 1) ? first : alternate;
  match.homeOnLeft = !match.homeOnLeft;

  // Ask to confirm or re-enter lineups before the next set starts
  confirmLineupsForNextSet();

  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
  syncNamesToOBS();
}

function endMatchManually() {
  if (!match) return;
  if (!confirm("End match now?")) return;
  match.status = "finished";
  match.matchEndTime = new Date().toISOString();
  addEvent("END_MATCH", "Match marked as finished manually.");
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  saveMatchToStorage();
  renderAll();
  showMatchSummary();
}

// ---- Timers ----
function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0")
    );
  }
  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
}

function startMatchTimer() {
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  matchTimerInterval = setInterval(updateMatchTimerDisplay, 1000);
  updateMatchTimerDisplay();
}

function updateMatchTimerDisplay() {
  const el = document.getElementById("matchTimer");
  if (!match || !match.matchStartTime) {
    el.textContent = "00:00";
    return;
  }
  const start = new Date(match.matchStartTime).getTime();
  const end = match.matchEndTime ? new Date(match.matchEndTime).getTime() : Date.now();
  const diff = end - start;
  el.textContent = formatDuration(diff);
  const payload = getScoreboardPayload();
  if (payload) updateScoreboardWindow(payload);
}

function startTimeoutTimer(team) {
  if (timeoutTimerInterval) clearInterval(timeoutTimerInterval);
  const now = Date.now();
  match.timeoutTeam = team;
  match.timeoutEnd = now + 30 * 1000; // 30 seconds
  timeoutTimerInterval = setInterval(updateTimeoutTimerDisplay, 200);
  updateTimeoutTimerDisplay();
}

function updateTimeoutTimerDisplay() {
  const el = document.getElementById("timeoutTimer");
  if (!match || !match.timeoutEnd || !match.timeoutTeam) {
    el.textContent = "--";
    const payload = getScoreboardPayload();
    if (payload) updateScoreboardWindow(payload);
    return;
  }
  const remaining = match.timeoutEnd - Date.now();
  if (remaining <= 0) {
    el.textContent = "00:00";
    clearInterval(timeoutTimerInterval);
    timeoutTimerInterval = null;
    match.timeoutTeam = null;
    match.timeoutEnd = null;
    saveMatchToStorage();
    const payload = getScoreboardPayload();
    if (payload) updateScoreboardWindow(payload);
    return;
  }
  el.textContent = "00:" + String(Math.floor(remaining / 1000)).padStart(2, "0");
  const payload = getScoreboardPayload();
  if (payload) updateScoreboardWindow(payload);
}

function updateTimers() {
  if (match && match.matchStartTime && !match.matchEndTime) {
    startMatchTimer();
  } else {
    updateMatchTimerDisplay();
  }
  if (match && match.timeoutEnd && match.timeoutEnd > Date.now() && match.timeoutTeam) {
    if (timeoutTimerInterval) clearInterval(timeoutTimerInterval);
    timeoutTimerInterval = setInterval(updateTimeoutTimerDisplay, 200);
  } else {
    updateTimeoutTimerDisplay();
  }
}

function formatMatchSummaryDuration() {
  if (!match || !match.matchStartTime || !match.matchEndTime) return "--";
  const start = new Date(match.matchStartTime).getTime();
  const end = new Date(match.matchEndTime).getTime();
  return formatDuration(end - start);
}

function showMatchSummary() {
  if (!match || match.status !== "finished") return;
  const overlay = document.getElementById("matchSummaryOverlay");
  const resEl = document.getElementById("summaryResult");
  const setsEl = document.getElementById("summarySets");
  const durEl = document.getElementById("summaryDuration");
  const idEl = document.getElementById("summaryMatchId");
  const cardsEl = document.getElementById("summaryCards");

  const setLines = match.sets
    .map(s => `Set ${s.setNumber}: ${match.homeTeam} ${s.homePoints} - ${s.awayPoints} ${match.awayTeam}`)
    .join("<br>");

  const cards = (match.events || []).filter(ev => ev.type === "CARD");
  const cardLines = cards.length
    ? cards.map(c => {
      const teamName = c.team === "home" ? match.homeTeam : c.team === "away" ? match.awayTeam : "";
      const pn = c.playerNumber ? ` #${c.playerNumber}` : "";
      return `${c.text} (${teamName}${pn})`;
    }).join("<br>")
    : "None";

  resEl.innerHTML = `${match.homeTeam} ${match.homeSetsWon} - ${match.awaySetsWon} ${match.awayTeam}`;
  setsEl.innerHTML = setLines;
  durEl.textContent = formatMatchSummaryDuration();
  idEl.textContent = `Match ID: ${match.id || "-"}`;
  cardsEl.innerHTML = cardLines;

  overlay.classList.remove("hidden");
}

function hideMatchSummary() {
  const overlay = document.getElementById("matchSummaryOverlay");
  overlay.classList.add("hidden");
}

// ---- Rendering ----
function renderLog() {
  const list = document.getElementById("logList");
  list.innerHTML = "";
  if (!match) return;
  match.events.forEach(ev => {
    const li = document.createElement("li");
    li.className = "log-item";
    const t = new Date(ev.time);
    const ts = t.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    li.innerHTML = `<span class="time">[${ts}]</span> <strong>S${ev.setNumber}</strong> – ${ev.text}`;
    list.appendChild(li);
  });
  list.scrollTop = list.scrollHeight;
}

function renderRotation() {
  const homeGrid = document.getElementById("homeRotationGrid");
  const awayGrid = document.getElementById("awayRotationGrid");
  homeGrid.innerHTML = "";
  awayGrid.innerHTML = "";

  if (!match) return;

  // Volleyball positions mapping:
  // 0=Pos1 (back-right/server), 1=Pos2 (front-right), 2=Pos3 (front-middle),
  // 3=Pos4 (front-left), 4=Pos5 (back-left), 5=Pos6 (back-middle)
  // Front row indices: 1,2,3; Back row indices: 4,5,0
  const homeCourt = match.homeCourt || [];
  const awayCourt = match.awayCourt || [];
  const homeLibero = match.homeLibero;
  const awayLibero = match.awayLibero;
  const homeLiberoPos = match.homeLiberoPos;
  const awayLiberoPos = match.awayLiberoPos;

  // Server is position 1 (back-right) => index 0 in this mapping
  const homeServerIdx = 0;
  const awayServerIdx = 0;
  const homeServing = match.serving === "home";
  const awayServing = match.serving === "away";

  // Render Team A (top row: front 4-3-2, bottom: back 5-6-1)
  const displayOrder = [3, 2, 1, 4, 5, 0];
  displayOrder.forEach(i => {
    const el = document.createElement("div");
    el.className = "rot-pos";
    el.textContent = homeCourt[i] || "-";
    if (homeLibero && homeLiberoPos === i) el.classList.add("libero-active");
    if (homeServing && i === homeServerIdx) el.classList.add("server-active");
    homeGrid.appendChild(el);
  });

  // Render Team B
  displayOrder.forEach(i => {
    const el = document.createElement("div");
    el.className = "rot-pos";
    el.textContent = awayCourt[i] || "-";
    if (awayLibero && awayLiberoPos === i) el.classList.add("libero-active");
    if (awayServing && i === awayServerIdx) el.classList.add("server-active");
    awayGrid.appendChild(el);
  });

  document.getElementById("homeLiberoLabel").textContent = homeLibero || "-";
  document.getElementById("awayLiberoLabel").textContent = awayLibero || "-";
}

function renderSquads() {
  const homeEl = document.getElementById("homeSquadText");
  const awayEl = document.getElementById("awaySquadText");
  if (!match) return;
  // Sort numerically
  const sortNums = arr => (arr || []).slice().sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const homeSorted = sortNums(match.homeRoster);
  const awaySorted = sortNums(match.awayRoster);
  const homeNames = match.homePlayerNames || {};
  const awayNames = match.awayPlayerNames || {};

  const makeList = (sorted, names, teamKey) => {
    if (!sorted.length) return "<em>–</em>";
    return sorted.map(num => {
      const nm = names[num] ? ` — ${names[num]}` : "";
      return `<span class="squad-slot" data-team="${teamKey}" data-num="${num}">#${num}${nm}</span>`;
    }).join(", ");
  };

  homeEl.innerHTML = makeList(homeSorted, homeNames, "home");
  awayEl.innerHTML = makeList(awaySorted, awayNames, "away");
}

function getScoreboardPayload() {
  if (!match) return null;
  const currentSet = match.sets[match.sets.length - 1];
  const leftTeam = match.homeOnLeft ? "home" : "away";
  const rightTeam = match.homeOnLeft ? "away" : "home";
  const leftName = leftTeam === "home" ? match.homeTeam : match.awayTeam;
  const rightName = rightTeam === "home" ? match.homeTeam : match.awayTeam;
  const leftScore = leftTeam === "home" ? currentSet.homePoints : currentSet.awayPoints;
  const rightScore = rightTeam === "home" ? currentSet.homePoints : currentSet.awayPoints;
  const leftSets = leftTeam === "home" ? match.homeSetsWon : match.awaySetsWon;
  const rightSets = rightTeam === "home" ? match.homeSetsWon : match.awaySetsWon;
  const leftLogo = getTeamLogo(leftName);
  const rightLogo = getTeamLogo(rightName);
  const setHistory = (match.sets || [])
    .map(s => `S${s.setNumber} ${match.homeTeam} ${s.homePoints}-${s.awayPoints} ${match.awayTeam}`)
    .join(" | ");
  const winnerText = match.status === "finished"
    ? `${match.homeSetsWon > match.awaySetsWon ? match.homeTeam : match.awayTeam} wins ${match.homeSetsWon}-${match.awaySetsWon}`
    : "";
  const now = Date.now();
  const start = match.matchStartTime ? new Date(match.matchStartTime).getTime() : null;
  const end = match.matchEndTime ? new Date(match.matchEndTime).getTime() : null;
  const matchTime = start ? formatDuration((end || now) - start) : "00:00";
  const timeoutRemaining = (match.timeoutEnd && match.timeoutTeam)
    ? Math.max(0, Math.ceil((match.timeoutEnd - now) / 1000))
    : 0;
  const timeoutTeamName = match.timeoutTeam
    ? (match.timeoutTeam === "home" ? match.homeTeam : match.awayTeam)
    : "";
  const timeoutTeamLogo = match.timeoutTeam ? getTeamLogo(timeoutTeamName) : "";
  const cardRemaining = match.cardNotice
    ? Math.max(0, Math.ceil((match.cardNotice.shownUntil - now) / 1000))
    : 0;
  const cardTeamName = match.cardNotice
    ? (match.cardNotice.team === "home" ? match.homeTeam : match.awayTeam)
    : "";
  const cardTeamLogo = cardTeamName ? getTeamLogo(cardTeamName) : "";
  const sfxVisual = match.sfxNotice ? (SFX_VISUALS[match.sfxNotice.key] || null) : null;

  let payload = {
    leftName,
    rightName,
    leftScore,
    rightScore,
    leftSets,
    rightSets,
    leftLogo,
    rightLogo,
    currentSet: currentSet.setNumber,
    servingSide: match.serving === leftTeam ? "left" : "right",
    setHistory,
    matchId: match.id || "-",
    matchTime,
    winnerText,
    timeoutRemaining,
    timeoutTeamName,
    timeoutTeamLogo,
    cardRemaining,
    cardTeamName,
    cardTeamLogo,
    cardPlayerNumber: match.cardNotice ? match.cardNotice.playerNumber : null,
    cardColor: match.cardNotice ? match.cardNotice.color : null,
    cardEmoji: match.cardNotice ? getCardEmoji(match.cardNotice.color) : "",
    sfxActive: Boolean(sfxVisual),
    sfxImage: sfxVisual ? sfxVisual.image : "",
    sfxLabel: sfxVisual ? sfxVisual.label : ""
  };

  if (scoreboardInvert) {
    payload = {
      ...payload,
      leftName: payload.rightName,
      rightName: payload.leftName,
      leftScore: payload.rightScore,
      rightScore: payload.leftScore,
      leftSets: payload.rightSets,
      rightSets: payload.leftSets,
      leftLogo: payload.rightLogo,
      rightLogo: payload.leftLogo,
      servingSide: payload.servingSide === "left" ? "right" : "left"
    };
  }

  return payload;
}

function refreshFirstServeLabels() {
  const homeLabel = document.getElementById("firstServeHomeLabel");
  const awayLabel = document.getElementById("firstServeAwayLabel");
  const homeName = (document.getElementById("homeNameInput")?.value || "").trim() || "Team A";
  const awayName = (document.getElementById("awayNameInput")?.value || "").trim() || "Team B";
  if (homeLabel) homeLabel.textContent = homeName;
  if (awayLabel) awayLabel.textContent = awayName;
}

function renderAll() {
  if (!match) return;
  refreshFirstServeLabels();
  const leftTeam = match.homeOnLeft ? "home" : "away";
  const rightTeam = match.homeOnLeft ? "away" : "home";
  const leftName = leftTeam === "home" ? match.homeTeam : match.awayTeam;
  const rightName = rightTeam === "home" ? match.homeTeam : match.awayTeam;

  document.getElementById("homeNameDisplay").textContent = leftName;
  document.getElementById("awayNameDisplay").textContent = rightName;
  applyLogo(document.getElementById("homeLogoDisplay"), leftName);
  applyLogo(document.getElementById("awayLogoDisplay"), rightName);
  const homeSquadLabel = document.getElementById("homeSquadLabel");
  const awaySquadLabel = document.getElementById("awaySquadLabel");
  if (homeSquadLabel) homeSquadLabel.textContent = `${match.homeTeam} Squad:`;
  if (awaySquadLabel) awaySquadLabel.textContent = `${match.awayTeam} Squad:`;

  const currentSet = match.sets[match.sets.length - 1];
  document.getElementById("homeScore").textContent =
    leftTeam === "home" ? currentSet.homePoints : currentSet.awayPoints;
  document.getElementById("awayScore").textContent =
    rightTeam === "home" ? currentSet.homePoints : currentSet.awayPoints;
  document.getElementById("homeSets").textContent =
    leftTeam === "home" ? match.homeSetsWon : match.awaySetsWon;
  document.getElementById("awaySets").textContent =
    rightTeam === "home" ? match.homeSetsWon : match.awaySetsWon;
  document.getElementById("currentSetLabel").textContent = currentSet.setNumber;

  document.getElementById("homeTimeouts").textContent = match.homeTimeouts;
  document.getElementById("awayTimeouts").textContent = match.awayTimeouts;
  document.getElementById("homeSubs").textContent = match.homeSubsUsed;
  document.getElementById("awaySubs").textContent = match.awaySubsUsed;

  document.getElementById("matchStatusTag").textContent =
    "Status: " + (match.status === "finished" ? "Finished" : "Live");

  document.getElementById("homeCard").classList.toggle("serving", match.serving === leftTeam);
  document.getElementById("awayCard").classList.toggle("serving", match.serving === rightTeam);

  // Sync first serve radio if present
  const fs = match.firstServer || "home";
  const radio = document.querySelector(`input[name="firstServe"][value="${fs}"]`);
  if (radio) radio.checked = true;

  // Set score summary
  const summaryEl = document.getElementById("setSummaryText");
  if (summaryEl) {
    const summary = (match.sets || [])
      .map(s => `S${s.setNumber}: ${match.homeTeam} ${s.homePoints} - ${s.awayPoints} ${match.awayTeam}`)
      .join(" | ");
    summaryEl.textContent = summary || "--";
  }

  const leftBtn = document.getElementById("btnPointHome");
  const rightBtn = document.getElementById("btnPointAway");
  if (leftBtn) leftBtn.textContent = `+1 ${leftName}`;
  if (rightBtn) rightBtn.textContent = `+1 ${rightName}`;

  // Control panel labels follow court sides
  const leftTitle = document.querySelector(".controls-group:nth-child(1) h3");
  const rightTitle = document.querySelector(".controls-group:nth-child(2) h3");
  if (leftTitle) leftTitle.textContent = `${leftName} - Controls`;
  if (rightTitle) rightTitle.textContent = `${rightName} - Controls`;

  const btnTimeoutLeft = document.getElementById("btnTimeoutHome");
  const btnTimeoutRight = document.getElementById("btnTimeoutAway");
  if (btnTimeoutLeft) btnTimeoutLeft.textContent = `Timeout ${leftName}`;
  if (btnTimeoutRight) btnTimeoutRight.textContent = `Timeout ${rightName}`;

  const btnYellowLeft = document.getElementById("btnCardHomeYellow");
  const btnRedLeft = document.getElementById("btnCardHomeRed");
  const btnYellowRight = document.getElementById("btnCardAwayYellow");
  const btnRedRight = document.getElementById("btnCardAwayRed");
  if (btnYellowLeft) btnYellowLeft.textContent = `Yellow Card ${leftName}`;
  if (btnRedLeft) btnRedLeft.textContent = `Red Card ${leftName}`;
  if (btnYellowRight) btnYellowRight.textContent = `Yellow Card ${rightName}`;
  if (btnRedRight) btnRedRight.textContent = `Red Card ${rightName}`;

  // Timeouts/subs display should reflect left/right teams
  const leftTimeouts = leftTeam === "home" ? match.homeTimeouts : match.awayTimeouts;
  const rightTimeouts = rightTeam === "home" ? match.homeTimeouts : match.awayTimeouts;
  const leftSubs = leftTeam === "home" ? match.homeSubsUsed : match.awaySubsUsed;
  const rightSubs = rightTeam === "home" ? match.homeSubsUsed : match.awaySubsUsed;
  document.getElementById("homeTimeouts").textContent = leftTimeouts;
  document.getElementById("awayTimeouts").textContent = rightTimeouts;
  document.getElementById("homeSubs").textContent = leftSubs;
  document.getElementById("awaySubs").textContent = rightSubs;

  const payload = getScoreboardPayload();
  if (payload) updateScoreboardWindow(payload);

  renderRotation();
  renderLog();
  renderSquads();
  updateTimers();
}

function openScoreboardWindow() {
  if (scoreboardWindow && !scoreboardWindow.closed) {
    scoreboardWindow.focus();
    return;
  }
  scoreboardWindow = window.open("", "ivi_scoreboard", "width=900,height=500");
  if (!scoreboardWindow) {
    alert("Popup blocked. Please allow popups for this site.");
    return;
  }
  scoreboardWindow.document.write(`
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Scoreboard</title>
          <style>
            :root { --bg:#071525; --panel:#0f2236; --accent:#00a651; --muted:#8fa2c2; --text:#e5f0ff; }
            body { margin:0; font-family: "Trebuchet MS", Arial, sans-serif; background:radial-gradient(circle at top, #163a63 0, #071525 55%); color:var(--text); }
            .page { display:flex; flex-direction:column; height:100vh; padding:16px 24px; gap:10px; }
            .topbar { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:14px; }
            .winner { text-align:center; font-size:26px; font-weight:800; color:#ffd166; display:none; }
            .winner.show { display:block; }
            .set-history { text-align:center; font-size:14px; color:var(--muted); }
            .wrap { display:flex; flex:1; align-items:stretch; justify-content:center; gap:24px; }
            .card { flex:1; background:var(--panel); border-radius:20px; padding:22px; text-align:center; position:relative; box-shadow:0 10px 24px rgba(0,0,0,0.45); display:flex; flex-direction:column; justify-content:center; }
            .logo { width:140px; height:140px; object-fit:contain; margin:0 auto 6px; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5)); }
            .logo.hidden { display:none; }
            .name { font-size:40px; font-weight:800; margin-bottom:10px; letter-spacing:0.03em; }
            .sets { font-size:16px; color:var(--muted); }
            .score { font-size:340px; font-weight:900; margin-top:12px; line-height:1; flex:1; display:flex; align-items:center; justify-content:center; }
            .serve-dot { position:absolute; top:14px; right:14px; width:34px; height:34px; object-fit:contain; filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45)); opacity:0; transform:scale(0.92); }
            .card.serving .serve-dot { opacity:1; transform:scale(1); }
            .center { font-size:18px; text-align:center; color:var(--muted); min-width:160px; display:flex; flex-direction:column; justify-content:center; }
            .setnum { font-size:64px; font-weight:800; color:var(--text); margin-top:6px; }
            .center .label { text-transform:uppercase; letter-spacing:0.12em; font-size:12px; }
            .timeout { text-align:center; font-size:16px; color:#f4d35e; }
            .timeout.hidden { display:none; }
            .timeout-modal { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:50; }
            .timeout-modal.hidden { display:none; }
            .timeout-card { background:var(--panel); border:3px solid #f4d35e; border-radius:24px; padding:40px 56px; text-align:center; box-shadow:0 16px 40px rgba(0,0,0,0.6); }
            .overlay-logo { width:104px; height:104px; object-fit:contain; margin:0 auto 10px; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.45)); }
            .overlay-logo.hidden { display:none; }
            .timeout-title { font-size:40px; font-weight:900; letter-spacing:0.1em; color:#f4d35e; }
            .timeout-team { font-size:30px; color:var(--text); margin-top:10px; }
            .timeout-clock { font-size:110px; font-weight:900; color:var(--text); margin-top:8px; }
            .card-modal { position:fixed; inset:0; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; z-index:55; }
            .card-modal.hidden { display:none; }
            .card-popup { min-width:420px; background:var(--panel); border-radius:28px; padding:36px 42px; text-align:center; box-shadow:0 16px 40px rgba(0,0,0,0.6); border:4px solid #ffd166; }
            .card-popup.red { border-color:#ef476f; }
            .card-popup.yellow { border-color:#ffd166; }
            .card-popup img { width:180px; height:180px; object-fit:contain; margin:0 auto 14px; }
            .card-type { font-size:44px; font-weight:900; letter-spacing:0.08em; }
            .card-team { font-size:30px; margin-top:10px; }
            .card-player { font-size:112px; font-weight:900; line-height:1; margin-top:12px; }
            .sfx-modal { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:54; }
            .sfx-modal.hidden { display:none; }
            .sfx-card { min-width:640px; background:transparent; border-radius:34px; padding:20px; text-align:center; box-shadow:none; border:none; }
            .sfx-image { width:520px; height:520px; object-fit:contain; margin:0 auto; filter:drop-shadow(0 8px 18px rgba(0,0,0,0.45)); }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="topbar">
              <div id="matchId">Match ID: -</div>
              <div id="matchTime">00:00</div>
            </div>
            <div class="winner" id="winnerBanner"></div>
            <div class="set-history" id="setHistory">--</div>
            <div class="wrap">
              <div class="card" id="leftCard">
                <img class="serve-dot" src="mikasa.png" alt="Serving" />
                <img class="logo hidden" id="leftLogo" alt="" />
                <div class="name" id="leftName">Team A</div>
                <div class="sets">Sets: <span id="leftSets">0</span></div>
                <div class="score" id="leftScore">0</div>
              </div>
              <div class="center">
                <div class="label">Current Set</div>
                <div class="setnum" id="currentSet">1</div>
              </div>
              <div class="card" id="rightCard">
                <img class="serve-dot" src="mikasa.png" alt="Serving" />
                <img class="logo hidden" id="rightLogo" alt="" />
                <div class="name" id="rightName">Team B</div>
                <div class="sets">Sets: <span id="rightSets">0</span></div>
                <div class="score" id="rightScore">0</div>
              </div>
            </div>
            <div class="timeout hidden" id="timeoutBox">Timeout: <span id="timeoutTeam">-</span> <span id="timeoutClock">00</span></div>
            <div class="timeout-modal hidden" id="timeoutModal">
              <div class="timeout-card">
                <img class="overlay-logo hidden" id="timeoutLogoModal" alt="" />
                <div class="timeout-title">TIMEOUT</div>
                <div class="timeout-team" id="timeoutTeamModal">-</div>
                <div class="timeout-clock" id="timeoutClockModal">00</div>
              </div>
            </div>
            <div class="card-modal hidden" id="cardModal">
              <div class="card-popup" id="cardPopup">
                <img class="overlay-logo hidden" id="cardLogoModal" alt="" />
                <div id="cardPopupEmoji" style="font-size:160px; line-height:1;">🟨</div>
                <div class="card-type" id="cardPopupType">CARD</div>
                <div class="card-team" id="cardPopupTeam">-</div>
                <div class="card-player" id="cardPopupPlayer">#</div>
              </div>
            </div>
            <div class="sfx-modal hidden" id="sfxModal">
              <div class="sfx-card">
                <img class="sfx-image" id="sfxImage" alt="" />
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
  scoreboardWindow.document.close();
  const sbScript = scoreboardWindow.document.createElement("script");
  sbScript.textContent = `
        let cardHideTimer = null;
        function applyLogo(el, src, name) {
          if (!el) return;
          if (!src) {
            el.classList.add("hidden");
            el.removeAttribute("src");
            el.alt = "";
            return;
          }
          el.classList.remove("hidden");
          el.src = src;
          el.alt = name + " logo";
          el.onerror = () => el.classList.add("hidden");
        }
        window.addEventListener("message", (e) => {
          const data = e.data;
          if (!data || data.type !== "scoreboard:update") return;
          document.getElementById("leftName").textContent = data.leftName;
          document.getElementById("rightName").textContent = data.rightName;
          applyLogo(document.getElementById("leftLogo"), data.leftLogo, data.leftName);
          applyLogo(document.getElementById("rightLogo"), data.rightLogo, data.rightName);
          document.getElementById("leftScore").textContent = data.leftScore;
          document.getElementById("rightScore").textContent = data.rightScore;
          document.getElementById("leftSets").textContent = data.leftSets;
          document.getElementById("rightSets").textContent = data.rightSets;
          document.getElementById("currentSet").textContent = data.currentSet;
          document.getElementById("matchId").textContent = "Match ID: " + data.matchId;
          document.getElementById("matchTime").textContent = data.matchTime;
          document.getElementById("setHistory").textContent = data.setHistory || "--";
          const winner = document.getElementById("winnerBanner");
          if (data.winnerText) {
            winner.textContent = data.winnerText;
            winner.classList.add("show");
          } else {
            winner.textContent = "";
            winner.classList.remove("show");
          }
          const timeoutBox = document.getElementById("timeoutBox");
          const timeoutModal = document.getElementById("timeoutModal");
          const cardModal = document.getElementById("cardModal");
          const cardPopup = document.getElementById("cardPopup");
          const sfxModal = document.getElementById("sfxModal");
          if (data.timeoutRemaining > 0) {
            timeoutBox.classList.remove("hidden");
            document.getElementById("timeoutTeam").textContent = data.timeoutTeamName;
            document.getElementById("timeoutClock").textContent = String(data.timeoutRemaining).padStart(2, "0");
            timeoutModal.classList.remove("hidden");
            applyLogo(document.getElementById("timeoutLogoModal"), data.timeoutTeamLogo, data.timeoutTeamName);
            document.getElementById("timeoutTeamModal").textContent = data.timeoutTeamName;
            document.getElementById("timeoutClockModal").textContent = String(data.timeoutRemaining).padStart(2, "0");
          } else {
            timeoutBox.classList.add("hidden");
            timeoutModal.classList.add("hidden");
          }
          if (data.cardRemaining > 0 && data.cardColor) {
            cardModal.classList.remove("hidden");
            cardPopup.classList.toggle("yellow", data.cardColor === "yellow");
            cardPopup.classList.toggle("red", data.cardColor === "red");
            applyLogo(document.getElementById("cardLogoModal"), data.cardTeamLogo, data.cardTeamName);
            document.getElementById("cardPopupEmoji").textContent = data.cardEmoji || (data.cardColor === "yellow" ? "🟨" : "🟥");
            document.getElementById("cardPopupType").textContent = (data.cardColor === "yellow" ? "YELLOW" : "RED") + " CARD";
            document.getElementById("cardPopupTeam").textContent = data.cardTeamName || "-";
            document.getElementById("cardPopupPlayer").textContent = data.cardPlayerNumber ? "#" + data.cardPlayerNumber : "TEAM / COACH";
            if (cardHideTimer) clearTimeout(cardHideTimer);
            cardHideTimer = setTimeout(() => cardModal.classList.add("hidden"), data.cardRemaining * 1000 + 100);
          } else {
            cardModal.classList.add("hidden");
            if (cardHideTimer) clearTimeout(cardHideTimer);
            cardHideTimer = null;
          }
          if (data.sfxActive && data.sfxImage) {
            sfxModal.classList.remove("hidden");
            const sfxImage = document.getElementById("sfxImage");
            sfxImage.src = data.sfxImage;
            sfxImage.alt = data.sfxLabel || "Sound effect";
          } else {
            sfxModal.classList.add("hidden");
          }
          document.getElementById("leftCard").classList.toggle("serving", data.servingSide === "left");
          document.getElementById("rightCard").classList.toggle("serving", data.servingSide === "right");
        });
      `;
  scoreboardWindow.document.body.appendChild(sbScript);
  scoreboardWindow.focus();
  // Push current state immediately so names/scores are correct on open
  const payload = getScoreboardPayload();
  if (payload) updateScoreboardWindow(payload);
}

function updateScoreboardWindow(payload) {
  if (!scoreboardWindow || scoreboardWindow.closed) return;
  scoreboardWindow.postMessage({ type: "scoreboard:update", ...payload }, "*");
}

function openAudioPanelWindow() {
  if (audioPanelWindow && !audioPanelWindow.closed) {
    audioPanelWindow.focus();
    return;
  }

  audioPanelWindow = window.open("", "ivi_audio_panel", "width=430,height=760");
  if (!audioPanelWindow) {
    alert("Popup blocked. Please allow popups for this site.");
    return;
  }

  audioPanelWindow.document.write(`
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Audio Panel</title>
          <style>
            :root { --bg:#071525; --panel:#0f2236; --muted:#8fa2c2; --text:#e5f0ff; --accent:#00a651; --warn:#ff6f00; }
            * { box-sizing: border-box; }
            body { margin:0; font-family:"Trebuchet MS", Arial, sans-serif; background:radial-gradient(circle at top, #163a63 0, #071525 55%); color:var(--text); }
            .page { min-height:100vh; padding:18px; padding-bottom:calc(18px + env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:14px; }
            .head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
            .title { font-size:22px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; }
            .hint { color:var(--muted); font-size:13px; }
            .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; }
            .btn { border:none; border-radius:16px; padding:18px 14px; font-size:22px; font-weight:800; cursor:pointer; color:#fff; background:#203854; box-shadow:0 6px 14px rgba(0,0,0,0.45); min-height:84px; }
            .btn.active { background:linear-gradient(135deg, #009f4f, #00c86a); }
            .stop { background:linear-gradient(135deg, #ff6f00, #ff9a2b); margin-top:4px; }
            .status { font-size:14px; color:var(--muted); }
            @media (max-width:700px) { .grid { grid-template-columns:1fr; } .btn { font-size:24px; min-height:94px; padding:22px 14px; } }
            @media (max-width:480px), (pointer:coarse) {
              .page { padding:14px; gap:10px; }
              .title { font-size:20px; }
              .hint { font-size:12px; }
              .status { font-size:12px; }
              .grid { gap:10px; }
              .btn { font-size:26px; min-height:100px; padding:24px 12px; border-radius:18px; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="head">
              <div>
                <div class="title">Audio Panel</div>
                <div class="hint">Tap a sound to play/stop</div>
              </div>
              <div class="status" id="audioStatus">Ready</div>
            </div>
            <div class="grid" id="audioGrid"></div>
            <button class="btn stop" id="btnStopAudio">Stop All</button>
          </div>
          <script>
            const grid = document.getElementById("audioGrid");
            const statusEl = document.getElementById("audioStatus");
            let current = { activeKey: null, tracks: [] };

            function renderButtons() {
              grid.innerHTML = current.tracks.map(t =>
                '<button class="btn ' + (current.activeKey === t.key ? "active" : "") + '" data-key="' + t.key + '">' + t.label + '</button>'
              ).join("");
              statusEl.textContent = current.activeKey
                ? ("Playing: " + ((current.tracks.find(t => t.key === current.activeKey) || {}).label || current.activeKey))
                : "Ready";
            }

            window.addEventListener("message", (e) => {
              const data = e.data;
              if (!data || data.type !== "audio-panel:update") return;
              current = data;
              renderButtons();
            });

            grid.addEventListener("click", (e) => {
              const btn = e.target.closest("button[data-key]");
              if (!btn || !window.opener) return;
              window.opener.postMessage({ type: "audio-panel:toggle", key: btn.dataset.key }, "*");
            });

            document.getElementById("btnStopAudio").addEventListener("click", () => {
              if (!window.opener) return;
              window.opener.postMessage({ type: "audio-panel:stop" }, "*");
            });
          </script>
        </body>
        </html>
      `);
  audioPanelWindow.document.close();
  audioPanelWindow.focus();
  updateAudioPanelWindow();
}

// ---- Button wiring ----
document.getElementById("btnNewMatch").addEventListener("click", () => {
  if (match && match.events.length && !confirm("This will reset the current match. Continue?")) return;
  createNewMatch();
});

const lineupsBtn = document.getElementById("btnLineups");
if (lineupsBtn) lineupsBtn.addEventListener("click", () => setLineups());

document.getElementById("btnPointHome").addEventListener("click", () => addPointForSide("left"));
document.getElementById("btnPointAway").addEventListener("click", () => addPointForSide("right"));

document.getElementById("btnTimeoutHome").addEventListener("click", () => callTimeoutForSide("left"));
document.getElementById("btnTimeoutAway").addEventListener("click", () => callTimeoutForSide("right"));

document.getElementById("btnCardHomeYellow").addEventListener("click", () => cardForSide("left", "yellow"));
document.getElementById("btnCardHomeRed").addEventListener("click", () => cardForSide("left", "red"));
document.getElementById("btnCardAwayYellow").addEventListener("click", () => cardForSide("right", "yellow"));
document.getElementById("btnCardAwayRed").addEventListener("click", () => cardForSide("right", "red"));
document.getElementById("btnCloseCardEntry").addEventListener("click", () => closeCardEntryModal());
document.getElementById("btnConfirmCardEntry").addEventListener("click", () => confirmCardEntry());
document.getElementById("cardEntryOverlay").addEventListener("click", (e) => {
  if (e.target.id === "cardEntryOverlay") closeCardEntryModal();
});
document.getElementById("cardPlayerNumberInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmCardEntry();
  if (e.key === "Escape") closeCardEntryModal();
});

document.getElementById("btnUndo").addEventListener("click", () => undoLast());
document.getElementById("btnEndSet").addEventListener("click", () => endCurrentSet());
document.getElementById("btnEndMatch").addEventListener("click", () => endMatchManually());
document.getElementById("btnSubHome").addEventListener("click", () => substitutePlayer("home"));
document.getElementById("btnSubAway").addEventListener("click", () => substitutePlayer("away"));
document.getElementById("btnCloseSummary").addEventListener("click", () => hideMatchSummary());
document.getElementById("btnOpenScoreboard").addEventListener("click", () => openScoreboardWindow());
const btnOpenAudioPanel = document.getElementById("btnOpenAudioPanel");
if (btnOpenAudioPanel) btnOpenAudioPanel.addEventListener("click", () => openAudioPanelWindow());
const btnSfxAce = document.getElementById("btnSfxAce");
const btnSfxBlock = document.getElementById("btnSfxBlock");
const btnSfxBoom = document.getElementById("btnSfxBoom");
const btnSfxBrasil = document.getElementById("btnSfxBrasil");
if (btnSfxAce) btnSfxAce.addEventListener("click", () => toggleSfx("ace"));
if (btnSfxBlock) btnSfxBlock.addEventListener("click", () => toggleSfx("block"));
if (btnSfxBoom) btnSfxBoom.addEventListener("click", () => toggleSfx("boom"));
if (btnSfxBrasil) btnSfxBrasil.addEventListener("click", () => toggleSfx("brasilSil"));
document.getElementById("btnOpenRegister").addEventListener("click", () => {
  window.open("register.html", "_blank");
});

document.querySelectorAll(".squad-list span").forEach(el => {
  if (el.classList.contains("squad-slot")) return;
  el.addEventListener("click", (e) => {
    const target = e.target;
    const team = target.dataset.team;
    const num = target.dataset.num;
    promptPlayerName(team, num);
  });
});

document.addEventListener("click", (e) => {
  const slot = e.target.closest(".squad-slot");
  if (slot) {
    const team = slot.dataset.team;
    const num = slot.dataset.num;
    promptPlayerName(team, num);
  }
});

// Update team names live so future log entries use the chosen names
document.getElementById("homeNameInput").addEventListener("change", (e) => {
  refreshFirstServeLabels();
  if (!match) return;
  match.homeTeam = e.target.value || "Team A";
  saveMatchToStorage();
  renderAll();
  syncNamesToOBS();
});
document.getElementById("awayNameInput").addEventListener("change", (e) => {
  refreshFirstServeLabels();
  if (!match) return;
  match.awayTeam = e.target.value || "Team B";
  saveMatchToStorage();
  renderAll();
  syncNamesToOBS();
});
document.getElementById("homeNameInput").addEventListener("input", refreshFirstServeLabels);
document.getElementById("awayNameInput").addEventListener("input", refreshFirstServeLabels);

window.addEventListener("message", (e) => {
  const data = e.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "audio-panel:toggle") {
    toggleSfx(data.key);
  }
  if (data.type === "audio-panel:stop") {
    stopAllSfx();
  }
});

// ---- Init ----
(function init() {
  const stored = loadMatchFromStorage();
  if (stored) {
    match = stored;
    // Backfill firstServer if missing from old saves
    match.firstServer = match.firstServer || match.serving || "home";
    // Backfill side flag
    if (typeof match.homeOnLeft !== "boolean") match.homeOnLeft = true;
    // Backfill starting six snapshots if missing
    if (!match.homeStartingSix || match.homeStartingSix.length !== 6) {
      match.homeStartingSix = (match.homeBaseRotation || []).slice();
    }
    if (!match.awayStartingSix || match.awayStartingSix.length !== 6) {
      match.awayStartingSix = (match.awayBaseRotation || []).slice();
    }
    document.getElementById("homeNameInput").value = match.homeTeam;
    document.getElementById("awayNameInput").value = match.awayTeam;
    document.getElementById("matchIdInput").value = match.id;
    const fs = match.firstServer || "home";
    const radio = document.querySelector(`input[name="firstServe"][value="${fs}"]`);
    if (radio) radio.checked = true;
  } else {
    createNewMatch();
  }
  refreshFirstServeLabels();
  renderAll();
  window.addEventListener('load', () => {
    window.obsClient.connect();
  });
})();

