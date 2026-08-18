// Timing Constants
const BUFFER_DURATION = 15000; // 15 seconds
const POLL_INTERVAL = 1500;
const PING_INTERVAL = 3000;
const FALLBACK_TIMEOUT = 5000;
const LB_POLL_INTERVAL = 5000;
const STRUCK_POLL_INTERVAL = 3000;

// State Machine
const STATES = {
    LOADING: 0,
    BUFFER: 1,
    STORM: 2,
    REVEAL_ARC: 3,
    REVEAL_TECH: 4,
    REVEAL_CREDIT: 5
};
let currentState = STATES.LOADING;

// Canvas Setup
const canvas = document.getElementById('storm-canvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// UI Elements
const loadingScreen = document.getElementById('loading-screen');
const bufferMessage = document.getElementById('buffer-message');
const techText = document.getElementById('tech-text');
const creditLine = document.getElementById('credit-line');
const btnStart = document.getElementById('btn-start');
const btnRevealTech = document.getElementById('btn-reveal-tech');
const btnShowCredit = document.getElementById('btn-show-credit');
const lbToggleContainer = document.getElementById('lb-toggle-container');
const toggleLb = document.getElementById('toggle-lb');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const leaderboardList = document.getElementById('leaderboard-list');
const manualInput = document.getElementById('manual-input');

// Slot Generation for A, R, C
// Uses an off-screen canvas to extract pixel coordinates of the letterforms

let letterSlots = { A: [], R: [], C: [] };
let totalSlots = 0;

function generateSlots() {
    letterSlots = { A: [], R: [], C: [] };
    totalSlots = 0;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = 400;
    offscreen.height = 300;
    const oCtx = offscreen.getContext('2d');
    oCtx.font = 'bold 280px Kalam';
    oCtx.textBaseline = 'top';
    
    const arcWidth = width * 0.7;
    const letterWidth = arcWidth / 3;
    const letterHeight = height * 0.55;
    
    const startX = (width - arcWidth) / 2;
    const startY = (height - letterHeight) / 2 - (height * 0.1); 

    ['A', 'R', 'C'].forEach((letter, i) => {
        oCtx.clearRect(0, 0, 400, 300);
        oCtx.fillText(letter, 50, 0);
        const imgData = oCtx.getImageData(0, 0, 400, 300).data;
        
        let potentialSlots = [];
        let minX = 400, maxX = 0, minY = 300, maxY = 0;
        
        for (let y = 0; y < 300; y++) {
            for (let x = 0; x < 400; x++) {
                const alpha = imgData[(y * 400 + x) * 4 + 3];
                if (alpha > 128) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    potentialSlots.push({x, y});
                }
            }
        }
        
        const bw = maxX - minX || 1;
        const bh = maxY - minY || 1;
        
        const scaleX = (letterWidth * 0.8) / bw;
        const scaleY = letterHeight / bh;
        const scale = Math.min(scaleX, scaleY);
        
        const lX = startX + (i * letterWidth);
        const lY = startY;
        const xOffset = lX + (letterWidth - bw * scale) / 2;
        const yOffset = lY + (letterHeight - bh * scale) / 2;
        
        let scaledSlots = potentialSlots.map(p => ({
            x: xOffset + (p.x - minX) * scale,
            y: yOffset + (p.y - minY) * scale
        }));
        
        scaledSlots.sort(() => Math.random() - 0.5);
        
        let selectedSlots = [];
        for (let ps of scaledSlots) {
            let tooClose = false;
            for (let ss of selectedSlots) {
                if (Math.abs(ps.x - ss.x) < 10 && Math.abs(ps.y - ss.y) < 8) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                selectedSlots.push({ ...ps, assigned: false });
            }
        }
        
        letterSlots[letter] = selectedSlots;
        console.log(`Letter ${letter}: ${selectedSlots.length} slots generated`);
    });
    totalSlots = letterSlots.A.length + letterSlots.R.length + letterSlots.C.length;
    
    // Dynamic styling for TECH and credit line
    if (techText && creditLine) {
        let techSize = letterHeight * 0.35;
        let creditSize = letterHeight * 0.20;
        
        const arcBottom = startY + letterHeight;
        let techTop = arcBottom + 24;
        let techBottom = techTop + techSize;
        let creditTop = techBottom + 12;
        let creditBottom = creditTop + creditSize;
        
        const maxBottom = height - 20;
        
        if (creditBottom > maxBottom) {
            const requiredSpace = creditBottom - arcBottom;
            const availableSpace = maxBottom - arcBottom;
            const scale = availableSpace / requiredSpace;
            
            techSize *= scale;
            creditSize *= scale;
            
            techTop = arcBottom + (24 * scale);
            techBottom = techTop + techSize;
            creditTop = techBottom + (12 * scale);
        }
        
        ctx.font = `700 ${techSize}px 'Playfair Display', serif`;
        let techWidth = ctx.measureText("TECH").width;
        if (techWidth > width * 0.8) {
            const wScale = (width * 0.8) / techWidth;
            techSize *= wScale;
            techBottom = techTop + techSize;
            creditTop = techBottom + 12;
        }
        
        techText.style.fontSize = techSize + 'px';
        techText.style.top = techTop + 'px';
        techText.style.lineHeight = '1';
        
        creditLine.style.fontSize = creditSize + 'px';
        creditLine.style.top = creditTop + 'px';
        creditLine.style.lineHeight = '1';
    }
}

