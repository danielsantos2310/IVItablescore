const STORAGE_KEY = "ivi_current_match_v3";
const APP_ORIGIN = window.location.origin;
const LIVE_SESSION_KEY = "ivi_live_referee_session_v1";

function loadMatchFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Match recovery is unavailable in this browser.", e);
    return null;
  }
}

function saveMatchToStorage() {
  if (!match) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  } catch (e) {
    console.warn("Match recovery could not be saved in this browser.", e);
  }
  scheduleLiveMatchSync();
}

let match = null;
let matchTimerInterval = null;
let timeoutTimerInterval = null;
let scoreboardWindow = null;
let audioPanelWindow = null;
let pendingCardEntry = null;
let overlapTeam = "home";
let overlapSelectedPosition = "p1";
let overlapPositionsByTeam = null;
let overlapReturnFocus = null;
let rotationNoticeText = "";
let rotationNoticeTimer = null;
const scoreboardInvert = true;
let activeSfxKey = null;
let pendingSfxKey = null;
let sfxPlaybackToken = 0;
let liveSession = loadLiveSession();
let liveSyncTimer = null;
let liveSyncInFlight = false;
let liveSyncQueued = false;

function loadLiveSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(LIVE_SESSION_KEY) || "null");
    if (!stored || typeof stored !== "object") return null;
    if (!stored.remoteMatchId || !stored.staffToken || !stored.refereeToken || !stored.localMatchId) return null;
    return stored;
  } catch (error) {
    console.warn("Live referee sharing could not be recovered.", error);
    return null;
  }
}

function clearLiveShareSession() {
  if (liveSyncTimer) clearTimeout(liveSyncTimer);
  liveSyncTimer = null;
  liveSession = null;
  try {
    localStorage.removeItem(LIVE_SESSION_KEY);
  } catch (error) {
    console.warn("Live referee sharing could not be cleared.", error);
  }
}

function getLiveConfig() {
  const config = window.IVI_LIVE_CONFIG;
  return config?.functionUrl ? config : null;
}

function scheduleLiveMatchSync() {
  if (!liveSession || !match || liveSession.localMatchId !== match.id) return;
  if (liveSyncInFlight) {
    liveSyncQueued = true;
    return;
  }
  if (liveSyncTimer) clearTimeout(liveSyncTimer);
  liveSyncTimer = setTimeout(() => syncLiveMatch(), 250);
}

async function sendLiveRequest(payload) {
  const config = getLiveConfig();
  if (!config) throw new Error("Live sharing has not been configured.");
  const response = await fetch(config.functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Live sharing request failed.");
  return body;
}

async function syncLiveMatch() {
  if (!liveSession || !match || liveSession.localMatchId !== match.id || liveSyncInFlight) return;
  liveSyncInFlight = true;
  try {
    await sendLiveRequest({
      action: match.status === "finished" ? "finish" : "update",
      match_id: liveSession.remoteMatchId,
      staff_token: liveSession.staffToken,
      match_state: match
    });
  } catch (error) {
    console.warn("Live referee view could not be updated.", error);
  } finally {
    liveSyncInFlight = false;
    if (liveSyncQueued) {
      liveSyncQueued = false;
      scheduleLiveMatchSync();
    }
  }
}

function getRefereeShareLink() {
  if (!liveSession) return "";
  const url = new URL("referee.html", window.location.href);
  url.searchParams.set("match", liveSession.remoteMatchId);
  url.searchParams.set("token", liveSession.refereeToken);
  return url.toString();
}

function renderRefereeQr(link) {
  const target = document.getElementById("refereeQrCode");
  if (!target) return;
  target.innerHTML = "";
  if (window.QRCode) {
    new window.QRCode(target, { text: link, width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M });
  } else {
    target.textContent = "QR unavailable";
  }
}

function showRefereeShareOverlay(message = "Live referee view ready.") {
  const overlay = document.getElementById("refereeShareOverlay");
  const linkInput = document.getElementById("refereeShareLink");
  const status = document.getElementById("refereeShareStatus");
  const link = getRefereeShareLink();
  if (!overlay || !linkInput || !status || !link) return;
  linkInput.value = link;
  status.textContent = message;
  status.classList.remove("error");
  renderRefereeQr(link);
  overlay.classList.remove("hidden");
}

function closeRefereeShareOverlay() {
  document.getElementById("refereeShareOverlay")?.classList.add("hidden");
  document.getElementById("btnShareReferee")?.focus();
}

async function openRefereeShare() {
  if (!match) return;
  const button = document.getElementById("btnShareReferee");
  if (button) button.disabled = true;
  try {
    if (!liveSession || liveSession.localMatchId !== match.id) {
      const created = await sendLiveRequest({ action: "create", match_state: match });
      liveSession = {
        localMatchId: match.id,
        remoteMatchId: created.match_id,
        staffToken: created.staff_token,
        refereeToken: created.referee_token
      };
      localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(liveSession));
    } else {
      await syncLiveMatch();
    }
    showRefereeShareOverlay();
  } catch (error) {
    const status = document.getElementById("refereeShareStatus");
    if (status) {
      status.textContent = error.message || "Could not create the referee link.";
      status.classList.add("error");
    }
    document.getElementById("refereeShareOverlay")?.classList.remove("hidden");
  } finally {
    if (button) button.disabled = false;
  }
}

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
  ace: "audio/Ace Ace.mpeg",
  aceAudio: "audio/aceaudio.mp3",
  block: "audio/Monster Block.mp3",
  boom: "audio/Boom.mp3",
  brasilSil: "audio/Vinheta Brasil Sil Sil - Globo (Anos 2000).mp3",
  champion: "audio/WE ARE THE CHAMPION, SOUND EFFECT.mp3",
  fahhm: "audio/Fahhm.mp3",
  isTime: "audio/istime.mp3"
};
const SFX_LABELS = {
  ace: "Ace Ace 🎯🏐",
  block: "Monster Block 🧱🛑",
  boom: "Boom 🔊💥",
  brasilSil: "Brasil Vibe 🇧🇷"
};
Object.assign(SFX_LABELS, {
  ace: "Ace Ace",
  aceAudio: "Ace Audio",
  block: "Monster Block",
  boom: "Boom",
  brasilSil: "Brasil Vibe",
  champion: "Champion",
  fahhm: "Fahhm",
  isTime: "Is Time"
});

const SFX_VISUALS = {
  ace: { image: "images/sfx/aceace.png", label: "ACE ACE" },
  block: { image: "images/sfx/monsterblock.png", label: "MONSTER BLOCK" },
  boom: { image: "images/sfx/boom.png", label: "BOOM" }
};
const sfxPlayers = Object.fromEntries(
  Object.entries(SFX_TRACKS).map(([key, src]) => [key, new Audio(src)])
);
Object.entries(sfxPlayers).forEach(([key, player]) => {
  player.preload = "auto";
  player.addEventListener("error", () => {
    if (activeSfxKey === key || pendingSfxKey === key) {
      pendingSfxKey = null;
      activeSfxKey = null;
      setSfxButtonState(null);
    }
    console.warn(`Audio file could not be loaded: ${SFX_TRACKS[key]}`);
  });
});

const timeoutAudioCues = {
  start: new Audio("audio/time out.mp3"),
  end: new Audio("audio/times up.mp3")
};
Object.values(timeoutAudioCues).forEach(player => {
  player.preload = "auto";
});

function playTimeoutCue(type) {
  const player = timeoutAudioCues[type];
  if (!player) return;
  player.pause();
  player.currentTime = 0;
  player.play().catch(() => { });
}

