// Runs the scoring engine embedded in index.html (extracted between markers) — tests the exact shipped code.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const eng = html.slice(html.indexOf('/*ENGINE-START*/'), html.indexOf('/*ENGINE-END*/'));
const crs = html.slice(html.indexOf('var BUILTIN_COURSES'), html.indexOf('(function(){\n\'use strict\''));
const ctx = {}; vm.createContext(ctx); vm.runInContext(eng + '\n' + crs + '\nthis.Engine=Engine;this.C=BUILTIN_COURSES;', ctx);
const E = ctx.Engine, yolo = ctx.C[0];
let pass = 0, fail = 0;
function t(name, fn){ try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); } }
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
const PARS = yolo.tees[0].pars;
const settings = (o) => Object.assign({ bet: 2, games: { stableford: true, nassau: true, skins: true }, strokeMode: 'low', skinsCarry: true, nassauTeams: false, teamPairing: 0, nassauMode: 'match' }, o || {});
function zeroSum(r){ const s = r.total.reduce((a, b) => a + b, 0); assert.ok(Math.abs(s) < 1e-9, 'total not zero: ' + s);
  ['stableford','nassau','skins'].forEach(g => { if (r[g]) assert.ok(Math.abs(r[g].money.reduce((a,b)=>a+b,0)) < 1e-9, g + ' not zero-sum'); });
  const bal = r.total.map(() => 0); r.settlements.forEach(s => { bal[s.from] -= s.amount; bal[s.to] += s.amount; });
  bal.forEach((v, i) => assert.ok(Math.abs(v - r.total[i]) < 0.011, 'settlement mismatch for player ' + i)); }

console.log('Course data');
t('Yolo Fliers: 11 tees, par 72, SI 1-18 unique, yardage totals', () => {
  eq(yolo.tees.length, 11);
  const tot = { black: 6858, blue: 6496, bw: 6115, white: 5975, wg: 5540, gold: 5141 };
  yolo.tees.forEach(tee => { eq(tee.pars.reduce((a,b)=>a+b), 72); eq(tee.si.slice().sort((a,b)=>a-b), Array.from({length:18},(_, i)=>i+1));
    const key = tee.id.replace('-w',''); eq(tee.yards.reduce((a,b)=>a+b), tot[key], tee.name); });
});

console.log('Handicap math');
const tee = id => yolo.tees.find(x => x.id === id);
t('Course handicap (WHS) for Yolo tees', () => {
  eq(E.courseHandicap(12.4, tee('blue')), 13);   // 12.4*125/113 - 0.8 = 12.92
  eq(E.courseHandicap(6.1, tee('blue')), 6);     // 5.95
  eq(E.courseHandicap(24.0, tee('white')), 22);  // 24*120/113 - 3.4 = 22.09
  eq(E.courseHandicap(-2.0, tee('black')), -1);  // +2.0: -2.27 + 1.0 = -1.27 -> +1
  eq(E.courseHandicap(20.0, tee('white-w')), 25); // 20*127/113 + 2.3 = 24.78
  eq(E.courseHandicap(0, tee('gold')), -8);       // 64.4 - 72 = -7.6 -> -8 (shown as +8)
});
t('Index parsing / plus format', () => { eq(E.parseIndex('+2.0'), -2); eq(E.parseIndex('12,4'), 12.4); eq(E.fmtIndex(-0.8), '+0.8'); eq(E.fmtCH(-1), '+1'); assert.ok(isNaN(E.parseIndex(''))); });
t('Stroke allocation incl. >18 and plus', () => {
  const alloc = h => tee('blue').si.map(s => E.strokesOnHole(h, s));
  eq(alloc(13).reduce((a,b)=>a+b), 13); eq(alloc(22).reduce((a,b)=>a+b), 22); eq(alloc(36).reduce((a,b)=>a+b), 36); eq(alloc(-1).reduce((a,b)=>a+b), -1);
  eq(alloc(22)[4], 2);   // hole 5 = SI 1
  eq(alloc(22)[3], 1);   // hole 4 = SI 5 -> 1 stroke at 22 (2nd strokes only on SI 1-4)
  eq(alloc(23)[3], 2);   // at 23 SI 5 gets a 2nd
  eq(alloc(-1)[14], -1); // plus 1 gives back on SI 18 (hole 15)
  eq(alloc(-1).filter(x=>x!==0).length, 1);
});

