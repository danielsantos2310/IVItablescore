// VIRTUAL COORD SYSTEM: 800Ã—880
// Court: left=50, top=30, width=700, height=820
// Net at y=440 (home team BELOW net: y>440)
// Home front row ~y=510, back row ~y=700

const V = { W: 800, H: 500 };
const CT = { l: 50, t: 30, w: 700, h: 440 };
const NET_Y = 60;
const ATK_LINE_DIST = 125; // 3m line distance from net in virtual units
const HOME_ATK_Y = NET_Y + ATK_LINE_DIST; // ~565

// Key y-coordinates for home team
const NET_CLOSE = NET_Y + 25;   // right at net for blocking
const FRONT_BASE = NET_Y + 80;  // front row base
const ATK_LINE = HOME_ATK_Y;    // 3m attack line
const MID_COURT = NET_Y + 230;  // middle of home court
const BACK_BASE = NET_Y + 310;  // back row base
const DEEP = NET_Y + 370;       // deep court
const SERVICE = NET_Y + 400;    // service position

// Key x-coordinates
const L = 130;   // left sideline area
const LC = 250;  // left-center
const C = 400;   // center
const RC = 550;  // right-center
const R = 670;   // right sideline area
const SET_POS_X = RC + 20; // setter target position x
const SET_POS_Y = NET_Y + 50; // setter target near net

const PLAYER_R = 28;

const ROLES = {
  S:   { color: '#2563eb', label: 'S' },
  OH:  { color: '#ef4444', label: 'OH' },
  OH2: { color: '#ef4444', label: 'OH' },
  OPP: { color: '#f59e0b', label: 'OPP' },
  MB:  { color: '#22c55e', label: 'MB' },
  MB2: { color: '#22c55e', label: 'MB' },
  L:   { color: '#a855f7', label: 'L' },
  S2:  { color: '#607080', label: 'S2' },
};

// STATE
let sx = 1, sy = 1;
let tool = 'select', dColor = '#f59e0b', lineW = 3;
let formation = '5-1', rot = 1, phase = 'serving';
let recvShape = '3p', defVs = 'z4';
let players = [], oppPlayers = [];
let ball = null, showBall = false, showOpp = false;
let showZoneNumbers = true;
let drawings = [], curDraw = null;
let drag = null, dragOff = { x: 0, y: 0 };
let selPlayer = null;
let curvePoints = [];
let ctxTarget = null;
let lineStart = null;
let playerNumbers = {};
let dragMoved = false;
let undoStack = [];
let redoStack = [];
let isHistoryApplying = false;
let rallyServeBy = 'us'; // 'us' or 'opp'
let rallyState = 'pre_serve'; // 'pre_serve' or 'rally'
let presentationMode = false;

const MAX_HISTORY = 120;

const canvas = document.getElementById('C');
const ctx = canvas.getContext('2d');
const courtLogo = new Image();
courtLogo.src = 'logo.png';
courtLogo.onload = () => render();