function setSfxButtonState(activeKey) {
  activeSfxKey = activeKey || null;
  document.querySelectorAll("[data-sfx-key]").forEach(btn => {
    btn.classList.toggle("sfx-active", btn.dataset.sfxKey === activeKey || btn.dataset.sfxKey === pendingSfxKey);
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
  sfxPlaybackToken++;
  pendingSfxKey = null;
  Object.values(sfxPlayers).forEach(p => {
    p.onended = null;
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

  if (activeSfxKey === key || pendingSfxKey === key || !player.paused) {
    stopAllSfx();
    return;
  }

  stopAllSfx();
  const playToken = ++sfxPlaybackToken;
  pendingSfxKey = key;
  setSfxButtonState(key);
  player.currentTime = 0;
  player.play().then(() => {
    if (playToken !== sfxPlaybackToken) {
      player.pause();
      player.currentTime = 0;
      return;
    }
    pendingSfxKey = null;
    showSfxOnScoreboard(key);
    setSfxButtonState(key);
    player.onended = () => {
      if (playToken !== sfxPlaybackToken) return;
      if (match) {
        match.sfxNotice = null;
        const payload = getScoreboardPayload();
        if (payload) updateScoreboardWindow(payload);
      }
      activeSfxKey = null;
      setSfxButtonState(null);
    };
  }).catch(() => {
    if (playToken !== sfxPlaybackToken) return;
    pendingSfxKey = null;
    setSfxButtonState(null);
  });
}

function getSfxPayload() {
  return {
    type: "audio-panel:update",
    activeKey: activeSfxKey || pendingSfxKey,
    tracks: Object.entries(SFX_TRACKS).map(([key]) => ({ key, label: SFX_LABELS[key] || key }))
  };
}

function updateAudioPanelWindow() {
  if (!audioPanelWindow || audioPanelWindow.closed) return;
  audioPanelWindow.postMessage(getSfxPayload(), APP_ORIGIN);
}

const TEAM_LOGOS = {
  dinosaurs: "images/teams/DINOSAURS_transparent.png",
  dragons: "images/teams/DRAGONS_transparent.png",
  lynx: "images/teams/LYNX_transparent.png",
  phoenix: "images/teams/PHOENIX_transparent.png",
  ravens: "images/teams/RAVENS_transparent.png",
  vixen: "images/teams/VIXEN_transparent.png"
};

const TEAM_LOGO_ALIASES = {
  "ivi dinosaurs": "dinosaurs",
  "ivi dragons": "dragons",
  "ivi lynx": "lynx",
  "ivi phoenix": "phoenix",
  "ivi ravens": "ravens",
  "ivi vixen": "vixen"
};

const VISITOR_TEAM_LOGOS = {
  visitors: "images/Visitor teams/Visitors.png"
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
  if (TEAM_LOGOS[aliasKey]) return TEAM_LOGOS[aliasKey];
  if (VISITOR_TEAM_LOGOS[key]) return VISITOR_TEAM_LOGOS[key];
  return "";
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
    imgEl.removeAttribute("src");
  };
}

function createNewMatch() {
  clearLiveShareSession();
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
    tieBreakEightPointSwitchDone: false,
    events: [],
    homeSystem: "5-1",
    awaySystem: "5-1",
    homeRoleMap: {},
    awayRoleMap: {},

    // Lineups / rotation
    homeRoster: [],
    awayRoster: [],
    homeRosterSlots: Array(14).fill(null),
    awayRosterSlots: Array(14).fill(null),
    homeLiberos: [],
    awayLiberos: [],
    homeBaseRotation: [null, null, null, null, null, null],
    awayBaseRotation: [null, null, null, null, null, null],
    homeRotationCount: 0,
    awayRotationCount: 0,
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
    maxSubsPerSet: 8,
    homeSubstitutionPairs: [],
    awaySubstitutionPairs: [],
    homePlayerNames: {},
    awayPlayerNames: {},
    serverVerification: { home: null, away: null },

    // Timers
    matchStartTime: null, // ISO string
    matchEndTime: null,
    timeoutTeam: null,  // "home" | "away" | null
    timeoutEnd: null,   // timestamp ms
    timeoutCountdownStart: null,
    timeoutEndCuePlayed: false,
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

function resetServerVerification() {
  if (!match) return;
  match.serverVerification = { home: null, away: null };
}

function showRotationNotice(team) {
  const rotation = team === "home" ? match.homeBaseRotation : match.awayBaseRotation;
  const teamName = team === "home" ? match.homeTeam : match.awayTeam;
  const server = getServeOrder(rotation || [])[0];
  rotationNoticeText = server
    ? `${teamName} rotated. #${server} is expected to serve.`
    : `${teamName} rotated. Set the lineup to verify the server.`;
  if (rotationNoticeTimer) clearTimeout(rotationNoticeTimer);
  rotationNoticeTimer = setTimeout(() => {
    rotationNoticeText = "";
    const notice = document.getElementById("rotationNotice");
    if (notice) notice.classList.add("hidden");
  }, 4500);
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

function legacySetLineups() {
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
  match.homeRotationCount = 0;

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
  match.awayRotationCount = 0;

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
  resetServerVerification();

  saveMatchToStorage();
  renderAll();
  addEvent("SYSTEM", "Lineups and libero settings updated.");
}

const STARTING_POSITION_LAYOUT = [
  { label: "P4", index: 3 },
  { label: "P3", index: 2 },
  { label: "P2", index: 1 },
  { label: "P5", index: 4 },
  { label: "P6", index: 5 },
  { label: "P1", index: 0 }
];

const FIVE_ONE_ROLE_FIELDS = [
  { key: "setter", label: "Setter" },
  { key: "opposite", label: "Opposite" },
  { key: "middleOne", label: "M1" },
  { key: "middleTwo", label: "M2" },
  { key: "hitterOne", label: "H1" },
  { key: "hitterTwo", label: "H2" }
];

function sanitizeJerseyInput(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 2);
}

function getStoredRosterSlots(team) {
  const slotsKey = team === "home" ? "homeRosterSlots" : "awayRosterSlots";
  const rosterKey = team === "home" ? "homeRoster" : "awayRoster";
  const liberosKey = team === "home" ? "homeLiberos" : "awayLiberos";
  const slots = Array.isArray(match[slotsKey]) ? match[slotsKey].slice(0, 14) : [];
  while (slots.length < 14) slots.push(null);
  if (slots.some(Boolean)) return slots;

  const liberos = Array.isArray(match[liberosKey]) && match[liberosKey].length
    ? match[liberosKey]
    : [team === "home" ? match.homeLibero : match.awayLibero].filter(Boolean);
  const regular = (match[rosterKey] || []).filter(number => !liberos.includes(number)).slice(0, 12);
  return [...regular, ...Array(Math.max(0, 12 - regular.length)).fill(null), liberos[0] || null, liberos[1] || null];
}

function createNumberInput(id, label, value, className, data = {}) {
  const field = document.createElement("div");
  field.className = className;
  const labelElement = document.createElement("label");
  labelElement.htmlFor = id;
  labelElement.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.value = value || "";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = 2;
  input.setAttribute("pattern", "[0-9]*");
  Object.entries(data).forEach(([key, dataValue]) => { input.dataset[key] = dataValue; });
  input.addEventListener("input", () => {
    sanitizeJerseyInput(input);
    if (Number(input.dataset.rosterSlot) >= 12) updateLiberoSelectOptions(input.dataset.team);
    if (input.dataset.rotationIndex !== undefined) {
      const currentStarting = Array(6).fill(null);
      document.querySelectorAll(`#${input.dataset.team}StartingInputs input`).forEach(startingInput => {
        currentStarting[Number(startingInput.dataset.rotationIndex)] = startingInput.value.trim() || null;
      });
      renderFiveOneRoleMap(input.dataset.team, currentStarting);
    }
    validateLineupTeam(input.dataset.team);
    const status = document.getElementById("lineupSaveStatus");
    if (status) {
      status.textContent = "";
      status.className = "lineup-save-status";
    }
  });
  field.append(labelElement, input);
  return field;
}

function updateLiberoSelectOptions(team) {
  const select = document.getElementById(`${team}ActiveLibero`);
  if (!select) return;
  const previous = select.value;
  const liberoEntries = [13, 14]
    .map((slot, index) => ({
      label: `L${index + 1}`,
      number: document.getElementById(`${team}Roster${slot}`)?.value.trim()
    }))
    .filter(entry => entry.number);
  const liberoNumbers = liberoEntries.map(entry => entry.number);
  select.innerHTML = "";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "None";
  select.appendChild(noneOption);
  liberoEntries.forEach(entry => {
    const option = document.createElement("option");
    option.value = entry.number;
    option.textContent = `${entry.label} #${entry.number}`;
    select.appendChild(option);
  });
  select.value = liberoNumbers.includes(previous) ? previous : (liberoNumbers[0] || "");
}

function renderLiberoAssignment(team) {
  const container = document.getElementById(`${team}LiberoAssignment`);
  const activeLibero = match[`${team}Libero`] || "";
  const partner = match[`${team}LiberoPartner`] || "";
  const partner2 = match[`${team}LiberoPartner2`] || "";
  container.innerHTML = "";

  const activeField = document.createElement("div");
  activeField.className = "libero-assignment-field";
  const activeLabel = document.createElement("label");
  activeLabel.htmlFor = `${team}ActiveLibero`;
  activeLabel.textContent = "Active libero";
  const activeSelect = document.createElement("select");
  activeSelect.id = `${team}ActiveLibero`;
  activeSelect.dataset.team = team;
  activeSelect.addEventListener("change", () => validateLineupTeam(team));
  activeField.append(activeLabel, activeSelect);

  function createPartnerField(idSuffix, labelText, value) {
    const field = document.createElement("div");
    field.className = "libero-assignment-field";
    const label = document.createElement("label");
    label.htmlFor = `${team}${idSuffix}`;
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = `${team}${idSuffix}`;
    input.value = value;
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = 2;
    input.setAttribute("pattern", "[0-9]*");
    input.addEventListener("input", () => {
      sanitizeJerseyInput(input);
      validateLineupTeam(team);
    });
    field.append(label, input);
    return field;
  }

  container.append(
    activeField,
    createPartnerField("LiberoPartner", "Replaces #1", partner),
    createPartnerField("LiberoPartner2", "Replaces #2", partner2)
  );
  updateLiberoSelectOptions(team);
  if (Array.from(activeSelect.options).some(option => option.value === activeLibero)) {
    activeSelect.value = activeLibero;
  }
}

function renderLineupEditor(team) {
  if (!match) return;
  const rosterContainer = document.getElementById(`${team}RosterInputs`);
  const startingContainer = document.getElementById(`${team}StartingInputs`);
  const title = document.getElementById(`${team}LineupEditorTitle`);
  const isHome = team === "home";
  const slots = getStoredRosterSlots(team);
  const starting = (isHome ? match.homeStartingSix : match.awayStartingSix) || [];
  const values = starting.some(Boolean) ? starting : slots.slice(0, 6);

  title.textContent = isHome ? match.homeTeam : match.awayTeam;
  rosterContainer.innerHTML = "";
  slots.forEach((value, index) => {
    const isLibero = index >= 12;
    rosterContainer.appendChild(createNumberInput(
      `${team}Roster${index + 1}`,
      isLibero ? `L${index - 11}` : String(index + 1),
      value,
      `lineup-number-field${isLibero ? " libero" : ""}`,
      { team, rosterSlot: String(index) }
    ));
  });
  renderLiberoAssignment(team);

  startingContainer.innerHTML = "";
  STARTING_POSITION_LAYOUT.forEach(position => {
    startingContainer.appendChild(createNumberInput(
      `${team}Start${position.label}`,
      position.label,
      values[position.index],
      "starting-position-field",
      { team, rotationIndex: String(position.index) }
    ));
  });
  renderFiveOneRoleMap(team, values);
  validateLineupTeam(team);
}

function renderFiveOneRoleMap(team, starting) {
  const container = document.getElementById(`${team}RoleMap`);
  if (!container) return;
  const system = match[team === "home" ? "homeSystem" : "awaySystem"];
  container.classList.toggle("hidden", system === "6-0");
  if (system === "6-0") return;

  const existingSelections = Object.fromEntries(FIVE_ONE_ROLE_FIELDS
    .map(({ key }) => [key, document.getElementById(`${team}Role${key}`)?.value])
    .filter(([, value]) => value !== undefined));
  const roleMap = { ...(match[`${team}RoleMap`] || {}), ...existingSelections };
  const eligiblePlayers = [...new Set(starting.filter(Boolean))];
  container.innerHTML = "";
  const title = document.createElement("div");
  title.className = "five-one-role-map-title";
  title.textContent = "5-1 court roles";
  container.appendChild(title);

  FIVE_ONE_ROLE_FIELDS.forEach(({ key, label }) => {
    const field = document.createElement("div");
    field.className = "five-one-role-field";
    const fieldLabel = document.createElement("label");
    fieldLabel.htmlFor = `${team}Role${key}`;
    fieldLabel.textContent = label;
    const select = document.createElement("select");
    select.id = `${team}Role${key}`;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "#";
    select.appendChild(placeholder);
    eligiblePlayers.forEach(number => {
      const option = document.createElement("option");
      option.value = number;
      option.textContent = `#${number}`;
      select.appendChild(option);
    });
    if (eligiblePlayers.includes(roleMap[key])) select.value = roleMap[key];
    select.addEventListener("change", () => validateLineupTeam(team));
    field.append(fieldLabel, select);
    container.appendChild(field);
  });
}

function collectLineupTeam(team) {
  const rosterInputs = Array.from(document.querySelectorAll(`#${team}RosterInputs input`));
  const startingInputs = Array.from(document.querySelectorAll(`#${team}StartingInputs input`));
  const slots = rosterInputs.map(input => input.value.trim() || null);
  const starting = Array(6).fill(null);
  startingInputs.forEach(input => {
    starting[Number(input.dataset.rotationIndex)] = input.value.trim() || null;
  });
  return {
    slots,
    regular: slots.slice(0, 12).filter(Boolean),
    liberos: slots.slice(12, 14).filter(Boolean),
    starting,
    activeLibero: document.getElementById(`${team}ActiveLibero`)?.value || null,
    liberoPartner: document.getElementById(`${team}LiberoPartner`)?.value.trim() || null,
    liberoPartner2: document.getElementById(`${team}LiberoPartner2`)?.value.trim() || null,
    roleMap: Object.fromEntries(FIVE_ONE_ROLE_FIELDS.map(({ key }) => [
      key,
      document.getElementById(`${team}Role${key}`)?.value || null
    ]))
  };
}

function validateLineupTeam(team) {
  const validation = document.getElementById(`${team}LineupValidation`);
  if (!validation) return { valid: false, data: null };
  const data = collectLineupTeam(team);
  const allNumbers = [...data.regular, ...data.liberos];
  const duplicates = allNumbers.filter((number, index) => allNumbers.indexOf(number) !== index);
  const issues = [];
  if (data.regular.length < 6) issues.push("Enter at least 6 squad numbers.");
  if (duplicates.length) issues.push(`Duplicated: ${[...new Set(duplicates)].join(", ")}.`);
  if (data.starting.some(number => !number)) issues.push("Fill all 6 starting positions.");
  const repeatedStarters = data.starting.filter((number, index) => number && data.starting.indexOf(number) !== index);
  if (repeatedStarters.length) issues.push("Starting positions must be unique.");
  const outsideRoster = data.starting.filter(number => number && !data.regular.includes(number));
  if (outsideRoster.length) issues.push(`Starting player not in slots 1-12: ${[...new Set(outsideRoster)].join(", ")}.`);
  if (data.liberos.length && !data.activeLibero) issues.push("Choose the active libero.");
  if (data.activeLibero && !data.liberos.includes(data.activeLibero)) issues.push("Active libero must be L1 or L2.");
  if (data.activeLibero && !data.liberoPartner) issues.push("Choose at least one player for the libero to replace.");
  const replacementPlayers = [data.liberoPartner, data.liberoPartner2].filter(Boolean);
  if (!data.activeLibero && replacementPlayers.length) issues.push("Choose an active libero or clear the replacement fields.");
  const invalidPartners = replacementPlayers.filter(number => !data.starting.includes(number));
  if (invalidPartners.length) issues.push(`Libero replacement must be in the starting six: ${[...new Set(invalidPartners)].join(", ")}.`);
  if (replacementPlayers.length === 2 && replacementPlayers[0] === replacementPlayers[1]) {
    issues.push("Libero replacement players must be different.");
  }
  const system = match[team === "home" ? "homeSystem" : "awaySystem"];
  if (system !== "6-0") {
    const roleNumbers = Object.values(data.roleMap);
    if (roleNumbers.some(number => !number)) issues.push("Assign all 5-1 court roles.");
    const duplicateRoles = roleNumbers.filter((number, index) => number && roleNumbers.indexOf(number) !== index);
    if (duplicateRoles.length) issues.push("Each 5-1 court role must use a different starter.");
    const invalidRoles = roleNumbers.filter(number => number && !data.starting.includes(number));
    if (invalidRoles.length) issues.push("5-1 court roles must be starters.");
  }

  validation.textContent = issues.length ? issues.join(" ") : "Lineup ready.";
  validation.className = `lineup-validation ${issues.length ? "error" : "ok"}`;
  return { valid: issues.length === 0, data };
}

function openLineupWorkspace() {
  if (!match) return;
  document.getElementById("lineupWorkspace")?.classList.remove("hidden");
  document.getElementById("rightWorkspace")?.classList.add("lineup-open");
  document.getElementById("btnLineups")?.setAttribute("aria-expanded", "true");
  renderLineupEditor("home");
  renderLineupEditor("away");
  renderRotation();
}

function closeLineupWorkspace() {
  document.getElementById("lineupWorkspace")?.classList.add("hidden");
  document.getElementById("rightWorkspace")?.classList.remove("lineup-open");
  document.getElementById("btnLineups")?.setAttribute("aria-expanded", "false");
  document.getElementById("btnLineups")?.focus();
}

function setLineups() {
  const workspace = document.getElementById("lineupWorkspace");
  if (workspace?.classList.contains("hidden")) openLineupWorkspace();
  else closeLineupWorkspace();
}

function saveLineupsFromWorkspace() {
  if (!match) return;
  const homeResult = validateLineupTeam("home");
  const awayResult = validateLineupTeam("away");
  const saveStatus = document.getElementById("lineupSaveStatus");
  if (!homeResult.valid || !awayResult.valid) {
    saveStatus.textContent = "Correct the lineup information before saving.";
    saveStatus.className = "lineup-save-status error";
    document.querySelector(".lineup-validation.error")?.closest(".lineup-team-editor")?.querySelector("input")?.focus();
    return;
  }

  [["home", homeResult.data], ["away", awayResult.data]].forEach(([team, data]) => {
    match[`${team}RosterSlots`] = data.slots;
    match[`${team}Roster`] = [...data.regular, ...data.liberos];
    match[`${team}Liberos`] = data.liberos;
    match[`${team}Libero`] = data.activeLibero || null;
    match[`${team}Libero2`] = data.liberos[1] || null;
    match[`${team}LiberoPartner`] = data.liberoPartner || null;
    match[`${team}LiberoPartner2`] = data.liberoPartner2 || null;
    match[`${team}RoleMap`] = data.roleMap;
    match[`${team}BaseRotation`] = data.starting.slice();
    match[`${team}StartingSix`] = data.starting.slice();
    match[`${team}RotationCount`] = 0;
    syncPlayerNamesWithRoster(team);
  });

  updateCurrentCourt("home");
  updateCurrentCourt("away");
  resetServerVerification();
  saveMatchToStorage();
  addEvent("SYSTEM", "Lineups and libero numbers updated.");
  saveStatus.textContent = "Lineups saved.";
  saveStatus.className = "lineup-save-status ok";
  renderAll();
}

function confirmLineupsForNextSet() {
  if (!match) return;
  if (match.homeStartingSix && match.homeStartingSix.length === 6) {
    match.homeBaseRotation = match.homeStartingSix.slice();
    match.homeRotationCount = 0;
  }
  if (match.awayStartingSix && match.awayStartingSix.length === 6) {
    match.awayBaseRotation = match.awayStartingSix.slice();
    match.awayRotationCount = 0;
  }
  updateCurrentCourt("home");
  updateCurrentCourt("away");
  resetServerVerification();
  saveMatchToStorage();
  renderAll();
}

function rotateBaseOnce(team) {
  const baseKey = team === "home" ? "homeBaseRotation" : "awayBaseRotation";
  const rotationCountKey = team === "home" ? "homeRotationCount" : "awayRotationCount";
  const arr = match[baseKey];
  if (!arr || arr.length !== 6) return;
  // Rotation is clockwise: 2->1, 3->2, 4->3, 5->4, 6->5, 1->6
  arr.push(arr.shift());
  match[rotationCountKey] = ((match[rotationCountKey] || 0) + 1) % 6;
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
  const result = getCourtWithLibero(base, liberoNum, partners, match.serving === team);
  match[courtKey] = result.court;
  match[liberoPosKey] = result.liberoPos;
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
    resetServerVerification();
    showRotationNotice(team);
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
  const pairsKey = team === "home" ? "homeSubstitutionPairs" : "awaySubstitutionPairs";
  const liberoNumbers = team === "home" ? match.homeLiberos : match.awayLiberos;
  const maxSubs = 8;

  const currentCourt = match[courtKey] || [];
  const onCourt = currentCourt.filter(number => number && !liberoNumbers.includes(number));
  const activeLineup = match[baseKey] || [];
  const pairs = Array.isArray(match[pairsKey]) ? match[pairsKey] : [];
  match[pairsKey] = pairs;

  if ((match[subsKey] || 0) >= maxSubs) {
    alert("This team has used all 8 substitutions for this set.");
    return;
  }

  const outStr = prompt(`Choose OUT (on court, excluding libero): ${onCourt.join(", ")}`);
  if (!outStr) return;
  const outNum = outStr.trim();
  if (!onCourt.includes(outNum)) {
    alert("Choose a non-libero player currently on court.");
    return;
  }

  const outPair = pairs.find(pair => pair.original === outNum || pair.replacement === outNum);
  if (outPair?.closed) {
    alert(`#${outNum} has completed its substitution pair for this set.`);
    return;
  }

  const regularRoster = (roster || []).filter(number => number && !liberoNumbers.includes(number));
  const bench = regularRoster.filter(number => !activeLineup.includes(number));
  const inStr = prompt(`Choose IN (bench): ${bench.join(", ")}`);
  if (!inStr) return;
  const inNum = inStr.trim();
  if (!bench.includes(inNum)) {
    alert("Choose a non-libero player from the bench.");
    return;
  }

  let pairAction = "first";
  if (outPair) {
    if (outPair.replacement !== outNum || outPair.original !== inNum) {
      alert(`#${outNum} can only be replaced by #${outPair.original} this set.`);
      return;
    }
    pairAction = "return";
  } else if (pairs.some(pair => pair.original === inNum || pair.replacement === inNum)) {
    alert(`#${inNum} is already part of a substitution pair for this set.`);
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
  if (pairAction === "first") {
    pairs.push({ original: outNum, replacement: inNum, closed: false });
  } else {
    outPair.closed = true;
  }
  resetServerVerification();

  addEvent("SUB", `Sub ${team === "home" ? match.homeTeam : match.awayTeam}: OUT #${outNum}, IN #${inNum}`, team, {
    out: outNum,
    in: inNum,
    subsUsed: match[subsKey],
    pairAction,
    pairOriginal: pairAction === "first" ? outNum : outPair.original,
    pairReplacement: pairAction === "first" ? inNum : outPair.replacement
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
      const rotationCountKey = team === "home" ? "homeRotationCount" : "awayRotationCount";
      const arr = match[baseKey];
      if (arr && arr.length === 6) {
        // reverse rotation of rotateBaseOnce (counter-clockwise)
        arr.unshift(arr.pop());
        match[rotationCountKey] = ((match[rotationCountKey] || 0) + 5) % 6;
        updateCurrentCourt(team);
      }
      match.serving = last.prevServing;
      resetServerVerification();
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
    match.timeoutCountdownStart = null;
    match.timeoutEndCuePlayed = false;
    document.getElementById("timeoutTimer").textContent = "--";
  } else if (last.type === "CARD") {
    match.cardNotice = null;
  } else if (last.type === "SUB") {
    const team = last.team;
    const baseKey = team === "home" ? "homeBaseRotation" : "awayBaseRotation";
    const courtKey = team === "home" ? "homeCourt" : "awayCourt";
    const subsKey = team === "home" ? "homeSubsUsed" : "awaySubsUsed";
    const pairsKey = team === "home" ? "homeSubstitutionPairs" : "awaySubstitutionPairs";
    const baseIndex = match[baseKey]?.indexOf(last.in);
    const courtIndex = match[courtKey]?.indexOf(last.in);
    if (baseIndex >= 0) match[baseKey][baseIndex] = last.out;
    if (courtIndex >= 0) match[courtKey][courtIndex] = last.out;
    match[subsKey] = Math.max(0, (match[subsKey] || 0) - 1);

    const pairs = match[pairsKey] || [];
    const pairIndex = pairs.findIndex(pair =>
      pair.original === last.pairOriginal && pair.replacement === last.pairReplacement
    );
    if (pairIndex >= 0) {
      if (last.pairAction === "return") pairs[pairIndex].closed = false;
      else pairs.splice(pairIndex, 1);
    }
    updateCurrentCourt(team);
    resetServerVerification();
  } else if (last.type === "SIDE_SWITCH") {
    match.homeOnLeft = !match.homeOnLeft;
    match.tieBreakEightPointSwitchDone = Boolean(last.previousTieBreakEightPointSwitchDone);
    syncNamesToOBS();
  } else if (last.type === "END_SET" || last.type === "END_MATCH") {
    // For simplicity, do not fully undo set/match end here
    alert("Undo for end of set/match is not fully supported. Last event removed from log only.");
  }

  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
}

const {
  getSetCompletion,
  getMatchScoreAfterSet,
  getServeOrder,
  evaluateOverlapPositions,
  getCourtWithLibero
} = window.matchRules;

function finalizeCurrentSet() {
  const set = match.sets[match.sets.length - 1];
  if (set.winner) return true;

  const completion = getSetCompletion(set);
  if (!completion.valid) {
    alert(completion.message);
    return false;
  }

  set.winner = completion.winner;
  if (set.winner === "home") match.homeSetsWon++;
  else match.awaySetsWon++;

  addEvent(
    "END_SET",
    `End of set ${set.setNumber}: ${match.homeTeam} ${set.homePoints} – ${set.awayPoints} ${match.awayTeam}`
  );
  return true;
}

function finishMatch() {
  match.status = "finished";
  match.matchEndTime = new Date().toISOString();
  addEvent("END_MATCH", `Match finished: ${match.homeTeam} ${match.homeSetsWon} - ${match.awaySetsWon} ${match.awayTeam}`);
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
  syncNamesToOBS();
  showMatchSummary();
}

function endCurrentSet() {
  if (!match) return;
  if (!finalizeCurrentSet()) return;

  const needed = Math.ceil(match.bestOf / 2); // 3 in best of 5
  if (match.homeSetsWon >= needed || match.awaySetsWon >= needed || match.currentSet >= match.bestOf) {
    finishMatch();
    return;
  }

  match.currentSet++;
  match.homeTimeouts = 0;
  match.awayTimeouts = 0;
  match.homeSubsUsed = 0;
  match.awaySubsUsed = 0;
  match.homeSubstitutionPairs = [];
  match.awaySubstitutionPairs = [];
  match.homeRotationCount = 0;
  match.awayRotationCount = 0;
  match.tieBreakEightPointSwitchDone = false;
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
  resetServerVerification();

  // Ask to confirm or re-enter lineups before the next set starts
  confirmLineupsForNextSet();

  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
  syncNamesToOBS();
}

function endMatchManually() {
  if (!match || match.status === "finished") return;
  if (!confirm("End match now?")) return;

  const set = match.sets[match.sets.length - 1];
  const completion = set.winner ? { valid: true, winner: set.winner } : getSetCompletion(set);
  if (!completion.valid) {
    alert(completion.message);
    return;
  }

  const prospectiveScore = getMatchScoreAfterSet(
    match.homeSetsWon,
    match.awaySetsWon,
    completion.winner,
    Boolean(set.winner)
  );
  const needed = Math.ceil(match.bestOf / 2);
  if (prospectiveScore.homeSetsWon < needed && prospectiveScore.awaySetsWon < needed) {
    alert(`The match cannot end yet. A team must win ${needed} sets. Use End Set to continue the match.`);
    return;
  }

  if (!finalizeCurrentSet()) return;
  finishMatch();
}

function switchCourtSides() {
  if (!match || match.status === "finished" || match.currentSet !== 5) return;
  const set = match.sets[match.sets.length - 1];
  const previousTieBreakEightPointSwitchDone = Boolean(match.tieBreakEightPointSwitchDone);
  match.homeOnLeft = !match.homeOnLeft;
  if (Math.max(set.homePoints, set.awayPoints) >= 8) {
    match.tieBreakEightPointSwitchDone = true;
  }
  addEvent("SIDE_SWITCH", "Teams switched court sides in the deciding set.", null, {
    previousTieBreakEightPointSwitchDone
  });
  saveMatchToStorage();
  renderAll();
  syncScoreToOBS();
  syncNamesToOBS();
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
  match.timeoutCountdownStart = now + 4 * 1000;
  match.timeoutEnd = match.timeoutCountdownStart + 30 * 1000; // 4-second intro, then 30-second timeout
  match.timeoutEndCuePlayed = false;
  playTimeoutCue("start");
  timeoutTimerInterval = setInterval(updateTimeoutTimerDisplay, 200);
  updateTimeoutTimerDisplay();
}

function getTimeoutRemainingMs(now = Date.now()) {
  if (!match || !match.timeoutEnd || !match.timeoutTeam) return 0;
  const countdownStart = match.timeoutCountdownStart || (match.timeoutEnd - 30 * 1000);
  if (now < countdownStart) return 30 * 1000;
  return Math.max(0, match.timeoutEnd - now);
}

function updateTimeoutTimerDisplay() {
  const el = document.getElementById("timeoutTimer");
  if (!match || !match.timeoutEnd || !match.timeoutTeam) {
    el.textContent = "--";
    const payload = getScoreboardPayload();
    if (payload) updateScoreboardWindow(payload);
    return;
  }
  const remaining = getTimeoutRemainingMs();
  if (remaining <= 0) {
    el.textContent = "00:00";
    clearInterval(timeoutTimerInterval);
    timeoutTimerInterval = null;
    match.timeoutTeam = null;
    match.timeoutEnd = null;
    match.timeoutCountdownStart = null;
    match.timeoutEndCuePlayed = false;
    saveMatchToStorage();
    const payload = getScoreboardPayload();
    if (payload) updateScoreboardWindow(payload);
    return;
  }
  const remainingSeconds = Math.ceil(remaining / 1000);
  if (remainingSeconds <= 3 && !match.timeoutEndCuePlayed) {
    match.timeoutEndCuePlayed = true;
    playTimeoutCue("end");
  }
  el.textContent = "00:" + String(remainingSeconds).padStart(2, "0");
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
    .join("\n");

  const cards = (match.events || []).filter(ev => ev.type === "CARD");
  const cardLines = cards.length
    ? cards.map(c => c.text).join("\n")
    : "None";

  resEl.textContent = `${match.homeTeam} ${match.homeSetsWon} - ${match.awaySetsWon} ${match.awayTeam}`;
  setsEl.textContent = setLines;
  durEl.textContent = formatMatchSummaryDuration();
  idEl.textContent = `Match ID: ${match.id || "-"}`;
  cardsEl.textContent = cardLines;

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
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = `[${ts}]`;
    const set = document.createElement("strong");
    set.textContent = `S${ev.setNumber}`;
    li.append(time, document.createTextNode(" "), set, document.createTextNode(` - ${ev.text}`));
    list.appendChild(li);
  });
  list.scrollTop = list.scrollHeight;
}

function toggleTimeline() {
  const panel = document.getElementById("timelinePanel");
  const button = document.getElementById("btnToggleTimeline");
  if (!panel || !button) return;

  const expanded = panel.classList.toggle("expanded");
  button.textContent = expanded ? "Collapse" : "Expand";
  button.setAttribute("aria-expanded", String(expanded));

  const list = document.getElementById("logList");
  if (list) list.scrollTop = list.scrollHeight;
}

function renderRotation() {
  const homeGrid = document.getElementById("homeRotationGrid");
  const awayGrid = document.getElementById("awayRotationGrid");
  homeGrid.innerHTML = "";
  awayGrid.innerHTML = "";

  if (!match) return;

  const notice = document.getElementById("rotationNotice");
  if (notice) {
    notice.textContent = rotationNoticeText;
    notice.classList.toggle("hidden", !rotationNoticeText);
  }

  const homeCourt = match.homeCourt || [];
  const awayCourt = match.awayCourt || [];
  const displayOrder = [3, 2, 1, 4, 5, 0];
  const labels = ["P1", "P2", "P3", "P4", "P5", "P6"];

  function renderTeamRotation(team, grid, court) {
    const isHome = team === "home";
    const base = isHome ? match.homeBaseRotation : match.awayBaseRotation;
    const libero = isHome ? match.homeLibero : match.awayLibero;
    const liberos = isHome ? match.homeLiberos : match.awayLiberos;
    const liberoPos = isHome ? match.homeLiberoPos : match.awayLiberoPos;
    const isServing = match.serving === team;
    const order = getServeOrder(base || []);
    const hasLineup = order.length === 6 && order.every(Boolean);
    const panel = document.getElementById(`${team}RotationPanel`);
    const state = document.getElementById(`${team}ServeState`);
    const systemSelect = document.getElementById(`${team}SystemSelect`);
    const input = document.getElementById(`${team}ServerInput`);
    const verifyButton = document.querySelector(`[data-verify-server="${team}"]`);

    displayOrder.forEach(i => {
      const cell = document.createElement("div");
      cell.className = "rot-pos";
      cell.dataset.position = labels[i].toLowerCase();
      const positionLabel = document.createElement("span");
      positionLabel.className = "rot-pos-label";
      positionLabel.textContent = labels[i];
      const player = document.createElement("strong");
      player.className = "rot-pos-player";
      player.textContent = court[i] || "-";
      cell.append(positionLabel, player);
      if (libero && liberoPos === i) cell.classList.add("libero-active");
      if (isServing && i === 0) cell.classList.add("server-active");
      grid.appendChild(cell);
    });

    panel.classList.toggle("is-serving", isServing);
    state.textContent = isServing ? "Serving" : "Receiving";
    document.getElementById(`${team}RotationTitle`).textContent = isHome ? match.homeTeam : match.awayTeam;
    systemSelect.value = (isHome ? match.homeSystem : match.awaySystem) === "6-0" ? "6-0" : "5-1";
    document.getElementById(`${team}CurrentServer`).textContent =
      isServing && hasLineup ? `#${order[0]}` : "--";
    const next = hasLineup ? order.slice(1, 3).map(n => `#${n}`).join(", ") : "--";
    document.getElementById(`${team}NextServers`).textContent = next || "--";
    const reserveLiberos = Array.isArray(liberos) ? liberos.filter(number => number !== libero) : [];
    document.getElementById(`${team}LiberoLabel`).textContent = libero
      ? `#${libero} active${reserveLiberos.length ? ` / #${reserveLiberos.join(", #")}` : ""}`
      : "--";

    input.disabled = !isServing || !hasLineup;
    verifyButton.disabled = !isServing || !hasLineup;
    const verification = match.serverVerification?.[team] || null;
    const result = document.getElementById(`${team}ServerResult`);
    if (verification) {
      input.value = verification.observed;
      result.textContent = verification.valid
        ? `Correct: #${verification.expected}`
        : `Mismatch: expected #${verification.expected}`;
      result.className = `server-check-result ${verification.valid ? "ok" : "error"}`;
    } else {
      if (document.activeElement !== input) input.value = "";
      result.textContent = !hasLineup ? "Set lineup first" : (isServing ? "Not checked" : "Available when serving");
      result.className = "server-check-result";
    }
  }

  renderTeamRotation("home", homeGrid, homeCourt);
  renderTeamRotation("away", awayGrid, awayCourt);

  const hasBothLineups = [match.homeBaseRotation, match.awayBaseRotation]
    .every(rotation => getServeOrder(rotation || []).length === 6 && rotation.every(Boolean));
  document.getElementById("rotationEmptyState")?.classList.toggle("hidden", hasBothLineups);
  renderServeReceiveExample();
}

function renderServeReceiveExample() {
  const section = document.getElementById("serveReceiveExample");
  const teamLabel = document.getElementById("serveReceiveTeam");
  const caption = document.getElementById("serveReceiveCaption");
  if (!section || !teamLabel || !caption || !match) return;

  const receivingTeam = match.serving === "home" ? "away" : "home";
  const teamName = receivingTeam === "home" ? match.homeTeam : match.awayTeam;
  const system = receivingTeam === "home" ? match.homeSystem : match.awaySystem;
  section.classList.toggle("hidden", system === "6-0");
  if (system === "6-0") return;
  const rotationCount = receivingTeam === "home" ? match.homeRotationCount : match.awayRotationCount;
  const rotationNumber = ((rotationCount || 0) % 6) + 1;
  const hasConfiguredTemplate = rotationNumber <= 6;

  section.dataset.receivingTeam = receivingTeam;
  section.dataset.template = `rotation-${rotationNumber}`;
  section.classList.toggle("receive-template-pending", !hasConfiguredTemplate);
  teamLabel.textContent = `${teamName} receiving`;
  caption.textContent = hasConfiguredTemplate
    ? `5-1 receive plan · Rotation ${rotationNumber}.`
    : `Rotation ${rotationNumber} receive plan has not been configured yet.`;
  const roleMap = receivingTeam === "home" ? match.homeRoleMap : match.awayRoleMap;
  const libero = receivingTeam === "home" ? match.homeLibero : match.awayLibero;
  section.querySelectorAll(".receive-player[data-role]").forEach(player => {
    const number = player.dataset.role === "libero"
      ? libero
      : getActiveRoleNumber(receivingTeam, roleMap?.[player.dataset.role]);
    player.querySelector("strong").textContent = number ? `#${number}` : "--";
  });
}

function getActiveRoleNumber(team, roleNumber) {
  if (!roleNumber || !match) return roleNumber;
  const pairs = team === "home" ? match.homeSubstitutionPairs : match.awaySubstitutionPairs;
  const activePair = (pairs || []).find(pair => pair.original === roleNumber && !pair.closed);
  return activePair ? activePair.replacement : roleNumber;
}

function setTeamSystem(team, system) {
  if (!match) return;
  match[team === "home" ? "homeSystem" : "awaySystem"] = system === "6-0" ? "6-0" : "5-1";
  saveMatchToStorage();
  renderRotation();
}

function verifyServer(team) {
  if (!match || match.serving !== team) return;
  const input = document.getElementById(`${team}ServerInput`);
  const base = team === "home" ? match.homeBaseRotation : match.awayBaseRotation;
  const expected = getServeOrder(base || [])[0] || "";
  const observed = String(input?.value || "").trim().replace(/^#/, "");
  if (!expected || !observed) {
    const result = document.getElementById(`${team}ServerResult`);
    if (result) {
      result.textContent = expected ? "Enter the visible server number." : "Set lineup first.";
      result.className = "server-check-result error";
    }
    return;
  }

  match.serverVerification = match.serverVerification || { home: null, away: null };
  match.serverVerification[team] = {
    observed,
    expected,
    valid: observed.toLowerCase() === expected.toLowerCase()
  };
  saveMatchToStorage();
  renderRotation();
}

const DEFAULT_OVERLAP_POSITIONS = {
  p4: { x: 20, y: 31 },
  p3: { x: 50, y: 31 },
  p2: { x: 80, y: 31 },
  p5: { x: 20, y: 72 },
  p6: { x: 50, y: 72 },
  p1: { x: 80, y: 72 }
};

function copyDefaultOverlapPositions() {
  return Object.fromEntries(
    Object.entries(DEFAULT_OVERLAP_POSITIONS).map(([key, value]) => [key, { ...value }])
  );
}

function getOverlapPlayer(team, positionKey) {
  const court = team === "home" ? match.homeCourt : match.awayCourt;
  const index = Number(positionKey.slice(1)) - 1;
  return court?.[index] || "-";
}

function updateOverlapResult() {
  const result = document.getElementById("overlapResult");
  if (!result || !overlapPositionsByTeam) return;
  const court = overlapTeam === "home" ? match.homeCourt : match.awayCourt;
  const hasLineup = Array.isArray(court) && court.length === 6 && court.every(Boolean);
  if (!hasLineup) {
    result.textContent = "Set this team's lineup before checking overlap.";
    result.className = "overlap-result error";
    return;
  }

  const assessment = evaluateOverlapPositions(overlapPositionsByTeam[overlapTeam]);
  if (assessment.valid) {
    result.textContent = "No positional overlap relationship is shown in this layout.";
    result.className = "overlap-result ok";
  } else {
    result.textContent = assessment.issues.join(" ");
    result.className = "overlap-result error";
  }
}

function selectOverlapMarker(positionKey) {
  overlapSelectedPosition = positionKey;
  document.querySelectorAll(".overlap-marker").forEach(marker => {
    marker.classList.toggle("selected", marker.dataset.position === positionKey);
  });
  const selected = document.getElementById("overlapSelectedPlayer");
  if (selected) selected.textContent = `${positionKey.toUpperCase()} - #${getOverlapPlayer(overlapTeam, positionKey)}`;
}

function updateOverlapMarker(marker, position) {
  marker.style.left = `${position.x}%`;
  marker.style.top = `${position.y}%`;
  updateOverlapResult();
}

function renderOverlapAssistant() {
  if (!match || !overlapPositionsByTeam) return;
  const court = document.getElementById("overlapCourt");
  court.innerHTML = '<div class="overlap-net">Net</div>';
  document.querySelectorAll("[data-overlap-team]").forEach(button => {
    const team = button.dataset.overlapTeam;
    button.classList.toggle("active", team === overlapTeam);
    button.textContent = team === "home" ? match.homeTeam : match.awayTeam;
  });

  Object.entries(overlapPositionsByTeam[overlapTeam]).forEach(([key, position]) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "overlap-marker";
    marker.dataset.position = key;
    marker.setAttribute("aria-label", `${key.toUpperCase()}, player ${getOverlapPlayer(overlapTeam, key)}`);
    const positionLabel = document.createElement("span");
    positionLabel.textContent = key.toUpperCase();
    const playerLabel = document.createElement("strong");
    playerLabel.textContent = `#${getOverlapPlayer(overlapTeam, key)}`;
    marker.append(positionLabel, playerLabel);
    marker.style.left = `${position.x}%`;
    marker.style.top = `${position.y}%`;

    marker.addEventListener("pointerdown", event => {
      selectOverlapMarker(key);
      marker.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    marker.addEventListener("pointermove", event => {
      if (!marker.hasPointerCapture(event.pointerId)) return;
      const rect = court.getBoundingClientRect();
      const x = Math.max(7, Math.min(93, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(15, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100));
      overlapPositionsByTeam[overlapTeam][key] = { x, y };
      updateOverlapMarker(marker, { x, y });
    });
    marker.addEventListener("pointerup", event => {
      if (marker.hasPointerCapture(event.pointerId)) marker.releasePointerCapture(event.pointerId);
    });
    court.appendChild(marker);
  });

  selectOverlapMarker(overlapSelectedPosition);
  updateOverlapResult();
}

function openOverlapAssistant() {
  if (!match) return;
  overlapReturnFocus = document.activeElement;
  overlapTeam = match.serving || "home";
  overlapSelectedPosition = "p1";
  overlapPositionsByTeam = {
    home: copyDefaultOverlapPositions(),
    away: copyDefaultOverlapPositions()
  };
  const app = document.querySelector(".app");
  if (app) app.inert = true;
  document.getElementById("overlapOverlay")?.classList.remove("hidden");
  renderOverlapAssistant();
  document.getElementById("btnCloseOverlap")?.focus();
}

function closeOverlapAssistant() {
  document.getElementById("overlapOverlay")?.classList.add("hidden");
  const app = document.querySelector(".app");
  if (app) app.inert = false;
  if (overlapReturnFocus && typeof overlapReturnFocus.focus === "function") overlapReturnFocus.focus();
  overlapReturnFocus = null;
}

function nudgeOverlapPlayer(direction) {
  if (!overlapPositionsByTeam) return;
  const position = overlapPositionsByTeam[overlapTeam][overlapSelectedPosition];
  if (!position) return;
  const amount = 4;
  if (direction === "up") position.y = Math.max(15, position.y - amount);
  if (direction === "down") position.y = Math.min(92, position.y + amount);
  if (direction === "left") position.x = Math.max(7, position.x - amount);
  if (direction === "right") position.x = Math.min(93, position.x + amount);
  renderOverlapAssistant();
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

  const renderSquad = (element, sorted, names, teamKey) => {
    if (!sorted.length) {
      const empty = document.createElement("em");
      empty.textContent = "–";
      element.replaceChildren(empty);
      return;
    }

    const entries = sorted.flatMap((num, index) => {
      const slot = document.createElement("span");
      slot.className = "squad-slot";
      slot.dataset.team = teamKey;
      slot.dataset.num = num;
      slot.textContent = `#${num}${names[num] ? ` — ${names[num]}` : ""}`;
      return index ? [document.createTextNode(", "), slot] : [slot];
    });
    element.replaceChildren(...entries);
  };

  renderSquad(homeEl, homeSorted, homeNames, "home");
  renderSquad(awayEl, awaySorted, awayNames, "away");
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
    ? Math.ceil(getTimeoutRemainingMs(now) / 1000)
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

  const homeEditorTitle = document.getElementById("homeLineupEditorTitle");
  const awayEditorTitle = document.getElementById("awayLineupEditorTitle");
  if (homeEditorTitle) homeEditorTitle.textContent = match.homeTeam;
  if (awayEditorTitle) awayEditorTitle.textContent = match.awayTeam;

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

  const switchSidesBtn = document.getElementById("btnSwitchSides");
  if (switchSidesBtn) {
    const isTieBreak = currentSet.setNumber === 5 && match.status !== "finished";
    const switchDue = isTieBreak && Math.max(currentSet.homePoints, currentSet.awayPoints) >= 8 && !match.tieBreakEightPointSwitchDone;
    switchSidesBtn.classList.toggle("hidden", !isTieBreak);
    switchSidesBtn.classList.toggle("switch-due", switchDue);
    switchSidesBtn.textContent = switchDue ? "Switch Sides - 8 Points" : "Switch Sides";
  }

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
            .page { display:flex; flex-direction:column; height:100vh; padding:16px 24px; gap:8px; }
            .topbar { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:16px; }
            .winner { text-align:center; font-size:26px; font-weight:800; color:#ffd166; display:none; }
            .winner.show { display:block; }
            .set-history { text-align:center; font-size:16px; color:var(--muted); }
            .wrap { display:flex; flex:1; min-height:0; align-items:stretch; justify-content:center; gap:14px; }
            .card { flex:1; min-width:0; background:var(--panel); border-radius:20px; padding:30px 34px; text-align:center; position:relative; box-shadow:0 10px 24px rgba(0,0,0,0.45); display:flex; flex-direction:column; justify-content:center; }
            .logo { width:clamp(88px, 8vw, 140px); height:clamp(88px, 8vw, 140px); object-fit:contain; margin:0 auto 8px; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5)); }
            .logo.hidden { display:none; }
            .name { max-width:76%; margin:0 auto 12px; font-size:clamp(38px, 4.1vw, 76px); font-weight:800; line-height:1.06; letter-spacing:0.03em; overflow-wrap:anywhere; }
            .sets { position:absolute; top:28px; color:var(--muted); display:flex; align-items:baseline; gap:8px; font-size:clamp(14px, 1.4vw, 22px); font-weight:700; }
            .left-card .sets { right:34px; }.right-card .sets { left:34px; }
            .sets span { color:var(--text); font-size:clamp(48px, 5vw, 96px); line-height:.8; }
            .score { font-size:clamp(300px, 29vw, 560px); font-weight:900; margin-top:8px; line-height:.82; flex:1; min-height:0; display:flex; align-items:center; justify-content:center; }
            .serve-dot { position:absolute; top:22px; right:28px; width:clamp(58px, 4.8vw, 92px); height:clamp(58px, 4.8vw, 92px); object-fit:contain; filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45)); opacity:0; transform:scale(0.92); }
            .left-card .serve-dot { left:28px; right:auto; }
            .card.serving .serve-dot { opacity:1; transform:scale(1); }
            .center { font-size:18px; text-align:center; color:var(--muted); min-width:132px; display:flex; flex-direction:column; justify-content:center; }
            .setnum { font-size:clamp(70px, 6vw, 118px); font-weight:800; color:var(--text); margin-top:8px; }
            .center .label { text-transform:uppercase; letter-spacing:0.12em; font-size:13px; }
            @media (max-width: 900px) { .page { padding:10px; }.wrap { gap:8px; }.card { padding:24px 14px; }.center { min-width:78px; }.name { max-width:74%; font-size:clamp(25px, 4.4vw, 42px); }.sets { top:18px; gap:4px; font-size:12px; }.left-card .sets { right:16px; }.right-card .sets { left:16px; }.sets span { font-size:clamp(34px, 6vw, 54px); }.serve-dot { top:14px; right:15px; }.left-card .serve-dot { left:15px; }.score { font-size:clamp(150px, 27vw, 300px); } }
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
              <div class="card left-card" id="leftCard">
                <img class="serve-dot" src="images/ui/mikasa.png" alt="Serving" />
                <img class="logo hidden" id="leftLogo" alt="" />
                <div class="name" id="leftName">Team A</div>
                <div class="sets">Sets <span id="leftSets">0</span></div>
                <div class="score" id="leftScore">0</div>
              </div>
              <div class="center">
                <div class="label">Current Set</div>
                <div class="setnum" id="currentSet">1</div>
              </div>
              <div class="card right-card" id="rightCard">
                <img class="serve-dot" src="images/ui/mikasa.png" alt="Serving" />
                <img class="logo hidden" id="rightLogo" alt="" />
                <div class="name" id="rightName">Team B</div>
                <div class="sets">Sets <span id="rightSets">0</span></div>
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
          el.onerror = () => {
            el.classList.add("hidden");
            el.removeAttribute("src");
          };
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
  scoreboardWindow.postMessage({ type: "scoreboard:update", ...payload }, APP_ORIGIN);
}

function openAudioPanelWindow() {
  if (audioPanelWindow && !audioPanelWindow.closed) {
    audioPanelWindow.focus();
    return;
  }

  audioPanelWindow = window.open("", "ivi_audio_panel", "width=520,height=760");
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
            .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
            .btn { border:none; border-radius:16px; padding:16px 10px; font-size:20px; font-weight:800; cursor:pointer; color:#fff; background:#203854; box-shadow:0 6px 14px rgba(0,0,0,0.45); min-height:78px; line-height:1.15; overflow-wrap:anywhere; }
            .btn.active { background:linear-gradient(135deg, #009f4f, #00c86a); }
            .stop { background:linear-gradient(135deg, #ff6f00, #ff9a2b); margin-top:4px; }
            .status { font-size:14px; color:var(--muted); }
            @media (max-width:480px), (pointer:coarse) {
              .page { padding:14px; gap:10px; }
              .title { font-size:20px; }
              .hint { font-size:12px; }
              .status { font-size:12px; }
              .grid { gap:10px; }
              .btn { font-size:17px; min-height:74px; padding:14px 8px; border-radius:16px; }
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
              if (e.source !== window.opener) return;
              const data = e.data;
              if (!data || data.type !== "audio-panel:update") return;
              current = data;
              renderButtons();
            });

            grid.addEventListener("click", (e) => {
              const btn = e.target.closest("button[data-key]");
              if (!btn || !window.opener) return;
              window.opener.postMessage({ type: "audio-panel:toggle", key: btn.dataset.key }, window.location.origin);
            });

            document.getElementById("btnStopAudio").addEventListener("click", () => {
              if (!window.opener) return;
              window.opener.postMessage({ type: "audio-panel:stop" }, window.location.origin);
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
document.getElementById("btnCloseLineups")?.addEventListener("click", closeLineupWorkspace);
document.getElementById("btnSaveLineups")?.addEventListener("click", saveLineupsFromWorkspace);
document.getElementById("homeSystemSelect")?.addEventListener("change", event => setTeamSystem("home", event.target.value));
document.getElementById("awaySystemSelect")?.addEventListener("change", event => setTeamSystem("away", event.target.value));
document.getElementById("btnToggleTimeline")?.addEventListener("click", toggleTimeline);

document.querySelectorAll("[data-verify-server]").forEach(button => {
  button.addEventListener("click", () => verifyServer(button.dataset.verifyServer));
});
document.querySelectorAll("#homeServerInput, #awayServerInput").forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    verifyServer(input.id.startsWith("home") ? "home" : "away");
  });
});
document.getElementById("btnCheckOverlap")?.addEventListener("click", openOverlapAssistant);
document.getElementById("btnCloseOverlap")?.addEventListener("click", closeOverlapAssistant);
document.getElementById("overlapOverlay")?.addEventListener("click", event => {
  if (event.target.id === "overlapOverlay") closeOverlapAssistant();
});
document.querySelectorAll("[data-overlap-team]").forEach(button => {
  button.addEventListener("click", () => {
    overlapTeam = button.dataset.overlapTeam;
    overlapSelectedPosition = "p1";
    renderOverlapAssistant();
  });
});
document.querySelectorAll("[data-nudge]").forEach(button => {
  button.addEventListener("click", () => nudgeOverlapPlayer(button.dataset.nudge));
});
document.getElementById("btnResetOverlap")?.addEventListener("click", () => {
  if (!overlapPositionsByTeam) return;
  overlapPositionsByTeam[overlapTeam] = copyDefaultOverlapPositions();
  renderOverlapAssistant();
});
document.addEventListener("keydown", event => {
  const overlay = document.getElementById("overlapOverlay");
  if (!overlay || overlay.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    closeOverlapAssistant();
    return;
  }
  if (event.key === "Tab") {
    const focusable = Array.from(overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

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
document.getElementById("btnSwitchSides").addEventListener("click", () => switchCourtSides());
document.getElementById("btnEndSet").addEventListener("click", () => endCurrentSet());
document.getElementById("btnEndMatch").addEventListener("click", () => endMatchManually());
document.getElementById("btnSubHome").addEventListener("click", () => substitutePlayer("home"));
document.getElementById("btnSubAway").addEventListener("click", () => substitutePlayer("away"));
document.getElementById("btnCloseSummary").addEventListener("click", () => hideMatchSummary());
document.getElementById("btnOpenScoreboard").addEventListener("click", () => openScoreboardWindow());
document.getElementById("btnOpenAudioPanel")?.addEventListener("click", openAudioPanelWindow);
document.getElementById("btnShareReferee")?.addEventListener("click", openRefereeShare);
document.getElementById("btnCloseRefereeShare")?.addEventListener("click", closeRefereeShareOverlay);
document.getElementById("refereeShareOverlay")?.addEventListener("click", event => {
  if (event.target.id === "refereeShareOverlay") closeRefereeShareOverlay();
});
document.getElementById("btnCopyRefereeLink")?.addEventListener("click", async () => {
  const input = document.getElementById("refereeShareLink");
  if (!input?.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
    const status = document.getElementById("refereeShareStatus");
    if (status) status.textContent = "Link copied.";
  } catch (error) {
    input.select();
    document.execCommand("copy");
  }
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
  if (e.origin !== APP_ORIGIN || e.source !== audioPanelWindow) return;
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
    if (typeof match.tieBreakEightPointSwitchDone !== "boolean") match.tieBreakEightPointSwitchDone = false;
    if (match.homeSystem !== "6-0") match.homeSystem = "5-1";
    if (match.awaySystem !== "6-0") match.awaySystem = "5-1";
    if (!match.homeRoleMap || typeof match.homeRoleMap !== "object") match.homeRoleMap = {};
    if (!match.awayRoleMap || typeof match.awayRoleMap !== "object") match.awayRoleMap = {};
    if (!match.serverVerification) match.serverVerification = { home: null, away: null };
    if (!Array.isArray(match.homeLiberos)) match.homeLiberos = [match.homeLibero, match.homeLibero2].filter(Boolean);
    if (!Array.isArray(match.awayLiberos)) match.awayLiberos = [match.awayLibero, match.awayLibero2].filter(Boolean);
    match.maxSubsPerSet = 8;
    if (!Array.isArray(match.homeSubstitutionPairs)) match.homeSubstitutionPairs = [];
    if (!Array.isArray(match.awaySubstitutionPairs)) match.awaySubstitutionPairs = [];
    if (!Array.isArray(match.homeRosterSlots) || match.homeRosterSlots.length !== 14) {
      match.homeRosterSlots = getStoredRosterSlots("home");
    }
    if (!Array.isArray(match.awayRosterSlots) || match.awayRosterSlots.length !== 14) {
      match.awayRosterSlots = getStoredRosterSlots("away");
    }
    // Backfill starting six snapshots if missing
    if (!match.homeStartingSix || match.homeStartingSix.length !== 6) {
      match.homeStartingSix = (match.homeBaseRotation || []).slice();
    }
    if (!match.awayStartingSix || match.awayStartingSix.length !== 6) {
      match.awayStartingSix = (match.awayBaseRotation || []).slice();
    }
    if (!Number.isInteger(match.homeRotationCount)) {
      const index = match.homeBaseRotation?.indexOf(match.homeStartingSix?.[0]);
      match.homeRotationCount = index >= 0 ? (6 - index) % 6 : 0;
    }
    if (!Number.isInteger(match.awayRotationCount)) {
      const index = match.awayBaseRotation?.indexOf(match.awayStartingSix?.[0]);
      match.awayRotationCount = index >= 0 ? (6 - index) % 6 : 0;
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