console.log('Two-player scenario (scratch vs scratch, $2)');
const flat = { id: 'flat', name: 'Flat', courses: 0, tees: [{ id: 'f', name: 'F', gender: 'M', rating: 72, slope: 113, par: 72, pars: PARS, si: tee('blue').si, yards: [] }] };
const X = PARS.slice();
const yd = [-1, +1, 0, 0, -1, 0, 0, 0, 0,  0, 0, 0, 0, 0, 0, 0, 0, +1];
const Y = PARS.map((p, i) => p + yd[i]);
const two = (o, sc) => E.computeRound({ players: [{ name: 'X', index: 0, teeId: 'f' }, { name: 'Y', index: 0, teeId: 'f' }], scores: sc || [X, Y], settings: settings(o) }, flat);
t('Nassau match play: Y wins front, X wins back, overall halved', () => {
  const r = two(); const s = r.nassau.matches[0].segments;
  eq(s.map(x => x.result), ['b', 'a', 'push']); eq(r.nassau.money, [0, 0]);
});
t('Nassau stroke play: front Y -1, back X, overall tied', () => {
  const r = two({ nassauMode: 'stroke' }); eq(r.nassau.matches[0].segments.map(x => x.result), ['b', 'a', 'push']);
});
t('Skins with carryover: X 14 skins (13 carried onto 18), Y 4', () => {
  const r = two(); eq(r.skins.won, [14, 4]); eq(r.skins.money, [20, -20]);
  eq(r.skins.holes[4].value, 3); eq(r.skins.holes[17].value, 13); eq(r.skins.carryLeft, 0);
});
t('Skins without carryover: 2-2, $0', () => { const r = two({ skinsCarry: false }); eq(r.skins.won, [2, 2]); eq(r.skins.money, [0, 0]); });
t('Stableford: 36 v 36 -> $0', () => { const r = two(); eq(r.stableford.points, [36, 36]); eq(r.stableford.money, [0, 0]); zeroSum(r); });
t('Gross/net front/back/total', () => { const r = two(); const p = r.players[1].totals; eq([p.grossF, p.grossB, p.gross, p.net], [35, 37, 72, 72]); });
t('Early close-out: X wins holes 1-5 -> front decided 5&4 after hole 5', () => {
  const Y2 = PARS.map((p, i) => i < 5 ? p + 1 : p); const sc = [X.slice(), Y2.map((v, i) => i < 5 ? v : null)];
  const r = two({}, [X.map((v,i)=> i<5?v:null), sc[1]]);
  const f = r.nassau.matches[0].segments[0]; eq(f.result, 'a'); assert.ok(/5&4/.test(f.status), f.status);
  eq(r.nassau.matches[0].segments[2].result, null); // overall still open
  eq(r.nassau.money, [2, -2]);
});

