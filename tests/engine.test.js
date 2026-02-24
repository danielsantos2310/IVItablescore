const assert = require('node:assert/strict');

const CT = { l: 50, t: 30, w: 700, h: 820 };
const NET_Y = 440;
const PLAYER_R = 22;

const LINEUP_51 = ['S', 'OH', 'MB', 'OPP', 'OH2', 'MB2'];
const LINEUP_42 = ['S', 'OH', 'MB', 'S2', 'OH2', 'MB2'];
const LINEUP_62 = ['S', 'OH', 'MB', 'S2', 'OH2', 'MB2'];

function getLineup(formation) {
  if (formation === '4-2') return LINEUP_42;
  if (formation === '6-2') return LINEUP_62;
  return LINEUP_51;
}

function getZoneRole(formation, rot, zone) {
  const lineup = getLineup(formation);
  const idx = (zone - 1 + (rot - 1) + 600) % 6;
  return lineup[idx];
}

function enforceOverlapOnPositions(pos) {
  if (pos[4] && pos[3] && pos[4].x >= pos[3].x) pos[4].x = pos[3].x - 35;
  if (pos[3] && pos[2] && pos[3].x >= pos[2].x) pos[3].x = pos[2].x - 35;
  if (pos[5] && pos[6] && pos[5].x >= pos[6].x) pos[5].x = pos[6].x - 35;
  if (pos[6] && pos[1] && pos[6].x >= pos[1].x) pos[6].x = pos[1].x - 35;

  [[4, 5], [3, 6], [2, 1]].forEach(([f, b]) => {
    if (pos[f] && pos[b] && pos[f].y >= pos[b].y) pos[f].y = pos[b].y - 35;
  });

  for (let z = 1; z <= 6; z++) {
    if (!pos[z]) continue;
    pos[z].x = Math.max(CT.l + PLAYER_R, Math.min(CT.l + CT.w - PLAYER_R, pos[z].x));
    pos[z].y = Math.max(NET_Y + PLAYER_R + 5, Math.min(CT.t + CT.h - PLAYER_R, pos[z].y));
  }
}

function testRotationMapping() {
  assert.equal(getZoneRole('5-1', 1, 1), 'S');
  assert.equal(getZoneRole('5-1', 1, 2), 'OH');
  assert.equal(getZoneRole('5-1', 2, 1), 'OH');
  assert.equal(getZoneRole('5-1', 2, 6), 'S');
  assert.equal(getZoneRole('4-2', 1, 4), 'S2');
}

function testOverlapAndBounds() {
  const pos = {
    1: { x: 620, y: 560 },
    2: { x: 610, y: 580 },
    3: { x: 610, y: 600 },
    4: { x: 615, y: 620 },
    5: { x: 650, y: 590 },
    6: { x: 640, y: 590 },
  };
  enforceOverlapOnPositions(pos);
  assert.ok(pos[4].x < pos[3].x);
  assert.ok(pos[3].x < pos[2].x);
  assert.ok(pos[5].x < pos[6].x);
  assert.ok(pos[6].x < pos[1].x);
  assert.ok(pos[4].y < pos[5].y);
  assert.ok(pos[3].y < pos[6].y);
  assert.ok(pos[2].y < pos[1].y);
}

function testBoundsClamp() {
  const pos = {
    1: { x: -10, y: 0 },
    2: { x: 900, y: 1200 },
  };
  enforceOverlapOnPositions(pos);
  assert.ok(pos[1].x >= CT.l + PLAYER_R);
  assert.ok(pos[1].y >= NET_Y + PLAYER_R + 5);
  assert.ok(pos[2].x <= CT.l + CT.w - PLAYER_R);
  assert.ok(pos[2].y <= CT.t + CT.h - PLAYER_R);
}

testRotationMapping();
testOverlapAndBounds();
testBoundsClamp();
console.log('engine tests passed');
