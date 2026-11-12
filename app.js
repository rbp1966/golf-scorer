(function(){
'use strict';
var E = Engine;
var DEMO = /^#demo/.test(location.hash);
var LS = { courses:'gs.courses', players:'gs.players', setup:'gs.setup', round:'gs.round', history:'gs.history', ui:'gs.ui' };
var mem = {};
function load(k, d){ if (DEMO) return k in mem ? mem[k] : d; try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }
function save(k, v){ if (DEMO){ mem[k]=v; return; } try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ toast('Could not save (storage full?)'); } }
function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(v){ if (!v) return '$0'; return (v>0?'+':'−') + '$' + Math.abs(v).toFixed(Math.abs(v)%1?2:0); }
function moneyCls(v){ return v>0?'pos':(v<0?'neg':''); }

// ---------- data
function customCourses(){ return load(LS.courses, []); }
function getCourses(){
  var cus = customCourses(), out = [];
  BUILTIN_COURSES.forEach(function(b){ var o = cus.filter(function(c){ return c.id===b.id; })[0]; out.push(o ? Object.assign({}, o, {builtin:true, edited:true}) : b); });
  cus.forEach(function(c){ if (!BUILTIN_COURSES.some(function(b){ return b.id===c.id; })) out.push(c); });
  return out;
}
function getCourse(id){ var cs = getCourses(); return cs.filter(function(c){ return c.id===id; })[0] || cs[0]; }
function savedPlayers(){ return load(LS.players, []); }
function setSavedPlayers(a){ save(LS.players, a); }
function upsertPlayer(p){
  var list = savedPlayers(), rec = null;
  if (p.pid) rec = list.filter(function(x){ return x.id===p.pid; })[0];
  if (!rec && p.name) rec = list.filter(function(x){ return x.name.toLowerCase()===p.name.trim().toLowerCase(); })[0];
  if (!rec){ if (!p.name || !p.name.trim()) return null; rec = { id: uid(), name: p.name.trim() }; list.push(rec); }
  if (E.isNum(p.index)) rec.index = p.index;
  if (p.teeId) rec.teeId = p.teeId;
  rec.updated = Date.now();
  setSavedPlayers(list); p.pid = rec.id; return rec;
}
function defaultSetup(){
  var c = getCourses()[0];
  var tee = (c.tees.filter(function(t){ return t.id==='blue'; })[0] || c.tees[0]).id;
  return { courseId: c.id, players: [{name:'',index:null,teeId:tee},{name:'',index:null,teeId:tee}],
    settings: { bet:1, games:{stableford:false, nassau:true, skins:true}, strokeMode:'low', skinsCarry:true, nassauTeams:false, teamPairing:0, nassauMode:'match', presses:'off', pressTrigger:2, pressOverall:false } };
}
var setup = load(LS.setup, null) || defaultSetup();
var round = load(LS.round, null);
var ui = load(LS.ui, { screen: round ? 'hole' : 'home' });
var editCourse = null, viewRound = null;
function persist(){ save(LS.setup, setup); save(LS.round, round); save(LS.ui, { screen: ui.screen === 'courseEdit' ? 'courses' : (ui.screen==='historySummary'?'history':ui.screen) }); }

// ---------- rendering
var app = document.getElementById('app');
function go(s){ ui.screen = s; persist(); render(); window.scrollTo(0,0); }
function render(){
  var f = screens[ui.screen] || screens.home;
  if ((ui.screen==='hole'||ui.screen==='summary') && !round) ui.screen='home', f=screens.home;
  app.innerHTML = f();
}
function header(title, back){ return '<header class="bar">' + (back ? '<button class="ghost" data-go="'+back+'">‹ Back</button>' : '<span></span>') + '<h1>'+esc(title)+'</h1><span></span></header>'; }
function toggle(key, on, label, sub){ return '<label class="row toggle"><span><b>'+label+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span><input type="checkbox" data-set="'+key+'" '+(on?'checked':'')+'><i></i></label>'; }

var screens = {};
screens.home = function(){
  var h = header('Golf Game Scorer');
  h += '<main>';
  if (round){
    var c = getCourse(round.courseId), r = E.computeRound(round, c);
    h += '<div class="card hero"><div><b>Round in progress</b><small>'+esc(c.name)+' · '+round.players.map(function(p){return esc(p.name);}).join(', ')+' · '+r.holesComplete+'/18 holes</small></div>'
      + '<button class="primary big" data-go="hole">Resume hole '+(round.hole+1)+'</button><button class="secondary" data-go="summary">View summary</button></div>';
  }
  h += '<button class="primary big" data-act="newRound">'+(round?'Set up a new round':'New round')+'</button>';
  h += '<div class="grid2"><button class="secondary" data-go="players">Players & Index</button><button class="secondary" data-go="courses">Courses</button><button class="secondary" data-go="history">Past rounds</button><button class="secondary" data-go="help">How scoring works</button></div>';
  h += '<p class="muted center">Works offline. Scores save on this phone automatically.</p></main>';
  return h;
};
screens.help = function(){
  return header('How scoring works','home') + '<main class="prose card">'
  + '<h2>Course handicap</h2><p>USGA World Handicap System: <b>Index × Slope ÷ 113 + (Course Rating − Par)</b>, rounded. Each player uses the rating/slope of the tee they play. Plus indexes are entered with a “+” (e.g. +1.2).</p>'
  + '<h2>Strokes</h2><p>Strokes fall on holes by stroke index (SI 1 = hardest). 20 strokes = 1 on every hole + a 2nd on SI 1–2. Plus handicaps give strokes back starting on SI 18. Dots on the scoring screen show strokes for match games.</p>'
  + '<p><b>Off the low man</b> (default for Nassau & Skins): the lowest course handicap plays at 0 and everyone else gets the difference. <b>Full handicap</b>: everyone gets their full course handicap. Stableford always uses full course handicap.</p>'
  + '<h2>Stableford</h2><p>Points on net score: double bogey or worse 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5. <b>Payout:</b> you win/lose the bet amount for every point of difference against each other player (e.g. $2 game, you have 36 and Joe has 31 → Joe pays you $10).</p>'
  + '<h2>Nassau</h2><p>Three bets: Front 9, Back 9, Overall 18, each worth the bet amount. Match play (most holes won on net) by default, or stroke play (lowest net total). With 3–4 players every pair plays its own Nassau. Ties push. With 4 players you can instead play 2-man teams, best net ball; each winner collects the bet from an opponent. Matches can close out early (e.g. 3&2).</p>'
  + '<h2>Presses</h2><p>A press is a new bet for the same amount that starts on the next hole and runs to the end of that nine (or the 18 for the Overall, if “Presses on Overall 18” is on). <b>Manual:</b> when a side is down in a match, a <b>Press</b> button appears in Game status for that match and nine; it starts on the next unplayed hole. A mis-tapped press can be undone until a score is entered on its first hole. <b>Auto:</b> whenever a side goes 2 down (or 1 down, if chosen) in any bet — the original or a press — a new press starts on the next hole automatically, so presses can be pressed. No press can start after the last hole of its nine. In stroke play, “down” means strokes behind on net total for that bet. Each press wins, loses or pushes on its own and goes into the money ledger.</p>'
  + '<h2>Skins</h2><p>Lowest unique net score wins the hole. With carryovers on, a tied hole adds its skin to the next hole. Each skin is worth the bet amount from each other player. Skins still tied after 18 are not paid.</p>'
  + '<h2>Settle up</h2><p>All games are totalled into one net $ per player, then simplified into the fewest payments.</p></main>';
};

// ----- Setup
screens.setup = function(){
  var c = getCourse(setup.courseId), st = setup.settings, sp = savedPlayers();
  var h = header('New Round','home') + '<main>';
  h += '<section class="card"><label class="lbl">Course</label><select data-setup="courseId">' + getCourses().map(function(x){ return '<option value="'+x.id+'"'+(x.id===c.id?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('') + '</select>';
  if (c.notes) h += '<small class="muted">'+esc(c.notes)+'</small>';
  h += '</section>';
  h += '<section class="card"><div class="rowsb"><h2>Players</h2><span class="muted">'+setup.players.length+' of 4</span></div>';
  var used = setup.players.map(function(p){ return p.pid; });
  var avail = sp.filter(function(x){ return used.indexOf(x.id)<0; }).sort(function(a,b){ return (b.updated||0)-(a.updated||0); });
  if (avail.length) h += '<div class="chips"><small class="muted">Tap to add:</small>' + avail.map(function(x){ return '<button class="chip" data-act="pickPlayer" data-id="'+x.id+'">'+esc(x.name)+' <span>'+E.fmtIndex(x.index)+'</span></button>'; }).join('') + '</div>';
  h += '<datalist id="pnames">' + sp.map(function(x){ return '<option value="'+esc(x.name)+'">'; }).join('') + '</datalist>';
  setup.players.forEach(function(p, i){
    var tee = E.findTee(c, p.teeId), ch = E.isNum(p.index) ? E.courseHandicap(p.index, tee) : null;
    h += '<div class="pcard"><div class="rowsb"><b>Player '+(i+1)+'</b>' + (setup.players.length>2 ? '<button class="ghost danger" data-act="removePlayer" data-i="'+i+'">Remove</button>' : '') + '</div>'
      + '<input class="name" list="pnames" placeholder="Name" value="'+esc(p.name)+'" data-pname="'+i+'" autocomplete="off">'
      + '<div class="pgrid"><label><span class="lbl">Index</span><input inputmode="decimal" placeholder="e.g. 12.4 or +1.2" value="'+(E.isNum(p.index)?E.fmtIndex(p.index):'')+'" data-pindex="'+i+'"></label>'
      + '<label><span class="lbl">Tee</span><select data-ptee="'+i+'">' + c.tees.map(function(t){ return '<option value="'+t.id+'"'+(t.id===tee.id?' selected':'')+'>'+esc(t.name)+' ('+t.rating.toFixed(1)+'/'+t.slope+')</option>'; }).join('') + '</select></label>'
      + '<div class="chbox"><span class="lbl">Course Hcp</span><b id="ch'+i+'">'+(ch==null?'–':E.fmtCH(ch))+'</b></div></div></div>';
  });
  if (setup.players.length < 4) h += '<button class="secondary" data-act="addPlayer">+ Add player</button>';
  h += '<small class="muted">Read each Handicap Index from the GHIN app — it updates daily. Changes here update the saved player.</small></section>';
  h += '<section class="card"><h2>Games</h2>'
    + toggle('games.stableford', st.games.stableford, 'Stableford', 'Points on net score, $ per point difference')
    + toggle('games.nassau', st.games.nassau, 'Nassau', 'Front / Back / Overall')
    + toggle('games.skins', st.games.skins, 'Skins', 'Net, lowest unique score');
  h += '<label class="lbl">Bet amount (per bet / point / skin)</label><div class="seg">' + [1,2,5].map(function(b){ return '<button data-act="bet" data-v="'+b+'" class="'+(st.bet===b?'on':'')+'">$'+b+'</button>'; }).join('') + '</div>';
  h += '<label class="lbl">Match strokes (Nassau & Skins)</label><div class="seg"><button data-act="strokeMode" data-v="low" class="'+(st.strokeMode!=='full'?'on':'')+'">Off the low man</button><button data-act="strokeMode" data-v="full" class="'+(st.strokeMode==='full'?'on':'')+'">Full handicap</button></div>';
  if (st.games.skins) h += toggle('skinsCarry', st.skinsCarry, 'Skins carry over', 'Tied holes roll to the next hole');
  if (st.games.nassau){
    h += '<label class="lbl">Nassau scoring</label><div class="seg"><button data-act="nassauMode" data-v="match" class="'+(st.nassauMode!=='stroke'?'on':'')+'">Match play</button><button data-act="nassauMode" data-v="stroke" class="'+(st.nassauMode==='stroke'?'on':'')+'">Stroke play</button></div>';
    var pm = st.presses || 'off';
    h += '<label class="lbl">Presses</label><div class="seg">' + [['off','Off'],['manual','Manual'],['auto','Auto'],['both','Both']].map(function(x){ return '<button data-act="pressMode" data-v="'+x[0]+'" class="'+(pm===x[0]?'on':'')+'">'+x[1]+'</button>'; }).join('') + '</div>';
    if (pm === 'auto' || pm === 'both') h += '<label class="lbl">Auto-press when down</label><div class="seg"><button data-act="pressTrigger" data-v="2" class="'+(st.pressTrigger!==1?'on':'')+'">2 down</button><button data-act="pressTrigger" data-v="1" class="'+(st.pressTrigger===1?'on':'')+'">1 down</button></div>';
    if (pm !== 'off') h += toggle('pressOverall', !!st.pressOverall, 'Presses on Overall 18 too', 'Off = presses on Front & Back 9 only');
    if (setup.players.length===4){
      h += toggle('nassauTeams', st.nassauTeams, '2-man teams (best net ball)', 'Otherwise every pair plays its own Nassau');
      if (st.nassauTeams){
        var n = setup.players.map(function(p,i){ return p.name || ('P'+(i+1)); });
        var prs = [[0,1,2,3],[0,2,1,3],[0,3,1,2]];
        h += '<select data-setup="teamPairing">' + prs.map(function(q,k){ return '<option value="'+k+'"'+((st.teamPairing||0)===k?' selected':'')+'>'+esc(n[q[0]]+' & '+n[q[1]]+'  vs  '+n[q[2]]+' & '+n[q[3]])+'</option>'; }).join('') + '</select>';
      }
    }
  }
  h += '<button class="ghost" data-go="help">How the games & payouts work ›</button></section>';
  h += '<button class="primary big" data-act="startRound">Start round</button></main>';
  return h;
};

// ----- Hole entry
function dots(n){ if (!n) return ''; if (n<0) return '<span class="dots minus" title="gives a stroke">'+new Array(-n+1).join('○')+'</span>'; return '<span class="dots">'+new Array(n+1).join('●')+'</span>'; }
screens.hole = function(){
  var c = getCourse(round.courseId), r = E.computeRound(round, c), h = round.hole, st = round.settings;
  var t0 = r.players[0].tee;
  var out = '<header class="bar"><button class="ghost" data-go="home">‹ Menu</button><h1>Hole '+(h+1)+'</h1><button class="ghost" data-go="summary">Summary</button></header><main>';
  out += '<div class="holeinfo"><div><span class="lbl">Par</span><b>'+t0.pars[h]+'</b></div><div><span class="lbl">SI</span><b>'+t0.si[h]+'</b></div><div><span class="lbl">Yards</span><b>'+(t0.yards&&t0.yards[h]||'–')+'</b><small>'+esc(t0.name)+'</small></div></div>';
  r.players.forEach(function(p, i){
    var g = round.scores[i][h], sm = p.strokesMatch[h], sf = p.strokesFull[h];
    var sub = [];
    if (E.isNum(g)){ sub.push('Net '+p.netMatch[h]); if (st.games.stableford) sub.push(p.stbl[h]+' pts'); }
    var parTxt = p.tee.pars[h] !== t0.pars[h] || p.tee.si[h] !== t0.si[h] ? ' · par '+p.tee.pars[h]+' SI '+p.tee.si[h] : '';
    var stTxt = st.games.stableford && sf !== sm ? '<small class="muted">Stableford strokes: '+sf+'</small>' : '';
    var rel = E.isNum(g) ? g - p.tee.pars[h] : null;
    out += '<div class="prow"><div class="pinfo"><b>'+esc(p.name)+' '+dots(sm)+'</b><small>'+esc(p.tee.name)+' · CH '+E.fmtCH(p.ch)+(st.strokeMode!=='full'?' · plays '+E.fmtCH(p.matchHcp):'')+parTxt+'</small>'+stTxt+'<small class="net">'+sub.join(' · ')+'</small></div>'
      + '<div class="stepper"><button class="step" data-act="dec" data-i="'+i+'" aria-label="minus">−</button><button class="score '+(rel==null?'empty':rel<0?'under':rel>0?'over':'par')+'" data-act="setPar" data-i="'+i+'">'+(E.isNum(g)?g:'<span class="ph">'+p.tee.pars[h]+'</span>')+'</button><button class="step" data-act="inc" data-i="'+i+'" aria-label="plus">+</button></div></div>';
  });
  out += '<div class="nav"><button class="secondary big" data-act="prevHole" '+(h===0?'disabled':'')+'>‹ Prev</button>' + (h<17 ? '<button class="primary big" data-act="nextHole">Next ›</button>' : '<button class="primary big" data-go="summary">Finish ›</button>') + '</div>';
  out += '<div class="holegrid">' + round.scores[0].map(function(_, k){ return '<button data-act="goHole" data-h="'+k+'" class="'+(k===h?'cur ':'')+(r.complete[k]?'done':'')+'">'+(k+1)+'</button>'; }).join('') + '</div>';
  out += statusPanel(r, st);
  out += '</main>';
  return out;
};
function statusPanel(r, st){
  var P = r.players, o = '<section class="card status"><h2>Game status <small class="muted">thru '+r.holesComplete+'</small></h2>';
  if (r.stableford) o += '<div class="srow"><b>Stableford</b><div>' + P.map(function(p,i){ return '<span>'+esc(p.name)+' <b>'+r.stableford.points[i]+'</b></span>'; }).join('') + '</div></div>';
  if (r.skins){
    o += '<div class="srow"><b>Skins</b><div>' + P.map(function(p,i){ return '<span>'+esc(p.name)+' <b>'+r.skins.won[i]+'</b></span>'; }).join('') + '</div></div>';
    if (r.skins.carryLeft) o += '<small class="carry">'+r.skins.carryLeft+' skin'+(r.skins.carryLeft>1?'s':'')+' carrying to the next hole</small>';
  }
  if (r.nassau) r.nassau.matches.forEach(function(m){
    o += '<div class="nas"><b>'+esc(m.label)+'</b>' + m.segments.map(function(s, si){
      var x = '<small><i>'+s.name.split(' ')[0]+':</i> '+esc(s.status)+'</small>';
      (s.presses||[]).forEach(function(p){ x += '<small class="press">↳ Press #'+p.num+' (from '+(p.start+1)+(p.auto?', auto':'')+'): '+esc(p.status)+(p.manual && p.undoable ? ' <button class="ghost mini" data-act="undoPress" data-id="'+p.id+'">Undo</button>' : '')+'</small>'; });
      (s.pressable||[]).forEach(function(q){ x += '<button class="pressbtn" data-act="press" data-m="'+m.key+'" data-s="'+si+'" data-side="'+q.side+'">'+esc(q.name)+': press '+s.name.split(' ')[0]+' from hole '+(q.start+1)+'</button>'; });
      return x;
    }).join('') + '</div>';
  });
  o += '<div class="srow"><b>Money</b><div>' + P.map(function(p,i){ return '<span>'+esc(p.name)+' <b class="'+moneyCls(r.total[i])+'">'+money(r.total[i])+'</b></span>'; }).join('') + '</div></div>';
  return o + '</section>';
}

// ----- Summary
function summaryHTML(rd, readOnly){
  var c = getCourse(rd.courseId), r = E.computeRound(rd, c), P = r.players, st = rd.settings;
  var o = '<main>';
  o += '<div class="card"><b>'+esc(c.name)+'</b><small class="muted">'+new Date(rd.started).toLocaleDateString()+' · $'+st.bet+' games · '+(st.strokeMode==='full'?'full handicaps':'strokes off the low man')+' · '+r.holesComplete+'/18 holes complete</small></div>';
  o += '<section class="card"><h2>Scores</h2><div class="tscroll"><table><thead><tr><th></th><th>CH</th><th>Out</th><th>In</th><th>Total</th></tr></thead><tbody>';
  P.forEach(function(p){ var t = p.totals;
    o += '<tr><th rowspan="2">'+esc(p.name)+'<small>'+esc(p.tee.name)+' · '+E.fmtIndex(p.index)+'</small></th><td rowspan="2">'+E.fmtCH(p.ch)+'</td><td>'+t.grossF+'</td><td>'+t.grossB+'</td><td><b>'+t.gross+'</b></td></tr>'
      + '<tr class="netrow"><td>'+t.netF+'</td><td>'+t.netB+'</td><td><b>'+t.net+'</b></td></tr>';
  });
  o += '</tbody></table></div><small class="muted">Top line gross, second line net (full course handicap). Par '+P[0].totals.parF+'/'+P[0].totals.parB+'/'+P[0].totals.par+'.</small></section>';
  // hole by hole
  o += '<section class="card"><h2>Scorecard</h2><div class="tscroll"><table class="sc"><thead><tr><th>Hole</th>' + P[0].gross.map(function(_,k){ return '<th>'+(k+1)+'</th>'+(k===8?'<th>Out</th>':''); }).join('') + '<th>In</th><th>Tot</th></tr>'
    + '<tr class="muted"><th>Par</th>' + P[0].tee.pars.map(function(v,k){ return '<td>'+v+'</td>'+(k===8?'<td>'+P[0].totals.parF+'</td>':''); }).join('') + '<td>'+P[0].totals.parB+'</td><td>'+P[0].totals.par+'</td></tr></thead><tbody>';
  P.forEach(function(p){
    o += '<tr><th>'+esc(p.name)+'</th>' + p.gross.map(function(g,k){ var rel = E.isNum(g)? g - p.tee.pars[k] : null; return '<td class="'+(rel==null?'':rel<0?'under':rel>0?'over':'')+'">'+(E.isNum(g)?g:'')+(p.strokesFull[k]>0?'<sup>'+new Array(p.strokesFull[k]+1).join('•')+'</sup>':'')+'</td>'+(k===8?'<td><b>'+p.totals.grossF+'</b></td>':''); }).join('') + '<td><b>'+p.totals.grossB+'</b></td><td><b>'+p.totals.gross+'</b></td></tr>';
  });
  o += '</tbody></table></div><small class="muted">• = handicap stroke (full CH)</small></section>';
  if (r.stableford){
    o += '<section class="card"><h2>Stableford</h2><table><thead><tr><th></th><th>Front</th><th>Back</th><th>Total</th><th>$</th></tr></thead><tbody>';
    var order = P.map(function(_,i){return i;}).sort(function(a,b){ return P[b].totals.stbl - P[a].totals.stbl; });
    order.forEach(function(i){ var p=P[i]; o += '<tr><th>'+esc(p.name)+'</th><td>'+p.totals.stblF+'</td><td>'+p.totals.stblB+'</td><td><b>'+p.totals.stbl+'</b></td><td class="'+moneyCls(r.stableford.money[i])+'">'+money(r.stableford.money[i])+'</td></tr>'; });
    o += '</tbody></table><small class="muted">$'+st.bet+' per point difference vs each other player.</small></section>';
  }
  if (r.nassau){
    var pmTxt = {manual:'manual presses', auto:'auto presses '+(st.pressTrigger===1?'1':'2')+' down', both:'manual + auto presses '+(st.pressTrigger===1?'1':'2')+' down'}[st.presses||'off'];
    o += '<section class="card"><h2>Nassau <small class="muted">'+(st.nassauMode==='stroke'?'stroke play':'match play')+(pmTxt?' · '+pmTxt+(st.pressOverall?' (incl. overall)':''):'')+'</small></h2>';
    r.nassau.matches.forEach(function(m){
      o += '<div class="nas"><b>'+esc(m.label)+'</b>' + m.segments.map(function(s){
        var w = s.result==='a' ? m.a : s.result==='b' ? m.b : null;
        var res = s.result==='push' ? 'Push' : w ? w.map(function(k){return P[k].name;}).join(' & ')+' +$'+st.bet : 'In progress';
        var x = '<div class="rowsb"><span>'+s.name+'</span><span class="muted">'+esc(s.status)+'</span><b>'+esc(res)+'</b></div>';
        (s.presses||[]).forEach(function(p){ var pw = p.result==='a' ? m.a : p.result==='b' ? m.b : null;
          var pr = p.result==='push' ? 'Push' : pw ? pw.map(function(k){return P[k].name;}).join(' & ')+' +$'+st.bet : 'In progress';
          x += '<div class="rowsb press"><span>↳ Press #'+p.num+' <small>from '+(p.start+1)+(p.auto?' · auto':' · '+esc(p.side==='a'?m.An:m.Bn))+'</small></span><span class="muted">'+esc(p.status)+'</span><b>'+esc(pr)+'</b></div>'; });
        return x;
      }).join('') + '</div>';
    });
    o += '<div class="srow"><b>Nassau $</b><div>' + P.map(function(p,i){ return '<span>'+esc(p.name)+' <b class="'+moneyCls(r.nassau.money[i])+'">'+money(r.nassau.money[i])+'</b></span>'; }).join('') + '</div></div></section>';
  }
  if (r.skins){
    o += '<section class="card"><h2>Skins</h2><div class="skins">';
    r.skins.holes.forEach(function(s){
      if (s.pending) return;
      o += '<div class="'+(s.winner!=null?'won':'')+'"><span>#'+s.hole+'</span>' + (s.winner!=null ? '<b>'+esc(P[s.winner].name)+'</b><small>'+s.value+' skin'+(s.value>1?'s':'')+' (net '+s.net+')</small>' : '<small class="muted">'+(r.skins.carryOn?'tied – carry':'tied – no skin')+'</small>') + '</div>';
    });
    o += '</div>';
    if (r.skins.carryLeft) o += '<small class="carry">'+r.skins.carryLeft+' skin(s) unclaimed (tied through the last hole played).</small>';
    o += '<div class="srow"><b>Skins</b><div>' + P.map(function(p,i){ return '<span>'+esc(p.name)+' '+r.skins.won[i]+' · <b class="'+moneyCls(r.skins.money[i])+'">'+money(r.skins.money[i])+'</b></span>'; }).join('') + '</div></div></section>';
  }
  o += '<section class="card ledger"><h2>Money ledger</h2><table><thead><tr><th></th>'+(r.stableford?'<th>Stbl</th>':'')+(r.nassau?'<th>Nassau</th>':'')+(r.skins?'<th>Skins</th>':'')+'<th>Net</th></tr></thead><tbody>';
  P.forEach(function(p,i){ o += '<tr><th>'+esc(p.name)+'</th>'+(r.stableford?'<td>'+money(r.stableford.money[i])+'</td>':'')+(r.nassau?'<td>'+money(r.nassau.money[i])+'</td>':'')+(r.skins?'<td>'+money(r.skins.money[i])+'</td>':'')+'<td class="'+moneyCls(r.total[i])+'"><b>'+money(r.total[i])+'</b></td></tr>'; });
  o += '</tbody></table><h2>Settle up</h2>';
  o += r.settlements.length ? '<ul class="settle">' + r.settlements.map(function(s){ return '<li><b>'+esc(P[s.from].name)+'</b> pays <b>'+esc(P[s.to].name)+'</b> <span class="amt">$'+s.amount+'</span></li>'; }).join('') + '</ul>' : '<p class="muted">All square — nobody owes anything.</p>';
  o += '</section>';
  o += '<button class="secondary big" data-act="share">Share / copy results</button>';
  if (!readOnly) o += '<div class="nav"><button class="secondary big" data-go="hole">‹ Back to scoring</button><button class="primary big" data-act="endRound">End & save round</button></div>';
  return o + '</main>';
}
screens.summary = function(){ return header('Round Summary', 'hole') + summaryHTML(round, false); };
screens.historySummary = function(){ return viewRound ? header('Past Round', 'history') + summaryHTML(viewRound, true) + '<main><button class="ghost danger" data-act="delHistory">Delete this round</button></main>' : screens.history(); };
screens.history = function(){
  var hs = load(LS.history, []);
  var o = header('Past rounds','home') + '<main>';
  if (!hs.length) o += '<p class="muted center">No saved rounds yet.</p>';
  hs.slice().reverse().forEach(function(rd){ var c = getCourse(rd.courseId), r = E.computeRound(rd, c);
    o += '<button class="card listbtn" data-act="openHistory" data-id="'+rd.id+'"><b>'+new Date(rd.started).toLocaleDateString()+' · '+esc(c.name)+'</b><small>'+r.players.map(function(p,i){ return esc(p.name)+' '+p.totals.gross+' ('+money(r.total[i])+')'; }).join(' · ')+'</small></button>'; });
  return o + '</main>';
};

// ----- Players
screens.players = function(){
  var sp = savedPlayers().slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
  var o = header('Players & Index','home') + '<main><p class="muted">Update each Handicap Index from the GHIN app — it changes daily. Edits save instantly.</p>';
  sp.forEach(function(p){
    o += '<div class="card pedit"><input class="name" value="'+esc(p.name)+'" data-spname="'+p.id+'" placeholder="Name"><input inputmode="decimal" value="'+E.fmtIndex(p.index)+'" data-spindex="'+p.id+'" placeholder="Index"><button class="ghost danger" data-act="delPlayer" data-id="'+p.id+'" aria-label="delete">✕</button>'
      + '<small class="muted">'+(p.updated?'Updated '+new Date(p.updated).toLocaleDateString():'')+'</small></div>';
  });
  o += '<button class="secondary big" data-act="newSavedPlayer">+ Add player</button></main>';
  return o;
};

// ----- Courses
screens.courses = function(){
  var o = header('Courses','home') + '<main>';
  getCourses().forEach(function(c){
    o += '<div class="card"><div class="rowsb"><div><b>'+esc(c.name)+'</b><small class="muted">'+esc(c.location||'')+' · '+c.tees.length+' tees'+(c.edited?' · edited':'')+'</small></div><button class="secondary" data-act="editCourse" data-id="'+c.id+'">Edit</button></div>';
    o += '<table class="tees"><thead><tr><th>Tee</th><th></th><th>Rating</th><th>Slope</th><th>Par</th><th>Yds</th></tr></thead><tbody>' + c.tees.map(function(t){ return '<tr><td>'+esc(t.name)+'</td><td>'+t.gender+'</td><td>'+t.rating.toFixed(1)+'</td><td>'+t.slope+'</td><td>'+t.par+'</td><td>'+(t.yards?E.sum(t.yards):'')+'</td></tr>'; }).join('') + '</tbody></table>';
    if (c.notes) o += '<small class="muted">'+esc(c.notes)+'</small>';
    if (c.sources) o += '<small class="muted">Sources: '+c.sources.map(function(s){ return '<a href="'+esc(s)+'" target="_blank" rel="noopener">'+esc(s.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])+'</a>'; }).join(', ')+'</small>';
    o += '</div>';
  });
  o += '<button class="primary big" data-act="newCourse">+ Add a course</button></main>';
  return o;
};
screens.courseEdit = function(){
  var c = editCourse; if (!c) return screens.courses();
  var o = header(c.isNew?'Add course':'Edit course','courses') + '<main>';
  o += '<section class="card"><label class="lbl">Course name</label><input data-cf="name" value="'+esc(c.name)+'"><label class="lbl">Location</label><input data-cf="location" value="'+esc(c.location||'')+'"><label class="lbl">Notes</label><input data-cf="notes" value="'+esc(c.notes||'')+'"></section>';
  c.tees.forEach(function(t, ti){
    o += '<section class="card tee"><div class="rowsb"><h2>'+esc(t.name||'Tee')+'</h2><button class="ghost danger" data-act="delTee" data-t="'+ti+'">Delete tee</button></div>'
      + '<div class="pgrid4"><label><span class="lbl">Name</span><input data-tf="'+ti+'.name" value="'+esc(t.name)+'"></label>'
      + '<label><span class="lbl">Gender</span><select data-tf="'+ti+'.gender"><option value="M"'+(t.gender!=='F'?' selected':'')+'>Men</option><option value="F"'+(t.gender==='F'?' selected':'')+'>Women</option></select></label>'
      + '<label><span class="lbl">Rating</span><input inputmode="decimal" data-tf="'+ti+'.rating" value="'+t.rating+'"></label>'
      + '<label><span class="lbl">Slope</span><input inputmode="numeric" data-tf="'+ti+'.slope" value="'+t.slope+'"></label></div>'
      + '<small class="muted">Par '+E.sum(t.pars)+' (from holes)</small>';
    if (c.tees.length>1) o += '<label class="lbl">Copy pars & stroke index from</label><select data-act-change="copyTee" data-t="'+ti+'"><option value="">—</option>'+c.tees.map(function(x,k){ return k===ti?'':'<option value="'+k+'">'+esc(x.name)+'</option>'; }).join('')+'</select>';
    o += '<div class="tscroll"><table class="edit"><thead><tr><th>Hole</th><th>Par</th><th>SI</th><th>Yards</th></tr></thead><tbody>';
    for (var k=0;k<18;k++) o += '<tr><th>'+(k+1)+'</th><td><input inputmode="numeric" data-hf="'+ti+'.pars.'+k+'" value="'+t.pars[k]+'"></td><td><input inputmode="numeric" data-hf="'+ti+'.si.'+k+'" value="'+t.si[k]+'"></td><td><input inputmode="numeric" data-hf="'+ti+'.yards.'+k+'" value="'+(t.yards&&t.yards[k]!=null?t.yards[k]:'')+'"></td></tr>';
    o += '</tbody></table></div></section>';
  });
  o += '<button class="secondary big" data-act="addTee">+ Add tee</button>';
  o += '<div class="nav"><button class="secondary big" data-go="courses">Cancel</button><button class="primary big" data-act="saveCourse">Save course</button></div>';
  if (c.builtin && c.edited) o += '<button class="ghost danger" data-act="resetCourse">Reset to built-in data</button>';
  if (!c.builtin && !c.isNew) o += '<button class="ghost danger" data-act="deleteCourse">Delete course</button>';
  return o + '</main>';
};
function blankTee(from){ return { id: uid(), name: 'New tee', gender: 'M', rating: 72.0, slope: 113, par: from?from.par:72, pars: from?from.pars.slice():new Array(18).fill(4), si: from?from.si.slice():[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18], yards: new Array(18).fill(null) }; }
function validateCourse(c){
  var errs = [];
  if (!c.name.trim()) errs.push('Course needs a name');
  if (!c.tees.length) errs.push('Add at least one tee');
  c.tees.forEach(function(t){
    if (!(t.rating>50 && t.rating<90)) errs.push(t.name+': course rating looks wrong');
    if (!(t.slope>=55 && t.slope<=155)) errs.push(t.name+': slope must be 55–155');
    if (t.pars.some(function(p){ return !(p>=3 && p<=6); })) errs.push(t.name+': each par must be 3–6');
    var s = t.si.slice().sort(function(a,b){return a-b;}).join(',');
    if (s !== '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18') errs.push(t.name+': stroke indexes must use 1–18 once each');
  });
  return errs;
}

// ---------- events
function toast(msg){ var t = document.getElementById('toast'); t.textContent = msg; t.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(function(){ t.className=''; }, 2600); }
function setDeep(obj, path, val){ var ps = path.split('.'); var o = obj; for (var i=0;i<ps.length-1;i++) o = o[ps[i]]; o[ps[ps.length-1]] = val; }
function curPar(i){ var c = getCourse(round.courseId); return E.findTee(c, round.players[i].teeId).pars[round.hole]; }

var acts = {
  newRound: function(){
    if (round && !confirm('A round is in progress. Start setting up a new one? (The current round stays until you start the new one.)')) return;
    // refresh saved indexes into setup
    var sp = savedPlayers();
    setup.players.forEach(function(p){ var rec = sp.filter(function(x){ return x.id===p.pid; })[0]; if (rec){ p.name = rec.name; p.index = rec.index; } });
    go('setup');
  },
  addPlayer: function(){ var t = setup.players[setup.players.length-1].teeId; setup.players.push({name:'',index:null,teeId:t}); persist(); render(); },
  removePlayer: function(d){ setup.players.splice(+d.i,1); if (setup.players.length<4) setup.settings.nassauTeams=false; persist(); render(); },
  pickPlayer: function(d){
    var rec = savedPlayers().filter(function(x){ return x.id===d.id; })[0]; if (!rec) return;
    var c = getCourse(setup.courseId);
    var slot = setup.players.filter(function(p){ return !p.name.trim(); })[0];
    if (!slot){ if (setup.players.length>=4){ toast('Already 4 players — remove one first'); return; } slot = {teeId: setup.players[0].teeId}; setup.players.push(slot); }
    slot.pid = rec.id; slot.name = rec.name; slot.index = E.isNum(rec.index)?rec.index:null;
    if (rec.teeId && c.tees.some(function(t){ return t.id===rec.teeId; })) slot.teeId = rec.teeId;
    persist(); render();
  },
  bet: function(d){ setup.settings.bet = +d.v; persist(); render(); },
  strokeMode: function(d){ setup.settings.strokeMode = d.v; persist(); render(); },
  nassauMode: function(d){ setup.settings.nassauMode = d.v; persist(); render(); },
  pressMode: function(d){ setup.settings.presses = d.v; if (!setup.settings.pressTrigger) setup.settings.pressTrigger = 2; persist(); render(); },
  pressTrigger: function(d){ setup.settings.pressTrigger = +d.v; persist(); render(); },
  press: function(d){ var res = E.addPress(round, getCourse(round.courseId), d.m, +d.s, d.side); if (!res.ok){ toast(res.reason); return; } persist(); render(); toast('Press starts on hole '+(res.press.start+1)); },
  undoPress: function(d){ if (E.undoPress(round, getCourse(round.courseId), d.id)){ persist(); render(); toast('Press removed'); } else toast('Can\'t undo — scores already entered on its first hole'); },
  startRound: function(){
    var st = setup.settings, errs = [];
    setup.players.forEach(function(p,i){ if (!p.name.trim()) errs.push('Player '+(i+1)+' needs a name'); if (!E.isNum(p.index)) errs.push((p.name||'Player '+(i+1))+' needs a Handicap Index'); });
    if (!st.games.stableford && !st.games.nassau && !st.games.skins) errs.push('Pick at least one game');
    var names = setup.players.map(function(p){ return p.name.trim().toLowerCase(); });
    if (names.some(function(n,i){ return n && names.indexOf(n)!==i; })) errs.push('Player names must be different');
    if (errs.length){ alert(errs.join('\n')); return; }
    if (round && !confirm('Replace the round in progress? Its scores will be saved to Past rounds.')) return;
    if (round) archive(round);
    setup.players.forEach(function(p){ upsertPlayer(p); });
    round = { id: uid(), courseId: setup.courseId, started: Date.now(), hole: 0,
      players: setup.players.map(function(p){ return { pid:p.pid, name:p.name.trim(), index:p.index, teeId:p.teeId }; }),
      settings: clone(st), presses: [], scores: setup.players.map(function(){ return new Array(18).fill(null); }) };
    if (!(st.nassauTeams && setup.players.length===4)) round.settings.nassauTeams = false;
    go('hole');
  },
  inc: function(d){ var i=+d.i, v = round.scores[i][round.hole]; round.scores[i][round.hole] = E.isNum(v) ? Math.min(15, v+1) : curPar(i); persist(); render(); },
  dec: function(d){ var i=+d.i, v = round.scores[i][round.hole]; round.scores[i][round.hole] = E.isNum(v) ? Math.max(1, v-1) : curPar(i); persist(); render(); },
  setPar: function(d){ var i=+d.i, v = round.scores[i][round.hole]; round.scores[i][round.hole] = E.isNum(v) ? null : curPar(i); persist(); render(); },
  prevHole: function(){ if (round.hole>0){ round.hole--; persist(); render(); } },
  nextHole: function(){
    if (round.hole<17){
      var miss = round.players.filter(function(_,i){ return !E.isNum(round.scores[i][round.hole]); });
      if (miss.length && !confirm('No score yet for '+miss.map(function(p){return p.name;}).join(', ')+'. Go to next hole anyway?')) return;
      round.hole++; persist(); render(); window.scrollTo(0,0);
    }
  },
  goHole: function(d){ round.hole = +d.h; persist(); render(); },
  endRound: function(){
    var c = getCourse(round.courseId), r = E.computeRound(round, c);
    if (r.holesComplete < 18 && !confirm('Only '+r.holesComplete+' of 18 holes have scores for everyone. End and save anyway?')) return;
    archive(round); round = null; go('home'); toast('Round saved to Past rounds');
  },
  share: function(){
    var rd = ui.screen==='historySummary' ? viewRound : round; var txt = shareText(rd);
    if (navigator.share) navigator.share({ title: 'Golf results', text: txt }).catch(function(){});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function(){ toast('Results copied'); }, function(){ prompt('Copy results:', txt); });
    else prompt('Copy results:', txt);
  },
  openHistory: function(d){ viewRound = load(LS.history, []).filter(function(x){ return x.id===d.id; })[0]; ui.screen='historySummary'; render(); window.scrollTo(0,0); },
  delHistory: function(){ if (!confirm('Delete this saved round?')) return; save(LS.history, load(LS.history, []).filter(function(x){ return x.id!==viewRound.id; })); viewRound=null; go('history'); },
  delPlayer: function(d){ var list = savedPlayers(), rec = list.filter(function(x){ return x.id===d.id; })[0]; if (!rec || !confirm('Delete '+rec.name+' from saved players?')) return; setSavedPlayers(list.filter(function(x){ return x.id!==d.id; })); setup.players.forEach(function(p){ if (p.pid===d.id) delete p.pid; }); persist(); render(); },
  newSavedPlayer: function(){ var name = prompt('Player name'); if (!name || !name.trim()) return; var idx = E.parseIndex(prompt('Handicap Index (e.g. 12.4, or +1.2 for plus)') || ''); upsertPlayer({ name: name, index: E.isNum(idx)?idx:undefined }); render(); },
  editCourse: function(d){ editCourse = clone(getCourse(d.id)); ui.screen='courseEdit'; render(); window.scrollTo(0,0); },
  newCourse: function(){ editCourse = { id: uid(), isNew: true, name: '', location: '', notes: '', tees: [blankTee()] }; ui.screen='courseEdit'; render(); },
  addTee: function(){ editCourse.tees.push(blankTee(editCourse.tees[editCourse.tees.length-1])); render(); },
  delTee: function(d){ if (editCourse.tees.length<=1){ toast('A course needs at least one tee'); return; } if (confirm('Delete this tee?')){ editCourse.tees.splice(+d.t,1); render(); } },
  saveCourse: function(){
    var c = editCourse; c.tees.forEach(function(t){ t.par = E.sum(t.pars); });
    var errs = validateCourse(c); if (errs.length){ alert(errs.join('\n')); return; }
    var cus = customCourses().filter(function(x){ return x.id!==c.id; }); var o = clone(c); delete o.isNew; delete o.edited; delete o.builtin;
    cus.push(o); save(LS.courses, cus); editCourse = null; go('courses'); toast('Course saved');
  },
  resetCourse: function(){ if (!confirm('Discard your edits and restore built-in data?')) return; save(LS.courses, customCourses().filter(function(x){ return x.id!==editCourse.id; })); editCourse=null; go('courses'); },
  deleteCourse: function(){ if (!confirm('Delete this course?')) return; save(LS.courses, customCourses().filter(function(x){ return x.id!==editCourse.id; })); if (setup.courseId===editCourse.id) setup = defaultSetup(); editCourse=null; persist(); go('courses'); }
};
function archive(rd){ var hs = load(LS.history, []); rd.ended = Date.now(); hs = hs.filter(function(x){ return x.id!==rd.id; }); hs.push(rd); if (hs.length>100) hs = hs.slice(-100); save(LS.history, hs); }
function shareText(rd){
  var c = getCourse(rd.courseId), r = E.computeRound(rd, c), P = r.players, L = [];
  L.push(c.name+' — '+new Date(rd.started).toLocaleDateString()+' ($'+rd.settings.bet+')');
  P.forEach(function(p){ L.push(p.name+': '+p.totals.grossF+'-'+p.totals.grossB+'-'+p.totals.gross+' (net '+p.totals.net+')'+(r.stableford?' · '+p.totals.stbl+' pts':'')+(r.skins?' · '+r.skins.won[P.indexOf(p)]+' skins':'')); });
  L.push('Money: '+P.map(function(p,i){ return p.name+' '+money(r.total[i]); }).join(', '));
  r.settlements.forEach(function(s){ L.push(P[s.from].name+' pays '+P[s.to].name+' $'+s.amount); });
  return L.join('\n');
}

document.addEventListener('click', function(e){
  var b = e.target.closest('[data-go],[data-act]'); if (!b || b.disabled) return;
  if (b.tagName === 'SELECT') return;
  if (b.dataset.go){ if (ui.screen==='courseEdit') editCourse=null; go(b.dataset.go); return; }
  var f = acts[b.dataset.act]; if (f) f(b.dataset);
});
document.addEventListener('input', function(e){
  var el = e.target, d = el.dataset;
  if (d.pindex != null){
    var i = +d.pindex, p = setup.players[i], v = E.parseIndex(el.value);
    p.index = E.isNum(v) && v <= 54 && v >= -10 ? v : null;
    var c = getCourse(setup.courseId), ch = E.isNum(p.index) ? E.courseHandicap(p.index, E.findTee(c, p.teeId)) : null;
    document.getElementById('ch'+i).textContent = ch==null ? '–' : E.fmtCH(ch);
    if (E.isNum(p.index) && p.name.trim()) upsertPlayer(p);
    persist();
  } else if (d.pname != null){ setup.players[+d.pname].name = el.value; persist(); }
  else if (d.spindex != null){ var v2 = E.parseIndex(el.value); if (E.isNum(v2)){ var list = savedPlayers(); list.forEach(function(x){ if (x.id===d.spindex){ x.index = v2; x.updated = Date.now(); } }); setSavedPlayers(list); } }
  else if (d.spname != null){ if (el.value.trim()){ var l2 = savedPlayers(); l2.forEach(function(x){ if (x.id===d.spname){ x.name = el.value.trim(); x.updated = Date.now(); } }); setSavedPlayers(l2); setup.players.forEach(function(p){ if (p.pid===d.spname) p.name = el.value.trim(); }); persist(); } }
  else if (d.cf != null && editCourse){ editCourse[d.cf] = el.value; }
  else if (d.tf != null && editCourse){ var ps = d.tf.split('.'), t = editCourse.tees[+ps[0]]; t[ps[1]] = (ps[1]==='rating'||ps[1]==='slope') ? parseFloat(el.value) : el.value; }
  else if (d.hf != null && editCourse){ var q = d.hf.split('.'), tt = editCourse.tees[+q[0]]; if (!tt[q[1]]) tt[q[1]] = new Array(18).fill(null); var n = parseInt(el.value,10); tt[q[1]][+q[2]] = isFinite(n) ? n : null; }
});
document.addEventListener('change', function(e){
  var el = e.target, d = el.dataset;
  if (d.set != null){ setDeep(setup.settings, d.set, el.checked); persist(); render(); }
  else if (d.setup != null){
    if (d.setup === 'courseId'){ setup.courseId = el.value; var c = getCourse(el.value); setup.players.forEach(function(p){ if (!c.tees.some(function(t){ return t.id===p.teeId; })) p.teeId = c.tees[0].id; }); }
    else if (d.setup === 'teamPairing') setup.settings.teamPairing = +el.value;
    persist(); render();
  }
  else if (d.ptee != null){ var p = setup.players[+d.ptee]; p.teeId = el.value; if (p.pid || (p.name.trim() && E.isNum(p.index))) upsertPlayer(p); persist(); render(); }
  else if (d.pname != null){
    var pl = setup.players[+d.pname], rec = savedPlayers().filter(function(x){ return x.name.toLowerCase()===el.value.trim().toLowerCase(); })[0];
    if (rec){ pl.pid = rec.id; pl.name = rec.name; if (E.isNum(rec.index)) pl.index = rec.index; var cc = getCourse(setup.courseId); if (rec.teeId && cc.tees.some(function(t){return t.id===rec.teeId;})) pl.teeId = rec.teeId; persist(); render(); }
    else { delete pl.pid; if (E.isNum(pl.index) && pl.name.trim()) upsertPlayer(pl); persist(); }
  }
  else if (d.pindex != null){ render(); }
  else if (d.actChange === 'copyTee' && el.value !== ''){ var src = editCourse.tees[+el.value], dst = editCourse.tees[+d.t]; dst.pars = src.pars.slice(); dst.si = src.si.slice(); if (src.yards) dst.yards = src.yards.slice(); render(); }
  else if ((d.tf != null || d.cf != null) && editCourse){ /* keep focus; header refresh on blur */ }
});

// ---------- demo data (only when URL has #demo-*) – never touches saved data
if (DEMO){
  var mode = location.hash.slice(6) || 'summary';
  mem[LS.players] = [{id:'p1',name:'Bob',index:12.4,teeId:'blue',updated:Date.now()},{id:'p2',name:'Mike',index:6.1,teeId:'blue',updated:Date.now()},{id:'p3',name:'Dave',index:18.7,teeId:'white',updated:Date.now()},{id:'p4',name:'Steve',index:+0.8,teeId:'black',updated:Date.now()}];
  setup = defaultSetup(); setup.players = [{pid:'p1',name:'Bob',index:12.4,teeId:'blue'},{pid:'p2',name:'Mike',index:6.1,teeId:'blue'},{pid:'p3',name:'Dave',index:18.7,teeId:'white'},{pid:'p4',name:'Steve',index:-0.8,teeId:'black'}];
  setup.settings.games.stableford = true; setup.settings.bet = 2;
  if (/^press/.test(mode)){ setup.settings.presses = 'both'; setup.settings.games.stableford = false; }
  if (mode !== 'setup'){
    var demoScores = [[6,5,4,4,5,6,3,5,5, 5,6,4,4,6,3,5,6,5],[5,4,4,3,5,5,3,4,4, 4,5,3,5,5,3,4,5,4],[7,5,5,4,6,6,4,5,5, 5,6,4,5,6,4,5,6,5],[5,4,4,3,4,5,3,4,4, 4,5,3,4,4,3,4,5,4]];
    round = { id:'demo', courseId:'yolo-fliers', started:Date.now(), hole: mode==='hole'?4:17, players: clone(setup.players), settings: clone(setup.settings), scores: demoScores.map(function(s){ return mode==='hole' ? s.map(function(v,k){ return k<4?v:null; }) : s; }) };
  }
  if (mode === 'press'){ round.hole = 6; round.scores = round.scores.map(function(s){ return s.map(function(v,k){ return k<6?v:null; }); }); round.presses = [{ id:'demo1', m:'0-1', s:0, start:6, side:'a' }]; }
  if (mode === 'presssummary'){ round.presses = [{ id:'demo2', m:'0-1', s:0, start:4, side:'a' }, { id:'demo3', m:'0-3', s:1, start:12, side:'a' }]; }
  ui = { screen: mode === 'press' ? 'hole' : mode === 'presssummary' ? 'summary' : mode };
}
render();
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !DEMO) navigator.serviceWorker.register('sw.js').catch(function(){});
})();
