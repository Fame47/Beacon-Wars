/* =========================================================
   BEACON WARS v57 CLEAN CODE MAP
   =========================================================
   1. CONFIG: board constants, art, units, tactics, battlefields
   2. SETUP UI: side, commander, tactic, battlefield cards
   3. GAME INIT: map loading, deployment safety, board reset
   4. BOARD HELPERS: blocked cells, center coordinates, placement
   5. RENDERING: unit tray, board pieces, markers, console
   6. INPUT: click, drag, scan confirm, tactical warp confirm
   7. COMBAT: rank resolution, mines, beacon, commander defeat
   8. AI: fair/no-psychic movement and attack scoring
   9. UTILITY: logs, modals, calibration, help screen
*/
const ROWS=8, COLS=10, BLUE='blue', RED='red';
const settings={sound:true,music:true};
const setup={side:'blue', commander:'fleet', tactic:'tacticalWarp', battlefield:'mars'};
const ONLINE_STORAGE_PREFIX='beaconWarsRoom_';
const onlineState={
  enabled:false,
  role:'local',
  roomCode:null,
  hostColor:null,
  playerColor:null,
  opponentColor:null,
  firstAttackTeam:null,
  firebaseReady:false,
  uid:null,
  roomUnsub:null,
  moveSeq:0,
  firebaseError:null,
  pendingCommit:false,
  lastCommitId:null,
  lastRoomData:null,
  pendingMove:null,
  lastAppliedCommitId:null,
  opponentDeploymentId:null
};
let showCenterDots=false, showAllEnemies=false;

// Main rule: the middle of the A on the base is the anchor.
// Every piece is normalized to 118 x 129. This anchor can be nudged live.
const BASE_ANCHOR = {x:54, y:119};
let anchorOffset = {x:0,y:0};

const TILE_CENTERS=[
  [{x:555.5,y:748.3},{x:646.5,y:748.3},{x:737.4,y:748.3},{x:828.3,y:748.3},{x:919.2,y:748.3},{x:1010.1,y:748.3},{x:1101.0,y:748.3},{x:1192.0,y:748.3},{x:1282.9,y:748.3},{x:1373.8,y:748.3}],
  [{x:569.1,y:677.0},{x:657.0,y:677.0},{x:744.9,y:677.0},{x:832.7,y:677.0},{x:920.6,y:677.0},{x:1008.4,y:677.0},{x:1096.3,y:677.0},{x:1184.1,y:677.0},{x:1272.0,y:677.0},{x:1359.9,y:677.0}],
  [{x:582.7,y:605.8},{x:667.5,y:605.8},{x:752.3,y:605.8},{x:837.1,y:605.8},{x:921.9,y:605.8},{x:1006.7,y:605.8},{x:1091.5,y:605.8},{x:1176.3,y:605.8},{x:1261.1,y:605.8},{x:1345.9,y:605.8}],
  [{x:596.4,y:534.6},{x:678.1,y:534.6},{x:759.8,y:534.6},{x:841.6,y:534.6},{x:923.3,y:534.6},{x:1005.0,y:534.6},{x:1086.8,y:534.6},{x:1168.5,y:534.6},{x:1250.3,y:534.6},{x:1332.0,y:534.6}],
  [{x:610.0,y:463.4},{x:688.6,y:463.4},{x:767.3,y:463.4},{x:846.0,y:463.4},{x:924.7,y:463.4},{x:1003.3,y:463.4},{x:1082.0,y:463.4},{x:1160.7,y:463.4},{x:1239.4,y:463.4},{x:1318.1,y:463.4}],
  [{x:623.6,y:392.1},{x:699.2,y:392.1},{x:774.8,y:392.1},{x:850.4,y:392.1},{x:926.0,y:392.1},{x:1001.6,y:392.1},{x:1077.3,y:392.1},{x:1152.9,y:392.1},{x:1228.5,y:392.1},{x:1304.1,y:392.1}],
  [{x:637.2,y:320.9},{x:709.7,y:320.9},{x:782.3,y:320.9},{x:854.8,y:320.9},{x:927.4,y:320.9},{x:1000.0,y:320.9},{x:1072.5,y:320.9},{x:1145.1,y:320.9},{x:1217.6,y:320.9},{x:1290.2,y:320.9}],
  [{x:650.8,y:249.7},{x:720.3,y:249.7},{x:789.8,y:249.7},{x:859.3,y:249.7},{x:928.8,y:249.7},{x:998.3,y:249.7},{x:1067.8,y:249.7},{x:1137.3,y:249.7},{x:1206.8,y:249.7},{x:1276.2,y:249.7}]
];

const tactics=[
  {id:'tacticalWarp', name:'Tactical Warp', text:'Teleport up to 3 spaces in any direction.'},
  {id:'emergencyShield', name:'Emergency Shield', text:'Survive one losing attack.'}
];

const battlefields={
  mars:{
    id:'mars',
    name:'Mars Training Grounds',
    image:'MARS_BATTLE_BOARD.png',
    desc:'Open red-planet training terrain with wreckage lanes.',
    status:'Original training map',
    log:'Mars Training Grounds',
    blocked:['3,2','3,3','4,2','4,3','3,6','3,7','4,6','4,7']
  },
  earth:{
    id:'earth',
    name:'Earth Evacuation Zone',
    image:'EARTH_BATTLE_BOARD.png',
    desc:'Urban Earth warzone with red restricted sectors and battlefield debris.',
    status:'Earth obstacle lanes, deployment-safe',
    log:'Earth Evacuation Zone',
    // Earth visual quarantine zones:
    // Board-label left zone:  C1-C2, R4-R5
    // Board-label right zone: C8-C9, R4-R5
    // Internal code cells are zero-based: left r3-4/c0-1, right r3-4/c7-8.
    // These stay out of the top/bottom deployment rows, so CPU and player can always place 30 units.
    blocked:['3,0','3,1','4,0','4,1','3,7','3,8','4,7','4,8']
  }
};
function currentBattlefield(){return battlefields[setup.battlefield]||battlefields.mars;}


// Deployment rows are locked: AI owns the top 3 rows, player owns the bottom 3 rows.
// Middle rows are the only safe place for impassable objects on an 8x10 board.
const AI_DEPLOY_ROWS=[0,1,2];
const PLAYER_DEPLOY_ROWS=[5,6,7];
const SAFE_BLOCK_ROWS=[3,4];

function totalUnitCount(){return unitDefs.reduce((sum,def)=>sum+def.count,0)}
function isDeployRow(r){return AI_DEPLOY_ROWS.includes(r)||PLAYER_DEPLOY_ROWS.includes(r)}
function normalizeBlockedCells(rawCells){
  const clean=[];
  const seen=new Set();
  (rawCells||[]).forEach(cell=>{
    const [r,c]=String(cell).split(',').map(Number);
    if(!Number.isInteger(r)||!Number.isInteger(c)) return;
    if(r<0||r>=ROWS||c<0||c>=COLS) return;
    // Do not allow battlefield blockers to steal deployment squares.
    if(isDeployRow(r)) return;
    const key=`${r},${c}`;
    if(!seen.has(key)){seen.add(key);clean.push(key)}
  });
  return clean;
}
function deploymentSpots(rows){
  const spots=[];
  rows.forEach(r=>{
    for(let c=0;c<COLS;c++){
      if(!isBlocked(r,c) && !board[r][c]) spots.push([r,c]);
    }
  });
  return spots;
}
function assertDeploymentCapacity(label, spots){
  const needed=totalNeeded();
  if(spots.length<needed){
    console.warn(`${label} has only ${spots.length} deployment spaces for ${needed} units. Check battlefield blocked cells.`);
    return false;
  }
  return true;
}

const commanders=[
  {id:'fleet', name:'Fleet Commander', role:'Standard Academy command profile.', piece:'CMD_FLEET.png', redPiece:'RED_CMD_FLEET.png', profile:'PROF_CMD_FLEET.jpg'},
  {id:'mirlock', name:'Commander Mirlock', role:'Aggressive field commander.', piece:'CMD_MIRLOCK.png', redPiece:'RED_CMD_MIRLOCK.png', profile:'PROF_CMD_MIRLOCK.jpg'},
  {id:'naya', name:'Commander Naya', role:'Calm tactical specialist.', piece:'CMD_NAYA.png', redPiece:'RED_CMD_NAYA.png', profile:'PROF_CMD_NAYA.jpg'},
  {id:'jay', name:'Commander Jay', role:'Bold frontline leader.', piece:'CMD_JAY.png', redPiece:'RED_CMD_JAY.png', profile:'PROF_CMD_JAY.jpg'}
];

function currentCommander(){
  return commanders.find(c=>c.id===setup.commander)||commanders[0];
}
function playerTeam(){return setup.side===RED?RED:BLUE}
function enemyTeam(){return playerTeam()===BLUE?RED:BLUE}
function teamLabel(team){return team===RED?'RED':'BLUE'}
function sideLabel(side){return side===RED?'RED ACADEMY':'BLUE ACADEMY'}
function commanderPieceForTeam(commander, team){return team===RED ? (commander.redPiece||commander.piece) : commander.piece}