console.log('Four-player scenario (mixed tees, plus & >18 handicap, $2, off the low man)');
const four = [
  { name: 'Bob',   index: 12.4, teeId: 'blue' },   // CH 13
  { name: 'Mike',  index: 6.1,  teeId: 'blue' },   // CH 6
  { name: 'Dave',  index: 24.0, teeId: 'white' },  // CH 22
  { name: 'Steve', index: -2.0, teeId: 'black' }   // CH +1
];
const S4 = [
  [6,5,4,4,5,6,3,5,5, 5,6,4,4,6,3,5,6,5],
  [5,4,4,3,5,5,3,4,4, 4,5,3,5,5,3,4,5,4],
  [7,5,5,4,6,6,4,5,5, 5,6,4,5,6,4,5,6,5],
  [5,4,4,3,4,5,3,4,4, 4,5,3,4,4,3,4,5,4]
];
const r4 = (o) => E.computeRound({ players: four, scores: S4, settings: settings(o) }, yolo);
t('Course handicaps & low-man playing handicaps', () => { const r = r4(); eq(r.players.map(p => p.ch), [13, 6, 22, -1]); eq(r.players.map(p => p.matchHcp), [14, 7, 23, 0]); });
t('Stroke dots: Dave hole 5 (SI1) gets 2 full/2 match; hole 4 (SI5) 1 full/2 match; Steve gives 1 back on 15 (full only)', () => {
  const r = r4(); const d = r.players[2], s = r.players[3];
  eq([d.strokesFull[4], d.strokesMatch[4], d.strokesFull[3], d.strokesMatch[3]], [2, 2, 1, 2]);
  eq([s.strokesFull[14], s.strokesMatch[14]], [-1, 0]);
  r.players.forEach(p => { eq(p.strokesFull.reduce((a,b)=>a+b), p.ch); eq(p.strokesMatch.reduce((a,b)=>a+b), p.matchHcp); });
});
t('Stableford points computed on full-handicap net', () => {
  const r = r4(); const d = r.players[2], s = r.players[3];
  eq(d.stbl[4], 2);  // Dave 6 on par 4 with 2 strokes = net par
  eq(s.stbl[14], 1); // Steve 3 on par 3, gives a stroke -> net 4 = bogey
  // independent recompute
  r.players.forEach((p, i) => { const exp = S4[i].reduce((a, g, h) => a + Math.max(0, 2 + PARS[h] - (g - p.strokesFull[h])), 0); eq(p.totals.stbl, exp); });
  const pts = r.stableford.points; const m = [0,0,0,0];
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) if (i!==j) m[i] += (pts[i]-pts[j])*2;
  eq(r.stableford.money, m);
});
t('Nassau: 6 pairwise matches x 3 bets, all decided or pushed', () => { const r = r4(); eq(r.nassau.matches.length, 6); r.nassau.matches.forEach(m => m.segments.forEach(s => assert.ok(s.result))); });
t('Skins: independent recompute w/ carryovers', () => {
  const r = r4(); let carry = 0; const won = [0,0,0,0];
  for (let h = 0; h < 18; h++){ const n = r.players.map((p, i) => S4[i][h] - p.strokesMatch[h]); const mn = Math.min(...n); const w = n.map((v,i)=>v===mn?i:-1).filter(i=>i>=0);
    if (w.length === 1){ won[w[0]] += 1 + carry; carry = 0; } else carry++; }
  eq(r.skins.won, won); eq(r.skins.carryLeft, carry);
  eq(r.skins.money, won.map((w, i) => w * 2 * 3 - (won.reduce((a,b)=>a+b) - w) * 2));
});
t('Ledger zero-sum + settle-up reconciles (all modes)', () => {
  zeroSum(r4()); zeroSum(r4({ strokeMode: 'full' })); zeroSum(r4({ nassauMode: 'stroke' })); zeroSum(r4({ skinsCarry: false }));
  [0,1,2].forEach(k => zeroSum(r4({ nassauTeams: true, teamPairing: k })));
});
t('Team Nassau best ball: 1 match, each winner +bet per decided bet', () => {
  const r = r4({ nassauTeams: true, teamPairing: 0 }); eq(r.nassau.matches.length, 1); eq(r.nassau.matches[0].label, 'Bob & Mike vs Dave & Steve');
  const segs = r.nassau.matches[0].segments; let a = 0; segs.forEach(s => { if (s.result==='a') a += 2; if (s.result==='b') a -= 2; });
  eq(r.nassau.money, [a, a, -a, -a]);
});
t('Settle-up uses at most n-1 payments', () => { const r = r4(); assert.ok(r.settlements.length <= 3); });

console.log('Nassau presses');
// X always pars; Y's score per hole derived from result codes: 'a' = X wins (Y bogey), 'b' = Y wins (Y birdie), 'h' = halved, null = not played
const ys = codes => PARS.map((p, i) => codes[i] == null ? null : p + (codes[i] === 'a' ? 1 : codes[i] === 'b' ? -1 : 0));
const xs = codes => PARS.map((p, i) => codes[i] == null ? null : p);
const R2 = (codes, o, presses) => ({ players: [{ name: 'X', index: 0, teeId: 'f' }, { name: 'Y', index: 0, teeId: 'f' }], scores: [xs(codes), ys(codes)],
  settings: settings(Object.assign({ bet: 1, games: { nassau: true } }, o)), presses: presses || [] });