function cloneState(v) {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

function getStateSnapshot() {
  return {
    players,
    oppPlayers,
    ball,
    showBall,
    drawings,
    rot,
    phase,
    formation,
    recvShape,
    defVs,
    playerNumbers,
    showOpp,
    showZoneNumbers,
    rallyServeBy,
    rallyState,
    tool,
    dColor,
    lineW,
  };
}

function syncUIFromState() {
  document.getElementById('fmtSel').value = formation;
  document.querySelectorAll('#rotBtns button').forEach((b, i) => b.classList.toggle('active', i === rot - 1));
  document.getElementById('rotDisp').textContent = 'R' + rot;
  document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ph' + (phase === 'serving' ? 'Serve' : phase === 'receive' ? 'Recv' : 'Def')).classList.add('active');
  document.getElementById('ballBtn').classList.toggle('active', showBall);
  document.querySelectorAll('.tool-row button[id^="t"]').forEach(b => b.classList.remove('active'));
  const toolBtn = document.getElementById('t' + tool.charAt(0).toUpperCase() + tool.slice(1));
  if (toolBtn) toolBtn.classList.add('active');
  const zoneBtn = document.getElementById('zoneNumBtn');
  if (zoneBtn) zoneBtn.classList.toggle('active', showZoneNumbers);
  const presentBtn = document.getElementById('presentBtn');
  if (presentBtn) presentBtn.classList.toggle('active', presentationMode);
  canvas.style.cursor = tool === 'select' ? 'grab' : 'crosshair';
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  const activeDot = document.querySelector(`.cdot[onclick*="${dColor.toLowerCase()}"]`);
  if (activeDot) activeDot.classList.add('active');
  document.getElementById('lwSlider').value = lineW;
  document.getElementById('lwVal').textContent = String(lineW);
}

function applySnapshot(s, opts = {}) {
  players = Array.isArray(s.players) ? s.players : [];
  oppPlayers = Array.isArray(s.oppPlayers) ? s.oppPlayers : [];
  ball = s.ball || null;
  showBall = !!s.showBall;
  drawings = Array.isArray(s.drawings) ? s.drawings : [];
  rot = Math.min(6, Math.max(1, +s.rot || 1));
  phase = ['serving', 'receive', 'defense'].includes(s.phase) ? s.phase : 'serving';
  formation = ['5-1', '4-2', '6-2'].includes(s.formation) ? s.formation : '5-1';
  recvShape = s.recvShape === '4p' ? '4p' : '3p';
  defVs = ['z4', 'z3', 'z2', 'pipe'].includes(s.defVs) ? s.defVs : 'z4';
  playerNumbers = s.playerNumbers && typeof s.playerNumbers === 'object' ? s.playerNumbers : {};
  showOpp = false;
  showZoneNumbers = s.showZoneNumbers !== undefined ? !!s.showZoneNumbers : true;
  rallyServeBy = s.rallyServeBy === 'opp' ? 'opp' : 'us';
  rallyState = s.rallyState === 'rally' ? 'rally' : 'pre_serve';
  tool = s.tool || tool;
  dColor = s.dColor || dColor;
  lineW = Number.isFinite(+s.lineW) ? +s.lineW : lineW;

  if (opts.rebuildPlayers || !players.length) {
    buildPlayers();
  }

  syncUIFromState();
  updateInfoBox();
  updateFlowInfo();
  render();
}

function commitHistory() {
  if (isHistoryApplying) return;
  const snap = cloneState(getStateSnapshot());
  const last = undoStack[undoStack.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
  undoStack.push(snap);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (undoStack.length <= 1) return;
  isHistoryApplying = true;
  const current = undoStack.pop();
  redoStack.push(current);
  const prev = undoStack[undoStack.length - 1];
  applySnapshot(cloneState(prev));
  isHistoryApplying = false;
}

function redo() {
  if (!redoStack.length) return;
  isHistoryApplying = true;
  const next = redoStack.pop();
  undoStack.push(cloneState(next));
  applySnapshot(cloneState(next));
  isHistoryApplying = false;
}

// 5-1 LINEUP
// This is the "serving order" / rotation order
// Rotation 1: S=z1, OH=z2, MB=z3, OPP=z4, OH2=z5, MB2=z6
// Each rotation shifts everyone one position clockwise

const LINEUP_51 = ['S', 'OH', 'MB', 'OPP', 'OH2', 'MB2'];
const LINEUP_42 = ['S', 'OH', 'MB', 'S2', 'OH2', 'MB2'];
const LINEUP_62 = ['S', 'OH', 'MB', 'S2', 'OH2', 'MB2'];

function getLineup() {
  if (formation === '4-2') return LINEUP_42;
  if (formation === '6-2') return LINEUP_62;
  return LINEUP_51;
}

function getZoneRole(zone) {
  // Given current rotation, who is in each zone?
  const lineup = getLineup();
  // Zone 1 = index 0, zone 2 = index 1, etc
  // In rotation R, shift by R-1 in volleyball clockwise direction:
  // z2->z1, z1->z6, z6->z5, z5->z4, z4->z3, z3->z2
  const idx = (zone - 1 + (rot - 1) + 600) % 6;
  return lineup[idx];
}

function isFrontZone(z) { return z === 2 || z === 3 || z === 4; }
function isBackZone(z) { return z === 1 || z === 5 || z === 6; }

const SERVE_51_TEMPLATES = {
  1: { 1: [R, SERVICE], 2: [R - 35, FRONT_BASE], 3: [C, FRONT_BASE - 10], 4: [L + 45, FRONT_BASE + 10], 5: [L + 60, BACK_BASE - 10], 6: [C, BACK_BASE + 10] },
  // R2 serving tuned to the provided diagram:
  // OH1 serves from P1, setter shifts right, libero holds deep center, OH2/RS/MB2 stay front.
  2: { 1: [R, SERVICE], 2: [R - 25, FRONT_BASE], 3: [C - 10, FRONT_BASE + 5], 4: [L + 65, FRONT_BASE + 5], 5: [C - 15, BACK_BASE + 30], 6: [R - 70, BACK_BASE - 45] },
  // R3 serving tuned to the provided diagram:
  // Libero serves from P1, setter left-back, OH1 mid-back, MB1/OH2/RS front.
  3: { 1: [R, SERVICE], 2: [R - 70, FRONT_BASE], 3: [C - 10, FRONT_BASE + 5], 4: [L + 70, FRONT_BASE], 5: [RC - 30, BACK_BASE + 35], 6: [L + 75, BACK_BASE - 5] },
  // R4 serving tuned to the provided diagram:
  // RS serves from P1, S/MB/OH2 form the front line, OH1 left-back and libero center-back.
  4: { 1: [R, SERVICE], 2: [R - 75, FRONT_BASE + 2], 3: [C, FRONT_BASE - 8], 4: [L + 70, FRONT_BASE + 6], 5: [L + 80, BACK_BASE + 5], 6: [C, BACK_BASE + 35] },
  // R5 serving tuned to the provided diagram:
  // OH2 serves from P1, OH1/S/MB1 front line, L+RS deep lanes.
  5: { 1: [R, SERVICE], 2: [R - 55, FRONT_BASE + 2], 3: [C + 5, FRONT_BASE - 6], 4: [L + 70, FRONT_BASE + 2], 5: [L + 75, BACK_BASE + 15], 6: [C - 10, BACK_BASE + 15] },
  // R6 serving tuned to the provided diagram:
  // MB1 serves from P1, S/OH1/MB2 stay front, RS+OH2 in middle lanes.
  6: { 1: [R, SERVICE], 2: [R - 65, FRONT_BASE + 8], 3: [C + 5, FRONT_BASE - 12], 4: [L + 75, FRONT_BASE - 10], 5: [C - 30, BACK_BASE + 22], 6: [L + 90, BACK_BASE + 5] },
};

const RECEIVE_51_TEMPLATES = {
  // R1 receive tuned to the provided diagram:
  // S hidden deep right, OH1 drops to pass right seam, L centered, OH2 left passer.
  1: { 1: [R - 10, BACK_BASE + 40], 2: [R - 90, BACK_BASE - 20], 3: [C, NET_CLOSE + 20], 4: [L + 75, FRONT_BASE + 5], 5: [L + 80, BACK_BASE - 10], 6: [C, BACK_BASE + 20] },
  // R2 receive tuned to the provided diagram:
  // OH2 left lane, L middle lane, OH1 right lane, S + RS stack right-center, MB2 holds right-front.
  2: { 1: [R - 65, BACK_BASE + 20], 2: [R - 18, FRONT_BASE + 20], 3: [RC, FRONT_BASE + 5], 4: [L + 70, FRONT_BASE + 35], 5: [C, BACK_BASE + 25], 6: [RC - 20, FRONT_BASE + 18] },
  // R3 receive: MB left-front, OPP right-front, S left-inside near attack line,
  // OH passers in zones 5/6 lanes, libero in zone 1 lane.
  3: { 1: [R - 35, BACK_BASE + 30], 2: [R - 35, NET_CLOSE + 20], 3: [C + 30, FRONT_BASE + 18], 4: [L + 45, NET_CLOSE + 20], 5: [L + 80, FRONT_BASE + 55], 6: [C, BACK_BASE + 18] },
  // R4 receive tuned to the provided diagram:
  // RS stays deep right, S+MB left-front corridor, OH2 center lane, OH1+L right-back lanes.
  4: { 1: [R - 10, BACK_BASE + 35], 2: [RC - 10, FRONT_BASE + 18], 3: [L + 65, FRONT_BASE + 12], 4: [L + 30, FRONT_BASE - 5], 5: [C + 15, BACK_BASE + 15], 6: [RC + 45, BACK_BASE + 18] },
  // R5 receive tuned to the provided diagram:
  // S+MB1 hold right-front, OH1/L/OH2 in passing lanes, RS deep middle-right.
  5: { 1: [C + 40, BACK_BASE + 45], 2: [R - 18, FRONT_BASE + 10], 3: [RC, FRONT_BASE - 5], 4: [L + 75, BACK_BASE + 12], 5: [C + 10, BACK_BASE + 18], 6: [R - 65, BACK_BASE + 15] },
  // R6 receive tuned to the provided diagram:
  // S+MB2 front line, OH1/OH2/L pass lanes, RS deep-left lane.
  6: { 1: [R - 65, BACK_BASE + 8], 2: [R - 45, FRONT_BASE - 5], 3: [L + 75, FRONT_BASE + 5], 4: [L + 95, BACK_BASE + 8], 5: [C + 10, BACK_BASE + 18], 6: [L + 55, BACK_BASE + 38] },
};

function applyZoneTemplate(zm, tpl) {
  let pos = {};
  for (let z = 1; z <= 6; z++) {
    const p = zm[z];
    const t = tpl[z] || [zoneBaseX(z), isFrontZone(z) ? FRONT_BASE : BACK_BASE];
    pos[z] = { ...p, x: t[0], y: t[1] };
  }
  enforceOverlapOnPositions(pos);
  return pos;
}

function calc51ServingTemplate(zm) {
  const tpl = SERVE_51_TEMPLATES[rot] || SERVE_51_TEMPLATES[1];
  return applyZoneTemplate(zm, tpl);
}

function calc51ReceiveTemplate(zm) {
  const tpl = RECEIVE_51_TEMPLATES[rot] || RECEIVE_51_TEMPLATES[1];
  const pos = applyZoneTemplate(zm, tpl);

  // Optional 4-passer receive: pull OPP into passing line when possible.
  if (recvShape === '4p') {
    for (let z = 1; z <= 6; z++) {
      if (zm[z].origRole === 'OPP') {
        pos[z].y = BACK_BASE - 20;
        if (z === 2 || z === 1) pos[z].x = R - 90;
        else if (z === 3 || z === 6) pos[z].x = C + 70;
        else pos[z].x = L + 90;
      }
    }
    enforceOverlapOnPositions(pos);
  }
  return pos;
}


function calcPositions() {
  // Step 1: Determine who is in each zone
  let zoneMap = {};
  for (let z = 1; z <= 6; z++) {
    let role = getZoneRole(z);
    let actualRole = role;

    // Libero replacement rule (5-1 model):
    // - Libero replaces MB/MB2 in any back-row zone.
    // - Exception: if MB/MB2 is in P1 while serving, MB/MB2 must serve.
    if (formation === '5-1' && isBackZone(z) && (role === 'MB' || role === 'MB2')) {
      const mbServingNow = (phase === 'serving' && z === 1);
      if (!mbServingNow) actualRole = 'L';
    }
    // In 4-2 / 6-2: no libero in this basic model (can be added)

    zoneMap[z] = {
      origRole: role,
      role: actualRole,
      zone: z,
      isFront: isFrontZone(z),
      isBack: isBackZone(z),
    };
  }

  // Step 2: Calculate positions based on phase
  let positions = {};

  if (phase === 'serving') {
    positions = calcServing(zoneMap);
  } else if (phase === 'receive') {
    positions = calcReceive(zoneMap);
  } else if (phase === 'defense') {
    positions = calcDefense(zoneMap);
  }

  return positions;
}

function calcServing(zm) {
  if (formation === '5-1') {
    return calc51ServingTemplate(zm);
  }

  let pos = {};

  // Base positions: legal overlap positions
  // Zone 1 is serving (behind end line)
  // Everyone else in base/ready position
  // Must respect overlap rules

  for (let z = 1; z <= 6; z++) {
    const p = zm[z];
    let x, y;

    if (z === 1) {
      x = R; y = SERVICE;
    } else if (z === 2) {
      // Right front
      x = R - 40; y = FRONT_BASE;
    } else if (z === 3) {
      // Center front
      x = C; y = FRONT_BASE;
    } else if (z === 4) {
      // Left front
      x = L + 40; y = FRONT_BASE;
    } else if (z === 5) {
      // Left back
      x = L + 40; y = BACK_BASE;
    } else if (z === 6) {
      // Center back
      x = C; y = BACK_BASE;
    }

    // Setter positioning: when setter is front row, move to right side near net
    if (p.origRole === 'S' || (formation !== '5-1' && p.origRole === 'S')) {
      if (p.isFront && z !== 2) {
        // Setter wants to be near zone 2/3 area but must respect overlap
        if (z === 3) { x = RC - 30; }
        if (z === 4) { x = LC + 30; } // can't go too far right (z3 must be between z4 and z2)
      }
    }

    // 4-2: front setter goes to setting position
    if (formation === '4-2') {
      if (p.origRole === 'S' && p.isFront) {
        if (z === 2) { x = R - 20; y = FRONT_BASE - 20; }
        if (z === 3) { x = RC; y = FRONT_BASE - 10; }
        if (z === 4) { x = LC + 40; } // constrained by overlap
      }
      if (p.origRole === 'S2' && p.isFront) {
        if (z === 2) { x = R - 20; y = FRONT_BASE - 20; }
        if (z === 3) { x = RC; y = FRONT_BASE - 10; }
        if (z === 4) { x = LC + 40; }
      }
    }

    // 6-2: back row setter will penetrate after serve, but pre-serve must be legal
    // Just use base positions for now

    pos[z] = { ...p, x, y };
  }

  return pos;
}

function calcReceive(zm) {
  if (formation === '5-1') {
    return calc51ReceiveTemplate(zm);
  }

  let pos = {};

  // Key principle: after serve contact, players can move freely
  // But BEFORE contact, overlap rules apply
  // So receive positions must be LEGAL overlap-wise AND functional

  // Identify key players
  let setterZone = null, setterFront = false;
  let mbZones = [], ohZones = [], oppZone = null, libZone = null;

  for (let z = 1; z <= 6; z++) {
    const p = zm[z];
    if (p.origRole === 'S') { setterZone = z; setterFront = p.isFront; }
    if (p.origRole === 'MB' || p.origRole === 'MB2') mbZones.push(z);
    if (p.origRole === 'OH' || p.origRole === 'OH2') ohZones.push(z);
    if (p.origRole === 'OPP') oppZone = z;
    if (p.role === 'L') libZone = z;
  }

  // FORMATION-SPECIFIC RECEIVE
  if (formation === '5-1') {
    pos = calc51Receive(zm, setterZone, setterFront, mbZones, ohZones, oppZone, libZone);
  } else if (formation === '4-2') {
    pos = calc42Receive(zm);
  } else if (formation === '6-2') {
    pos = calc62Receive(zm, setterZone, setterFront);
  }

  return pos;
}

function calc51Receive(zm, sZ, sFront, mbZ, ohZ, oppZ, libZ) {
  let pos = {};

  // In 5-1 serve receive, the key patterns per rotation:
  // The setter penetrates to setting position (near zone 2-3 at net)
  // MB hides at net to prepare quick attack
  // OH(s) and Libero are primary passers
  // OPP may or may not pass

  // First set everyone to base
  for (let z = 1; z <= 6; z++) {
    pos[z] = { ...zm[z], x: C, y: MID_COURT };
  }

  // 5-1 Receive for each rotation
  // We need to handle this rotation by rotation because overlap constraints differ

  const r = rot;

  // Determine front row zones and back row zones
  // Front: 2,3,4  Back: 1,5,6

  // Primary passers: OH, OH2, Libero
  // Non-passers: MB/MB2 (hide at net), Setter (goes to set), OPP (usually doesn't pass or limited)

  // Place setter at target position (respecting overlap)
  if (sFront) {
    // Setter is front row - just move toward zone 2 area
    if (sZ === 2) { pos[sZ].x = R - 20; pos[sZ].y = FRONT_BASE - 30; }
    else if (sZ === 3) { pos[sZ].x = RC; pos[sZ].y = FRONT_BASE - 20; }
    else if (sZ === 4) { pos[sZ].x = LC + 50; pos[sZ].y = FRONT_BASE - 20; }
  } else {
    // Setter is back row - penetrate position (will run to net after serve contact)
    // Must stay behind corresponding front-row player before contact
    if (sZ === 1) { pos[sZ].x = R; pos[sZ].y = FRONT_BASE + 50; }
    else if (sZ === 6) { pos[sZ].x = RC + 20; pos[sZ].y = FRONT_BASE + 50; }
    else if (sZ === 5) { pos[sZ].x = LC + 60; pos[sZ].y = FRONT_BASE + 50; }
  }

  // Place MB(s) at net (hide from passing)
  mbZ.forEach(z => {
    if (isFrontZone(z)) {
      // Front row MB: at net
      if (z === 2) { pos[z].x = R - 30; pos[z].y = NET_CLOSE + 20; }
      else if (z === 3) { pos[z].x = C; pos[z].y = NET_CLOSE + 15; }
      else if (z === 4) { pos[z].x = L + 50; pos[z].y = NET_CLOSE + 20; }
    }
    // Back row MB is replaced by Libero (already in zm)
  });

  // Determine passing positions based on recvShape
  let passers = [];
  for (let z = 1; z <= 6; z++) {
    const p = zm[z];
    const isS = (p.origRole === 'S');
    const isMB = (p.origRole === 'MB' || p.origRole === 'MB2');
    if (!isS && !isMB) {
      passers.push(z);
    }
  }

  // In 3-person receive: use L, OH, OH2 (or L, OH, OPP if needed)
  // In 4-person: add OPP
  let passingZones = [];
  if (recvShape === '3p') {
    // Prefer OH, OH2, Libero
    passingZones = passers.filter(z => {
      const r = zm[z].role;
      const o = zm[z].origRole;
      return r === 'L' || o === 'OH' || o === 'OH2';
    });
    // If we don't have 3, add OPP
    if (passingZones.length < 3) {
      passers.forEach(z => {
        if (!passingZones.includes(z)) passingZones.push(z);
      });
    }
    passingZones = passingZones.slice(0, 3);
  } else {
    // 4-person: add OPP
    passingZones = passers.slice(0, 4);
  }

  // Sort passers left to right for positioning
  // The actual receive arc depends on rotation
  // Standard 3-person arc: left passer, center passer, right passer
  // Positioned in a slight arc behind the 3m line

  const passPositions3 = [
    { x: L + 80, y: BACK_BASE - 30 },  // left
    { x: C, y: BACK_BASE + 20 },         // center (slightly deeper)
    { x: R - 80, y: BACK_BASE - 30 },   // right
  ];

  const passPositions4 = [
    { x: L + 60, y: BACK_BASE - 40 },
    { x: LC + 40, y: BACK_BASE + 10 },
    { x: RC - 40, y: BACK_BASE + 10 },
    { x: R - 60, y: BACK_BASE - 40 },
  ];

  const ppos = recvShape === '3p' ? passPositions3 : passPositions4;

  // Sort passing zones by their expected left-to-right order
  // We need to respect overlap: if a passer is in zone 5, they must be left of zone 6 player
  passingZones.sort((a, b) => {
    const ax = zoneBaseX(a), bx = zoneBaseX(b);
    return ax - bx;
  });

  passingZones.forEach((z, i) => {
    if (i < ppos.length) {
      // Check overlap constraints
      let px = ppos[i].x;
      let py = ppos[i].y;

      // Back row passer must be behind front row in same column
      if (isBackZone(z)) {
        // Find the front row player in the same column pair
        const frontPair = { 1: 2, 6: 3, 5: 4 };
        const fz = frontPair[z];
        if (pos[fz] && py <= pos[fz].y) {
          py = pos[fz].y + 40;
        }
      }

      // Front row passer: must be in front of corresponding back row
      if (isFrontZone(z)) {
        const backPair = { 2: 1, 3: 6, 4: 5 };
        const bz = backPair[z];
        if (pos[bz] && py >= pos[bz].y) {
          py = pos[bz].y - 40;
        }
      }

      pos[z].x = px;
      pos[z].y = py;
    }
  });

  // OPP: if not passing, position near setter or ready area
  if (oppZ && !passingZones.includes(oppZ)) {
    if (isFrontZone(oppZ)) {
      pos[oppZ].x = R - 50;
      pos[oppZ].y = FRONT_BASE;
    } else {
      // Back row OPP: ready to hit back row attack
      pos[oppZ].x = R - 40;
      pos[oppZ].y = BACK_BASE - 60;
    }
  }

  enforceOverlapOnPositions(pos);
  return pos;
}

function calc42Receive(zm) {
  let pos = {};

  // 4-2: front setter sets, others receive/attack
  let frontSetterZ = null;
  for (let z = 1; z <= 6; z++) {
    pos[z] = { ...zm[z] };
    if ((zm[z].origRole === 'S' || zm[z].origRole === 'S2') && isFrontZone(z)) {
      frontSetterZ = z;
    }
  }

  // Position front setter near zone 2-3
  if (frontSetterZ) {
    if (frontSetterZ === 2) { pos[frontSetterZ].x = R - 20; pos[frontSetterZ].y = NET_CLOSE + 30; }
    else if (frontSetterZ === 3) { pos[frontSetterZ].x = RC; pos[frontSetterZ].y = NET_CLOSE + 25; }
    else if (frontSetterZ === 4) { pos[frontSetterZ].x = LC + 40; pos[frontSetterZ].y = NET_CLOSE + 30; }
  }

  // Front MB at net
  for (let z = 2; z <= 4; z++) {
    if ((zm[z].origRole === 'MB' || zm[z].origRole === 'MB2') && z !== frontSetterZ) {
      pos[z].x = zoneBaseX(z);
      pos[z].y = NET_CLOSE + 25;
    }
  }

  // Remaining players receive in W/arc
  let passers = [];
  for (let z = 1; z <= 6; z++) {
    if (z === frontSetterZ) continue;
    if (isFrontZone(z) && (zm[z].origRole === 'MB' || zm[z].origRole === 'MB2')) continue;
    passers.push(z);
  }

  const ppos = [
    { x: L + 80, y: BACK_BASE - 20 },
    { x: C - 30, y: BACK_BASE + 30 },
    { x: C + 80, y: BACK_BASE + 30 },
    { x: R - 80, y: BACK_BASE - 20 },
  ];

  passers.sort((a, b) => zoneBaseX(a) - zoneBaseX(b));
  passers.forEach((z, i) => {
    if (i < ppos.length) {
      pos[z].x = ppos[i].x;
      pos[z].y = ppos[i].y;
    }
  });

  enforceOverlapOnPositions(pos);
  return pos;
}

function calc62Receive(zm, sZ, sFront) {
  let pos = {};
  for (let z = 1; z <= 6; z++) pos[z] = { ...zm[z] };

  // 6-2: back row setter penetrates, front row "setter" attacks
  // Find back row setter
  let backSetterZ = null;
  for (let z = 1; z <= 6; z++) {
    if ((zm[z].origRole === 'S' || zm[z].origRole === 'S2') && isBackZone(z)) {
      backSetterZ = z;
    }
  }

  if (backSetterZ) {
    // Penetrate position
    if (backSetterZ === 1) { pos[backSetterZ].x = R; pos[backSetterZ].y = FRONT_BASE + 50; }
    else if (backSetterZ === 6) { pos[backSetterZ].x = RC + 20; pos[backSetterZ].y = FRONT_BASE + 50; }
    else if (backSetterZ === 5) { pos[backSetterZ].x = LC + 60; pos[backSetterZ].y = FRONT_BASE + 50; }
  }

  // Front row: all 3 are attackers (including the "setter" who acts as attacker)
  for (let z = 2; z <= 4; z++) {
    if ((zm[z].origRole === 'MB' || zm[z].origRole === 'MB2')) {
      pos[z].y = NET_CLOSE + 25;
      pos[z].x = zoneBaseX(z);
    } else {
      pos[z].y = FRONT_BASE - 10;
      pos[z].x = zoneBaseX(z);
    }
  }

  // Back row passers (except penetrating setter)
  let passers = [];
  for (let z = 1; z <= 6; z++) {
    if (z === backSetterZ) continue;
    if (isBackZone(z)) passers.push(z);
  }

  const ppos = [
    { x: L + 100, y: BACK_BASE + 10 },
    { x: R - 100, y: BACK_BASE + 10 },
  ];
  passers.sort((a, b) => zoneBaseX(a) - zoneBaseX(b));
  passers.forEach((z, i) => {
    if (i < ppos.length) { pos[z].x = ppos[i].x; pos[z].y = ppos[i].y; }
  });

  enforceOverlapOnPositions(pos);
  return pos;
}

function zoneBaseX(z) {
  const map = { 1: R, 2: R, 3: C, 4: L, 5: L, 6: C };
  return map[z] || C;
}

function calcDefense(zm) {
  let pos = {};
  for (let z = 1; z <= 6; z++) pos[z] = { ...zm[z] };

  // Front row: blocking positions
  // Determine block based on where attack is coming from
  const atkDir = defVs; // 'z4', 'z3', 'z2', 'pipe'

  // Find front row players
  let frontZones = [2, 3, 4];
  let backZones = [1, 5, 6];

  if (atkDir === 'z4') {
    // Attack from opponent's zone 4 (our right side)
    // Double/triple block on our right
    pos[2].x = R - 30; pos[2].y = NET_CLOSE;
    pos[3].x = R - 80; pos[3].y = NET_CLOSE; // join block
    pos[4].x = LC; pos[4].y = FRONT_BASE + 40; // off-blocker pulls back

    // Back row defense
    pos[1].x = R - 30; pos[1].y = BACK_BASE + 40; // line defense
    pos[6].x = C + 20; pos[6].y = MID_COURT + 30; // behind block
    pos[5].x = L + 50; pos[5].y = BACK_BASE; // cross-court deep
  } else if (atkDir === 'z2') {
    // Attack from opponent's zone 2 (our left side)
    pos[4].x = L + 30; pos[4].y = NET_CLOSE;
    pos[3].x = L + 80; pos[3].y = NET_CLOSE;
    pos[2].x = RC; pos[2].y = FRONT_BASE + 40;

    pos[5].x = L + 30; pos[5].y = BACK_BASE + 40;
    pos[6].x = C - 20; pos[6].y = MID_COURT + 30;
    pos[1].x = R - 50; pos[1].y = BACK_BASE;
  } else if (atkDir === 'z3') {
    pos[3].x = C; pos[3].y = NET_CLOSE;
    pos[2].x = C + 60; pos[2].y = NET_CLOSE; // join block
    pos[4].x = C - 60; pos[4].y = NET_CLOSE;

    pos[1].x = R - 50; pos[1].y = BACK_BASE;
    pos[6].x = C; pos[6].y = BACK_BASE + 20;
    pos[5].x = L + 50; pos[5].y = BACK_BASE;
  } else if (atkDir === 'pipe') {
    pos[3].x = C; pos[3].y = NET_CLOSE;
    pos[2].x = RC; pos[2].y = FRONT_BASE;
    pos[4].x = LC; pos[4].y = FRONT_BASE;

    pos[1].x = R - 40; pos[1].y = BACK_BASE + 30;
    pos[6].x = C; pos[6].y = BACK_BASE + 40;
    pos[5].x = L + 40; pos[5].y = BACK_BASE + 30;
  }

  enforceOverlapOnPositions(pos);
  return pos;
}

function enforceOverlapOnPositions(pos) {
  // Left-right front: z4.x < z3.x < z2.x
  if (pos[4] && pos[3] && pos[4].x >= pos[3].x) pos[4].x = pos[3].x - 35;
  if (pos[3] && pos[2] && pos[3].x >= pos[2].x) pos[3].x = pos[2].x - 35;

  // Left-right back: z5.x < z6.x < z1.x
  if (pos[5] && pos[6] && pos[5].x >= pos[6].x) pos[5].x = pos[6].x - 35;
  if (pos[6] && pos[1] && pos[6].x >= pos[1].x) pos[6].x = pos[1].x - 35;

  // Front-back (front must have lower y = closer to net):
  // z4.y < z5.y | z3.y < z6.y | z2.y < z1.y
  const pairs = [[4, 5], [3, 6], [2, 1]];
  pairs.forEach(([f, b]) => {
    if (pos[f] && pos[b] && pos[f].y >= pos[b].y) {
      pos[f].y = pos[b].y - 35;
    }
  });

  // Bounds
  for (let z = 1; z <= 6; z++) {
    if (!pos[z]) continue;
    pos[z].x = Math.max(CT.l + PLAYER_R, Math.min(CT.l + CT.w - PLAYER_R, pos[z].x));
    pos[z].y = Math.max(NET_Y + PLAYER_R + 5, Math.min(CT.t + CT.h - PLAYER_R, pos[z].y));
  }
}

function enforceOverlapLive() {
  const byZone = {};
  players.forEach(p => { if (p.zone) byZone[p.zone] = p; });

  if (byZone[4] && byZone[3] && byZone[4].x >= byZone[3].x) byZone[4].x = byZone[3].x - 30;
  if (byZone[3] && byZone[2] && byZone[3].x >= byZone[2].x) byZone[3].x = byZone[2].x - 30;
  if (byZone[5] && byZone[6] && byZone[5].x >= byZone[6].x) byZone[5].x = byZone[6].x - 30;
  if (byZone[6] && byZone[1] && byZone[6].x >= byZone[1].x) byZone[6].x = byZone[1].x - 30;

  [[4, 5], [3, 6], [2, 1]].forEach(([f, b]) => {
    if (byZone[f] && byZone[b] && byZone[f].y >= byZone[b].y) byZone[f].y = byZone[b].y - 30;
  });

  players.forEach(p => {
    if (p.team === 'home') {
      p.x = Math.max(CT.l + p.r, Math.min(CT.l + CT.w - p.r, p.x));
      p.y = Math.max(NET_Y + p.r + 5, Math.min(CT.t + CT.h - p.r, p.y));
    }
  });
}

// BUILD PLAYERS

function buildPlayers() {
  const oldNums = {};
  players.forEach(p => { if (p.num) oldNums[p.origRole || p.role] = p.num; });
  Object.assign(oldNums, playerNumbers);

  const positions = calcPositions();
  players = [];

  for (let z = 1; z <= 6; z++) {
    const p = positions[z];
    if (!p) continue;
    players.push({
      role: p.role,
      origRole: p.origRole,
      zone: z,
      x: p.x,
      y: p.y,
      isFront: p.isFront,
      isBack: p.isBack,
      team: 'home',
      r: PLAYER_R,
      num: oldNums[p.origRole] || playerNumbers[p.origRole] || '',
    });
  }

}

// RENDERING

function resize() {
  const w0 = document.querySelector('.canvas-wrap');
  const mW = w0.clientWidth - 16, mH = w0.clientHeight - 16;
  const ratio = V.W / V.H;
  let w, h;
  if (mW / mH > ratio) { h = mH; w = h * ratio; } else { w = mW; h = w / ratio; }
  canvas.width = Math.floor(w); canvas.height = Math.floor(h);
  sx = canvas.width / V.W; sy = canvas.height / V.H;
  render();
}
window.addEventListener('resize', resize);

function drawCourt() {
  const l = CT.l * sx, t = CT.t * sy, w = CT.w * sx, h = CT.h * sy, ny = NET_Y * sy;

  ctx.fillStyle = '#0d1628';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Single half-court (our side only)
  ctx.fillStyle = '#162a50';
  ctx.fillRect(l, t, w, h);

  // Court branding watermark (sponsor style)
  if (courtLogo.complete && courtLogo.naturalWidth > 0) {
    const wmH = Math.min(h * 0.72, w * 0.55);
    const wmW = Math.min(w * 0.96, wmH * 2);
    const alpha = 0.10;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(courtLogo, l + w * 0.5 - wmW * 0.5, t + h * 0.52 - wmH * 0.5, wmW, wmH);
    ctx.restore();
  }

  // 3m attack lines (solid)
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  const atkY1 = (NET_Y - ATK_LINE_DIST) * sy;
  const atkY2 = (NET_Y + ATK_LINE_DIST) * sy;
  ctx.beginPath(); ctx.moveTo(l, atkY1); ctx.lineTo(l + w, atkY1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l, atkY2); ctx.lineTo(l + w, atkY2); ctx.stroke();

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const tw = w / 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(l + tw * i, t); ctx.lineTo(l + tw * i, t + h); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Court border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(l, t, w, h);

  // Center line
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(l, ny); ctx.lineTo(l + w, ny); ctx.stroke();

  // NET
  const netH = 10 * sy;
  ctx.fillStyle = 'rgba(200,16,46,0.15)';
  ctx.fillRect(l - 8, ny - netH / 2, w + 16, netH);
  ctx.strokeStyle = '#c8102e';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(l - 12, ny); ctx.lineTo(l + w + 12, ny); ctx.stroke();

  // Net mesh
  ctx.strokeStyle = 'rgba(200,16,46,0.2)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 20; i++) {
    const px = l + i * (w / 19);
    ctx.beginPath(); ctx.moveTo(px, ny - netH / 2); ctx.lineTo(px, ny + netH / 2); ctx.stroke();
  }

  // Antennae
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(l - 4, ny - 16 * sy, 5, 32 * sy);
  ctx.fillRect(l + w - 1, ny - 16 * sy, 5, 32 * sy);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(l - 4, ny - 16 * sy, 5, 5);
  ctx.fillRect(l + w - 1, ny - 16 * sy, 5, 5);

  // Labels
  ctx.fillStyle = '#c8102e';
  ctx.font = `bold ${10 * sx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('NET', l + w / 2, ny - netH / 2 - 2);

  // Zone numbers
  if (showZoneNumbers) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = `bold ${42 * sx}px sans-serif`;
    ctx.textBaseline = 'middle';
    const hZ = { 1: [R, BACK_BASE], 2: [R, FRONT_BASE], 3: [C, FRONT_BASE], 4: [L, FRONT_BASE], 5: [L, BACK_BASE], 6: [C, BACK_BASE] };
    Object.entries(hZ).forEach(([z, [x, y]]) => ctx.fillText(z, x * sx, y * sy));
  }

  // Attack line labels
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = `${8 * sx}px sans-serif`;
  ctx.fillText('3m ATTACK LINE', l + w / 2, atkY2 + 11 * sy);
  ctx.fillText('3m ATTACK LINE', l + w / 2, atkY2 + 11 * sy);

}

function drawPlayerObj(p) {
  const px = p.x * sx, py = p.y * sy, r = p.r * sx;
  const isAway = p.team === 'away';
  const rc = ROLES[p.role] || ROLES[p.origRole] || { color: '#607080', label: p.role };

  // Shadow
  ctx.beginPath(); ctx.arc(px, py + 3, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();

  // Main circle
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(px - r * .3, py - r * .3, r * .1, px, py, r);
  if (isAway) {
    g.addColorStop(0, '#555'); g.addColorStop(1, '#222');
  } else {
    g.addColorStop(0, rc.color); g.addColorStop(1, shade(rc.color, -40));
  }
  ctx.fillStyle = g; ctx.fill();

  // Border
  ctx.strokeStyle = (selPlayer === p) ? '#fff' : (isAway ? '#555' : shade(rc.color, 25));
  ctx.lineWidth = (selPlayer === p) ? 3 : 1.5;
  ctx.stroke();

  if (selPlayer === p) {
    ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,16,46,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // Role label
  ctx.fillStyle = '#fff';
  const fs = (rc.label.length > 2 ? 9 : 12) * sx;
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(rc.label, px, py);

  // Zone badge
  if (showZoneNumbers && p.zone && p.team === 'home') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(px + r * .75, py - r * .75, 7 * sx, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ddd'; ctx.font = `bold ${7 * sx}px sans-serif`;
    ctx.fillText('Z' + p.zone, px + r * .75, py - r * .75);
  }

  // Number
  if (p.num) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${10 * sx}px sans-serif`;
    ctx.fillText('#' + p.num, px, py + r + 13 * sy);
  }
}