const unitDefs=[
  {id:'FC', display:'10', name:'Fleet Commander', count:1, rank:10, ability:'One-time commander tactic. Reveals after use.'},
  {id:'BC', display:'9', name:'Battle Captain', count:1, rank:9, ability:'High command attacker.'},
  {id:'TO', display:'8', name:'Tactical Officer', count:1, rank:8, ability:'Elite tactical pressure unit.'},
  {id:'SC', display:'7', name:'Security Chief', count:1, rank:7, ability:'Strong defensive leader.'},
  {id:'SL', display:'6', name:'Strike Leader', count:2, rank:6, ability:'Assault unit built for pressure and lane control.'},
  {id:'SO', display:'5', name:'Squad Officer', count:2, rank:5, ability:'Reliable mid-rank support unit.'},
  {id:'FCD', display:'4', name:'Field Cadet', count:2, rank:4, ability:'Basic unit for baiting and blocking.'},
  {id:'TE', display:'3', name:'Tech Engineer', count:5, rank:3, engineer:true, ability:'Can safely disable Shield Mines.'},
  {id:'RR', display:'2', name:'Recon Runner', count:5, rank:2, recon:true, ability:'Moves any number of open squares in a straight line.'},
  {id:'TS', display:'1', name:'Target Specialist', count:2, rank:1, specialist:true, ability:'SCAN up to 2 spaces. Cannot scan behind an enemy.'},
  {id:'I', display:'I', name:'Infiltrator', count:1, rank:0, infiltrator:true, ability:'Defeats Fleet Commander only when attacking first.'},
  {id:'M', display:'M', name:'Shield Mine', count:6, rank:null, mine:true, movable:false, ability:'Immobile defense. Destroys attackers unless hit by Tech Engineer.'},
  {id:'B', display:'B', name:'Academy Beacon', count:1, rank:null, beacon:true, movable:false, ability:'Objective. Capture it to win.'}
];

const blueImgMap={FC:'FC.png',BC:'BC.png',TO:'TO.png',SC:'SC.png',SL:'SL.png',SO:'SO.png',FCD:'FCD.png',TE:'TE.png',RR:'RR.png',TS:'TS.png',I:'I.png',M:'M.png',B:'B.png'};
const redImgMap={FC:'RED_FC.png',BC:'RED_BC.png',TO:'RED_TO.png',SC:'RED_SC.png',SL:'RED_SL.png',SO:'RED_SO.png',FCD:'RED_FCD.png',TE:'RED_TE.png',RR:'RED_RR.png',TS:'RED_TS.png',I:'RED_I.png',M:'RED_M.png',B:'RED_B.png'};
const imgMap=blueImgMap;
const profileMap={FC:'PROF_FC.jpg',BC:'PROF_BC.jpg',TO:'PROF_TO.jpg',SC:'PROF_SC.jpg',SL:'PROF_SL.jpg',SO:'PROF_SO.jpg',FCD:'PROF_FCD.jpg',TE:'PROF_TE.jpg',RR:'PROF_RR.jpg',TS:'PROF_TS.jpg',I:'PROF_I.jpg'};
function teamImageMap(team){return team===RED ? redImgMap : blueImgMap}
function unitImage(id, team){
  if(id==='FC' && team===playerTeam()) return commanderPieceForTeam(currentCommander(), team);
  return teamImageMap(team)[id] || blueImgMap[id];
}

let blockedCells=[...currentBattlefield().blocked];

let board=[], phase='deploy', unitCounter=1, selectedTray=null, selectedPiece=null, legal=[], scanTargets=[], scanMode=false;
let pendingConfirm=null;
let dragState=null;
let abilityMoveMode=false;
let suppressNextBoardClick=false;
let commanderUse={blue:1, red:1}, shieldArmed={blue:false, red:false};
let captured={blue:[],red:[]};
let lastMoveGlow=null;


function fitApp(){
  const scale=Math.min(window.innerWidth/1920, window.innerHeight/1080);
  document.documentElement.style.setProperty('--scale', scale);
}
window.addEventListener('resize', fitApp);
fitApp();

function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function toggleSetting(k){settings[k]=!settings[k];document.getElementById(k+'Toggle').textContent=k.toUpperCase()+': '+(settings[k]?'ON':'OFF')}

function resetOnlineState(){
  stopRoomListener();
  onlineState.enabled=false;
  onlineState.role='local';
  onlineState.roomCode=null;
  onlineState.hostColor=null;
  onlineState.playerColor=null;
  onlineState.opponentColor=null;
  onlineState.firstAttackTeam=null;
  onlineState.moveSeq=0;
  onlineState.pendingCommit=false;
}
function startLocalGameFlow(){
  resetOnlineState();
  renderSides();
  showScreen('setup');
}
async function openOnlineMatch(){
  renderOnlineRoom();
  showScreen('online');
  setOnlineStatus('Connecting to Firebase...');
  const ready=await initFirebase();
  setOnlineStatus(ready ? 'Firebase connected. Create or join a room.' : 'Firebase not ready: '+(onlineState.firebaseError||'check config/rules'));
}
function generateRoomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function setOnlineStatus(msg){
  const el=document.getElementById('onlineStatus');
  if(el) el.innerHTML=msg;
}

let bwFirebaseApp=null;
let bwFirebaseAuth=null;
let bwFirestore=null;