generateSlots(); // Initial gen

// Pool Manager
class PoolManager {
    constructor() {
        this.realWords = [];
        this.manualWords = [];
        this.activeWords = [];
        this.assignedSlots = {};
        
        this.networkAlive = true;
        this.leaderboardEnabled = false;
        
        this.lastPollTime = 0;
        
        this.dripInterval = 800;
        this.animationSpeed = 1.0;
        
        this.pingFails = 0;
        this.lastDrip = 0;
        this.lastSlot = 0;
        
        this.cFillCount = 0;
    }

    async pollWords() {
        if (!this.networkAlive || currentState < STATES.BUFFER) return;
        try {
            const res = await fetch(`/api/words?since=${this.lastPollTime}`);
            if (res.ok) {
                const data = await res.json();
                if (data.words.length > 0) {
                    const newWords = data.words.map(w => ({ id: w.id, text: w.text }));
                    this.realWords.push(...newWords);
                }
                this.lastPollTime = data.serverTime;
            }
        } catch (e) {
            // silent fail
        }
    }

    async ping() {
        try {
            const res = await fetch('/api/ping');
            if (res.ok) {
                this.pingFails = 0;
                this.setNetwork(true);
            } else {
                this.pingFails++;
            }
        } catch(e) {
            this.pingFails++;
        }
        
        if (this.pingFails >= 2) {
            this.setNetwork(false);
        }
    }
    
    setNetwork(alive) {
        if (this.networkAlive !== alive) {
            this.networkAlive = alive;
            if (!alive) {
                lbToggleContainer.classList.add('hidden');
                leaderboardPanel.classList.add('hidden');
                this.dripInterval = 500;
                this.animationSpeed = 1.4;
            } else {
                if (currentState >= STATES.STORM) {
                    lbToggleContainer.classList.remove('hidden');
                }
                this.dripInterval = 800;
                this.animationSpeed = 1.0;
            }
        }
    }

    tick(now) {
        if (currentState < STATES.STORM) return;

        this.isFastMode = this.realWords.length > 10;
        this.animationSpeed = this.isFastMode ? 3.0 : (this.networkAlive ? 1.0 : 1.4);
        const currentDrip = this.isFastMode ? 80 : this.dripInterval;

        // Drip logic
        if (now - this.lastDrip > currentDrip) {
            this.lastDrip = now;
            const unassigned = this.activeWords.filter(w => w.phase === 'entering' || w.phase === 'drifting').length;
            
            if (unassigned < (this.isFastMode ? 20 : 8)) {
                let objToDrop = null;
                if (this.manualWords.length > 0) {
                    objToDrop = { id: null, text: this.manualWords.shift() };
                } else if (this.realWords.length > 0) {
                    objToDrop = this.realWords.shift();
                }
                
                if (objToDrop) {
                    this.spawnWord(objToDrop);
                }
            }
        }

        // Slot Assignment logic
        const slotInterval = this.isFastMode ? 100 : 500;
        if (now - this.lastSlot > slotInterval) {
            this.lastSlot = now;
            this.assignSlots();
        }
    }