const H = n => new Array(n).fill('h');
const seg = (r, si) => r.nassau.matches[0].segments[si];
t('Auto 2-down press triggers and press of a press (match play)', () => {
  const codes = ['a','a','a','a','h','h','h','h','h'].concat(H(9));
  const r = E.computeRound(R2(codes, { presses: 'auto' }), flat); const f = seg(r, 0);
  eq(f.presses.map(p => [p.start, p.side, p.auto]), [[2, 'b', true], [4, 'b', true]]); // press from hole 3, press-of-press from hole 5
  eq(f.presses.map(p => p.result), ['a', 'push']); eq(f.result, 'a');
  eq(seg(r, 1).presses.length, 0); eq(seg(r, 2).presses.length, 0); // overall not pressed by default
  eq(r.nassau.money, [3, -3]); // front + press#1 + overall
  eq(f.presses.map(p => p.status), ['X won 2&1', 'Halved']);
});
t('Auto 1-down option cascades presses', () => {
  const codes = ['a','a','a','a','h','h','h','h','h'].concat(H(9));
  const f = seg(E.computeRound(R2(codes, { presses: 'auto', pressTrigger: 1 }), flat), 0);
  eq(f.presses.map(p => p.start), [1, 2, 3, 4]); eq(f.presses.map(p => p.result), ['a', 'a', 'a', 'push']);
});
t('Presses on Overall 18 when toggled', () => {
  const codes = ['a','a'].concat(H(16));
  const r = E.computeRound(R2(codes, { presses: 'auto', pressOverall: true }), flat);
  eq(seg(r, 2).presses.map(p => p.start), [2]); eq(seg(r, 0).presses.map(p => p.start), [2]);
});
t('Last-hole restriction: 2 down on the last hole of a nine starts no press (auto or manual)', () => {
  const codes = H(7).concat(['a','a']).concat(H(7)).concat(['a','a']);
  const rd = R2(codes, { presses: 'both' }); const r = E.computeRound(rd, flat);
  eq(seg(r, 0).presses.length, 0); // down 2 after hole 9 -> nothing left on front
  eq(seg(r, 1).presses.length, 0); // down 2 after hole 18
  eq(E.addPress(rd, flat, '0-1', 0).ok, false);
  const codes2 = H(16).concat(['a','a']); codes2[15] = 'a'; // 1 down after 16, 2 down after 17 -> press on 18 only
  eq(seg(E.computeRound(R2(codes2, { presses: 'auto' }), flat), 1).presses.map(p => p.start), [17]);
  // manual press with 8 holes played: allowed, starts hole 9; none after hole 9 played
  const rd3 = R2(H(7).concat(['a']), { presses: 'manual' }); const ok = E.addPress(rd3, flat, '0-1', 0); eq([ok.ok, ok.press.start], [true, 8]);
});
t('Manual press: down side only, starts next unplayed hole, no duplicates, undo, no auto in manual mode', () => {
  const rd = R2(['a','a'], { presses: 'manual' });
  eq(E.addPress(rd, flat, '0-1', 0, 'a').ok, false);           // X is up, cannot press
  const p = E.addPress(rd, flat, '0-1', 0); eq([p.ok, p.press.side, p.press.start], [true, 'b', 2]);
  eq(E.addPress(rd, flat, '0-1', 0, 'b').ok, false);           // duplicate on same hole
  eq(E.addPress(rd, flat, '0-1', 1).ok, false);                // back 9 not started, nobody down
  let r = E.computeRound(rd, flat); eq(seg(r, 0).presses.map(x => [x.manual, x.undoable]), [[true, true]]);
  eq(E.undoPress(rd, flat, p.press.id), true); eq(rd.presses.length, 0);
  const p2 = E.addPress(rd, flat, '0-1', 0);
  rd.scores[0][2] = 4; // one score entered on the press's first hole -> undo locked
  eq(E.undoPress(rd, flat, p2.press.id), false); eq(rd.presses.length, 1);
  // play out: Y wins holes 3-9 => Y wins press 7-0 and front 5 up (closed early); X no auto-press in manual mode
  const codes = ['a','a','b','b','b','b','b','b','b'].concat(H(9));
  rd.scores = [xs(codes), ys(codes)]; r = E.computeRound(rd, flat);
  eq(seg(r, 0).presses.length, 1); eq(seg(r, 0).presses[0].result, 'b'); eq(seg(r, 0).result, 'b');
  eq(r.nassau.money, [-3, 3]);  // front, press, overall (Y 5 up over 18)
  const r2 = E.computeRound(Object.assign({}, rd, { settings: Object.assign({}, rd.settings, { presses: 'off' }) }), flat);
  eq(seg(r2, 0).presses.length, 0); eq(r2.nassau.money, [-2, 2]); // presses ignored when off
});
t('Team Nassau (best ball) with auto + manual presses', () => {
  const T = PARS.map(p => p), B = PARS.map((p, i) => i < 2 ? p + 1 : p);
  const rd = { players: ['A1','A2','B1','B2'].map(n => ({ name: n, index: 0, teeId: 'f' })), scores: [T, T, B, B], presses: [],
    settings: settings({ bet: 5, games: { nassau: true }, nassauTeams: true, presses: 'both' }) };
  let r = E.computeRound(rd, flat); const f = seg(r, 0);
  eq(r.nassau.matches[0].key, 'T'); eq(f.presses.map(p => [p.start, p.side]), [[2, 'b']]);
  eq(r.nassau.money, [10, 10, -10, -10]); zeroSum(r); // front + overall to team A; press pushes
  const rd2 = Object.assign({}, rd, { scores: rd.scores.map(s => s.map((v, i) => i < 3 ? v : null)), presses: [] });
  const p = E.addPress(rd2, flat, 'T', 0); eq([p.ok, p.press.side, p.press.start], [true, 'b', 3]);
  eq(seg(E.computeRound(rd2, flat), 0).presses.length, 2); // auto from hole 3 + manual from hole 4
});
t('Stroke-play presses: down = net strokes behind', () => {
  const X0 = PARS.slice(), Y0 = PARS.map((p, i) => i === 0 ? p + 2 : i === 4 ? p - 1 : p); // Y double on 1 (2 behind), birdie on 5
  const rd = { players: [{ name: 'X', index: 0, teeId: 'f' }, { name: 'Y', index: 0, teeId: 'f' }], scores: [X0, Y0], presses: [], settings: settings({ bet: 1, games: { nassau: true }, nassauMode: 'stroke', presses: 'auto' }) };
  const r = E.computeRound(rd, flat); const f = seg(r, 0);
  eq(f.presses.map(p => [p.start, p.side]), [[1, 'b']]); eq(f.result, 'a'); eq(f.presses[0].result, 'b'); // press holes 2-9: Y by 1
  eq(r.nassau.money, [1, -1]); // front X, press Y, overall X, back push
  const rd2 = Object.assign({}, rd, { settings: Object.assign({}, rd.settings, { presses: 'manual' }), scores: [X0.map((v,i)=>i<1?v:null), Y0.map((v,i)=>i<1?v:null)] });
  const p = E.addPress(rd2, flat, '0-1', 0); eq([p.ok, p.press.side, p.press.start], [true, 'b', 1]);
});
t('Old saved round without press data still loads', () => {
  const old = { players: [{ name: 'X', index: 0, teeId: 'f' }, { name: 'Y', index: 0, teeId: 'f' }], scores: [X, Y], settings: { bet: 2, games: { nassau: true, skins: true }, strokeMode: 'low', skinsCarry: true, nassauMode: 'match' } };
  const r = E.computeRound(old, flat); eq(seg(r, 0).presses.length, 0); eq(r.nassau.money, [0, 0]); zeroSum(r);
});