async function initFirebase(){
  if(onlineState.firebaseReady && bwFirestore) return true;
  if(typeof firebase==='undefined'){
    onlineState.firebaseError='Firebase SDK not loaded.';
    return false;
  }
  if(!window.firebaseConfig){
    onlineState.firebaseError='firebase-config.js missing.';
    return false;
  }
  try{
    if(!firebase.apps.length) bwFirebaseApp=firebase.initializeApp(window.firebaseConfig);
    else bwFirebaseApp=firebase.app();
    bwFirebaseAuth=firebase.auth();
    bwFirestore=firebase.firestore();

    const cred=await bwFirebaseAuth.signInAnonymously();
    onlineState.uid=cred.user.uid;
    onlineState.firebaseReady=true;
    onlineState.firebaseError=null;
    return true;
  }catch(err){
    onlineState.firebaseReady=false;
    onlineState.firebaseError=err.message||String(err);
    console.error('Firebase init failed:', err);
    return false;
  }
}
function roomRef(code){
  return bwFirestore.collection('rooms').doc(code);
}
function stopRoomListener(){
  if(typeof onlineState.roomUnsub==='function'){
    try{onlineState.roomUnsub();}catch(e){}
  }
  onlineState.roomUnsub=null;
}
async function firebaseCreateRoom(roomCode, hostColor){
  const ready=await initFirebase();
  if(!ready) throw new Error(onlineState.firebaseError||'Firebase unavailable.');
  const guestColor=hostColor===BLUE?RED:BLUE;
  await roomRef(roomCode).set({
    roomCode,
    hostUid:onlineState.uid,
    guestUid:null,
    hostColor,
    guestColor,
    firstAttackTeam:guestColor,
    phase:'lobby',
    turnRole:null,
    turnTeam:null,
    moveSeq:0,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  firebaseListenRoom(roomCode);
}
async function firebaseJoinRoom(roomCode){
  const ready=await initFirebase();
  if(!ready) throw new Error(onlineState.firebaseError||'Firebase unavailable.');
  const snap=await roomRef(roomCode).get();
  if(!snap.exists) throw new Error('Room not found.');
  const data=snap.data()||{};
  if(!data.hostColor) throw new Error('Host has not picked a color yet.');
  if(data.guestUid && data.guestUid!==onlineState.uid) throw new Error('Room already has two players.');

  const guestColor=data.hostColor===BLUE?RED:BLUE;
  await roomRef(roomCode).set({
    guestUid:onlineState.uid,
    guestColor,
    firstAttackTeam:guestColor,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  firebaseListenRoom(roomCode);
  return {...data, guestColor, firstAttackTeam:guestColor};
}
function firebaseListenRoom(roomCode){
  if(!bwFirestore) return;
  stopRoomListener();
  onlineState.roomUnsub=roomRef(roomCode).onSnapshot(snap=>{
    if(!snap.exists) return;
    handleRoomSnapshot(snap.data()||{});
  }, err=>{
    console.error('Room listener error:', err);
    if(onlineState.enabled) log('Firebase room listener error: '+(err.message||err));
  });
}
function handleRoomSnapshot(data){
  if(!onlineState.enabled) return;
  onlineState.lastRoomData=data;

  if(data.moveSeq!=null) onlineState.moveSeq=data.moveSeq;
  if(data.hostColor) onlineState.hostColor=data.hostColor;

  // Re-assert role from Firebase uid. This saves us if the page refreshed mid-room.
  if(onlineState.uid){
    if(data.hostUid===onlineState.uid) onlineState.role='host';
    if(data.guestUid===onlineState.uid) onlineState.role='guest';
  }

  if(onlineState.role==='host' && data.hostColor){
    onlineState.playerColor=data.hostColor;
    onlineState.opponentColor=data.guestColor || (data.hostColor===BLUE?RED:BLUE);
    setup.side=onlineState.playerColor;
  }
  if(onlineState.role==='guest' && (data.guestColor || data.hostColor)){
    const guestColor=data.guestColor || (data.hostColor===BLUE?RED:BLUE);
    onlineState.playerColor=guestColor;
    onlineState.opponentColor=data.hostColor;
    setup.side=onlineState.playerColor;
  }
  if(data.firstAttackTeam) onlineState.firstAttackTeam=data.firstAttackTeam;
  installOpponentDeployment(data);

  // Do not let Firebase steal control during the local COMMIT step.
  if(phase==='commit') return;
  if(data.phase!=='battle') return;

  const activeUid=data.activeUid || data.turnUid || null;
  const activeRole=data.activeRole || data.turnRole;
  const activeTeam=data.activeTeam || data.turnTeam;

  // UID is the strongest source. Role/team are fallbacks for old rooms.
  const myTurnByUid = !!(activeUid && onlineState.uid && activeUid===onlineState.uid);
  const myTurnFallback = activeRole===onlineState.role || activeTeam===playerTeam();
  const myTurn = myTurnByUid || (!activeUid && myTurnFallback);

  if(myTurn){
    if(phase==='waiting'){
      phase='player';
      selectedPiece=null; legal=[]; scanTargets=[]; scanMode=false; abilityMoveMode=false;
      updateStatus(teamLabel(playerTeam())+' TURN','Opponent committed.','Your turn. Drag from a unit’s A/base to move.');
      updateStartBtn();
      renderBoard(); renderUnitList();
      log('Firebase turn passed to '+teamLabel(playerTeam())+'.');
    }
  } else {
    if(phase==='player'){
      phase='waiting';
      updateStatus('ONLINE WAITING','Opponent turn.','Waiting for the opponent to commit a move.');
      updateStartBtn();
    }
  }

  if(data.lastCommitId && data.lastCommitId!==onlineState.lastCommitId){
    const isOpponentCommit=data.lastCommitByUid!==onlineState.uid;
    onlineState.lastCommitId=data.lastCommitId;
    if(isOpponentCommit){
      applyRemoteMovePayload(data.lastMove && data.lastMove.payload);
      log('Opponent commit received. Turn is now '+(myTurn?'yours.':'theirs.'));
    }
  }
  updateBoardLock();
}

function deploymentFieldName(){
  return onlineState.role==='host' ? 'hostDeployment' : 'guestDeployment';
}
function deploymentIdFieldName(){
  return onlineState.role==='host' ? 'hostDeploymentId' : 'guestDeploymentId';
}
function serializePlayerDeployment(){
  const out=[];
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const p=board[r][c];
      if(!p || p.team!==playerTeam()) continue;
      out.push({
        id:p.id,
        name:p.name,
        display:p.display,
        rank:p.rank,
        movable:p.movable,
        mine:!!p.mine,
        beacon:!!p.beacon,
        engineer:!!p.engineer,
        recon:!!p.recon,
        specialist:!!p.specialist,
        infiltrator:!!p.infiltrator,
        commanderChoice:p.commanderChoice||null,
        r,c
      });
    }
  }
  return out;
}
function mirrorCell(cell){
  return {r:ROWS-1-cell.r, c:COLS-1-cell.c};
}
function installOpponentDeployment(data){
  if(!onlineState.enabled || !data) return false;
  const dep = onlineState.role==='host' ? data.guestDeployment : data.hostDeployment;
  const depId = onlineState.role==='host' ? data.guestDeploymentId : data.hostDeploymentId;
  if(!dep || !Array.isArray(dep) || !depId || onlineState.opponentDeploymentId===depId) return false;

  // Replace the temporary AI enemy layout with the real opponent layout.
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(board[r][c] && board[r][c].team===enemyTeam()) board[r][c]=null;
    }
  }

  dep.forEach(u=>{
    const cell=mirrorCell({r:u.r,c:u.c});
    if(!inBounds(cell.r,cell.c) || isBlocked(cell.r,cell.c)) return;
    const def=unitDefs.find(d=>d.id===u.id);
    if(!def) return;
    const p=unitCopy(def, enemyTeam(), cell.r, cell.c);
    p.name=u.name || p.name;
    p.display=u.display || p.display;
    p.rank=u.rank;
    p.movable=u.movable!==false;
    p.mine=!!u.mine;
    p.beacon=!!u.beacon;
    p.engineer=!!u.engineer;
    p.recon=!!u.recon;
    p.specialist=!!u.specialist;
    p.infiltrator=!!u.infiltrator;
    p.commanderChoice=u.commanderChoice||null;
    p.revealed=false;
    p.scanned=false;
    board[cell.r][cell.c]=p;
  });

  onlineState.opponentDeploymentId=depId;
  log('Opponent deployment synced from Firebase.');
  renderBoard();
  return true;
}
async function firebaseSubmitDeployment(){
  if(!onlineState.enabled || !onlineState.roomCode || onlineState.role==='local') return;
  const ready=await initFirebase();
  if(!ready) throw new Error(onlineState.firebaseError||'Firebase unavailable.');
  const dep=serializePlayerDeployment();
  if(dep.length!==totalNeeded()){
    throw new Error('Deployment incomplete. Place all units before starting.');
  }
  const field=deploymentFieldName();
  const idField=deploymentIdFieldName();
  const depId=(Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)).toUpperCase();
  const payload={
    [field]:dep,
    [idField]:depId,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  if(onlineState.role==='host') payload.hostReady=true;
  if(onlineState.role==='guest') payload.guestReady=true;
  await roomRef(onlineState.roomCode).set(payload,{merge:true});
  log('Your deployment uploaded to Firebase.');
}
function moveTextFor(p,from,to,target){
  const fromText=(from.c+1)+','+(ROWS-from.r);
  const toText=(to.c+1)+','+(ROWS-to.r);
  if(target) return `${teamLabel(p.team)} ${p.name} attacked at ${toText}.`;
  return `${teamLabel(p.team)} ${p.name} moved from ${fromText} to ${toText}.`;
}
function publicMoveText(from,to,target){
  const fromText=(from.c+1)+','+(ROWS-from.r);
  const toText=(to.c+1)+','+(ROWS-to.r);
  if(target) return `Opponent unit attacked at ${toText}.`;
  return `Opponent unit moved from ${fromText} to ${toText}.`;
}
function privateCommitText(){
  return onlineState.pendingMove && onlineState.pendingMove.privateText ? onlineState.pendingMove.privateText : 'Move committed.';
}
function publicCommitText(){
  return onlineState.pendingMove && onlineState.pendingMove.publicText ? onlineState.pendingMove.publicText : 'Opponent committed a move.';
}
function applyRemoteMovePayload(move){
  if(!move || !move.from || !move.to) return;
  // The other player sees the board rotated from our perspective.
  const from=mirrorCell(move.from);
  const to=mirrorCell(move.to);

  if(move.type==='move'){
    const p=board[from.r] && board[from.r][from.c];
    if(p && p.team===enemyTeam()){
      board[from.r][from.c]=null;
      p.r=to.r; p.c=to.c;
      board[to.r][to.c]=p;
      lastMoveGlow={r:to.r,c:to.c};
      renderBoard();
      log('Opponent move applied: '+(move.publicText||move.text||'Opponent unit moved.'));
    } else {
      lastMoveGlow={r:to.r,c:to.c};
      renderBoard();
      log('Opponent committed move: '+(move.publicText||move.text||'Opponent unit moved.')+' Could not auto-apply because the source square did not match.');
    }
  } else {
    lastMoveGlow={r:to.r,c:to.c};
    renderBoard();
    log('Opponent committed combat: '+(move.publicText||move.text||'Opponent unit attacked.'));
  }
}
async function firebaseStartBattle(){
  if(!onlineState.enabled || !onlineState.roomCode) return;
  const ready=await initFirebase();
  if(!ready){ log('Firebase not ready: '+(onlineState.firebaseError||'unknown error')); return; }

  const snap=await roomRef(onlineState.roomCode).get();
  const current=snap.exists ? (snap.data()||{}) : {};
  const hostColor=onlineState.hostColor || current.hostColor || BLUE;
  const guestColor=current.guestColor || (hostColor===BLUE?RED:BLUE);

  // Do not reset the room after commits begin.
  if(current.phase==='battle' && (current.moveSeq||0)>0){
    return;
  }

  // Guest attacks first. If guestUid exists, UID controls the turn.
  const firstUid=current.guestUid || null;

  await roomRef(onlineState.roomCode).set({
    phase:'battle',
    hostColor,
    guestColor,
    firstAttackTeam:guestColor,
    turnRole:current.turnRole || 'guest',
    activeRole:current.activeRole || 'guest',
    turnTeam:current.turnTeam || guestColor,
    activeTeam:current.activeTeam || guestColor,
    turnUid:current.turnUid || firstUid,
    activeUid:current.activeUid || firstUid,
    moveSeq:current.moveSeq || 0,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
}
async function firebaseSendTurn(){
  if(!onlineState.enabled || !onlineState.roomCode || onlineState.role==='local'){
    throw new Error('No active online room or player role.');
  }
  const ready=await initFirebase();
  if(!ready){
    throw new Error(onlineState.firebaseError||'Firebase unavailable.');
  }

  const snap=await roomRef(onlineState.roomCode).get();
  if(!snap.exists){
    throw new Error('Room not found in Firestore.');
  }
  const current=snap.data() || {};

  // Re-identify role from uid right before commit.
  if(onlineState.uid){
    if(current.hostUid===onlineState.uid) onlineState.role='host';
    if(current.guestUid===onlineState.uid) onlineState.role='guest';
  }

  const nextRole=onlineState.role==='host'?'guest':'host';
  const nextTeam=onlineState.opponentColor || (playerTeam()===BLUE?RED:BLUE);
  const nextUid=nextRole==='host' ? current.hostUid : current.guestUid;

  if(!nextUid){
    throw new Error('Opponent has not joined the room yet. Cannot pass turn.');
  }

  const commitId=(Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)).toUpperCase();

  const payload={
    phase:'battle',
    turnRole:nextRole,
    activeRole:nextRole,
    turnTeam:nextTeam,
    activeTeam:nextTeam,
    turnUid:nextUid,
    activeUid:nextUid,
    moveSeq:firebase.firestore.FieldValue.increment(1),
    lastCommitId:commitId,
    lastCommitByRole:onlineState.role,
    lastCommitByTeam:playerTeam(),
    lastCommitByUid:onlineState.uid || null,
    lastMoveText:publicCommitText(),
    lastMove:{
      commitId,
      byRole:onlineState.role,
      byTeam:playerTeam(),
      byUid:onlineState.uid || null,
      toRole:nextRole,
      toTeam:nextTeam,
      toUid:nextUid,
      payload:onlineState.pendingMove ? {
        type:onlineState.pendingMove.type,
        from:onlineState.pendingMove.from,
        to:onlineState.pendingMove.to,
        publicText:onlineState.pendingMove.publicText
      } : null,
      text:publicCommitText(),
      at:firebase.firestore.FieldValue.serverTimestamp()
    },
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };

  await roomRef(onlineState.roomCode).set(payload, {merge:true});

  try{
    await roomRef(onlineState.roomCode).collection('moves').add({
      commitId,
      byRole:onlineState.role,
      byTeam:playerTeam(),
      byUid:onlineState.uid || null,
      nextRole,
      nextTeam,
      nextUid,
      payload:onlineState.pendingMove ? {
        type:onlineState.pendingMove.type,
        from:onlineState.pendingMove.from,
        to:onlineState.pendingMove.to,
        publicText:onlineState.pendingMove.publicText
      } : null,
      text:publicCommitText(),
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(moveErr){
    console.warn('Optional move history write failed:', moveErr);
    log('Move history warning: turn passed, but move log subcollection was blocked.');
  }

  onlineState.lastCommitId=commitId;
  onlineState.pendingMove=null;
}

function updateBoardLock(){
  const overlay=document.getElementById('boardLockOverlay');
  const text=document.getElementById('boardLockText');
  if(!overlay) return;
  const locked = phase==='waiting' || phase==='commit';
  overlay.classList.toggle('show', locked);
  if(text){
    if(phase==='commit') text.textContent='MOVE READY - PRESS COMMIT';
    else if(phase==='waiting') text.textContent='WAITING FOR OPPONENT';
    else text.textContent='BOARD LOCKED';
  }
}
async function commitOnlineMove(){
  if(!onlineState.enabled || phase!=='commit') return;
  onlineState.pendingCommit=false;
  phase='waiting';
  updateStatus('ONLINE WAITING','Move committed.','Turn sent through Firebase. Waiting for the opponent to respond.');
  updateStartBtn();
  try{
    await firebaseSendTurn();
    log('Move committed to Firebase. Hidden identity preserved for opponent. Turn passed.');
  }catch(err){
    const msg=err.message||String(err);
    console.error('Firebase commit failed:', err);
    log('Firebase commit failed: '+msg);
    phase='commit';
    onlineState.pendingCommit=true;
    updateStatus('COMMIT FAILED','Firebase error: '+msg,'Check Firestore Rules, Anonymous Auth, then press COMMIT again.');
    updateStartBtn();
  }
}
function createOnlineRoom(){
  onlineState.enabled=true;
  onlineState.role='host';
  onlineState.roomCode=generateRoomCode();
  onlineState.hostColor=null;
  onlineState.playerColor=null;
  onlineState.opponentColor=null;
  onlineState.firstAttackTeam=null;
  renderOnlineRoom();
  setOnlineStatus('Room created. Host chooses BLUE or RED. The joining player takes the other color and attacks first.');
}
function renderOnlineRoom(){
  const created=document.getElementById('createdRoom');
  const pick=document.getElementById('hostColorPick');
  if(created) created.textContent=onlineState.roomCode||'No room yet.';
  if(pick){
    if(onlineState.role==='host' && onlineState.roomCode){
      pick.innerHTML=`<button class="btn" onclick="hostChooseColor('${BLUE}')">HOST BLUE</button><button class="btn red" onclick="hostChooseColor('${RED}')">HOST RED</button>`;
    } else {
      pick.innerHTML='';
    }
  }
}
function saveLocalRoom(){
  if(!onlineState.roomCode) return;
  const payload={
    roomCode:onlineState.roomCode,
    hostColor:onlineState.hostColor,
    createdAt:Date.now(),
    firstAttackTeam:onlineState.firstAttackTeam,
    firebaseTodo:true
  };
  try{localStorage.setItem(ONLINE_STORAGE_PREFIX+onlineState.roomCode, JSON.stringify(payload));}catch(e){}
}
function readLocalRoom(code){
  try{return JSON.parse(localStorage.getItem(ONLINE_STORAGE_PREFIX+code)||'null')}catch(e){return null}
}
async function hostChooseColor(color){
  if(!onlineState.roomCode) createOnlineRoom();
  onlineState.enabled=true;
  onlineState.role='host';
  onlineState.hostColor=color;
  onlineState.playerColor=color;
  onlineState.opponentColor=color===BLUE?RED:BLUE;
  onlineState.firstAttackTeam=onlineState.opponentColor; // joining player attacks first
  setup.side=color;
  saveLocalRoom();

  try{
    setOnlineStatus('Creating Firebase room...');
    await firebaseCreateRoom(onlineState.roomCode, color);
    setOnlineStatus('Room '+onlineState.roomCode+' live. Share this code with Player 2.');
  }catch(err){
    setOnlineStatus('Firebase room create failed: '+(err.message||err));
    log('Firebase create failed: '+(err.message||err));
  }

  renderSides();
  showScreen('setup');
}
async function joinOnlineRoom(){
  const input=document.getElementById('roomCodeInput');
  const code=(input?input.value:'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!code){setOnlineStatus('Enter a room code to join.'); return;}

  onlineState.enabled=true;
  onlineState.role='guest';
  onlineState.roomCode=code;

  try{
    setOnlineStatus('Joining Firebase room...');
    const room=await firebaseJoinRoom(code);
    const hostColor=room.hostColor||BLUE;
    const guestColor=room.guestColor || (hostColor===BLUE?RED:BLUE);
    onlineState.hostColor=hostColor;
    onlineState.playerColor=guestColor;
    onlineState.opponentColor=hostColor;
    onlineState.firstAttackTeam=guestColor; // joining player attacks first
    setup.side=guestColor;
    setOnlineStatus('Joined room '+code+'. You are '+teamLabel(guestColor)+' and attack first.');
    renderSides();
    showScreen('setup');
    return;
  }catch(err){
    setOnlineStatus('Firebase join failed: '+(err.message||err));
    console.error(err);
  }

  // Local fallback for offline testing only.
  const room=readLocalRoom(code);
  if(room){
    const hostColor=room.hostColor||BLUE;
    const guestColor=hostColor===BLUE?RED:BLUE;
    onlineState.hostColor=hostColor;
    onlineState.playerColor=guestColor;
    onlineState.opponentColor=hostColor;
    onlineState.firstAttackTeam=guestColor;
    setup.side=guestColor;
    renderSides();
    showScreen('setup');
  }
}
function onlineSummary(){
  if(!onlineState.enabled) return '';
  return `Room <b>${onlineState.roomCode||'LOCAL'}</b> · Role <b>${onlineState.role.toUpperCase()}</b> · UID <b>${(onlineState.uid||'...').slice(0,6)}</b> · You are <b>${teamLabel(playerTeam())}</b> · Opponent is <b>${teamLabel(enemyTeam())}</b> · First attack: <b>${teamLabel(onlineState.firstAttackTeam||enemyTeam())}</b>`;
}

// FIREBASE HOOKS TO WIRE NEXT:
// firebaseCreateRoom(roomCode, hostColor)
// firebaseJoinRoom(roomCode)
// firebaseListenRoom(roomCode, onRemoteMove)
// firebaseSendMove(roomCode, movePayload)
// For now, room creation/join uses localStorage as a harmless UI stub.
function renderSides(){
  const box=document.getElementById('sideBox');
  if(!box) return;
  box.innerHTML='';
  if(onlineState.enabled){
    box.innerHTML=`<div class="side-lock">${onlineSummary()}<div class="small-note">Online room locks color choice. Host picks color; joining player gets the other color and attacks first.</div></div>`;
    return;
  }
  [
    {id:BLUE, name:'BLUE ACADEMY', desc:'Start as BLUE. Your units use blue bases and RED becomes the opponent.'},
    {id:RED, name:'RED ACADEMY', desc:'Start as RED. Your units use red bases and BLUE becomes the opponent.'}
  ].forEach(side=>{
    const b=document.createElement('button');
    b.className='pick '+(setup.side===side.id?'active':'');
    b.innerHTML=side.name+'<br><span style="font-size:12px;color:#c8f8ff">'+side.desc+'</span>';
    b.onclick=()=>{setup.side=side.id; renderSides(); renderCommanders();};
    box.appendChild(b);
  });
}
function renderCommanders(){
  const box=document.getElementById('commanderBox');
  if(!box) return;
  box.innerHTML='';
  commanders.forEach(c=>{
    const b=document.createElement('button');
    b.className='commander-card '+(setup.commander===c.id?'active':'');
    b.innerHTML=`<img src="${commanderPieceForTeam(c, playerTeam())}" alt=""><div class="commander-name">${c.name}</div><div class="commander-role">${c.role}</div>`;
    b.onclick=()=>{setup.commander=c.id;renderCommanders();};
    box.appendChild(b);
  });
}
renderSides();
renderCommanders();

function renderTactics(){
  const box=document.getElementById('tacticBox'); box.innerHTML='';
  tactics.forEach(t=>{
    const b=document.createElement('button');
    b.className='pick '+(setup.tactic===t.id?'active':'');
    b.innerHTML=t.name+'<br><span style="font-size:12px;color:#c8f8ff">'+t.text+'</span>';
    b.onclick=()=>{setup.tactic=t.id;renderTactics()};
    box.appendChild(b);
  });
}
renderTactics();
function renderBattlefields(){
  const box=document.getElementById('battlefieldBox');
  if(!box) return;
  box.innerHTML='';
  Object.values(battlefields).forEach(bf=>{
    const b=document.createElement('button');
    b.className='battlefield-card '+(setup.battlefield===bf.id?'active':'');
    b.innerHTML=`<img src="${bf.image}" alt=""><div class="battlefield-name">${bf.name.toUpperCase()}</div><div class="battlefield-desc">${bf.desc}</div><div class="battlefield-status">CLICK TO LOAD BATTLE</div>`;
    b.onclick=()=>{
      startGame(bf.id);
    };
    box.appendChild(b);
  });
}
renderBattlefields();
    function preloadBattlefield(id){
  const bf=battlefields[id]||battlefields.mars;
  const img=new Image();
  img.src=bf.image;
}
preloadBattlefield(setup.battlefield);
function currentTactic(){return tactics.find(t=>t.id===setup.tactic)||tactics[0]}
function startGame(fieldId=null){
  if(fieldId && battlefields[fieldId]) setup.battlefield=fieldId;
  const bf=currentBattlefield();

  // Paint the selected board before the screen swap so Earth/Mars never shows blank.
  const layer=document.getElementById('boardLayer');
  if(layer) layer.style.backgroundImage=`url("${bf.image}")`;

  preloadBattlefield(bf.id);
  showScreen('game');

  // Hard reset the battle after the battlefield value is locked in.
  setTimeout(()=>initGame(), 0);
}

function unitCopy(def,team,r=null,c=null){
  const copy={...def,team,r,c,uid:unitCounter++,movable:def.movable!==false,revealed:false,scanned:false};
  copy.img=unitImage(def.id, team);
  if(team===playerTeam() && def.id==='FC'){
    const cmd=currentCommander();
    copy.name=cmd.name;
    copy.img=commanderPieceForTeam(cmd, team);
    copy.profile=cmd.profile;
    copy.commanderChoice=cmd.id;
  }
  return copy;
}

function initGame(){
  const bf=currentBattlefield();
  const originalBlocked=(bf.blocked||[]).length;
  blockedCells=normalizeBlockedCells(bf.blocked);
  const boardLayer=document.getElementById('boardLayer');
  if(boardLayer) boardLayer.style.backgroundImage=`url("${bf.image}")`;
  board=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  phase='deploy';unitCounter=1;selectedTray=null;selectedPiece=null;legal=[];scanTargets=[];scanMode=false; abilityMoveMode=false;pendingConfirm=null;lastMoveGlow=null;hideConfirm();
  commanderUse={blue:1,red:1};shieldArmed={blue:false,red:false};abilityMoveMode=false;captured={blue:[],red:[]};updateCaptured();
  placeAI();
  renderUnitList(); renderBoard(); clearLog(); updateConsole(null); updateStartBtn();
  updateStatus('DEPLOYMENT PHASE','Place your '+teamLabel(playerTeam())+' units.','Click a unit, then click a starting tile on the bottom 3 rows, or use RANDOM PLACE. In battle, drag a unit from its A/base to move.');
  log('Mission loaded: '+bf.log+'.');
  log('Battlefield selected: '+bf.name+'.');
  if(bf.id==='earth') log('Earth blockers: left C1-C2/R4-R5, right C8-C9/R4-R5.');
  if(blockedCells.length!==originalBlocked) log('Map safety: deployment-row blockers were ignored so both sides can place all units.');
  log('Side selected: '+sideLabel(playerTeam())+'.');
  if(onlineState.enabled){log('Online room: '+(onlineState.roomCode||'LOCAL')+'. '+teamLabel(onlineState.firstAttackTeam||enemyTeam())+' attacks first.');}
  log('Commander selected: '+currentCommander().name+'.');
  log('Anchor rule: A-center snaps to square center. Drag the A/base to move. Click it for skills.');
}

function isBlocked(r,c){return blockedCells.includes(`${r},${c}`)}
function inBounds(r,c){return r>=0&&r<ROWS&&c>=0&&c<COLS}
function cellCenter(r,c){return TILE_CENTERS[ROWS-1-r][c]}
function pieceTopLeft(r,c){
  const p=cellCenter(r,c);
  return {x:p.x - (BASE_ANCHOR.x + anchorOffset.x), y:p.y - (BASE_ANCHOR.y + anchorOffset.y)};
}
function nearestCell(x,y){
  let best=null, bestD=99999;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(isBlocked(r,c)) continue;
    const p=cellCenter(r,c);
    const d=Math.hypot(x-p.x,y-p.y);
    if(d<bestD){bestD=d;best={r,c,d}}
  }
  return best && best.d<34 ? best : null;
}

document.getElementById('game').addEventListener('click', e=>{
  if(suppressNextBoardClick){ suppressNextBoardClick=false; return; }
  const rect=document.getElementById('app').getBoundingClientRect();
  const scale=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  const hit=nearestCell(x,y);
  if(hit) cellClick(hit.r,hit.c);
});

function remaining(id){
  const def=unitDefs.find(d=>d.id===id); let used=0;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const p=board[r][c]; if(p&&p.team===playerTeam()&&p.id===id) used++}
  return def.count-used;
}
function totalNeeded(){return totalUnitCount()}
function totalPlaced(){let n=0; for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++) if(board[r][c]&&board[r][c].team===playerTeam()) n++; return n}
function updateStartBtn(){
  const primary=document.getElementById('primaryControlBtn');
  const secondary=document.getElementById('secondaryControlBtn');
  if(!primary || !secondary) return;

  if(phase==='deploy'){
    primary.textContent='START BATTLE';
    primary.disabled = totalPlaced()!==totalNeeded();
    primary.onclick=()=>{
      if(totalPlaced()!==totalNeeded()) return;
      selectedTray=null; selectedPiece=null; legal=[]; scanTargets=[]; scanMode=false;
      renderUnitList(); renderBoard();
      if(onlineState.enabled){
        firebaseSubmitDeployment().then(()=>firebaseStartBattle()).catch(err=>{
          log('Firebase deployment/start failed: '+(err.message||err));
          updateStatus('FIREBASE START ERROR','Could not upload deployment.','Check the room, rules, and both players, then try START BATTLE again.');
        });
        if((onlineState.firstAttackTeam||enemyTeam())===playerTeam()){
          phase='player';
          updateStatus(teamLabel(playerTeam())+' TURN','Online battle started.','You are the first-attack side. Make the opening move.');
        } else {
          phase='waiting';
          updateStatus('ONLINE WAITING','Opponent attacks first.','Waiting for the joining player to make the first move.');
        }
      } else {
        phase='player';
        updateStatus(teamLabel(playerTeam())+' TURN','Battle started.','Drag from a unit’s A/base to move. Click it for skills.');
      }
      updateStartBtn();
    };
    secondary.textContent='RANDOM PLACE';
    secondary.className='btn';
    secondary.onclick=()=>randomPlaceBlue();
  } else if(phase==='commit'){
    primary.textContent='COMMIT';
    primary.disabled=false;
    primary.onclick=()=>commitOnlineMove();
    secondary.textContent='MAIN MENU';
    secondary.className='btn red';
    secondary.onclick=()=>{phase='menu'; selectedPiece=null; selectedTray=null; legal=[]; scanTargets=[]; scanMode=false; abilityMoveMode=false; showScreen('menu');};
  } else {
    primary.textContent='RESTART';
    primary.disabled=false;
    primary.onclick=()=>initGame();
    secondary.textContent='MAIN MENU';
    secondary.className='btn red';
    secondary.onclick=()=>{phase='menu'; selectedPiece=null; selectedTray=null; legal=[]; scanTargets=[]; scanMode=false; abilityMoveMode=false; showScreen('menu');};
  }
  updateBoardLock();
}

function clearBlueDeployment(){
  if(phase!=='deploy') return;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(board[r][c] && board[r][c].team===playerTeam()) board[r][c]=null;
    }
  }
  selectedTray=null; selectedPiece=null; legal=[]; scanTargets=[]; scanMode=false; abilityMoveMode=false;
  renderUnitList(); renderBoard(); updateConsole(null); updateStartBtn();
  log(teamLabel(playerTeam())+' deployment cleared.');
}

