/* End-to-end check against a running server.
   Start the app (npm run dev) in one terminal, then:  node test/api.test.mjs   */
const B = process.env.BASE || "http://localhost:3131";
const post = async (p, body) =>
  (await fetch(B + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const state = async (code, pid) => (await fetch(`${B}/api/state?code=${code}&pid=${pid}`)).json();
let pass = 0;
const ok = (c, m) => { if (!c) { console.error("  FAIL - " + m); process.exitCode = 1; throw new Error(m); } pass++; console.log("  ok - " + m); };

for (let i = 0; i < 40; i++) { try { if ((await fetch(B)).ok) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }

console.log("\n1. host opens a room");
const host = await post("/api/room", { name: "Suppu" });
ok(host.code?.length === 4, `room code is four letters (${host.code})`);
const code = host.code;

console.log("\n2. seven guests join on their own phones");
const players = [{ name: "Suppu", id: host.playerId }];
for (const n of ["Sneha", "Naveen", "Maya", "Arjun", "Divya", "Rohan", "Priya"]) {
  const j = await post("/api/join", { code, name: n });
  ok(!j.error, `${n} joined`);
  players.push({ name: n, id: j.playerId });
}
let v = (await state(code, host.playerId)).view;
ok(v.players.length === 8, "eight players in the waiting room");
ok(v.score === 0 && v.maxScore === 32, "one shared score, best possible 32 over 8 rounds");
ok(v.players.every((p) => p.team === undefined), "nobody is put on a team");

console.log("\n3. bad code, and rejoining after a phone locks");
ok((await post("/api/join", { code: "ZZZZ", name: "Ghost" })).error === "no_room", "unknown code is rejected");
const re = await post("/api/join", { code, name: "priya" });
ok(!re.error, "rejoining by name reclaims the same seat");
players.find(p => p.name === "Priya").id = re.playerId;
ok((await state(code, host.playerId)).view.players.length === 8, "rejoin did not duplicate the player");

console.log("\n4. only the host can configure and start");
ok((await post("/api/action", { code, playerId: players[1].id, type: "setRounds", payload: { rounds: 4 } })).error === "not_host", "a guest cannot change the round count");
ok(!(await post("/api/action", { code, playerId: host.playerId, type: "setRounds", payload: { rounds: 4 } })).error, "the host set four rounds");
ok((await post("/api/action", { code, playerId: players[1].id, type: "start" })).error === "not_host", "a guest cannot start the game");
ok(!(await post("/api/action", { code, playerId: host.playerId, type: "start" })).error, "the host started the game");

console.log("\n5. the target never reaches a phone that must not see it");
v = (await state(code, host.playerId)).view;
const psychicId = v.psychicId;
ok((await state(code, psychicId)).view.target !== null, "the psychic receives the target");
for (const p of players.filter(p => p.id !== psychicId)) {
  ok((await state(code, p.id)).view.target === null, `${p.name} does not receive the target`);
}

console.log("\n6. one round, with the psychic held to silence");
const a = players.find(p => p.id !== psychicId);
const b = players.find(p => p.id !== psychicId && p.id !== a.id);
ok((await post("/api/action", { code, playerId: a.id, type: "clue", payload: { clue: "x" } })).error === "not_psychic", "only the psychic can give the clue");
ok(!(await post("/api/action", { code, playerId: psychicId, type: "clue", payload: { clue: "A filter kaapi kind of morning" } })).error, "the psychic locked the clue");
ok((await state(code, a.id)).view.clue === "A filter kaapi kind of morning", "the clue reads exactly as typed, not shouted in caps");
ok((await post("/api/action", { code, playerId: psychicId, type: "dial", payload: { dial: .5 } })).error === "psychic_silent", "the psychic cannot nudge the dial");
ok((await post("/api/action", { code, playerId: psychicId, type: "lock" })).error === "psychic_silent", "the psychic cannot lock it in either");
ok(!(await post("/api/action", { code, playerId: a.id, type: "dial", payload: { dial: .40 } })).error, `${a.name} moved the dial`);
ok(!(await post("/api/action", { code, playerId: b.id, type: "dial", payload: { dial: .72 } })).error, `${b.name} moved the same shared dial`);
ok((await state(code, host.playerId)).view.dial === .72, "one shared dial, live on every phone");
ok(!(await post("/api/action", { code, playerId: b.id, type: "lock" })).error, "anyone but the psychic can lock it in");
v = (await state(code, a.id)).view;
ok(v.phase === "reveal" && v.target !== null, "at the reveal every phone finally sees the target");
ok(v.score === v.lastScore.pts, "the round's points went into the shared total");

console.log("\n7. playing to the final whistle");
let guard = 0, seenPsychics = new Set(), scales = new Set();
while (v.phase !== "done" && guard++ < 40) {
  if (v.phase === "clue") {
    seenPsychics.add(v.psychicId);
    scales.add(v.card.l + "/" + v.card.r);
    await post("/api/action", { code, playerId: v.psychicId, type: "clue", payload: { clue: "Clue " + guard } });
  } else if (v.phase === "guess") {
    const g = players.find(p => p.id !== v.psychicId);
    await post("/api/action", { code, playerId: g.id, type: "dial", payload: { dial: Math.random() } });
    await post("/api/action", { code, playerId: g.id, type: "lock" });
  } else if (v.phase === "reveal") {
    await post("/api/action", { code, playerId: host.playerId, type: "next" });
  }
  v = (await state(code, host.playerId)).view;
}
ok(v.phase === "done", `reached the final screen (${v.score} of ${v.maxScore}, "${v.rating}")`);
ok(scales.size === v.totalRounds - 1, "every remaining round dealt a different scale");

console.log("\n8. eight phones tapping at once");
await post("/api/action", { code, playerId: host.playerId, type: "backToLobby" });
const before = (await state(code, host.playerId)).view.v;
await Promise.all(players.map(p => post("/api/action", { code, playerId: p.id, type: "react", payload: { reaction: "fire" } })));
const after = (await state(code, host.playerId)).view;
ok(after.v > before, "eight concurrent reactions all landed");
ok(after.players.length === 8, "the room survived the concurrent writes");

console.log(`\n${pass} checks passed\n`);