console.log('Fuzz: 2000 random rounds (incl. random manual/auto presses)');
t('Always zero-sum; settlements reconcile; strokes sum to handicap', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 2000; k++){
    const n = 2 + Math.floor(rnd() * 3);
    const pl = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, index: Math.round((rnd() * 40 - 4) * 10) / 10, teeId: yolo.tees[Math.floor(rnd() * 11)].id }));
    const sc = pl.map(() => PARS.map(p => rnd() < 0.05 ? null : p + Math.floor(rnd() * 5) - 1));
    const st = settings({ bet: [1,2,5][k%3], strokeMode: rnd()<.5?'low':'full', skinsCarry: rnd()<.5, nassauMode: rnd()<.5?'match':'stroke', nassauTeams: n===4 && rnd()<.5, teamPairing: Math.floor(rnd()*3), games: { stableford: rnd()<.7, nassau: rnd()<.7, skins: rnd()<.7 } });
    st.presses = ['off','manual','auto','both'][Math.floor(rnd()*4)]; st.pressTrigger = rnd()<.5?1:2; st.pressOverall = rnd()<.5;
    const rd = { players: pl, scores: pl.map(() => new Array(18).fill(null)), settings: st, presses: [] };
    let nm = 0;
    for (let h = 0; h < 18; h++){ pl.forEach((_, i) => rd.scores[i][h] = sc[i][h]);
      if (st.games.nassau && (st.presses==='manual'||st.presses==='both') && rnd() < .4){
        const keys = E.computeRound(rd, yolo).nassau.matches.map(m => m.key);
        const res = E.addPress(rd, yolo, keys[Math.floor(rnd()*keys.length)], Math.floor(rnd()*3)); if (res.ok){ nm++; assert.ok(res.press.start <= (res.press.s===0?8:17)); }
      } }
    const r = E.computeRound(rd, yolo);
    zeroSum(r);
    if (r.nassau) r.nassau.matches.forEach(m => m.segments.forEach((sg, si) => sg.presses.forEach(p => assert.ok(p.start <= (si===0?8:17) && p.start >= (si===1?9:0)))));
    r.players.forEach(p => { eq(p.strokesFull.reduce((a,b)=>a+b), p.ch); eq(p.strokesMatch.reduce((a,b)=>a+b), p.matchHcp); });
  }
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