function randomPlaceBlue(){
  if(phase!=='deploy') return;
  clearBlueDeployment();
  let units=[];
  unitDefs.forEach(def=>{for(let i=0;i<def.count;i++) units.push(unitCopy(def,playerTeam()))});
  shuffle(units);
  let spots=[];
  spots=deploymentSpots(PLAYER_DEPLOY_ROWS);
  if(!assertDeploymentCapacity('Player deployment', spots)){
    updateStatus('DEPLOYMENT ERROR','Not enough open player deployment squares.','Move battlefield blockers out of rows 1-3 and 6-8, then restart.');
    log('Player random placement cancelled: not enough deployment spaces.');
    return;
  }
  shuffle(spots);
  units.forEach((u,i)=>{
    const [r,c]=spots[i];
    u.r=r; u.c=c; board[r][c]=u;
  });
  selectedTray=null; selectedPiece=null; legal=[]; scanTargets=[]; scanMode=false; abilityMoveMode=false;
  renderUnitList(); renderBoard(); updateConsole(null); updateStartBtn();
  log(teamLabel(playerTeam())+' units random placed.');
}


function renderUnitList(){
  const list=document.getElementById('unitList'); list.innerHTML='';
  unitDefs.forEach(def=>{
    const row=document.createElement('div');
    row.className='unit-row '+(selectedTray===def.id?'active':'');
    row.onclick=e=>{
      e.stopPropagation();
      if(phase!=='deploy') return;
      selectedTray=def.id; selectedPiece=null; legal=[]; scanTargets=[]; scanMode=false; abilityMoveMode=false;
      updateConsole(def); renderUnitList(); renderBoard();
    };
    const trayImg=unitImage(def.id, playerTeam());
    const trayName=(def.id==="FC")?currentCommander().name:def.name;
    row.innerHTML=`<div class="rankbox">${def.display}</div><div class="thumb"><img src="${trayImg}"></div><div class="uname">${trayName.toUpperCase()}</div><div class="ucount">${remaining(def.id)}</div>`;
    list.appendChild(row);
  });
}

