const params = new URLSearchParams(window.location.search);
const matchId = params.get("match");
const refereeToken = params.get("token");
let currentState = null;

const roleLabels = { setter: "S", opposite: "O", middleOne: "M1", middleTwo: "M2", hitterOne: "H1", hitterTwo: "H2", libero: "L" };
const receiveTemplates = {
  1: { middleTwo:[16,18], opposite:[9,14], hitterTwo:[27,65], hitterOne:[73,65], libero:[50,77], setter:[88,77] },
  2: { opposite:[63,14], setter:[52,29], middleTwo:[77,29], hitterTwo:[27,69], hitterOne:[73,69], libero:[50,82] },
  3: { middleOne:[8,14], setter:[42,24], opposite:[90,18], hitterTwo:[25,68], hitterOne:[53,80], libero:[79,68] },
  4: { setter:[8,14], middleOne:[17,25], hitterTwo:[25,68], hitterOne:[53,80], libero:[79,68], opposite:[88,94] },
  5: { setter:[67,15], middleOne:[82,23], hitterOne:[24,68], hitterTwo:[78,68], libero:[51,80], opposite:[62,94] },
  6: { middleTwo:[3,16], setter:[76,13], hitterOne:[23,66], hitterTwo:[50,78], libero:[77,66], opposite:[29,94] }
};

function escapeHtml(value) { const div = document.createElement("div"); div.textContent = String(value ?? "-"); return div.innerHTML; }
function byId(id) { return document.getElementById(id); }
function teamData(state, team) { const home = team === "home"; return { name: home ? state.homeTeam : state.awayTeam, court: home ? state.homeCourt || [] : state.awayCourt || [], base: home ? state.homeBaseRotation || [] : state.awayBaseRotation || [], libero: home ? state.homeLibero : state.awayLibero, system: home ? state.homeSystem : state.awaySystem, rotations: home ? state.homeRotationCount || 0 : state.awayRotationCount || 0, roleMap: home ? state.homeRoleMap || {} : state.awayRoleMap || {}, pairs: home ? state.homeSubstitutionPairs || [] : state.awaySubstitutionPairs || [], subs: home ? state.homeSubsUsed || 0 : state.awaySubsUsed || 0 }; }
function serveOrder(base) { return [base[0],base[1],base[2],base[3],base[4],base[5]].filter(Boolean); }
function activeRole(team, number) { const pair = team.pairs.find(item => item.original === number && !item.closed); return pair ? pair.replacement : number; }

function renderRotationCard(state, teamKey) {
  const team = teamData(state, teamKey); const serving = state.serving === teamKey; const labels=["P1","P2","P3","P4","P5","P6"]; const display=[3,2,1,4,5,0]; const order=serveOrder(team.base);
  const cells = display.map(i => `<div class="rotation-cell ${serving && i===0 ? "server" : ""} ${team.libero && team.court[i]===team.libero ? "libero" : ""}"><span>${labels[i]}</span><strong>${escapeHtml(team.court[i])}</strong></div>`).join("");
  return `<article class="rotation-card ${serving ? "serving" : ""}"><header><h3>${escapeHtml(team.name)}</h3><span class="state-badge">${serving ? "Serving" : "Receiving"}</span></header><div class="rotation-grid">${cells}</div><div class="rotation-summary"><div><span>Current server</span><b>${serving && order[0] ? "#" + escapeHtml(order[0]) : "--"}</b></div><div><span>Next</span><b>${order.slice(1,3).map(n=>"#"+escapeHtml(n)).join(", ") || "--"}</b></div><div><span>Libero</span><b>${team.libero ? "#" + escapeHtml(team.libero) : "--"}</b></div></div></article>`;
}

function renderReceive(state) {
  const receiving = state.serving === "home" ? "away" : "home"; const team = teamData(state, receiving); const section=byId("receiveSection");
  if (team.system === "6-0") { section.classList.add("hidden"); return; }
  const number = (team.rotations % 6) + 1; const template=receiveTemplates[number]; const players=byId("receivePlayers");
  byId("receiveTitle").textContent = `${team.name} receiving`;
  byId("receiveMeta").textContent = `5-1 · Rotation ${number}`;
  players.innerHTML = Object.entries(template).map(([role, position]) => { const num=role === "libero" ? team.libero : activeRole(team, team.roleMap[role]); return `<span class="receive-player ${role === "libero" ? "libero" : role === "setter" ? "setter" : ""}" style="left:${position[0]}%;top:${position[1]}%"><em>${roleLabels[role]}</em><small>${num ? "#"+escapeHtml(num) : "--"}</small></span>`; }).join("");
  section.classList.remove("hidden");
}

function render(state, updatedAt) {
  currentState=state; const set=state.sets?.[state.sets.length-1] || {}; byId("homeName").textContent=state.homeTeam||"Team A"; byId("awayName").textContent=state.awayTeam||"Team B"; byId("homeScore").textContent=set.homePoints ?? "-"; byId("awayScore").textContent=set.awayPoints ?? "-"; byId("homeSets").textContent=state.homeSetsWon??0; byId("awaySets").textContent=state.awaySetsWon??0; byId("setNumber").textContent=set.setNumber||state.currentSet||1; byId("serveState").textContent=`${state.serving === "home" ? state.homeTeam : state.awayTeam} serving`; byId("matchLabel").textContent=state.id||"Live match"; byId("rotationCards").innerHTML=renderRotationCard(state,"home")+renderRotationCard(state,"away"); byId("updatedAt").textContent=updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}` : "Live"; renderReceive(state);
}

function setConnection(message, state="") { const el=byId("connectionState"); el.textContent=message; el.className=`connection-state ${state}`; }
async function loadMatch() {
  if (!matchId || !refereeToken) { byId("errorMessage").textContent="This referee link is incomplete."; byId("errorMessage").classList.remove("hidden"); setConnection("Link error","error"); return; }
  try { const config=window.IVI_LIVE_CONFIG; const response=await fetch(`${config.functionUrl}?match_id=${encodeURIComponent(matchId)}&token=${encodeURIComponent(refereeToken)}`, { cache:"no-store" }); const result=await response.json(); if(!response.ok) throw new Error(result.error||"Could not load match."); render(result.state,result.updated_at); byId("errorMessage").classList.add("hidden"); setConnection(result.status === "finished" ? "Match finished" : "Live", result.status === "finished" ? "" : "live"); } catch(error) { byId("errorMessage").textContent=error.message||"Connection unavailable."; byId("errorMessage").classList.remove("hidden"); setConnection("Reconnecting","error"); }
}
loadMatch(); window.setInterval(loadMatch, 1200);