    spawnWord(obj) {
        const text = obj.text;
        const id = obj.id;
        const edge = Math.floor(Math.random() * 4);
        let sx, sy;
        if (edge === 0) { sx = Math.random() * width; sy = -50; } // top
        else if (edge === 1) { sx = width + 50; sy = Math.random() * height; } // right
        else if (edge === 2) { sx = Math.random() * width; sy = height + 50; } // bottom
        else { sx = -50; sy = Math.random() * height; } // left

        // angle drift
        const dx = (Math.random() - 0.5) * 1.0;
        const dy = (Math.random() - 0.5) * 1.0;

        this.activeWords.push({
            id,
            text,
            x: sx,
            y: sy,
            dx,
            dy,
            targetX: null,
            targetY: null,
            rotation: (Math.random() * 30 - 15) * Math.PI / 180, // max ±15 deg
            rotSpeed: (Math.random() - 0.5) * 0.02,
            fontSize: Math.random() * 7 + 11, // 11 to 18
            opacity: this.isFastMode ? 1 : 0,
            phase: this.isFastMode ? 'drifting' : 'entering',
            letter: null
        });
    }

    assignSlots() {
        const drifting = this.activeWords.filter(w => w.phase === 'drifting' && !w.toRemove);
        if (drifting.length === 0) return;
        
        const word = drifting[0];
        
        ctx.font = `${word.fontSize}px 'Kalam', cursive`;
        const mWidth = ctx.measureText(word.text).width;
        // Even tighter tolerance for bounding box (50%)
        const wBox = { width: mWidth * 0.5, height: word.fontSize * 0.5 };
        
        const settledBoxes = this.activeWords
            .filter(w => (w.phase === 'settled' || w.phase === 'settling') && !w.toRemove && w.targetX !== null)
            .map(w => {
                ctx.font = `${w.fontSize}px 'Kalam', cursive`;
                return {
                    x: w.targetX,
                    y: w.targetY,
                    width: ctx.measureText(w.text).width * 0.5,
                    height: w.fontSize * 0.5
                };
            });
            
        function checkOverlap(x, y, box, boxes) {
            const r1 = { left: x - box.width/2, right: x + box.width/2, top: y - box.height/2, bottom: y + box.height/2 };
            for (let b of boxes) {
                const r2 = { left: b.x - b.width/2, right: b.x + b.width/2, top: b.y - b.height/2, bottom: b.y + b.height/2 };
                if (r1.left < r2.right && r1.right > r2.left && r1.top < r2.bottom && r1.bottom > r2.top) {
                    return true;
                }
            }
            return false;
        }
        
        let targetLetter = null;
        let availableSlot = null;

        let aSlots = letterSlots.A.filter(s => !s.assigned);
        let rSlots = letterSlots.R.filter(s => !s.assigned);
        let cSlots = letterSlots.C.filter(s => !s.assigned);

        const aFilled = letterSlots.A.length - aSlots.length;
        const rFilled = letterSlots.R.length - rSlots.length;
        const cFilled = letterSlots.C.length - cSlots.length;
        const totalAssigned = totalSlots - (aSlots.length + rSlots.length + cSlots.length);
        
        // Log stats
        if (Math.random() < 0.1) { // Throttle logs
            console.log(`Slots filled: A=${aFilled}/${letterSlots.A.length} (${Math.round(aFilled/letterSlots.A.length*100)}%), R=${rFilled}/${letterSlots.R.length} (${Math.round(rFilled/letterSlots.R.length*100)}%), C=${cFilled}/${letterSlots.C.length} (${Math.round(cFilled/letterSlots.C.length*100)}%)`);
        }
        
        // Secondary pass if everything is mostly full or completely exhausted
        let secondaryPass = false;
        if (totalAssigned / totalSlots > 0.85 || (aSlots.length === 0 && rSlots.length === 0 && cSlots.length === 0)) {
            secondaryPass = true;
        }
        
        let lettersToCheck = [];
        if (aSlots.length > 0 || secondaryPass) lettersToCheck.push('A');
        if (rSlots.length > 0 || secondaryPass) lettersToCheck.push('R');
        if (cSlots.length > 0 || secondaryPass || rFilled > letterSlots.R.length * 0.4) lettersToCheck.push('C');
        
        // Shuffle to distribute evenly among unlocked letters
        lettersToCheck.sort(() => Math.random() - 0.5);
        
        for (let letter of lettersToCheck) {
            // In secondary pass, pick randomly from all slots for this letter
            const slots = (secondaryPass || letterSlots[letter].filter(s => !s.assigned).length === 0) 
                            ? letterSlots[letter] 
                            : letterSlots[letter].filter(s => !s.assigned);
            
            const randomizedSlots = [...slots].sort(() => Math.random() - 0.5);
            for (let s of randomizedSlots) {
                if (!checkOverlap(s.x, s.y, wBox, settledBoxes)) {
                    availableSlot = s;
                    targetLetter = letter;
                    break;
                }
            }
            if (availableSlot) break;
        }

        if (availableSlot) {
            availableSlot.assigned = true;
            word.slot = availableSlot;
            word.targetX = availableSlot.x;
            word.targetY = availableSlot.y;
            word.phase = 'settling';
            word.letter = targetLetter;
            
            if (targetLetter === 'C') {
                this.cFillCount++;
                const pct = this.cFillCount / letterSlots.C.length;
                if (pct > 0.85 && currentState === STATES.STORM) {
                    transitionTo(STATES.REVEAL_ARC);
                }
            }
        }
    }
    