function placeAI(){
  const units=[];
  unitDefs.forEach(def=>{for(let i=0;i<def.count;i++) units.push(unitCopy(def,enemyTeam()))});
  shuffle(units);
  const spots=deploymentSpots(AI_DEPLOY_ROWS);
  if(!assertDeploymentCapacity('AI deployment', spots)){
    updateStatus('AI DEPLOYMENT ERROR','Not enough open AI deployment squares.','Move battlefield blockers out of the top 3 deployment rows, then restart.');
    log('AI placement failed: not enough deployment spaces.');
    return false;
  }
  shuffle(spots);
  units.forEach((u,i)=>{
    const [r,c]=spots[i];
    u.r=r; u.c=c; board[r][c]=u;
  });
  return true;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}}

function renderBoard(){
  const pieces=document.getElementById('pieces'), markers=document.getElementById('markers'), dots=document.getElementById('dots'), nums=document.getElementById('coordNumbers');
  pieces.innerHTML=''; markers.innerHTML=''; dots.innerHTML=''; nums.innerHTML='';

  // coord numbers from board centers
  for(let c=0;c<COLS;c++){
    const p=cellCenter(7,c);
    const n=document.createElement('div'); n.className='board-num xnum'; n.textContent=c+1; n.style.left=p.x+'px'; n.style.top=(p.y+38)+'px'; nums.appendChild(n);
  }
  for(let r=0;r<ROWS;r++){
    const p=cellCenter(r,0);
    const n=document.createElement('div'); n.className='board-num ynum'; n.textContent=ROWS-r; n.style.left=(p.x-55)+'px'; n.style.top=p.y+'px'; nums.appendChild(n);
  }

  if(showCenterDots){
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const p=cellCenter(r,c);
      const d=document.createElement('div'); d.className='center-dot'; d.style.left=p.x+'px'; d.style.top=p.y+'px'; dots.appendChild(d);
      const lab=document.createElement('div'); lab.className='center-label'; lab.textContent=`${c+1},${ROWS-r}`; lab.style.left=p.x+'px'; lab.style.top=(p.y-14)+'px'; dots.appendChild(lab);
    }
  }

  if(lastMoveGlow){addMarker('lastmove',lastMoveGlow.r,lastMoveGlow.c)}
  if(selectedPiece){addMarker('sel',selectedPiece.r,selectedPiece.c)}
  legal.forEach(t=>addMarker('legal',t.r,t.c));
  scanTargets.forEach(t=>addMarker('scan',t.r,t.c));

  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const piece=board[r][c]; if(!piece) continue;
    if(piece.team===enemyTeam() && !piece.revealed && !piece.scanned && phase!=='gameover' && !showAllEnemies){
      const p=cellCenter(r,c);
      const h=document.createElement('div'); h.className='hidden-enemy'; h.textContent='?';
      h.style.left=(p.x-27)+'px'; h.style.top=(p.y-16)+'px';
      h.onclick=e=>{e.stopPropagation(); if(selectedPiece && legal.some(t=>t.r===r&&t.c===c)) cellClick(r,c)}
      pieces.appendChild(h);
      const hot=document.createElement('div');
      hot.className='a-hotspot enemy-hotspot';
      hot.style.left=p.x+'px';
      hot.style.top=p.y+'px';
      hot.onclick=e=>{e.stopPropagation(); if(selectedPiece && legal.some(t=>t.r===r&&t.c===c)) cellClick(r,c); else pieceClick(piece)};
      pieces.appendChild(hot);
      continue;
    }
    const top=pieceTopLeft(r,c);
    const el=document.createElement('div'); el.className='piece '+(piece.team===enemyTeam()?'enemy':'');
    el.style.left=top.x+'px'; el.style.top=top.y+'px'; el.style.zIndex=String(20+r);
    el.innerHTML=`<img src="${piece.img||imgMap[piece.id]}">`;
    pieces.appendChild(el);

    const center=cellCenter(r,c);
    const hot=document.createElement('div');
    hot.className='a-hotspot '+(piece.team===enemyTeam()?'enemy-hotspot':'');
    hot.style.left=center.x+'px';
    hot.style.top=center.y+'px';
    hot.title=piece.name+' A-anchor';
    hot.onpointerdown=e=>startPiecePointer(e,piece);
    pieces.appendChild(hot);
  }
  updateReadout();
}
function addMarker(type,r,c){
  const p=cellCenter(r,c);
  const m=document.createElement('div'); 
  m.className='marker '+type; 
  m.style.left=p.x+'px'; 
  m.style.top=p.y+'px'; 
  if(type==='lastmove'){
    m.onclick=e=>{e.stopPropagation();};
  } else {
    m.onclick=e=>{e.stopPropagation(); cellClick(r,c)};
  }
  document.getElementById('markers').appendChild(m);
}

