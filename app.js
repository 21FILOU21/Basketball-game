/* NBA Sim Lab 26 — local database, NBA stats import, coherent box scores and season history. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const POS = ['PG','SG','SF','PF','C'];
  const DATA_KEY = 'nbaSimLab.database.v2';
  const HISTORY_KEY = 'nbaSimLab.history.v2';
  const SEASON_KEY = 'nbaSimLab.season.v2';
  let SEASON = '2025-26';
  const HANDLE_DB = 'nbaSimLab.fileHandles.v1';
  let players = [], teams = [Array(5).fill(null), Array(5).fill(null)], selectedTeam = null;
  let history = [], fileHandle = null, spinTurns = 0, wins = 0, losses = 0, latestGame = null;

  const blankStats = () => ({
    perGame:{gp:null,gs:null,mp:null,pts:null,fg:null,fga:null,fgPct:null,fg3:null,fg3a:null,fg3Pct:null,ft:null,fta:null,ftPct:null,orb:null,drb:null,trb:null,ast:null,stl:null,blk:null,tov:null,pf:null},
    perMinute:{}, perPossession:{}, adjustedShooting:{}, advanced:{per:null,usgPct:null,astPct:null,trbPct:null,orbPct:null,drbPct:null,stlPct:null,blkPct:null,tovPct:null,ows:null,dws:null,ws:null,ws48:null,obpm:null,dbpm:null,bpm:null,vorp:null,offRtg:null,defRtg:null},
    shooting:{efgPct:null,tsPct:null,threePar:null,fTr:null,dist:null,corner3:null,heave:null},
    playByPlay:{positionEstimate:null,plusMinus:null,offCourt:null,defCourt:null,drawnFouls:null,blockedShots:null},
    totals:{}, units:{}
  });
  const num = v => { if(v === null || v === undefined || v === '' || v === '—' || v === '—') return null; const n = Number(String(v).replace(/,/g,'').replace('%','').trim()); return Number.isFinite(n) ? n : null; };
  const rate = v => { const n=num(v); return n===null?null:(n>1?n/100:n); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const avg = (p,k,def=0) => num(p?.stats?.perGame?.[k]) ?? num(p?.[k]) ?? def;
  const pct = (made,att) => att ? (made/att*100).toFixed(1)+'%' : '—';
  const safeJSON = (s) => { try { return JSON.parse(s); } catch(e) { throw new Error('JSON invalide : '+e.message); } };
  function normalizePlayer(p, idx=0) {
    const s=blankStats(), incoming=p.stats||{};
    for(const group of Object.keys(s)) if(incoming[group] && typeof incoming[group]==='object') s[group]={...s[group],...incoming[group]};
    for(const group of Object.keys(s)) if(s[group] && typeof s[group]==='object') for(const [key,value] of Object.entries(s[group])) {
      if(value===null || value===undefined || value==='') s[group][key]=null;
      else if(typeof value==='string' && num(value)!==null) s[group][key]=num(value);
    }
    const pg=s.perGame;
    const map={gp:['gp','games','games_played'],gs:['gs','games_started'],mp:['mp','mpg','minutes'],pts:['pts','points'],fg:['fg','fgm'],fga:['fga'],fgPct:['fg_pct','fgPct'],fg3:['fg3','fg3m','3p'],fg3a:['fg3a','3pa'],fg3Pct:['fg3_pct','three','threePointPct'],ft:['ft','ftm'],fta:['fta'],ftPct:['ft_pct'],orb:['orb'],drb:['drb'],trb:['trb','reb','rebounds'],ast:['ast','assists'],stl:['stl','steals'],blk:['blk','blocks'],tov:['tov','turnovers'],pf:['pf','fouls']};
    for(const [dest,aliases] of Object.entries(map)) { let v=pg[dest]; if(v===undefined || v===null) for(const a of aliases) if(p[a]!==undefined){v=p[a];break;} pg[dest]=num(v); }
    pg.fgPct=rate(pg.fgPct);pg.fg3Pct=rate(pg.fg3Pct);pg.ftPct=rate(pg.ftPct);
    if(pg.mp===null) pg.mp=num(p.mpg);
    if(pg.trb===null && pg.orb!==null && pg.drb!==null) pg.trb=pg.orb+pg.drb;
    s.shooting.efgPct=rate(s.shooting.efgPct ?? p.efgPct ?? p.efg_pct);
    s.shooting.tsPct=rate(s.shooting.tsPct ?? p.ts ?? p.ts_pct ?? p.trueShootingPct);
    if(s.shooting.tsPct===null && pg.pts!==null && pg.fga>0) s.shooting.tsPct=pg.pts/(2*(pg.fga+0.44*(pg.fta||0)));
    const advMap={per:['per'],usgPct:['usgPct','usg_pct'],astPct:['astPct','ast_pct'],trbPct:['trbPct','trb_pct'],orbPct:['orbPct','orb_pct'],drbPct:['drbPct','drb_pct'],stlPct:['stlPct','stl_pct'],blkPct:['blkPct','blk_pct'],tovPct:['tovPct','tov_pct'],ows:['ows'],dws:['dws'],ws:['ws'],ws48:['ws48','ws_48'],obpm:['obpm'],dbpm:['dbpm'],bpm:['bpm'],vorp:['vorp'],offRtg:['offRtg','off_rtg'],defRtg:['defRtg','def_rtg']};
    for(const [dest,aliases] of Object.entries(advMap)) if(s.advanced[dest]===null || s.advanced[dest]===undefined){for(const alias of aliases){if(p[alias]!==undefined){s.advanced[dest]=num(p[alias]);break;}}}
    for(const [group,fields] of [['perMinute',['pts','fg','fga','fg3','fg3a','ft','fta','orb','drb','trb','ast','stl','blk','tov','pf']],['perPossession',['pts','fg','fga','fg3','fg3a','ft','fta','orb','drb','trb','ast','stl','blk','tov','pf']]]) {
      for(const field of fields) { const raw=p[group+'_'+field] ?? p[field+'_'+(group==='perMinute'?'per_minute':'per_100_poss')]; if(raw!==undefined && s[group][field]==null)s[group][field]=num(raw); }
    }
    const id=String(p.id ?? [p.name||p.player||'unknown',p.team||p.tm||'UNK',p.season||SEASON].join('|')).trim();
    return {id,externalId:p.externalId||p.playerId||p.player_id||null,name:String(p.name||p.player||p.Player||'Joueur inconnu').trim(),team:String(p.team||p.tm||p.teamAbbreviation||'UNK').trim(),pos:String(p.pos||p.position||'—').trim(),age:num(p.age),season:String(p.season||SEASON),source:String(p.source||'Import utilisateur'),updatedAt:p.updatedAt||null,rawTables:p.rawTables||{},stats:s};
  }
  function fromLegacy(p,i) { const n=normalizePlayer(p,i); if(!n.stats.perGame.pts && p.pts!=null)n.stats.perGame.pts=num(p.pts); if(!n.stats.perGame.trb && p.reb!=null)n.stats.perGame.trb=num(p.reb); if(!n.stats.perGame.ast && p.ast!=null)n.stats.perGame.ast=num(p.ast); if(!n.stats.perGame.mp && p.mpg!=null)n.stats.perGame.mp=num(p.mpg); if(!n.stats.shooting.tsPct && p.ts!=null)n.stats.shooting.tsPct=rate(p.ts); if(!n.stats.perGame.fg3Pct && p.three!=null)n.stats.perGame.fg3Pct=rate(p.three); return n; }
  function fromStored(raw) { if(!raw || raw.schemaVersion!==2 || !Array.isArray(raw.players)) throw new Error('Structure de base non reconnue. Le fichier original est conservé; importez un JSON compatible.'); return raw.players.map((p,i)=>normalizePlayer(p,i)); }
  function dbObject() { return {schemaVersion:2,season:SEASON,lastUpdated:new Date().toISOString(),source:'Basketball-Reference / import utilisateur',players}; }
  function persistLocal() { try { localStorage.setItem(DATA_KEY,JSON.stringify(dbObject())); localStorage.setItem(HISTORY_KEY,JSON.stringify(history)); localStorage.setItem(SEASON_KEY,JSON.stringify({wins,losses,teams:teams.map(t=>t.map(p=>p?.id||null))})); } catch(e) { status('Sauvegarde navigateur impossible : '+e.message,true); } }
  function loadLocal() {
    try { const raw=localStorage.getItem(DATA_KEY); if(raw) players=fromStored(safeJSON(raw)); }
    catch(e) { const raw=localStorage.getItem(DATA_KEY);if(raw!==null)localStorage.setItem(DATA_KEY+'.corrupt-backup',raw);status('La base locale est illisible. Une copie brute a été conservée; aucune donnée n’a été écrasée. '+e.message,true); }
    try { history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); if(!Array.isArray(history))throw new Error('L’historique ne contient pas un tableau.'); }
    catch(e) { const raw=localStorage.getItem(HISTORY_KEY);if(raw!==null)localStorage.setItem(HISTORY_KEY+'.corrupt-backup',raw);history=[];status('Historique illisible : copie brute conservée. '+e.message,true); }
    try {
      const state=JSON.parse(localStorage.getItem(SEASON_KEY)||'{}'); wins=Number(state.wins)||0;losses=Number(state.losses)||0;
      if(Array.isArray(state.teams) && players.length) teams=state.teams.map(line=>Array.from({length:5},(_,i)=>players.find(p=>p.id===line[i])||null));
    } catch(e) { const raw=localStorage.getItem(SEASON_KEY);if(raw!==null)localStorage.setItem(SEASON_KEY+'.corrupt-backup',raw);status('Sauvegarde de saison illisible : copie brute conservée. '+e.message,true); }
  }
  function status(msg,bad=false) { const el=$('dataStatus'); if(el){el.textContent=msg;el.className=bad?'notice':'muted';} }
  function handleStore(action,value) {
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){resolve(null);return;}
      const req=window.indexedDB.open(HANDLE_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('handles'))req.result.createObjectStore('handles');};
      req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir le stockage des fichiers.'));
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('handles',action==='put'?'readwrite':'readonly'),store=tx.objectStore('handles');
        const op=action==='put'?store.put(value,'players'):store.get('players');
        op.onsuccess=()=>resolve(op.result??null);op.onerror=()=>reject(op.error||new Error('Erreur de stockage du fichier.'));
        tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error||new Error('Écriture du stockage des fichiers impossible.'));};
      };
    });
  }
  async function loadHandle(handle) {
    const permission=handle.queryPermission?await handle.queryPermission({mode:'readwrite'}):'granted';
    if(permission!=='granted')throw new Error('Autorisation de lecture/écriture refusée. Sélectionne de nouveau le fichier.');
    const file=await handle.getFile(),parsed=safeJSON(await file.text());
    players=fromStored(parsed);fileHandle=handle;
    teams=teams.map(line=>line.map(old=>old?players.find(p=>p.id===old.id)||null:null));
    await handleStore('put',handle);
    render();persistLocal();status('Base chargée depuis '+file.name+' — '+players.length+' joueurs.');
  }
  async function chooseDatabase() {
    if(!('showOpenFilePicker' in window) || !('showSaveFilePicker' in window)) {
      alert('Ce navigateur ne prend pas en charge l’accès persistant aux fichiers. La base reste sauvegardée dans le navigateur; utilise Exporter pour obtenir un JSON.');
      return;
    }
    try {
      const saved=await handleStore('get');
      if(saved){
        try {
          let permission=saved.queryPermission?await saved.queryPermission({mode:'readwrite'}):'granted';
          if(permission!=='granted'&&saved.requestPermission)permission=await saved.requestPermission({mode:'readwrite'});
          if(permission==='granted'){await loadHandle(saved);return;}
        }catch{}
      }
      const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'Base de joueurs JSON',accept:{'application/json':['.json']}}]});
      await loadHandle(handle);
    }catch(e){
      if(e.name==='AbortError')return;
      status('Ouverture du fichier impossible : '+e.message,true);
    }
  }
  async function restoreLinkedDatabase() {
    try {
      const handle=await handleStore('get');if(!handle)return;
      fileHandle=handle;
      const permission=handle.queryPermission?await handle.queryPermission({mode:'readwrite'}):'granted';
      if(permission==='granted')await loadHandle(handle);
      else status('Un fichier de base est lié. Clique sur « Charger un fichier local » pour renouveler son autorisation.');
    }catch(e){status('Le fichier lié n’a pas pu être rechargé : '+e.message,true);}
  }
  async function writeDatabase() {
    if(!fileHandle) { download(JSON.stringify(dbObject(),null,2),'nba_players_2025-26.json','application/json'); return; }
    const writable=await fileHandle.createWritable(); await writable.write(JSON.stringify(dbObject(),null,2)); await writable.close();
  }
  function download(content,name,type) { const a=document.createElement('a'),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000); }
  function teamsList() { return [...new Set(players.map(p=>p.team).filter(Boolean))].sort(); }
  function playerLine(p) { return '<b>'+esc(p.name)+'</b><br><small>'+esc(p.team)+' · '+esc(p.pos)+' · '+(avg(p,'pts',0)).toFixed(1)+' PTS · TS '+(p.stats.shooting.tsPct===null?'—':(p.stats.shooting.tsPct*100).toFixed(1)+'%')+'</small>'; }
  function renderStatsCards() {
    $('playerCount').textContent=players.length;$('teamCount').textContent=teamsList().length;
    const rates=players.map(p=>p.stats.shooting.tsPct).filter(x=>x!==null);
    $('avgTs').textContent=rates.length?(rates.reduce((a,b)=>a+b,0)/rates.length*100).toFixed(1)+'%':'—';
    $('dataSeason').textContent=SEASON;
  }
  function renderSlots() {
    const html=teams.map((line,ti)=>'<div class="team-composition"><h3>'+ (ti===0?'ÉQUIPE A — DOMICILE':'ÉQUIPE B — ADVERSAIRE')+'</h3><div class="slots">'+line.map((p,i)=>'<div class="slot"><div class="pos">'+POS[i]+'</div>'+(p?playerLine(p):'<strong class="muted">Spot libre</strong><small>Choisir un joueur</small>')+(p?'<button class="btn" data-remove="'+ti+':'+i+'">Retirer</button>':'')+'<button class="btn" data-fill="'+ti+':'+i+'">Sélectionner</button></div>').join('')+'</div></div>').join('');
    $('slots').innerHTML=html;
    $('slots').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const [t,i]=b.dataset.remove.split(':').map(Number);teams[t][i]=null;renderSlots();persistLocal();});
    $('slots').querySelectorAll('[data-fill]').forEach(b=>b.onclick=()=>{const [t,i]=b.dataset.fill.split(':').map(Number);$('targetTeam').value=String(t);$('addSlot').value=String(i);});
  }
  function renderPlayerSelects() {
    const target=$('targetTeam')?.value||'0',slot=$('addSlot')?.value||'0';
    $('addPlayer').innerHTML=players.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+esc(p.team)+' · '+esc(p.pos)+'</option>').join('');
    $('teamPlayers').innerHTML=players.filter(p=>p.team===selectedTeam).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.pos)+'</option>').join('')||'<option value="">Aucun joueur de cette équipe</option>';
    if($('targetTeam'))$('targetTeam').value=target;if($('addSlot'))$('addSlot').value=slot;
  }
  function renderTable() {
    if(!$('playerTable'))return;
    const q=($('search').value||'').toLowerCase(),sort=$('sort').value;
    const key={pts:p=>avg(p,'pts',-Infinity),ts:p=>p.stats.shooting.tsPct??-Infinity,three:p=>p.stats.perGame.fg3Pct??-Infinity,reb:p=>avg(p,'trb',-Infinity),ast:p=>avg(p,'ast',-Infinity)}[sort]||((p)=>avg(p,'pts',0));
    $('playerTable').innerHTML=players.filter(p=>(p.name+' '+p.team+' '+p.pos).toLowerCase().includes(q)).sort((a,b)=>key(b)-key(a)).map(p=>'<tr><td><b>'+esc(p.name)+'</b><br><small>'+esc(p.source)+'</small></td><td>'+esc(p.team)+'</td><td>'+esc(p.pos)+'</td><td>'+fmt(avg(p,'pts',null))+'</td><td>'+fmt(avg(p,'trb',null))+'</td><td>'+fmt(avg(p,'ast',null))+'</td><td>'+rateFmt(p.stats.shooting.tsPct)+'</td><td>'+rateFmt(p.stats.perGame.fg3Pct)+'</td><td>'+fmt(avg(p,'mp',null))+'</td></tr>').join('');
  }
  const fmt=n=>n===null||n===undefined?'—':Number(n).toFixed(1);
  const rateFmt=n=>n===null||n===undefined?'—':(n*100).toFixed(1)+'%';
  function renderRawStatsTable() {
    if(!$('rawStatsBody')) return;
    const category=$('rawCategory').value, team=$('rawTeam').value, query=($('rawSearch').value||'').toLowerCase();
    const rows=players.filter(p=>!team||p.team===team).map(p=>({player:p,raw:p.rawTables?.[category]})).filter(x=>x.raw && typeof x.raw==='object');
    const keys=[...new Set(rows.flatMap(x=>Object.keys(x.raw)))];
    $('rawStatsHead').innerHTML=keys.length?'<tr>'+['Joueur','Équipe',...keys].map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr>':'';
    const filtered=rows.filter(x=>(x.player.name+' '+x.player.team+' '+keys.map(k=>x.raw[k]??'').join(' ')).toLowerCase().includes(query));
    $('rawStatsBody').innerHTML=filtered.map(x=>'<tr><td>'+esc(x.player.name)+'</td><td>'+esc(x.player.team)+'</td>'+keys.map(k=>'<td>'+esc(x.raw[k]??'')+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+Math.max(2,keys.length+2)+'">Aucune ligne disponible pour ces filtres.</td></tr>';
    $('rawStatsSummary').textContent=filtered.length+' ligne(s) · '+keys.length+' colonne(s) source conservée(s) · '+category+' · '+(rows.length?'données réellement importées':'aucune donnée pour cette catégorie');
    const teams=teamsList(),previous=$('rawTeam').value;
    $('rawTeam').innerHTML='<option value="">Toutes les équipes</option>'+teams.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
    $('rawTeam').value=teams.includes(previous)?previous:'';
  }
  $('rawCategory')?.addEventListener('change',renderRawStatsTable);
  $('rawTeam')?.addEventListener('change',renderRawStatsTable);
  $('rawSearch')?.addEventListener('input',renderRawStatsTable);
  document.addEventListener('nba:data-sync-start',e=>{if(e.detail?.season){SEASON=String(e.detail.season-1)+'-'+String(e.detail.season).slice(-2);$('dataSeason').textContent=SEASON;}});
  document.addEventListener('nba:data-sync-complete',e=>{
    const {season,results}=e.detail||{};
    const identity=p=>[p.name,p.team,p.season].map(v=>String(v||'').trim().toLowerCase()).join('|');
    const merged=new Map(players.map(p=>[identity(p),p]));
    let added=0,updated=0;
    for(const result of (results||[]).filter(r=>r.ok&&r.csv)){
      try{
        const parsed=parseCSV(result.csv,result.filename||('NBA_'+season+'_'+result.category+'.csv'));
        const totalNames=new Set(parsed.filter(p=>String(p.team||p.tm||'').toUpperCase()==='TOT').map(p=>String(p.name||p.player||'').trim().toLowerCase()));
        const rows=parsed.filter(p=>String(p.team||p.tm||'').toUpperCase()==='TOT'||!totalNames.has(String(p.name||p.player||'').trim().toLowerCase()));
        for(const row of rows){
          row.season=String(season-1)+'-'+String(season).slice(-2);
          row.source='Basketball-Reference ('+result.category+')';
          const p=normalizePlayer(row),key=identity(p),old=merged.get(key);
          if(old){
            merged.set(key,{...old,...p,id:old.id,externalId:p.externalId||old.externalId||null,rawTables:{...(old.rawTables||{}),...(p.rawTables||{})},stats:mergeStats(old.stats,p.stats)});
            updated++;
          }else{merged.set(key,p);added++;}
        }
      }catch(error){result.ok=false;result.error='Validation du CSV: '+error.message;}
    }
    if(added+updated>0){
      const selectedIds=teams.map(line=>line.map(p=>p?.id||null));
      players=[...merged.values()];
      teams=selectedIds.map(line=>line.map(id=>id?players.find(p=>p.id===id)||null:null));
      render();renderRawStatsTable();persistLocal();
      writeDatabase().catch(err=>status('Synchronisation reçue mais écriture du fichier liée impossible : '+err.message,true));
    }
    renderRawStatsTable();
    const report=(results||[]).map(r=>({...r,columns:r.csv?(r.csv.split(/\r?\n/)[0].match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g)||[]).length:0}));
    const good=report.filter(r=>r.ok).length;
    if(good===8&&added+updated>0){
      try{localStorage.setItem('nbaSimLab.lastSync.v1',JSON.stringify({season,completedAt:e.detail.completedAt,categories:report.map(r=>r.category)}));}catch{}
    }
    status('Synchronisation '+(good===8?'terminée':'partielle')+' : '+good+'/8 catégories · '+added+' nouveaux joueurs · '+updated+' lignes fusionnées. Les données brutes sont consultables dans « Toutes les statistiques importées ».');
  });
  document.addEventListener('nba:data-sync-error',e=>status('Synchronisation indisponible : '+(e.detail?.message||'erreur inconnue'),true));
  function render() {
    renderStatsCards();renderSlots();renderPlayerSelects();renderTable();renderRawStatsTable();
    $('spin').disabled=!teamsList().length;
    $('Wins').textContent=wins;$('Loses').textContent=losses;
    if(!players.length) status('Base vide : synchronise la source si le service est installé, ou importe un fichier CSV/JSON.');
  }
  function assignPlayer(p,teamIndex,slot) {
    if(!p)return status('Sélectionne un joueur valide.',true);
    if(teams[teamIndex].some((x,i)=>x?.id===p.id && i!==slot)) return status('Ce joueur occupe déjà une place dans cette équipe.',true);
    teams[teamIndex][slot]=p;renderSlots();persistLocal();status(p.name+' ajouté en '+POS[slot]+' — équipe '+(teamIndex?'B':'A')+'.');
  }
  $('addBtn').onclick=()=>assignPlayer(players.find(p=>p.id===$('addPlayer').value),+$('targetTeam').value,+$('addSlot').value);
  $('addTeamPlayer').onclick=()=>{const p=players.find(p=>p.id===$('teamPlayers').value);let ti=+$('targetTeam').value,slot=teams[ti].findIndex(x=>!x);assignPlayer(p,ti,slot<0?+$('addSlot').value:slot);};
  $('spin').onclick=()=>{const list=teamsList();if(!list.length)return;selectedTeam=list[Math.floor(Math.random()*list.length)];spinTurns+=5+Math.floor(Math.random()*4);$('wheel').style.transform='rotate('+(spinTurns*360+Math.random()*300)+'deg)';$('teamResult').textContent=selectedTeam;$('teamHint').textContent=players.filter(p=>p.team===selectedTeam).length+' joueur(s) chargé(s)';renderPlayerSelects();};
  $('search').oninput=renderTable;$('sort').onchange=renderTable;$('variance').oninput=()=>$('varianceValue').textContent=$('variance').value+'%';
  $('reset').onclick=()=>{if(!confirm('Vider la base locale et les compositions ? Cette action ne supprime pas les fichiers exportés.'))return;players=[];teams=[Array(5).fill(null),Array(5).fill(null)];selectedTeam=null;render();persistLocal();status('Base locale vidée. Les sauvegardes exportées restent intactes.');};
  $('export').onclick=async()=>{try{await writeDatabase();status('Base exportée/sauvegardée : '+players.length+' joueurs.');}catch(e){status('Export impossible : '+e.message,true);}};
  $('linkFile').onclick=chooseDatabase;
  $('createFile').onclick=async()=> {
    if(!('showSaveFilePicker' in window)){alert('La création directe exige un navigateur compatible avec File System Access. Utilise Exporter la base JSON pour télécharger le fichier.');return;}
    try {fileHandle=await window.showSaveFilePicker({suggestedName:'nba_players_2025-26.json',types:[{description:'Base de joueurs JSON',accept:{'application/json':['.json']}}]});await handleStore('put',fileHandle);await writeDatabase();status('Fichier de base créé / lié et sauvegardé.');}
    catch(e){if(e.name!=='AbortError')status('Création du fichier impossible : '+e.message,true);}
  };
  $('importFile').onchange=async e=>{
    const files=[...e.target.files||[]];if(!files.length)return;
    const identity=p=>[p.name,p.team,p.season].map(v=>String(v||'').trim().toLowerCase()).join('|');
    let merged=new Map(players.map(p=>[identity(p),p]));let added=0,updated=0,errors=[];
    for(let fileIndex=0;fileIndex<files.length;fileIndex++){const f=files[fileIndex];status('Import en cours ('+(fileIndex+1)+'/'+files.length+') : '+f.name);
      try{
        const txt=await f.text();let data;
        if(/\.(csv|txt)$/i.test(f.name))data=parseCSV(txt,f.name);
        else{data=safeJSON(txt);if(data.players)data=data.players;}
        if(!Array.isArray(data))throw new Error('Le fichier doit contenir un tableau de joueurs.');
        // Basketball-Reference may emit a TOT aggregate row alongside team rows.
        const totalNames=new Set(data.filter(p=>String(p.team||p.tm||'').toUpperCase()==='TOT').map(p=>String(p.name||p.player||'').trim().toLowerCase()));
        data=data.filter(p=>String(p.team||p.tm||'').toUpperCase()==='TOT'||!totalNames.has(String(p.name||p.player||'').trim().toLowerCase()));
        for(let i=0;i<data.length;i++){
          const p=normalizePlayer(data[i],i);
          if(p.team.toUpperCase()==='TOT')p.team='MULTI';
          const key=identity(p),old=merged.get(key);
          if(old){
            merged.set(key,{...old,...p,id:old.id,rawTables:{...(old.rawTables||{}),...(p.rawTables||{})},stats:mergeStats(old.stats,p.stats)});
            updated++;
          }else{merged.set(key,p);added++;}
        }
      }catch(err){errors.push(f.name+': '+err.message);}
    }
    if(added+updated===0&&errors.length){status('Import échoué sans modifier la base. '+errors.join(' | '),true);e.target.value='';return;}
    const selectedIds=teams.map(line=>line.map(p=>p?.id||null));
    players=[...merged.values()].map((p,i)=>normalizePlayer(p,i));
    teams=selectedIds.map(line=>line.map(id=>id?players.find(p=>p.id===id)||null:null));
    render();persistLocal();
    try{await writeDatabase();}catch(err){status('Import en mémoire effectué, mais écriture du fichier échouée : '+err.message,true);}
    status('Import terminé — '+added+' nouveaux, '+updated+' mis à jour, '+players.length+' joueurs en base. '+(errors.length?'Erreurs : '+errors.join(' | '):'Aucune erreur.'));
    e.target.value='';
  };
  function mergeStats(a,b){
    const out=blankStats();
    for(const g of Object.keys(out)){
      out[g]={...(a?.[g]||{}),...(b?.[g]||{})};
      for(const [k,v] of Object.entries(b?.[g]||{}))if(v===null||v===undefined||v==='')out[g][k]=(a?.[g]||{})[k]??null;
    }
    return out;
  }
  function parseCSV(text,filename=''){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
    if(lines.length<2)throw new Error('CSV vide ou sans lignes de données.');
    const parseLine=line=>{const out=[];let cur='',quote=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'&&quote){cur+='"';i++;}else if(ch==='"')quote=!quote;else if(ch===','&&!quote){out.push(cur.trim());cur='';}else cur+=ch;}out.push(cur.trim());return out;};
    const headers=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/[%]/g,'_pct').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
    const file=filename.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    const group=file.includes('adj_shooting')||file.includes('adjusted_shooting')?'adjustedShooting':file.includes('per_36')||file.includes('per_minute')||file.includes('per_min')?'perMinute':file.includes('per_poss')||file.includes('per_100')?'perPossession':file.includes('advanced')?'advanced':file.includes('play_by_play')||file.includes('play_by_play')?'playByPlay':file.includes('shooting')?'shooting':file.includes('totals')?'totals':'perGame';
    return lines.slice(1).map(line=>{
      const vals=parseLine(line),o={};headers.forEach((h,i)=>o[h]=vals[i]??'');
      const get=(...keys)=>{for(const k of keys)if(o[k]!==undefined&&o[k]!=='')return o[k];return null;};
      const name=get('player','name');if(!name)return null;
      const team=get('tm','team'),base={name,team,pos:get('pos','position'),age:get('age'),externalId:get('player_id','playerid'),season:SEASON,source:'Basketball-Reference CSV ('+group+')',rawTables:{[group]:o}};
      const fields=['fg','fga','fg3','fg3a','ft','fta','orb','drb','trb','ast','stl','blk','tov','pf','pts'];
      if(group==='perGame')return {...base,gp:get('g','gp'),gs:get('gs'),mp:get('mp','mp_per_g'),pts:get('pts','pts_per_g'),fg:get('fg','fg_per_g'),fga:get('fga','fga_per_g'),fg_pct:get('fg_pct'),fg3:get('x3p','fg3','3p'),fg3a:get('x3pa','fg3a','3pa'),fg3_pct:get('x3p_pct','fg3_pct','3p_pct'),ft:get('ft','ft_per_g'),fta:get('fta','fta_per_g'),ft_pct:get('ft_pct'),orb:get('orb','orb_per_g'),drb:get('drb','drb_per_g'),trb:get('trb','trb_per_g'),ast:get('ast','ast_per_g'),stl:get('stl','stl_per_g'),blk:get('blk','blk_per_g'),tov:get('tov','tov_per_g'),pf:get('pf','pf_per_g'),efg_pct:get('efg_pct'),ts_pct:get('ts_pct'),three_par:get('x3p_ar','3par','3p_ar'),f_tr:get('f_tr','ftr'),stats:{shooting:{efgPct:get('efg_pct'),tsPct:get('ts_pct'),threePar:get('x3p_ar','3par','3p_ar'),fTr:get('f_tr','ftr'),dist:get('dist')},units:{perGame:'per_game'}}};
      const raw={};
      if(group==='totals'){
        for(const h of headers)if(!['player','pos','age','tm','team','g','gs'].includes(h))raw[h]=get(h);
        return {...base,stats:{totals:raw,units:{totals:'season_total'}}};
      }
      if(group==='perMinute'||group==='perPossession'){for(const k of fields)raw[k]=get(...(k==='fg3'?['x3p','fg3','3p']:k==='fg3a'?['x3pa','fg3a','3pa']:[k]));return {...base,stats:{[group]:raw,units:{[group]:group==='perMinute'?'per_minute':'per_100_possessions'}}};}
      if(group==='advanced'){
        const aliases={per:['per'],usgPct:['usg_pct'],astPct:['ast_pct'],trbPct:['trb_pct'],orbPct:['orb_pct'],drbPct:['drb_pct'],stlPct:['stl_pct'],blkPct:['blk_pct'],tovPct:['tov_pct'],ows:['ows'],dws:['dws'],ws:['ws'],ws48:['ws_48'],obpm:['obpm'],dbpm:['dbpm'],bpm:['bpm'],vorp:['vorp'],offRtg:['ortg','off_rtg'],defRtg:['drtg','def_rtg']};
        for(const [k,a] of Object.entries(aliases))raw[k]=get(...a);return {...base,stats:{advanced:raw}};
      }
      if(group==='shooting'){
        const aliases={efgPct:['efg_pct'],tsPct:['ts_pct'],threePar:['x3p_ar','3par','3p_ar'],fTr:['f_tr','ftr'],dist:['dist'],corner3:['corner_3'],heave:['heave'],fgPct:['fg_pct'],fg3Pct:['x3p_pct','3p_pct'],ftPct:['ft_pct']};
        for(const [k,a] of Object.entries(aliases))raw[k]=get(...a);return {...base,stats:{shooting:raw}};
      }
      if(group==='adjustedShooting') return {...base,stats:{adjustedShooting:o,units:{adjustedShooting:'source_defined'}}};
      const aliases={plusMinus:['plus_minus'],offCourt:['off_court'],defCourt:['def_court'],drawnFouls:['drawn_shooting_fouls'],blockedShots:['blkd']};
      for(const [k,a] of Object.entries(aliases))raw[k]=get(...a);
      raw.positionEstimate={PG:get('pg_pct'),SG:get('sg_pct'),SF:get('sf_pct'),PF:get('pf_pct'),C:get('c_pct')};
      return {...base,stats:{playByPlay:raw}};
    }).filter(Boolean);
  }
  function createBoxPlayers(teamLine) {
    const active=teamLine.filter(Boolean);
    const raw=active.map(p=>({playerId:p.id,name:p.name,team:p.team,pos:p.pos,mp:0,pts:0,fg:0,fga:0,fg3:0,fg3a:0,ft:0,fta:0,orb:0,drb:0,trb:0,ast:0,stl:0,blk:0,tov:0,pf:0,plusMinus:null,
      ts:p.stats.shooting.tsPct,three:p.stats.perGame.fg3Pct,fgPct:p.stats.perGame.fgPct,ftPct:p.stats.perGame.ftPct,mpg:avg(p,'mp',30),usage:p.stats.advanced.usgPct}));
    // The current engine has no substitutions: the five selected starters play all 48 minutes.
    raw.forEach(p=>p.mp=48);
    return raw;
  }
  function chooseWeighted(items, weightFn) {
    const weightedItems=items.map((p,i)=>({p,i,w:Math.max(.01,weightFn(p,i))}));
    return weighted(weightedItems);
  }
  function simulateSide(offense, defense, possessions, variance) {
    const weights=offense.map(p=>Math.max(.15,(p.usage===null||p.usage===undefined?20:(p.usage>1?p.usage/100:p.usage))*1.0)*
      Math.max(.35,(p.mp/48))*Math.max(.4,(avg(players.find(x=>x.id===p.playerId),'pts',12)/18)));
    const offenseEntries=offense.map((p,i)=>({p,i,w:weights[i]}));
    for(let possession=0;possession<Math.round(possessions);possession++){
      const chosen=weighted(offenseEntries), shooter=chosen.p;
      const tovRateRaw=players.find(x=>x.id===shooter.playerId)?.stats?.advanced?.tovPct;
      const tovRate=tovRateRaw==null?.115:Math.max(.04,Math.min(.25,tovRateRaw>1?tovRateRaw/100:tovRateRaw));
      if(Math.random()<tovRate){
        shooter.tov++;
        if(Math.random()<.28) chooseWeighted(defense,(p)=>Math.max(.1,p.mp/48)).p.stl++;
        continue;
      }
      // An offensive rebound can extend the possession for another shot (up to three attempts).
      for(let attempt=0;attempt<3;attempt++){
        shooter.fga++;
        const source=players.find(x=>x.id===shooter.playerId);
        const perGame=source?.stats?.perGame||{};
        const threeRate=(perGame.fga>0&&perGame.fg3a!==null&&perGame.fg3a!==undefined)?Math.max(.02,Math.min(.65,perGame.fg3a/perGame.fga)):.34;
        const is3=Math.random()<threeRate;
        let shotPct;
        if(is3) shotPct=shooter.three??.35;
        else {
          const twoAtt=(perGame.fga??0)-(perGame.fg3a??0),twoMade=(perGame.fg??0)-(perGame.fg3??0);
          shotPct=twoAtt>0?twoMade/twoAtt:(shooter.fgPct??.47);
        }
        if(shotPct>1)shotPct/=100;
        const swing=1+(Math.random()-.5)*(variance/100)*.42;
        const made=Math.random()<Math.max(.12,Math.min(.78,shotPct*swing));
        if(is3)shooter.fg3a++;
        if(made){
          shooter.fg++;if(is3)shooter.fg3++;
          shooter.pts+=is3?3:2;
          if(Math.random()<.60)chooseWeighted(offense.filter(p=>p.playerId!==shooter.playerId),(p)=>Math.max(.1,p.mp/48)).p.ast++;
          break;
        }
        const defender=chooseWeighted(defense,(p)=>Math.max(.1,p.mp/48)).p;
        if(Math.random()<.055)defender.blk++;
        if(Math.random()<.085){
          defender.pf++;
          // Shooting fouls on misses: two free throws, or three on a missed three-point shot.
          const attempts=is3?3:2;shooter.fta+=attempts;
          const ftRaw=shooter.ftPct;const ftPct=ftRaw==null?.77:(ftRaw>1?ftRaw/100:ftRaw);
          for(let ft=0;ft<attempts;ft++)if(Math.random()<Math.max(.25,Math.min(.98,ftPct))){shooter.ft++;shooter.pts++;}
          break;
        }
        const offensiveRebound=Math.random()<.24;
        if(offensiveRebound){
          const rebounder=chooseWeighted(offense,(p)=>Math.max(.1,p.mp/48)).p;
          rebounder.orb++;rebounder.trb++;
          if(attempt===2)break;
          // Keep the possession alive after an offensive rebound.
        }else{
          const rebounder=chooseWeighted(defense,(p)=>Math.max(.1,p.mp/48)).p;
          rebounder.drb++;rebounder.trb++;break;
        }
      }
    }
    return {players:offense,score:offense.reduce((s,p)=>s+p.pts,0)};
  }
  function weighted(items){const total=items.reduce((s,x)=>s+x.w,0);let r=Math.random()*total;for(const x of items){r-=x.w;if(r<=0)return x;}return items[items.length-1];}
  function leaders(lines) {
    const cats=[['Meilleur marqueur','pts'],['Meilleur rebondeur','trb'],['Meilleur passeur','ast'],['Meilleur intercepteur','stl'],['Meilleur contreur','blk'],['Meilleur joueur (EFF)','eff']];
    const value=(p,key)=>key==='eff'?p.pts+p.trb+p.ast+p.stl+p.blk-(p.fga-p.fg)-(p.fta-p.ft)-p.tov:p[key];
    return cats.map(([label,key])=>{const all=lines.flatMap(t=>t.players.map(p=>({p,t,v:value(p,key)}))),max=Math.max(...all.map(x=>x.v));return {label,value:max,names:all.filter(x=>x.v===max&&max>0).map(x=>x.p.name+' ('+x.t.label+')')};});
  }
  function renderBox(game) {
    const columns=[['Joueur','name'],['MIN','mp'],['PTS','pts'],['FG','fg'],['FGA','fga'],['FG%','fgPct'],['3P','fg3'],['3PA','fg3a'],['3P%','threePct'],['FT','ft'],['FTA','fta'],['FT%','ftPct'],['OREB','orb'],['DREB','drb'],['REB','trb'],['AST','ast'],['STL','stl'],['BLK','blk'],['TOV','tov'],['PF','pf'],['+/-','plusMinus']];
    $('boxScore').innerHTML=game.lines.map(t=>'<h3>'+esc(t.label)+' — '+t.score+' points</h3><div class="tablewrap"><table><thead><tr>'+columns.map(c=>'<th>'+c[0]+'</th>').join('')+'</tr></thead><tbody>'+t.players.map(p=>'<tr>'+columns.map(c=>{let k=c[1],v=p[k];if(k==='fgPct')v=p.fga?p.fg/p.fga*100:null;if(k==='threePct')v=p.fg3a?p.fg3/p.fg3a*100:null;if(k==='ftPct')v=p.fta?p.ft/p.fta*100:null;return '<td>'+(k==='name'?esc(v):k==='plusMinus'?'—':k.endsWith('Pct')?(v===null?'—':v.toFixed(1)+'%'):k==='mp'?(v/1).toFixed(1):v??0)+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div>').join('');
    $('leaders').innerHTML='<h3>Leaders du match</h3><div class="stats">'+leaders(game.lines).map(l=>'<div class="stat"><span>'+l.label+'</span><b style="font-size:16px">'+(l.names.length?l.names.map(esc).join(', '):'—')+'</b><small>'+l.value+'</small></div>').join('')+'</div>';
  }
  function simulate() {
    if(teams.some(t=>t.filter(Boolean).length!==5)){status('Il faut cinq titulaires pour chacune des deux équipes avant de simuler.',true);return;}
    const n=+$('possessions').value,variance=+$('variance').value;
    const aPlayers=createBoxPlayers(teams[0]),bPlayers=createBoxPlayers(teams[1]);
    const a=simulateSide(aPlayers,bPlayers,n,variance),b=simulateSide(bPlayers,aPlayers,n,variance);
    // +/- is deliberately unavailable: the current model does not track on-court stints or substitutions.
    const game={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),season:SEASON,date:new Date().toISOString(),type:'played',possessions:n,variance,lines:[{label:'Équipe A',score:a.score,players:a.players},{label:'Équipe B',score:b.score,players:b.players}]};
    latestGame=game;history.push(game);if(a.score>b.score)wins++;else if(a.score<b.score)losses++;persistLocal();
    $('scoreA').textContent=a.score;$('scoreB').textContent=b.score;$('winner').textContent=a.score===b.score?'Égalité':a.score>b.score?'ÉQUIPE A':'ÉQUIPE B';$('momentum').textContent='Variance '+variance+'%';$('Wins').textContent=wins;$('Loses').textContent=losses;
    $('gameLog').innerHTML='<p>Match enregistré · '+new Date(game.date).toLocaleString()+' · '+n+' possessions par équipe.</p><p>Le score correspond à la somme des points des joueurs. Le +/- reste indisponible tant que les présences sur le terrain ne sont pas suivies.</p>';
    renderBox(game);renderHistory();renderSeason();status('Match enregistré dans l’historique. '+history.length+' rencontre(s) conservée(s).');
  }
  $('simulate').onclick=simulate;
  function renderHistory() {
    $('historyCount').textContent=history.length;
    $('historyList').innerHTML=history.slice().reverse().map(g=>'<div class="player"><div><strong>'+esc(new Date(g.date).toLocaleString())+' · '+esc(g.season)+'</strong><small>'+g.lines.map(t=>esc(t.label)+' '+t.score).join(' — ')+' · '+esc(g.type)+'</small></div><button class="btn" data-game="'+esc(g.id)+'">Voir box score</button></div>').join('')||'<p>Aucun match enregistré pour le moment.</p>';
    $('historyList').querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{const g=history.find(x=>x.id===b.dataset.game);if(g){latestGame=g;$('scoreA').textContent=g.lines[0].score;$('scoreB').textContent=g.lines[1].score;renderBox(g);}});
  }
  function seasonTotals() {
    const sums=new Map();
    for(const g of history.filter(g=>g.season===SEASON))for(const line of g.lines)for(const p of line.players){const key=p.playerId+'|'+p.name;if(!sums.has(key))sums.set(key,{name:p.name,gp:0,mp:0,pts:0,fg:0,fga:0,fg3:0,fg3a:0,ft:0,fta:0,orb:0,drb:0,trb:0,ast:0,stl:0,blk:0,tov:0,pf:0});const s=sums.get(key);s.gp++;for(const k of ['mp','pts','fg','fga','fg3','fg3a','ft','fta','orb','drb','trb','ast','stl','blk','tov','pf'])s[k]+=p[k]||0;}
    return [...sums.values()].map(s=>({...s,ppg:s.pts/s.gp,rpg:s.trb/s.gp,apg:s.ast/s.gp,spg:s.stl/s.gp,bpg:s.blk/s.gp,topg:s.tov/s.gp,mpg:s.mp/s.gp,fgPct:pct(s.fg,s.fga),threePct:pct(s.fg3,s.fg3a),ftPct:pct(s.ft,s.fta),efgPct:s.fga?((s.fg+.5*s.fg3)/s.fga*100).toFixed(1)+'%':'—',tsPct:(2*(s.fga+.44*s.fta))? (s.pts/(2*(s.fga+.44*s.fta))*100).toFixed(1)+'%':'—'}));
  }
  function renderSeason() {
    const rows=seasonTotals();$('seasonTable').innerHTML=rows.map(s=>'<tr>'+[s.name,s.gp,s.pts,s.ppg.toFixed(1),s.trb,s.rpg.toFixed(1),s.ast,s.apg.toFixed(1),s.stl,s.blk,s.tov,s.mpg.toFixed(1),s.fgPct,s.threePct,s.ftPct,s.efgPct,s.tsPct].map((v,i)=>'<td>'+(i===0?esc(v):v)+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="17">Les statistiques apparaîtront après les premiers matchs.</td></tr>';
  }
  $('seasonRefresh').onclick=renderSeason;
  $('seasonExport').onclick=()=>download(JSON.stringify({season:SEASON,source:'simulation',generatedAt:new Date().toISOString(),players:seasonTotals(),games:history},null,2),'nba_sim_season_'+SEASON+'.json','application/json');
  // Try browser-local persistence at startup. A selected file is user-authorized; no silent disk writes.
  loadLocal();
  if(!localStorage.getItem(DATA_KEY)) persistLocal(); // initialize a valid empty database without overwriting an existing one
  render();renderHistory();renderSeason();
  restoreLinkedDatabase();
})();