    forceSettleAll() {
        this.activeWords.forEach(w => {
            if (w.phase === 'drifting' || w.phase === 'entering') {
                w.opacity = 0; 
                w.toRemove = true;
            }
        });
    }

    removeStruckWords(struckIds) {
        this.activeWords.forEach(w => {
            if (w.id && struckIds.includes(w.id)) {
                if (w.phase === 'settled' || w.phase === 'settling') {
                    if (!w.isFadingOut) {
                        w.isFadingOut = true;
                    }
                } else if (w.phase === 'drifting' || w.phase === 'entering') {
                    w.toRemove = true;
                }
            }
        });
    }
}

let pool;

// Animation Loop
let lastFrameTime = performance.now();

function render(now) {
    if (!pool) return requestAnimationFrame(render);
    const dt = (now - lastFrameTime) * pool.animationSpeed;
    lastFrameTime = now;

    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw Glow if REVEAL_ARC
    if (currentState >= STATES.REVEAL_ARC) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
    } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    // Update and Draw Words
    // Drifting repulsion
    const drifters = pool.activeWords.filter(w => w.phase === 'drifting' && !w.toRemove);
    for (let i = 0; i < drifters.length; i++) {
        for (let j = i + 1; j < drifters.length; j++) {
            const w1 = drifters[i];
            const w2 = drifters[j];
            const dx = w1.x - w2.x;
            const dy = w1.y - w2.y;
            const dist2 = dx*dx + dy*dy;
            if (dist2 < 900 && dist2 > 0) { // 30px
                const dist = Math.sqrt(dist2);
                const force = 0.5 * dt * 0.05; // per frame scaled to dt
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                w1.x += fx; w1.y += fy;
                w2.x -= fx; w2.y -= fy;
            }
        }
    }

    for (let i = pool.activeWords.length - 1; i >= 0; i--) {
        const w = pool.activeWords[i];
        
        if (w.toRemove) {
            if (w.slot) w.slot.assigned = false;
            pool.activeWords.splice(i, 1);
            continue;
        }

        if (w.isFadingOut) {
            w.opacity -= dt * 0.0025;
            if (w.opacity <= 0) {
                w.opacity = 0;
                w.toRemove = true;
            }
        }

        if (w.phase === 'entering') {
            w.x += w.dx * dt * 0.05;
            w.y += w.dy * dt * 0.05;
            w.rotation += w.rotSpeed * dt * 0.05;
            w.opacity += 0.05;
            if (w.opacity >= 1) {
                w.opacity = 1;
                w.phase = 'drifting';
            }
        } else if (w.phase === 'drifting') {
            w.x += w.dx * dt * 0.05;
            w.y += w.dy * dt * 0.05;
            w.rotation += w.rotSpeed * dt * 0.05;
            
            // Clamp strictly to canvas bounds so nothing rotates off screen
            const padding = w.fontSize * 3;
            w.x = Math.max(padding, Math.min(width - padding, w.x));
            w.y = Math.max(padding, Math.min(height - padding, w.y));
            
        } else if (w.phase === 'settling') {
            // Spring physics
            const stiffness = pool.isFastMode ? 0.15 : 0.06;
            const damping = pool.isFastMode ? 0.8 : 0.75;
            
            if(!w.vx) w.vx = 0;
            if(!w.vy) w.vy = 0;
            
            const ax = (w.targetX - w.x) * stiffness;
            const ay = (w.targetY - w.y) * stiffness;
            
            w.vx = (w.vx + ax) * damping;
            w.vy = (w.vy + ay) * damping;
            
            w.x += w.vx;
            w.y += w.vy;
            
            // near-zero rotation for crisp letters
            w.rotation *= 0.85;
            if (Math.abs(w.rotation) < 0.5) w.rotation = 0;
            
            const dist = Math.sqrt(Math.pow(w.targetX - w.x, 2) + Math.pow(w.targetY - w.y, 2));
            if (dist < 2 && Math.abs(w.vx) < 0.1) {
                w.phase = 'settled';
                w.x = w.targetX;
                w.y = w.targetY;
                w.rotation = 0;
                w.breathOffset = Math.random() * Math.PI * 2;
            }
        } else if (w.phase === 'settled') {
            // Breathing / Celebrate ripple
            let scale = 1.0;
            if (currentState >= STATES.REVEAL_ARC) {
                // stop breathing when revealed, handle ripple if REVEAL_CREDIT active
                if (currentState === STATES.REVEAL_CREDIT && arcScaleAnimStart > 0) {
                    const elapsed = now - arcScaleAnimStart;
                    if (elapsed < 600) {
                        // Ripple 1.0 -> 1.05 -> 1.0 over 600ms
                        const p = elapsed / 600;
                        scale = 1.0 + Math.sin(p * Math.PI) * 0.05;
                    }
                }
            } else {
                scale = 0.99 + 0.01 * Math.sin(now * 0.002 + w.breathOffset);
            }
            w.currentScale = scale;
        }

        // Draw
        if (w.opacity > 0 && !w.toRemove) {
            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate(w.rotation);
            if (w.currentScale) ctx.scale(w.currentScale, w.currentScale);
            
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, w.opacity)})`;
            ctx.font = `${w.fontSize}px 'Kalam', cursive`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(w.text, 0, 0);
            
            ctx.restore();
        }
    }
    
    // Pool tick
    pool.tick(now);

    requestAnimationFrame(render);
}

// Reveal Animation Tracking
let arcScaleAnimStart = 0;

async function pollRevealState() {
    if (currentState < STATES.BUFFER) return;
    try {
        const res = await fetch('/api/reveal/state');
        if (res.ok) {
            const data = await res.json();
            if (data.tech && currentState < STATES.REVEAL_TECH) {
                transitionTo(STATES.REVEAL_TECH);
            }
            if (data.credit && currentState < STATES.REVEAL_CREDIT) {
                transitionTo(STATES.REVEAL_CREDIT);
            }
        }
    } catch (e) {}
}

// Transitions
function transitionTo(newState) {
    if (newState <= currentState) return;
    currentState = newState;

    if (currentState === STATES.BUFFER) {
        loadingScreen.classList.remove('active');
        bufferMessage.classList.remove('hidden');
        btnStart.classList.add('hidden');
        
        // Start polling
        setInterval(() => pool.pollWords(), POLL_INTERVAL);
        setInterval(() => pool.ping(), PING_INTERVAL);
        setInterval(fetchLeaderboard, LB_POLL_INTERVAL);
        setInterval(pollStruckWords, STRUCK_POLL_INTERVAL);
        setInterval(pollRevealState, 1500);
        
        // Buffer timeout
        setTimeout(() => {
            transitionTo(STATES.STORM);
        }, BUFFER_DURATION);

    } else if (currentState === STATES.STORM) {
        bufferMessage.classList.add('hidden');
        if (pool.networkAlive) {
            lbToggleContainer.classList.remove('hidden');
        }
        
    } else if (currentState === STATES.REVEAL_ARC) {
        pool.forceSettleAll();
        btnRevealTech.classList.remove('hidden');
        
    } else if (currentState === STATES.REVEAL_TECH) {
        techText.classList.add('revealed');
        
    } else if (currentState === STATES.REVEAL_CREDIT) {
        // Dramatic 300ms pause then show credit and start ripple
        setTimeout(() => {
            creditLine.classList.add('revealed');
            arcScaleAnimStart = performance.now();
        }, 300);
    }
}

// Manual Input
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'W' && manualInput) {
        manualInput.classList.add('active');
        manualInput.focus();
    }
    if (e.key === 'Escape' && manualInput) {
        manualInput.classList.remove('active');
        manualInput.value = '';
    }
});

if (manualInput) {
    manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = manualInput.value.trim();
            if (val && pool) {
                pool.manualWords.push(val);
            }
            manualInput.value = '';
            manualInput.classList.remove('active');
        }
    });
}

async function pollStruckWords() {
    try {
        const res = await fetch('/api/words/struck');
        const { struckIds } = await res.json();
        if (pool) pool.removeStruckWords(struckIds);
    } catch (e) {
        // silent fail
    }
}

// Leaderboard
async function fetchLeaderboard() {
    if (!pool || !pool.leaderboardEnabled || !pool.networkAlive) return;
    try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
            const data = await res.json();
            renderLeaderboard(data.leaderboard);
        }
    } catch (e) {}
}

function renderLeaderboard(data) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    const top8 = data.slice(0, 8);
    top8.forEach(p => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `[${p.serial}] ${p.name}`;
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'lb-score';
        scoreSpan.textContent = p.count;
        
        row.appendChild(nameSpan);
        row.appendChild(scoreSpan);
        leaderboardList.appendChild(row);
    });
}

// QR Code Init
async function initQR() {
    const urlDisplay = document.getElementById('url-display');
    const qrDiv = document.getElementById('qr-code');
    if (!urlDisplay || !qrDiv) return;
    
    const INTRANET_URL = 'http://172.31.3.109:4521/player/';
    const finalUrl = INTRANET_URL;

    qrDiv.innerHTML = '';
    
    new QRCode(qrDiv, {
        text: finalUrl,
        width: 220,
        height: 220,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    urlDisplay.textContent = finalUrl;
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Host Events
    if (btnStart) btnStart.addEventListener('click', () => transitionTo(STATES.BUFFER));

    if (toggleLb) {
        toggleLb.addEventListener('change', (e) => {
            if (!pool) return;
            pool.leaderboardEnabled = e.target.checked;
            if (pool.leaderboardEnabled && pool.networkAlive) {
                if (leaderboardPanel) leaderboardPanel.classList.remove('hidden');
                fetchLeaderboard();
            } else {
                if (leaderboardPanel) leaderboardPanel.classList.add('hidden');
            }
        });
    }
    
    pool = new PoolManager();
    initQR();
    requestAnimationFrame(render);
});