function cellClick(r,c){
  if(isBlocked(r,c)) return;
  if(scanMode){ if(scanTargets.some(t=>t.r===r&&t.c===c)) chooseScanTarget(r,c); return; }
  if(phase==='deploy'){
    if(!PLAYER_DEPLOY_ROWS.includes(r) || !selectedTray || board[r][c] || remaining(selectedTray)<=0) return;
    const def=unitDefs.find(d=>d.id===selectedTray);
    board[r][c]=unitCopy(def,playerTeam(),r,c);
    lastMoveGlow=null;
    updateConsole(board[r][c]); renderUnitList(); renderBoard(); updateStartBtn();
    return;
  }
  if(phase!=='player') return;
  if(abilityMoveMode && selectedPiece && legal.some(t=>t.r===r&&t.c===c)){ chooseWarpTarget(r,c); }
}

function pieceClick(p){
  // Click means inspect / activate console skills.
  // Movement is handled by dragging from the A/base hotspot.
  if(phase==='deploy' && p.team===playerTeam()){
    board[p.r][p.c]=null; lastMoveGlow=null; renderUnitList(); renderBoard(); updateConsole(p); updateStartBtn(); return;
  }
  if(p.team===playerTeam() || p.revealed || p.scanned || showAllEnemies) updateConsole(p);
  if(phase==='player' && p.team===playerTeam()){
    selectedPiece=p;
    legal=[];
    scanMode=false;
    abilityMoveMode=false;
    scanTargets=[];
    renderBoard();
  }
}

function getLegal(p){
  const out=[], dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  if(!p.movable) return out;
  if(p.recon){
    for(const [dr,dc] of dirs){
      let r=p.r+dr,c=p.c+dc;
      while(inBounds(r,c)&&!isBlocked(r,c)){
        const o=board[r][c];
        if(!o) out.push({r,c});
        else{ if(o.team!==p.team) out.push({r,c}); break; }
        r+=dr; c+=dc;
      }
    }
  } else {
    for(const [dr,dc] of dirs){
      const r=p.r+dr,c=p.c+dc;
      if(!inBounds(r,c)||isBlocked(r,c)) continue;
      const o=board[r][c];
      if(!o || o.team!==p.team) out.push({r,c});
    }
  }
  return out;
}
function performAction(p,r,c){
  const from={r:p.r,c:p.c};
  const to={r,c};
  const target=board[r][c];

  if(!target){
    const privateText=moveTextFor(p,from,to,null);
    const publicText=publicMoveText(from,to,null);
    board[p.r][p.c]=null; p.r=r; p.c=c; board[r][c]=p;
    lastMoveGlow={r,c};
    log(privateText);
    if(onlineState.enabled){
      // Privacy rule: never send the moving unit's name/id in the room commit.
      onlineState.pendingMove={type:'move', from, to, publicText, privateText};
    }
    finishPlayerTurn();
    return;
  }

  if(target.team!==p.team){
    const privateText=moveTextFor(p,from,to,target);
    const publicText=publicMoveText(from,to,target);
    resolveCombat(p,target);
    lastMoveGlow={r,c};
    if(onlineState.enabled){
      // Combat replay is a later layer. For now, do not expose attacker/defender identity through commit text.
      onlineState.pendingMove={type:'attack', from, to, publicText, privateText};
    }
    finishPlayerTurn();
  }
}
function resolveCombat(a,d){
  a.revealed=true; d.revealed=true; log(`${a.team.toUpperCase()} ${a.name} challenged ${d.team.toUpperCase()} ${d.name}.`);
  if(d.beacon){capturePiece(a.team,d); moveInto(a,d.r,d.c); endGame(a.team.toUpperCase()+' captured the Academy Beacon!'); return}
  if(d.mine){
    if(a.engineer){
      const oldR=a.r, oldC=a.c, targetR=d.r, targetC=d.c;
      board[oldR][oldC]=null; board[targetR][targetC]=a; a.r=targetR; a.c=targetC;
      capturePiece(a.team,d); log(a.name+' disabled and removed a Shield Mine.');
    } else {
      log(a.name+' was destroyed by a Shield Mine.'); capturePiece(d.team,a); board[a.r][a.c]=null; d.revealed=true;
    }
    return;
  }
  if(a.infiltrator){
    if(d.rank===10){capturePiece(a.team,d); moveInto(a,d.r,d.c); endGame(a.team.toUpperCase()+' eliminated the Fleet Commander!')}
    else {capturePiece(d.team,a); board[a.r][a.c]=null; log('Infiltrator failed.')} return
  }
  if(d.infiltrator){capturePiece(a.team,d); moveInto(a,d.r,d.c); log(a.name+' caught the Infiltrator.'); return}

  if(a.rank>d.rank){
    if(d.shielded){d.shielded=false; shieldArmed[d.team]=false; log(d.name+' Emergency Shield absorbed the losing attack.'); return;}
    const fc=d.rank===10; capturePiece(a.team,d); moveInto(a,d.r,d.c); log(a.name+' wins.'); if(fc) endGame(a.team.toUpperCase()+' eliminated the Fleet Commander!')
  }
  else if(a.rank<d.rank){
    if(a.shielded){a.shielded=false; shieldArmed[a.team]=false; log(a.name+' Emergency Shield saved it from defeat.'); return;}
    const fc=a.rank===10; capturePiece(d.team,a); board[a.r][a.c]=null; log(a.name+' lost.'); if(fc) endGame(d.team.toUpperCase()+' eliminated the Fleet Commander!')
  }
  else {
    const afc=a.rank===10,dfc=d.rank===10;
    capturePiece(d.team,a); capturePiece(a.team,d); board[a.r][a.c]=null; board[d.r][d.c]=null; log('Equal ranks. Both removed.');
    if(afc&&dfc) endGame('Both Fleet Commanders were eliminated. Draw.');
  }
}
function moveInto(p,r,c){board[p.r][p.c]=null; p.r=r; p.c=c; board[r][c]=p}
function finishPlayerTurn(){
  selectedPiece=null; legal=[]; scanMode=false; abilityMoveMode=false; scanTargets=[]; pendingConfirm=null; hideConfirm(); renderBoard(); renderUnitList();
  if(phase==='gameover') return;
  if(onlineState.enabled){
    phase='commit';
    onlineState.pendingCommit=true;
    updateStatus('COMMIT MOVE','Review your move.','Press COMMIT to send this move and pass the turn to the other player.');
    log('Move ready. Press COMMIT to pass the turn.');
    updateStartBtn();
    return;
  }
  phase='ai'; updateStatus(teamLabel(enemyTeam())+' ACADEMY AI','Enemy turn.','Computer is making a move...'); updateStartBtn();
  setTimeout(aiTurn,450);
}
function aiKnows(piece){
  // Fair AI rule: the CPU only knows player identities after combat reveal or scan.
  // It can see occupied spaces, but not hidden ranks, mines, beacon, or Fleet Commander.
  return !!(piece && piece.revealed);
}

