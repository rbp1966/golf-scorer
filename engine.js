/*ENGINE-START*/
var Engine = (function(){
  function isNum(x){ return typeof x === 'number' && isFinite(x); }
  function sum(a){ return a.reduce(function(p,c){ return p + (isNum(c)?c:0); }, 0); }
  // USGA WHS Course Handicap = Index x (Slope/113) + (Course Rating - Par), rounded
  function courseHandicap(index, tee){
    var v = index * tee.slope / 113 + (tee.rating - tee.par);
    return Math.round(v + 1e-9) || 0;
  }
  // strokes received on a hole of given stroke index (1 = hardest). Negative = plus handicap gives strokes back
  function strokesOnHole(h, si){
    if (h >= 0) return Math.floor(h/18) + (si <= h % 18 ? 1 : 0);
    var n = -h;
    return -(Math.floor(n/18) + (si > 18 - (n % 18) ? 1 : 0)) || 0;
  }
  function parseIndex(s){
    if (typeof s === 'number') return s;
    s = String(s||'').trim().replace(',', '.');
    if (!s) return NaN;
    var plus = s.charAt(0) === '+';
    var v = parseFloat(plus ? s.slice(1) : s);
    if (!isFinite(v)) return NaN;
    return plus ? -v : v;
  }
  function fmtIndex(v){ if (!isNum(v)) return ''; return v < 0 ? '+' + (-v).toFixed(1) : v.toFixed(1); }
  function fmtCH(v){ return v < 0 ? '+' + (-v) : String(v); }
  function findTee(course, teeId){
    for (var i=0;i<course.tees.length;i++) if (course.tees[i].id === teeId) return course.tees[i];
    return course.tees[0];
  }
  var FRONT=[0,1,2,3,4,5,6,7,8], BACK=[9,10,11,12,13,14,15,16,17], ALL=FRONT.concat(BACK);

  function computeRound(round, course){
    var st = round.settings || {}; var bet = st.bet || 1;
    var P = round.players.length;
    var players = round.players.map(function(p, i){
      var tee = findTee(course, p.teeId);
      var ch = courseHandicap(p.index, tee);
      return { name: p.name, index: p.index, tee: tee, ch: ch, gross: (round.scores[i]||[]).slice(0,18) };
    });
    var low = Math.min.apply(null, players.map(function(p){ return p.ch; }));
    players.forEach(function(p){
      p.matchHcp = st.strokeMode === 'full' ? p.ch : p.ch - low;
      p.strokesFull = p.tee.si.map(function(s){ return strokesOnHole(p.ch, s); });
      p.strokesMatch = p.tee.si.map(function(s){ return strokesOnHole(p.matchHcp, s); });
      p.netFull = ALL.map(function(h){ return isNum(p.gross[h]) ? p.gross[h] - p.strokesFull[h] : null; });
      p.netMatch = ALL.map(function(h){ return isNum(p.gross[h]) ? p.gross[h] - p.strokesMatch[h] : null; });
      p.stbl = ALL.map(function(h){ return isNum(p.gross[h]) ? Math.max(0, 2 + p.tee.pars[h] - p.netFull[h]) : null; });
      function seg(arr, holes){ return sum(holes.map(function(h){ return arr[h]; })); }
      p.totals = {
        grossF: seg(p.gross, FRONT), grossB: seg(p.gross, BACK), gross: seg(p.gross, ALL),
        netF: seg(p.netFull, FRONT), netB: seg(p.netFull, BACK), net: seg(p.netFull, ALL),
        parF: seg(p.tee.pars, FRONT), parB: seg(p.tee.pars, BACK), par: seg(p.tee.pars, ALL),
        stblF: seg(p.stbl, FRONT), stblB: seg(p.stbl, BACK), stbl: seg(p.stbl, ALL),
        holesF: FRONT.filter(function(h){ return isNum(p.gross[h]); }).length,
        holesB: BACK.filter(function(h){ return isNum(p.gross[h]); }).length
      };
    });
    var complete = ALL.map(function(h){ return players.every(function(p){ return isNum(p.gross[h]); }); });
    var games = st.games || {};
    var res = { players: players, complete: complete, holesComplete: complete.filter(Boolean).length, bet: bet, low: low };
    var zero = function(){ return players.map(function(){ return 0; }); };

    // ---- Stableford: per-point difference vs each opponent (only holes everyone has completed)
    if (games.stableford){
      var pts = players.map(function(p){ return sum(ALL.filter(function(h){ return complete[h]; }).map(function(h){ return p.stbl[h]; })); });
      var m = zero();
      for (var i=0;i<P;i++) for (var j=i+1;j<P;j++){ var d = pts[i]-pts[j]; m[i] += d*bet; m[j] -= d*bet; }
      res.stableford = { points: pts, money: m };
    }

    // ---- Nassau
    if (games.nassau){
      var matches = [];
      if (st.nassauTeams && P === 4){
        var pairings = [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]];
        var pr = pairings[st.teamPairing||0];
        matches.push({ a: pr[0], b: pr[1] });
      } else {
        for (var a=0;a<P;a++) for (var b=a+1;b<P;b++) matches.push({ a:[a], b:[b] });
      }
      var nm = zero();
      matches.forEach(function(mt){
        var members = mt.a.concat(mt.b);
        var sideNet = function(side, h){ return Math.min.apply(null, side.map(function(k){ return players[k].netMatch[h]; })); };
        var hc = function(h){ return members.every(function(k){ return isNum(players[k].gross[h]); }); };
        mt.label = mt.a.map(function(k){return players[k].name;}).join(' & ') + ' vs ' + mt.b.map(function(k){return players[k].name;}).join(' & ');
        var An = mt.a.map(function(k){return players[k].name;}).join('/'), Bn = mt.b.map(function(k){return players[k].name;}).join('/');
        mt.holes = ALL.map(function(h){ if(!hc(h)) return null; var x=sideNet(mt.a,h), y=sideNet(mt.b,h); return x<y?'a':(y<x?'b':'h'); });
        mt.segments = [['Front 9', FRONT], ['Back 9', BACK], ['Overall 18', ALL]].map(function(sg){
          var holes = sg[1], played = holes.filter(hc), remaining = holes.length - played.length;
          var out = { name: sg[0], played: played.length, remaining: remaining, result: null };
          if (st.nassauMode === 'stroke'){
            var ta = sum(played.map(function(h){ return sideNet(mt.a,h); })), tb = sum(played.map(function(h){ return sideNet(mt.b,h); }));
            out.diff = tb - ta; // positive = side a ahead
            if (remaining === 0) out.result = ta < tb ? 'a' : (tb < ta ? 'b' : 'push');
            out.status = played.length === 0 ? 'Not started' : (out.diff === 0 ? 'Tied' : (out.diff > 0 ? An : Bn) + ' by ' + Math.abs(out.diff)) + (remaining ? ' thru ' + played.length : '');
          } else {
            var aw=0, bw=0, closed=null;
            // walk in hole order to detect early close-out
            var seq = holes.filter(hc);
            seq.forEach(function(h, k){
              if (closed) return;
              var r = mt.holes[h]; if (r==='a') aw++; else if (r==='b') bw++;
              var left = holes.length - (k+1);
              if (Math.abs(aw-bw) > left) closed = { left:left, diff:aw-bw };
            });
            out.diff = aw - bw;
            if (closed){ out.result = closed.diff > 0 ? 'a' : 'b'; out.closedLeft = closed.left; }
            else if (remaining === 0) out.result = aw===bw ? 'push' : (aw>bw?'a':'b');
            var d2 = Math.abs(out.diff);
            if (played.length === 0) out.status = 'Not started';
            else if (closed && closed.left > 0) out.status = (closed.diff>0?An:Bn) + ' won ' + Math.abs(closed.diff) + '&' + closed.left;
            else if (remaining === 0) out.status = out.diff===0 ? 'Halved' : (out.diff>0?An:Bn) + ' won ' + d2 + ' up';
            else out.status = (out.diff===0 ? 'All square' : (out.diff>0?An:Bn) + ' ' + d2 + ' up') + ' thru ' + played.length;
          }
          if (out.result === 'a' || out.result === 'b'){
            var win = out.result==='a'? mt.a : mt.b, lose = out.result==='a'? mt.b : mt.a;
            win.forEach(function(k){ nm[k] += bet; }); lose.forEach(function(k){ nm[k] -= bet; });
          }
          return out;
        });
      });
      res.nassau = { matches: matches, money: nm };
    }

    // ---- Skins (net, lowest unique score wins; carryovers optional)
    if (games.skins){
      var carryOn = st.skinsCarry !== false, carry = 0, holesOut = [], won = zero(), sm = zero(), stopped = false;
      ALL.forEach(function(h){
        if (stopped || !complete[h]){ stopped = true; holesOut.push({ hole: h+1, pending: true }); return; }
        var nets = players.map(function(p){ return p.netMatch[h]; });
        var mn = Math.min.apply(null, nets), who = [];
        nets.forEach(function(v,k){ if (v===mn) who.push(k); });
        if (who.length === 1){
          var val = 1 + carry; carry = 0; won[who[0]] += val;
          holesOut.push({ hole: h+1, winner: who[0], value: val, net: mn });
        } else {
          if (carryOn) carry += 1;
          holesOut.push({ hole: h+1, winner: null, tied: who, carry: carryOn ? carry : 0 });
        }
      });
      players.forEach(function(p,k){ sm[k] = won[k]*bet*(P-1) - (sum(won) - won[k])*bet; });
      res.skins = { holes: holesOut, won: won, money: sm, carryLeft: carry, carryOn: carryOn };
    }

    // ---- Ledger + settle-up
    var total = zero();
    ['stableford','nassau','skins'].forEach(function(g){ if (res[g]) res[g].money.forEach(function(v,k){ total[k] += v; }); });
    res.total = total;
    res.settlements = settle(total);
    return res;
  }
  function settle(total){
    var cr = [], db = [], out = [];
    total.forEach(function(v,k){ if (v>0.004) cr.push({k:k,v:v}); else if (v<-0.004) db.push({k:k,v:-v}); });
    cr.sort(function(a,b){return b.v-a.v;}); db.sort(function(a,b){return b.v-a.v;});
    var i=0,j=0;
    while (i<db.length && j<cr.length){
      var amt = Math.min(db[i].v, cr[j].v);
      out.push({ from: db[i].k, to: cr[j].k, amount: Math.round(amt*100)/100 });
      db[i].v -= amt; cr[j].v -= amt;
      if (db[i].v < 0.004) i++; if (cr[j].v < 0.004) j++;
    }
    return out;
  }
  return { courseHandicap: courseHandicap, strokesOnHole: strokesOnHole, parseIndex: parseIndex, fmtIndex: fmtIndex, fmtCH: fmtCH,
           computeRound: computeRound, settle: settle, findTee: findTee, sum: sum, isNum: isNum };
})();
if (typeof module !== 'undefined') module.exports = Engine;
/*ENGINE-END*/