function drawBallObj() {
  if (!showBall || !ball) return;
  const bx = ball.x * sx, by = ball.y * sy, r = 13 * sx;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, r);
  g.addColorStop(0, '#fffde4'); g.addColorStop(1, '#e8c800');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#b89600'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(180,140,0,0.4)'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.arc(bx, by, r * .55, -.6, .6); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by, r * .55, 2.5, 3.7); ctx.stroke();
  if (selPlayer === ball) {
    ctx.beginPath(); ctx.arc(bx, by, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,200,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawAllDrawings() {
  drawings.forEach(d => {
    ctx.strokeStyle = d.color; ctx.lineWidth = d.w * sx; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (d.type === 'free') {
      if (d.pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(d.pts[0].x * sx, d.pts[0].y * sy);
      d.pts.forEach(p => ctx.lineTo(p.x * sx, p.y * sy)); ctx.stroke();
    } else if (d.type === 'arrow') {
      arrowFn(d.a.x * sx, d.a.y * sy, d.b.x * sx, d.b.y * sy, d.color, d.w * sx);
    } else if (d.type === 'curve') {
      if (d.pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(d.pts[0].x * sx, d.pts[0].y * sy);
      for (let i = 1; i < d.pts.length - 1; i++) {
        const xc = (d.pts[i].x + d.pts[i + 1].x) / 2 * sx;
        const yc = (d.pts[i].y + d.pts[i + 1].y) / 2 * sy;
        ctx.quadraticCurveTo(d.pts[i].x * sx, d.pts[i].y * sy, xc, yc);
      }
      ctx.lineTo(d.pts[d.pts.length - 1].x * sx, d.pts[d.pts.length - 1].y * sy);
      ctx.stroke();
      if (d.pts.length >= 2) {
        const p1 = d.pts[d.pts.length - 2], p2 = d.pts[d.pts.length - 1];
        arrowHeadFn(p1.x * sx, p1.y * sy, p2.x * sx, p2.y * sy, d.color, d.w * sx);
      }
    } else if (d.type === 'zone') {
      const x = Math.min(d.a.x, d.b.x) * sx, y = Math.min(d.a.y, d.b.y) * sy;
      const w = Math.abs(d.b.x - d.a.x) * sx, h2 = Math.abs(d.b.y - d.a.y) * sy;
      ctx.fillStyle = d.color + '18'; ctx.fillRect(x, y, w, h2);
      ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h2);
    } else if (d.type === 'text') {
      ctx.fillStyle = d.color; ctx.font = `bold ${14 * sx}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(d.text, d.x * sx, d.y * sy);
    }
  });

  if (curDraw && curDraw.type === 'free' && curDraw.pts.length > 1) {
    ctx.strokeStyle = curDraw.color; ctx.lineWidth = curDraw.w * sx; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(curDraw.pts[0].x * sx, curDraw.pts[0].y * sy);
    curDraw.pts.forEach(p => ctx.lineTo(p.x * sx, p.y * sy)); ctx.stroke();
  }
}

function arrowFn(x1, y1, x2, y2, c, w) {
  ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  arrowHeadFn(x1, y1, x2, y2, c, w);
}

function arrowHeadFn(x1, y1, x2, y2, c, w) {
  const a = Math.atan2(y2 - y1, x2 - x1), hl = 14 * sx;
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hl * Math.cos(a - .35), y2 - hl * Math.sin(a - .35));
  ctx.lineTo(x2 - hl * Math.cos(a + .35), y2 - hl * Math.sin(a + .35));
  ctx.closePath(); ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCourt();
  drawAllDrawings();
  drawBallObj();
  players.forEach(drawPlayerObj);
  updateStatus();
}

// INTERACTION

function gp(e) {
  const r = canvas.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (cx - r.left) / sx, y: (cy - r.top) / sy };
}
function gpEnd(e) {
  const r = canvas.getBoundingClientRect();
  const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  return { x: (cx - r.left) / sx, y: (cy - r.top) / sy };
}

function findHit(pos) {
  for (let i = players.length - 1; i >= 0; i--) {
    if (Math.hypot(pos.x - players[i].x, pos.y - players[i].y) < players[i].r + 6)
      return { type: 'player', obj: players[i], idx: i };
  }
  if (showBall && ball && Math.hypot(pos.x - ball.x, pos.y - ball.y) < 18)
    return { type: 'ball', obj: ball, idx: 0 };
  return null;
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); onUp(e); }, { passive: false });

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const pos = gp(e);
  const hit = findHit(pos);
  if (hit && (hit.type === 'player' || hit.type === 'opp')) {
    ctxTarget = hit;
    const m = document.getElementById('ctxMenu');
    m.style.display = 'block'; m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
  }
});
document.addEventListener('click', () => { document.getElementById('ctxMenu').style.display = 'none'; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && presentationMode) {
    e.preventDefault();
    togglePresentationMode(false);
  } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    togglePresentationMode();
  } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
    e.preventDefault();
    redo();
  }
});

canvas.addEventListener('dblclick', e => {
  const pos = gp(e);
  if (tool === 'curve' && curvePoints.length >= 2) {
    curvePoints.push(pos);
    drawings.push({ type: 'curve', pts: [...curvePoints], color: dColor, w: lineW });
    curvePoints = []; render(); commitHistory(); return;
  }
  const hit = findHit(pos);
  if (hit && (hit.type === 'player' || hit.type === 'opp')) {
    const n = prompt('Player number:', hit.obj.num || '');
    if (n !== null) {
      hit.obj.num = n;
      if (hit.obj.origRole) playerNumbers[hit.obj.origRole] = n;
      render();
      commitHistory();
    }
  }
});

function onDown(e) {
  const pos = gp(e);
  hideCtx();
  if (tool === 'select') {
    dragMoved = false;
    const hit = findHit(pos);
    if (hit) {
      drag = hit; dragOff = { x: pos.x - hit.obj.x, y: pos.y - hit.obj.y };
      selPlayer = hit.obj;
    } else { selPlayer = null; }
    render();
  } else if (tool === 'draw') {
    curDraw = { type: 'free', pts: [pos], color: dColor, w: lineW };
  } else if (tool === 'arrow') {
    lineStart = pos;
  } else if (tool === 'curve') {
    if (curvePoints.length === 0) curvePoints = [pos]; else curvePoints.push(pos);
  }
}

function onMove(e) {
  const pos = gp(e);
  if (tool === 'select' && drag) {
    drag.obj.x = pos.x - dragOff.x;
    drag.obj.y = pos.y - dragOff.y;
    dragMoved = true;
    if (drag.type === 'player') enforceOverlapLive();
    if (drag.type === 'opp') {
      drag.obj.x = Math.max(CT.l + drag.obj.r, Math.min(CT.l + CT.w - drag.obj.r, drag.obj.x));
      drag.obj.y = Math.max(CT.t + drag.obj.r, Math.min(NET_Y - drag.obj.r - 5, drag.obj.y));
    }
    if (drag.type === 'ball') {
      ball.x = Math.max(CT.l + 10, Math.min(CT.l + CT.w - 10, ball.x));
      ball.y = Math.max(CT.t + 10, Math.min(CT.t + CT.h - 10, ball.y));
    }
    render();
  } else if (tool === 'draw' && curDraw) {
    curDraw.pts.push(pos); render();
  } else if (tool === 'arrow' && lineStart) {
    render();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = dColor + '88'; ctx.lineWidth = lineW * sx;
    ctx.beginPath(); ctx.moveTo(lineStart.x * sx, lineStart.y * sy);
    ctx.lineTo(pos.x * sx, pos.y * sy); ctx.stroke();
    ctx.setLineDash([]);
  } else if (tool === 'curve' && curvePoints.length > 0) {
    render();
    ctx.strokeStyle = dColor + '55'; ctx.lineWidth = lineW * sx; ctx.setLineDash([4, 4]);
    const lp = curvePoints[curvePoints.length - 1];
    ctx.beginPath(); ctx.moveTo(lp.x * sx, lp.y * sy); ctx.lineTo(pos.x * sx, pos.y * sy); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function onUp(e) {
  const pos = gpEnd(e);
  if (tool === 'select') {
    if (drag && dragMoved) commitHistory();
    drag = null;
    dragMoved = false;
  }
  else if (tool === 'draw' && curDraw) {
    if (curDraw.pts.length > 2) drawings.push(curDraw);
    curDraw = null; render(); commitHistory();
  } else if (tool === 'arrow' && lineStart) {
    if (Math.hypot(pos.x - lineStart.x, pos.y - lineStart.y) > 10)
      drawings.push({ type: 'arrow', a: lineStart, b: pos, color: dColor, w: lineW });
    lineStart = null; render(); commitHistory();
  }
}

// CONTROLS

function updateFlowInfo() {
  const info = document.getElementById('flowInfo');
  if (!info) return;
  const serveTxt = rallyServeBy === 'us' ? 'Our serve' : 'Opponent serve';
  const stateTxt = rallyState === 'pre_serve' ? 'pre-serve' : 'rally live';
  info.textContent = `Flow: ${serveTxt} | ${stateTxt}`;
}

function flowStartOurServe() {
  rallyServeBy = 'us';
  rallyState = 'pre_serve';
  setPhase('serving', { syncFlow: false, commit: false });
  updateFlowInfo();
  commitHistory();
}

function flowStartOppServe() {
  rallyServeBy = 'opp';
  rallyState = 'pre_serve';
  setPhase('receive', { syncFlow: false, commit: false });
  updateFlowInfo();
  commitHistory();
}

function flowServeContact() {
  if (rallyState !== 'pre_serve') return;
  rallyState = 'rally';
  if (rallyServeBy === 'us') {
    setPhase('defense', { syncFlow: false, commit: false });
  } else {
    buildPlayers();
    syncUIFromState();
    updateInfoBox();
    updateFlowInfo();
    render();
  }
  commitHistory();
}

function flowWinRally() {
  if (rallyServeBy === 'opp') rot = rot === 6 ? 1 : rot + 1; // side-out rotation
  rallyServeBy = 'us';
  rallyState = 'pre_serve';
  setPhase('serving', { syncFlow: false, commit: false });
  updateFlowInfo();
  commitHistory();
}

function flowLoseRally() {
  rallyServeBy = 'opp';
  rallyState = 'pre_serve';
  setPhase('receive', { syncFlow: false, commit: false });
  updateFlowInfo();
  commitHistory();
}

function setTool(t) {
  tool = t; curvePoints = [];
  document.querySelectorAll('.tool-row button[id]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('t' + t.charAt(0).toUpperCase() + t.slice(1));
  if (btn) btn.classList.add('active');
  canvas.style.cursor = t === 'select' ? 'grab' : 'crosshair';
  document.getElementById('sR').textContent = t.charAt(0).toUpperCase() + t.slice(1) + ' mode';
  commitHistory();
}

function pickColor(c, el) {
  dColor = c;
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  if (el) el.classList.add('active');
  commitHistory();
}

function setRot(r) {
  rot = r;
  buildPlayers();
  syncUIFromState();
  updateInfoBox();
  render();
  commitHistory();
}

function rotPrev() { setRot(rot === 1 ? 6 : rot - 1); }
function rotNext() { setRot(rot === 6 ? 1 : rot + 1); }

function setFormation(f) {
  formation = f;
  buildPlayers();
  syncUIFromState();
  updateInfoBox();
  render();
  commitHistory();
}

function setPhase(p, opts = {}) {
  const syncFlow = opts.syncFlow !== false;
  const shouldCommit = opts.commit !== false;
  phase = p;
  if (syncFlow) {
    if (p === 'serving') {
      rallyServeBy = 'us';
      rallyState = 'pre_serve';
    } else if (p === 'receive') {
      rallyServeBy = 'opp';
      rallyState = 'pre_serve';
    } else {
      rallyState = 'rally';
    }
  }
  buildPlayers();
  syncUIFromState();
  updateInfoBox();
  updateFlowInfo();
  render();
  if (shouldCommit) commitHistory();
}

function setRecvShape(s) {
  recvShape = s;
  if (phase !== 'receive') setPhase('receive');
  else {
    buildPlayers();
    updateInfoBox();
    render();
    commitHistory();
  }
}
function setDefVs(d) {
  defVs = d;
  if (phase !== 'defense') setPhase('defense');
  else {
    buildPlayers();
    updateInfoBox();
    render();
    commitHistory();
  }
}

function toggleBall() {
  if (showBall) { showBall = false; ball = null; }
  else { showBall = true; ball = { x: C, y: NET_Y - 60 }; }
  render();
  syncUIFromState();
  commitHistory();
}

function toggleZoneNumbers() {
  showZoneNumbers = !showZoneNumbers;
  syncUIFromState();
  render();
  commitHistory();
}

function togglePresentationMode(forceState = null) {
  presentationMode = forceState === null ? !presentationMode : !!forceState;
  document.body.classList.toggle('presentation-mode', presentationMode);
  syncUIFromState();
  setTimeout(resize, 0);
}

function clearDraw() {
  drawings = [];
  render();
  commitHistory();
}
function resetAll() {
  drawings = []; ball = null; showBall = false; rot = 1; phase = 'serving';
  formation = '5-1'; recvShape = '3p'; defVs = 'z4';
  playerNumbers = {};
  showOpp = false;
  showZoneNumbers = true;
  rallyServeBy = 'us';
  rallyState = 'pre_serve';
  buildPlayers();
  syncUIFromState();
  updateInfoBox();
  updateFlowInfo();
  render();
  commitHistory();
}

function hideCtx() { document.getElementById('ctxMenu').style.display = 'none'; }
function ctxNum() {
  if (!ctxTarget) return; hideCtx();
  const n = prompt('Player number:', ctxTarget.obj.num || '');
  if (n !== null) {
    ctxTarget.obj.num = n;
    if (ctxTarget.obj.origRole) playerNumbers[ctxTarget.obj.origRole] = n;
    render();
    commitHistory();
  }
}
function ctxRole() {
  if (!ctxTarget) return; hideCtx();
  const r = prompt('New role (S, OH, MB, OPP, L):', ctxTarget.obj.role);
  if (r && ROLES[r.toUpperCase()]) {
    ctxTarget.obj.role = r.toUpperCase();
    render();
    commitHistory();
  }
}
function ctxDel() {
  if (!ctxTarget) return; hideCtx();
  if (ctxTarget.type === 'player') players.splice(ctxTarget.idx, 1);
  ctxTarget = null;
  render();
  commitHistory();
}

function updateStatus() {
  document.getElementById('sL').textContent =
    `${formation} | R${rot} | ${phase.charAt(0).toUpperCase() + phase.slice(1)}` +
    (phase === 'defense' ? ` vs ${defVs}` : '') +
    ` | ${players.length} players`;
}

function updateInfoBox() {
  const info = document.getElementById('recvInfo');
  if (!info) return;
  if (phase === 'receive') {
    const setter = players.find(p => p.origRole === 'S');
    const sZone = setter ? setter.zone : '?';
    const sRow = setter ? (setter.isFront ? 'FRONT' : 'BACK') : '?';
    info.textContent = `Setter in Z${sZone} (${sRow} row). ${sRow === 'BACK' ? 'Setter penetrates to net.' : 'Setter already front.'}`;
  } else if (phase === 'defense') {
    info.textContent = `Defending vs attack from ${defVs.toUpperCase()}. Blockers shift to that zone, back row adjusts.`;
  } else {
    info.textContent = `Z1 serves. Other players in base positions.`;
  }
}

function shade(c, pct) {
  const n = parseInt(c.replace('#', ''), 16), a = Math.round(2.55 * pct);
  const R = Math.min(255, Math.max(0, (n >> 16) + a));
  const G = Math.min(255, Math.max(0, (n >> 8 & 0xFF) + a));
  const B = Math.min(255, Math.max(0, (n & 0xFF) + a));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// BOOT
buildPlayers();
syncUIFromState();
updateInfoBox();
updateFlowInfo();
setTimeout(resize, 50);
setTimeout(() => commitHistory(), 80);