function aiValueAttack(a,t){
  const known=aiKnows(t);

  // Unknown enemy piece: no mind-reading.
  // AI sees a target, but does not know if it is a mine, beacon, weak unit, or monster.
  if(!known){
    let score=360 + Math.random()*180;

    // Brave attackers press unknown targets a little more.
    if(a.rank>=6) score+=90;
    if(a.rank<=2) score-=20;

    // Engineers are slightly useful into unknown defenses, but they do NOT magically know mines.
    if(a.engineer) score+=55;

    // Infiltrators should hunt, but not suicide into every mystery piece.
    if(a.infiltrator) score-=90;

    // Commander should not be totally reckless, but also not play like a psychic chess engine.
    if(a.rank===10) score-=120;

    return score;
  }

  // Known/revealed target logic.
  if(t.beacon) return 10000;
  if(t.rank===10) return a.infiltrator ? 9000 : (a.rank>t.rank?4000:-350);
  if(t.mine) return a.engineer ? 1800 : -700;
  if(t.infiltrator) return 900;
  if(a.infiltrator) return t.rank===10 ? 9000 : -500;

  let score=0;
  if(a.rank>t.rank) score=1100 + t.rank*60;
  else if(a.rank===t.rank) score=220 + t.rank*20;
  else score=-350 + Math.random()*260; // revealed bad attacks can still happen sometimes, just less often.

  if(a.rank===10 && t.infiltrator) score=-3000;
  return score;
}

function nearestPlayerGoalScore(r,c){
  let best=999, bestScore=-9999;
  for(let rr=0;rr<ROWS;rr++)for(let cc=0;cc<COLS;cc++){
    const p=board[rr][cc]; 
    if(!p||p.team!==playerTeam()) continue;

    const d=Math.abs(rr-r)+Math.abs(cc-c);
    let value=120; // unknown occupied enemy space

    if(aiKnows(p)){
      if(p.beacon) value=900;
      else if(p.rank===10) value=800;
      else if(p.mine) value=80;
      else value=160 + (p.rank||0)*18;
    }

    const score=value - d*38;
    if(score>bestScore){bestScore=score; best=d;}
  }

  // Slight pressure so the CPU keeps advancing even without perfect target info.
  return bestScore + r*10 + Math.random()*18;
}

function aiTurn(){
  if(phase!=='ai') return;
  const units=[]; 
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const p=board[r][c]; 
    if(p&&p.team===enemyTeam()&&p.movable) units.push(p);
  }

  const choices=[];
  units.forEach(u=>{
    getLegal(u).forEach(t=>{
      const target=board[t.r][t.c];
      if(target&&target.team===playerTeam()){
        choices.push({type:'attack',u,t,score:aiValueAttack(u,target)});
      }
      else if(!target){
        let score=nearestPlayerGoalScore(t.r,t.c);

        // Small personality nudges, not omniscience.
        if(u.engineer) score+=15;
        if(u.recon) score+=10;
        if(u.rank===10) score-=45;

        choices.push({type:'move',u,t,score});
      }
    });
  });

  if(!choices.length){
    if(phase!=='gameover'){phase='player'; updateStatus(teamLabel(playerTeam())+' TURN','Your turn.','Drag from a unit’s A/base to move. Click the A/base to use skills.'); updateStartBtn();}
    return;
  }

  // Fair imperfection: choose from the top few moves, not always the single best.
  choices.sort((a,b)=>b.score-a.score);
  const top=choices.slice(0, Math.min(5, choices.length));
  const pick=top[Math.floor(Math.random()*top.length)];

  if(pick){
    if(pick.type==='attack') resolveCombat(pick.u, board[pick.t.r][pick.t.c]);
    else {
      board[pick.u.r][pick.u.c]=null; 
      pick.u.r=pick.t.r; pick.u.c=pick.t.c; 
      board[pick.t.r][pick.t.c]=pick.u; 
      log(teamLabel(enemyTeam())+' unit advanced.');
    }
  }
  if(phase!=='gameover'){phase='player'; updateStatus(teamLabel(playerTeam())+' TURN','Your turn.','Drag from a unit’s A/base to move. Click the A/base to use skills.'); updateStartBtn();}
  renderBoard(); renderUnitList(); updateConsole(selectedPiece);
}
function activateScan(piece){selectedPiece=piece; legal=[]; pendingConfirm=null; hideConfirm(); scanMode=true; scanTargets=getScanTargets(piece); renderBoard(); updateStatus('SCAN MODE','Choose a ? target.','Click a hidden enemy in 2-space range, then press TARGET CONFIRM.')}
function blocksScan(p,r,c){
  const dr=r-p.r, dc=c-p.c;
  const sr=Math.sign(dr), sc=Math.sign(dc);
  if(!(dr===0 || dc===0 || Math.abs(dr)===Math.abs(dc))) return false;
  let cr=p.r+sr, cc=p.c+sc;
  while(cr!==r || cc!==c){
    if(board[cr][cc] && board[cr][cc].team!==p.team) return true;
    cr+=sr; cc+=sc;
  }
  return false;
}
function getScanTargets(p){
  const out=[]; for(let r=p.r-2;r<=p.r+2;r++)for(let c=p.c-2;c<=p.c+2;c++){
    if(!inBounds(r,c)||isBlocked(r,c)||(r===p.r&&c===p.c)) continue;
    const target=board[r][c];
    if(!target || target.team!==enemyTeam() || target.revealed || target.scanned) continue;
    if(blocksScan(p,r,c)) continue;
    out.push({r,c});
  } return out;
}
function doScan(r,c){const t=board[r][c]; if(t&&t.team===enemyTeam()){t.scanned=true; log('Target Specialist identified '+teamLabel(enemyTeam())+' '+t.name+'.')} else log('Scan found no enemy signal.'); finishPlayerTurn();}


function startPiecePointer(e,piece){
  e.stopPropagation();
  e.preventDefault();

  const startX=e.clientX, startY=e.clientY;
  let moved=false;

  const onMoveCheck=(ev)=>{
    if(Math.hypot(ev.clientX-startX, ev.clientY-startY)>10){
      cleanupCheck();
      beginDrag(ev,piece);
      moved=true;
    }
  };
  const onUpCheck=(ev)=>{
    cleanupCheck();
    if(!moved){
      pieceClick(piece);
    }
  };
  const cleanupCheck=()=>{
    window.removeEventListener('pointermove',onMoveCheck);
    window.removeEventListener('pointerup',onUpCheck);
    window.removeEventListener('pointercancel',onUpCheck);
  };
  window.addEventListener('pointermove',onMoveCheck);
  window.addEventListener('pointerup',onUpCheck);
  window.addEventListener('pointercancel',onUpCheck);
}

