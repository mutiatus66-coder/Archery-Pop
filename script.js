/* script.js
   Archery Pop - client-side module
   - Requirements implemented:
     * 960x600 board
     * custom scope cursor inside board (hidden system cursor)
     * targets spawn every 2s, fall 3 pixels/frame
     * max 5 targets, min 1 present
     * scoring + lives + timer + pause + gameover + highscore
*/

/* ========== CONFIG ========== */
const BOARD_W = 960;
const BOARD_H = 600;
const TARGET_SPAWN_INTERVAL = 2000; // ms
const TARGET_FALL_SPEED = 3; // pixels per frame (as spec)
const MAX_TARGETS = 5;
const MIN_TARGETS = 1;
const INITIAL_LIVES = 3;
const INITIAL_TIME = 60; // seconds

const HS_KEY = 'archerypop_highscore';

/* ========== DOM ========== */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const boardElement = document.getElementById('board');
const scopeImage = document.getElementById('scopeImage');

const menuOverlay = document.getElementById('menuOverlay');
const playBtn = document.getElementById('playBtn');
const resetHsBtn = document.getElementById('resetHsBtn');
const playerNameInput = document.getElementById('playerName');

const pauseBtn = document.getElementById('pauseBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const quitBtn = document.getElementById('quitBtn');

const gameOverOverlay = document.getElementById('gameOverOverlay');
const playAgainBtn = document.getElementById('playAgainBtn');
const toMenuBtn = document.getElementById('toMenuBtn');

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const livesContainer = document.getElementById('lives');
const displayHighscore = document.getElementById('displayHighscore');

const finalName = document.getElementById('finalName');
const finalScore = document.getElementById('finalScore');
const finalHighscore = document.getElementById('finalHighscore');
const newHighElem = document.getElementById('newHigh');

/* ========== MEDIA ========== */
const targetImg = new Image();
targetImg.src = 'target.png';

const scopeSrc = 'cursor-scope.png';
scopeImage.src = scopeSrc;

const heartSrc = 'user-lives.png';

/* ========== STATE ========== */
let targets = []; // array of {x,y,size,alive,id}
let score = 0;
let lives = INITIAL_LIVES;
let timeLeft = INITIAL_TIME;
let gameRunning = false;
let gamePaused = false;
let animationId = null;
let spawnIntervalId = null;
let countdownIntervalId = null;

let mouse = { x: BOARD_W/2, y: BOARD_H/2 };

/* highscore */
let highscore = Number(localStorage.getItem(HS_KEY) || 0);
displayHighscore.textContent = highscore;

/* initialize canvas logical size */
canvas.width = BOARD_W;
canvas.height = BOARD_H;

/* ========== UTIL ========== */
function rand(min,max){ return Math.random()*(max-min)+min; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function formatTime(sec){ const m = String(Math.floor(sec/60)).padStart(2,'0'); const s = String(sec%60).padStart(2,'0'); return `${m}:${s}`; }

/* ========== HUD ========= */
function updateHUD(){
  scoreEl.textContent = score;
  timerEl.textContent = formatTime(timeLeft);
  // render hearts
  livesContainer.innerHTML = '';
  for(let i=0;i<lives;i++){
    const img = document.createElement('img');
    img.src = heartSrc;
    img.alt = 'heart';
    img.className = 'heart';
    livesContainer.appendChild(img);
  }
}

/* ========== TARGETS ========= */
function spawnTarget(){
  // keep only alive count
  const aliveCount = targets.filter(t=>t.alive).length;
  if (aliveCount >= MAX_TARGETS) return;
  const size = 80;
  const x = rand(0, BOARD_W - size);
  const y = -size - rand(0,80);
  targets.push({ x, y, size, alive:true, id: Date.now() + Math.random() });
}

/* ensure minimum targets */
function ensureMinTargets(){
  while (targets.filter(t=>t.alive).length < MIN_TARGETS) spawnTarget();
}

/* ========== GAME CONTROL ========= */
function resetGameState(){
  targets = [];
  score = 0;
  lives = INITIAL_LIVES;
  timeLeft = INITIAL_TIME;
  gameRunning = false;
  gamePaused = false;
  updateHUD();
}

/* Start game */
function startGame(){
  if (!playerNameInput.value.trim()) return;
  // reset
  resetGameState();
  score = 0;
  lives = INITIAL_LIVES;
  timeLeft = INITIAL_TIME;
  updateHUD();

  // UI
  menuOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');

  // show scope
  scopeImage.style.display = 'block';

  // spawn initial
  for(let i=0;i<2;i++) spawnTarget();
  ensureMinTargets();

  // start spawn & countdown
  startSpawnTimer();
  startCountdown();

  gameRunning = true;
  gamePaused = false;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

/* Pause/resume */
function pauseGame(){
  if (!gameRunning) return;
  gamePaused = true;
  pauseOverlay.classList.remove('hidden');
  pauseBtn.setAttribute('aria-pressed','true');
}
function resumeGame(){
  if (!gameRunning) return;
  gamePaused = false;
  pauseOverlay.classList.add('hidden');
  pauseBtn.setAttribute('aria-pressed','false');
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

/* Quit to menu */
function quitToMenu(){
  stopSpawnTimer();
  stopCountdown();
  cancelAnimationFrame(animationId);
  scopeImage.style.display = 'none';
  gameRunning = false;
  gamePaused = false;
  menuOverlay.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
}

/* End game */
function endGame(){
  stopSpawnTimer();
  stopCountdown();
  cancelAnimationFrame(animationId);
  gameRunning = false;
  gamePaused = false;

  const prevHS = highscore;
  if (score > prevHS){
    highscore = score;
    localStorage.setItem(HS_KEY, highscore);
  }

  finalName.textContent = playerNameInput.value || 'Player';
  finalScore.textContent = score;
  finalHighscore.textContent = highscore;
  displayHighscore.textContent = highscore;
  if (score > prevHS) newHighElem.classList.remove('hidden'); else newHighElem.classList.add('hidden');

  gameOverOverlay.classList.remove('hidden');
  scopeImage.style.display = 'none';
}

/* ========== SPAWN & COUNTDOWN ========= */
function startSpawnTimer(){
  stopSpawnTimer();
  spawnIntervalId = setInterval(() => {
    spawnTarget();
  }, TARGET_SPAWN_INTERVAL);
}
function stopSpawnTimer(){
  if (spawnIntervalId){ clearInterval(spawnIntervalId); spawnIntervalId = null; }
}
function startCountdown(){
  stopCountdown();
  countdownIntervalId = setInterval(()=>{
    if (!gameRunning || gamePaused) return;
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0) {
      endGame();
    }
  },1000);
}
function stopCountdown(){ if (countdownIntervalId){ clearInterval(countdownIntervalId); countdownIntervalId=null; } }

/* ========== MAIN LOOP ========== */
function loop(){
  if (!gameRunning || gamePaused) return;
  // update targets
  for (let i = targets.length - 1; i >= 0; i--){
    const t = targets[i];
    if (!t.alive){ targets.splice(i,1); continue; }
    t.y += TARGET_FALL_SPEED; // exactly 3 px/frame as required

    // if reach bottom
    if (t.y > BOARD_H){
      t.alive = false;
      // penalty
      score = Math.max(0, score - 5);
      lives = Math.max(0, lives - 1);
      updateHUD();
      if (lives <= 0){ endGame(); return; }
    }
  }

  // ensure min targets
  ensureMinTargets();

  // render
  render();

  animationId = requestAnimationFrame(loop);
}

/* ========== RENDER ========== */
function render(){
  // clear
  ctx.clearRect(0,0,BOARD_W,BOARD_H);

  // background
  ctx.fillStyle = '#ffffffff';
  ctx.fillRect(0,0,BOARD_W,BOARD_H);

  // draw targets
  for (const t of targets){
    if (!t.alive) continue;
    ctx.drawImage(targetImg, t.x, t.y, t.size, t.size);
  }

  // optionally draw debug cross at mouse (we use scope image DOM on top)
}

/* ========== SHOOTING ========== */
function handleShoot(){
  if (!gameRunning || gamePaused) return;
  const mx = mouse.x;
  const my = mouse.y;
  let hit = false;
  // iterate topmost first (last spawned on top)
  for (let i = targets.length - 1; i >= 0; i--){
    const t = targets[i];
    if (!t.alive) continue;
    if (mx >= t.x && mx <= t.x + t.size && my >= t.y && my <= t.y + t.size){
      t.alive = false;
      score += 10;
      hit = true;
      break;
    }
  }
  // update HUD (note: missing penalty for miss per spec: only bottom triggers -5)
  updateHUD();
}

/* ========== INPUT & EVENTS ========== */
/* enable play button only when name non-empty */
playerNameInput.addEventListener('input', ()=>{
  const ok = playerNameInput.value.trim().length > 0;
  playBtn.disabled = !ok;
  playBtn.setAttribute('aria-disabled', String(!ok));
});

/* play */
playBtn.addEventListener('click', ()=> startGame());
resetHsBtn.addEventListener('click', ()=>{
  localStorage.removeItem(HS_KEY);
  highscore = 0;
  displayHighscore.textContent = 0;
});

/* pause/resume */
pauseBtn.addEventListener('click', ()=>{
  if (!gameRunning) return;
  if (gamePaused) resumeGame(); else pauseGame();
});
resumeBtn.addEventListener('click', resumeGame);
quitBtn.addEventListener('click', ()=> {
  quitToMenu();
});

/* game over overlay buttons */
playAgainBtn.addEventListener('click', ()=> startGame());
toMenuBtn.addEventListener('click', ()=> quitToMenu());

/* mouse move inside board - update mouse coords relative to canvas and position scope image */
boardElement.addEventListener('mousemove', (ev)=>{
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  mouse.x = clamp(Math.round(x), 0, BOARD_W);
  mouse.y = clamp(Math.round(y), 0, BOARD_H);
  // position scope image using board-local coordinates
  // boardElement is same position as canvas, so we can use client coords relative to board
  const rectBoard = boardElement.getBoundingClientRect();
  const localX = ev.clientX - rectBoard.left;
  const localY = ev.clientY - rectBoard.top;
  scopeImage.style.left = `${localX}px`;
  scopeImage.style.top = `${localY}px`;
});

/* show/hide scope and cursor on enter/leave */
boardElement.addEventListener('mouseenter', ()=>{
  boardElement.style.cursor = 'none';
  if (gameRunning && !gamePaused) scopeImage.style.display = 'block';
});
boardElement.addEventListener('mouseleave', ()=>{
  boardElement.style.cursor = 'default';
  scopeImage.style.display = 'none';
});

/* shooting */
boardElement.addEventListener('click', (ev)=>{
  if (!gameRunning || gamePaused) return;
  handleShoot();
});

/* keyboard: Space to pause/resume */
window.addEventListener('keydown', (ev)=>{
  if (ev.code === 'Space'){
    ev.preventDefault();
    if (!gameRunning) return;
    if (gamePaused) resumeGame(); else pauseGame();
  }
});

/* accessibility: play with Enter when focused */
playBtn.addEventListener('keyup', (ev)=> { if (ev.key === 'Enter' && !playBtn.disabled) playBtn.click(); });

/* ensure min targets & initial HUD on load */
ensureMinTargets();
updateHUD();