function beginDrag(e,piece){
  if(phase==='waiting' || phase==='commit'){
    log('Board locked until this turn is active.');
    return;
  }
  if(phase!=='player' || piece.team!==playerTeam() || !piece.movable){
    pieceClick(piece);
    return;
  }

  selectedPiece=piece;
  legal=getLegal(piece);
  scanMode=false;
  abilityMoveMode=false;
  scanTargets=[];
  renderBoard();

  const ghost=document.createElement('div');
  ghost.className='drag-ghost';
  ghost.innerHTML=`<img src="${piece.img||imgMap[piece.id]}">`;
  document.getElementById('pieces').appendChild(ghost);

  dragState={piece,ghost,legal};
  moveGhost(e);

  window.addEventListener('pointermove',dragMove);
  window.addEventListener('pointerup',dragEnd);
  window.addEventListener('pointercancel',dragCancel);
}

function appPointer(e){
  const rect=document.getElementById('app').getBoundingClientRect();
  const scale=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
  return {x:(e.clientX-rect.left)/scale, y:(e.clientY-rect.top)/scale};
}

function moveGhost(e){
  if(!dragState) return;
  const p=appPointer(e);
  dragState.ghost.style.left=(p.x-BASE_ANCHOR.x-anchorOffset.x)+'px';
  dragState.ghost.style.top=(p.y-BASE_ANCHOR.y-anchorOffset.y)+'px';
}

function dragMove(e){
  e.preventDefault();
  moveGhost(e);
}

function dragEnd(e){
  if(!dragState) return;
  const {piece,ghost,legal}=dragState;
  const p=appPointer(e);
  const hit=nearestCell(p.x,p.y);
  ghost.remove();
  cleanupDrag();
  suppressNextBoardClick=true;

  if(hit && legal.some(t=>t.r===hit.r && t.c===hit.c)){
    performAction(piece,hit.r,hit.c);
  } else {
    log('Move cancelled.');
    selectedPiece=null; legal=[]; renderBoard();
  }
}

function dragCancel(){
  if(dragState && dragState.ghost) dragState.ghost.remove();
  cleanupDrag();
  suppressNextBoardClick=true;
  selectedPiece=null; legal=[]; renderBoard();
}

function cleanupDrag(){
  dragState=null;
  window.removeEventListener('pointermove',dragMove);
  window.removeEventListener('pointerup',dragEnd);
  window.removeEventListener('pointercancel',dragCancel);
}

function updateCaptured(){
  const el=document.getElementById('capturedList');
  if(!el) return;
  const playerCaptured = (captured[playerTeam()]||[]).length ? captured[playerTeam()].join(', ') : 'None';
  el.textContent = playerCaptured;
}

function capturePiece(winnerTeam, loser){
  if(!loser) return;
  const arr = captured[winnerTeam] || [];
  arr.push(loser.display || loser.rank || loser.id);
  captured[winnerTeam]=arr;
  updateCaptured();
}


function showConfirm(title,text,buttonText,onConfirm){
  const box=document.getElementById('confirmBox');
  document.getElementById('confirmTitle').textContent=title;
  document.getElementById('confirmText').textContent=text;
  const btn=document.getElementById('confirmBtn');
  btn.textContent=buttonText;
  btn.onclick=onConfirm;
  document.getElementById('cancelConfirmBtn').onclick=()=>cancelConfirm();
  box.classList.add('show');
}
function hideConfirm(){const box=document.getElementById('confirmBox'); if(box) box.classList.remove('show')}
function cancelConfirm(){pendingConfirm=null; hideConfirm(); if(scanMode||abilityMoveMode){renderBoard();}}
function chooseScanTarget(r,c){
  const t=board[r][c];
  pendingConfirm={type:'scan',r,c};
  addMarker('sel',r,c);
  showConfirm('Target Confirm', t?('Scan '+(t.scanned||t.revealed?t.name:'unknown enemy')+' at '+(c+1)+','+(ROWS-r)+'?'):('Scan empty signal at '+(c+1)+','+(ROWS-r)+'?'), 'TARGET CONFIRM', ()=>confirmPending());
}
function chooseWarpTarget(r,c){
  pendingConfirm={type:'warp',r,c,piece:selectedPiece};
  addMarker('sel',r,c);
  showConfirm('Energize', 'Warp Fleet Commander to '+(c+1)+','+(ROWS-r)+'?', 'ENERGIZE', ()=>confirmPending());
}
function confirmPending(){
  if(!pendingConfirm) return;
  const p=pendingConfirm; pendingConfirm=null; hideConfirm();
  if(p.type==='scan'){doScan(p.r,p.c); return;}
  if(p.type==='warp'){
    if(p.piece && abilityMoveMode && legal.some(t=>t.r===p.r&&t.c===p.c)){
      abilityMoveMode=false; commanderUse[playerTeam()]=0; updateConsole(p.piece); performAction(p.piece,p.r,p.c);
    }
  }
}

function updateConsole(obj){
  const img=document.getElementById('consoleImg'), name=document.getElementById('consoleName'), text=document.getElementById('consoleText'), uses=document.getElementById('consoleUses'), actions=document.getElementById('consoleActions');
  actions.innerHTML=''; uses.textContent='';
  if(!obj){
    const cmd=(typeof currentCommander==='function')?currentCommander():null;
    img.src=cmd?cmd.profile:'PROF_FC.jpg';
    name.textContent=cmd?cmd.name:'Select a unit';
    text.textContent=cmd?'Selected '+sideLabel(playerTeam())+' Commander. Place your Fleet Commander token to use this leader.':'Unit name and ability display here.';
    return;
  }
  img.src=obj.profile||profileMap[obj.id]||obj.img||imgMap[obj.id]; name.textContent=obj.display+' '+obj.name; text.textContent=obj.id==='FC'?currentTactic().name+': '+currentTactic().text:obj.ability;
  if(obj.id==='FC' && obj.team===playerTeam()){uses.textContent='USES: '+commanderUse[obj.team]+'/1'+(obj.shielded?'  | SHIELD READY':''); if(phase==='player'&&commanderUse[obj.team]>0){const b=document.createElement('button'); b.className='btn ability-btn'; b.textContent=currentTactic().name.toUpperCase(); b.onclick=()=>useCommanderTactic(obj); actions.appendChild(b)}}
  if(obj.specialist && obj.team===playerTeam() && phase==='player'){const b=document.createElement('button'); b.className='btn ability-btn'; b.textContent='ACTIVATE SCAN'; b.onclick=()=>activateScan(obj); actions.appendChild(b)}
}
function useCommanderTactic(piece){
  if(piece.id!=='FC'||piece.team!==playerTeam()||commanderUse[piece.team]<=0||phase!=='player') return;
  pendingConfirm=null; hideConfirm();
  if(setup.tactic==='tacticalWarp'){
    piece.revealed=true;
    selectedPiece=piece; legal=getTeleport(piece,3); abilityMoveMode=true; renderBoard(); updateConsole(piece); updateStatus('TACTICAL WARP','Choose a warp space.','Click a green warp circle, then press ENERGIZE to commit.');
  }
  else {
    piece.shielded=true;
    piece.revealed=true;
    shieldArmed[piece.team]=true;
    commanderUse[piece.team]=0;
    updateConsole(piece);
    renderBoard();
    updateStatus('EMERGENCY SHIELD','Shield armed until hit.','Your Commander is revealed and ignores the next losing attack, then the shield is spent.');
    log(piece.name+' revealed and armed Emergency Shield.');
    finishPlayerTurn();
  }
}
function getTeleport(p,range){
  const out=[]; for(let r=p.r-range;r<=p.r+range;r++)for(let c=p.c-range;c<=p.c+range;c++){
    if(!inBounds(r,c)||isBlocked(r,c)||(r===p.r&&c===p.c)||board[r][c]) continue;
    if(Math.max(Math.abs(r-p.r),Math.abs(c-p.c))<=range) out.push({r,c});
  } return out;
}

function updateStatus(title,line,note){document.getElementById('phaseTitle').textContent=title;document.getElementById('statusLine').textContent=line;document.getElementById('statusNote').textContent=note;}
function clearLog(){document.getElementById('battleLog').innerHTML=''}
function log(msg){const d=document.createElement('div'); d.textContent='• '+msg; document.getElementById('battleLog').prepend(d)}
function endGame(msg){phase='gameover'; updateStartBtn(); for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const p=board[r][c]; if(p)p.revealed=true} renderBoard(); updateStatus('BATTLE COMPLETE',msg,'Restart or return to menu.'); showModal('Battle Complete',msg)}
function showModal(t,m){document.getElementById('modalTitle').textContent=t; document.getElementById('modalText').textContent=m; document.getElementById('modal').classList.add('show')}
function closeModal(){document.getElementById('modal').classList.remove('show')}

function toggleDots(){showCenterDots=!showCenterDots; renderBoard()}
function toggleEnemies(){showAllEnemies=!showAllEnemies; renderBoard()}
function nudgeAnchor(dx,dy){anchorOffset.x+=dx; anchorOffset.y+=dy; renderBoard()}
function updateReadout(){
  const a={x:BASE_ANCHOR.x+anchorOffset.x,y:BASE_ANCHOR.y+anchorOffset.y};
  document.getElementById('readout').innerHTML=`Anchor A-center: x ${a.x}, y ${a.y}<br>Offset: ${anchorOffset.x}, ${anchorOffset.y}<br>Click the A/base hotspot to select; click green highlighted spaces to move.`;
}

/* =========================================================
   HELP ME / DEBUG NOTES
   ========================================================= */
function showHelp(){showScreen('help')}
function returnFromHelp(){showScreen('setup')}


function firebaseDebugRoom(){
  console.log('Beacon Wars Firebase Debug', {
    onlineState: {...onlineState, roomUnsub: !!onlineState.roomUnsub},
    phase,
    playerTeam: playerTeam(),
    enemyTeam: enemyTeam(),
    lastRoomData: onlineState.lastRoomData
  });
  log('Firebase debug printed to browser console.');
}
