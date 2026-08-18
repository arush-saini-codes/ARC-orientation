const CORRECT_PIN = '2025';

const TECH_WORDS = new Set([
  'python', 'javascript', 'java', 'cpp', 'c', 'rust', 'go',
  'typescript', 'swift', 'kotlin', 'php', 'ruby', 'scala',
  'html', 'css', 'sql', 'bash', 'shell', 'assembly', 'matlab',
  'git', 'github', 'docker', 'kubernetes', 'linux', 'ubuntu',
  'windows', 'macos', 'arduino', 'raspberrypi', 'figma', 'notion',
  'slack', 'vscode', 'terminal', 'postman', 'webpack', 'npm',
  'algorithm', 'loop', 'array', 'function', 'variable', 'boolean',
  'binary', 'stack', 'queue', 'recursion', 'pointer', 'class',
  'object', 'inheritance', 'api', 'debug', 'compile', 'deploy',
  'iterate', 'syntax', 'logic', 'condition', 'exception', 'thread',
  'process', 'memory', 'cache', 'buffer', 'index', 'hash',
  'server', 'cloud', 'database', 'network', 'firewall', 'protocol',
  'packet', 'router', 'dns', 'http', 'https', 'ssh', 'aws',
  'azure', 'firebase', 'mongodb', 'postgres', 'redis', 'graphql',
  'rest', 'websocket', 'cdn', 'load', 'bandwidth', 'latency',
  'cpu', 'gpu', 'ram', 'ssd', 'motherboard', 'chip', 'circuit',
  'processor', 'transistor', 'byte', 'pixel', 'sensor', 'battery',
  'ai', 'ml', 'neural', 'deep', 'data', 'model', 'train',
  'dataset', 'predict', 'automate', 'robot', 'drone', 'iot',
  'blockchain', 'metaverse', 'vr', 'ar', 'llm', 'gpt', 'prompt',
  'startup', 'hackathon', 'devops', 'agile', 'scrum', 'sprint',
  'build', 'ship', 'code', 'hack', 'innovate', 'create', 'solve',
  'engineer', 'design', 'dream', 'make', 'launch', 'future',
  'connect', 'scale', 'commit', 'push', 'pull',
  'branch', 'merge', 'open-source', 'framework', 'library',
  'frontend', 'backend', 'fullstack', 'devrel'
]);

function initPinScreen() {
    const pinScreen = document.getElementById('pin-screen');
    const mainPanel = document.getElementById('main-panel');
    const pinInput = document.getElementById('pin-input');
    const pinSubmit = document.getElementById('pin-submit');
    const pinError = document.getElementById('pin-error');

    if (sessionStorage.getItem('mod_authed') === 'true') {
        pinScreen.style.display = 'none';
        mainPanel.style.display = 'flex';
        initModerator();
        return;
    }

    function tryPin() {
        if (pinInput.value === CORRECT_PIN) {
            sessionStorage.setItem('mod_authed', 'true');
            pinScreen.style.display = 'none';
            mainPanel.style.display = 'flex';
            initModerator();
        } else {
            pinError.style.display = 'block';
            pinInput.value = '';
            pinInput.focus();
        }
    }

    pinSubmit.addEventListener('click', tryPin);
    pinInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') tryPin();
    });
    pinInput.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    initPinScreen();
});

function initModerator() {
    // Top Bar
    const btnRevealTech = document.getElementById('btn-reveal-tech');
    const btnShowCredit = document.getElementById('btn-show-credit');
    const contestToggleBtn = document.getElementById('contest-toggle');
    const statPlayers = document.getElementById('stat-players');
    const statWords = document.getElementById('stat-words');
    const statStruck = document.getElementById('stat-struck');
    const statRate = document.getElementById('stat-rate');
    const btnLeaderboard = document.getElementById('btn-leaderboard');

    // Panels
    const feedSearch = document.getElementById('feed-search');
    const feedAutoscroll = document.getElementById('autoscroll');
    const batchStrikeBtn = document.getElementById('strike-selected');
    const feedList = document.getElementById('feed-list');

    const playerCountSpan = document.getElementById('player-count');
    const playerSearch = document.getElementById('player-search');
    const playerSort = document.getElementById('player-sort');
    const playerList = document.getElementById('player-list');

    const flaggedList = document.getElementById('flagged-list');

    // Bottom Bar
    const flowToggleBtn = document.getElementById('flow-toggle');
    const flowSpeedSpan = document.getElementById('flow-speed');
    const clearSystemBtn = document.getElementById('clear-system');

    // Leaderboard Overlay
    const lbOverlay = document.getElementById('leaderboard-overlay');
    const lbPodium = document.getElementById('lb-podium');
    const lbRest = document.getElementById('lb-rest');
    const lbRefreshBtn = document.getElementById('lb-refresh');
    const lbCloseBtn = document.getElementById('lb-close');

    // State
    let feedWords = [];
    let playersData = [];
    let flaggedWords = [];
    let feedSearchQuery = '';
    let playerSearchQuery = '';
    let currentPlayerSort = 'words';
    let contestOpen = true;
    let isFlowing = false;
    let expandedPlayer = null;

    // ----- CONTEST TOGGLE -----
    contestToggleBtn.addEventListener('click', async () => {
        const willClose = contestOpen;
        if (willClose && !confirm("Close contest? Players will stop being able to submit words.")) {
            return;
        }
        try {
            const res = await fetch('/api/contest/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ open: !willClose })
            });
            const data = await res.json();
            updateContestToggleUI(data.contestOpen);
        } catch (e) {}
    });

    function updateContestToggleUI(isOpen) {
        contestOpen = isOpen;
        if (isOpen) {
            contestToggleBtn.textContent = '🟢 OPEN';
            contestToggleBtn.className = 'contest-open-compact';
        } else {
            contestToggleBtn.textContent = '🔴 CLOSED';
            contestToggleBtn.className = 'contest-open-compact contest-closed-compact';
        }
    }
    
    async function initContestState() {
        try {
            const res = await fetch('/api/contest/state');
            const data = await res.json();
            updateContestToggleUI(data.contestOpen);
        } catch(e){}
    }
    initContestState();

    // ----- REVEAL LOGIC -----
    async function initRevealState() {
        try {
            const res = await fetch('/api/reveal/state');
            if (res.ok) {
                const data = await res.json();
                if (data.tech) {
                    btnRevealTech.disabled = true;
                    btnRevealTech.classList.add('confirmed');
                    btnRevealTech.textContent = '✓ TECH Revealed';
                    btnShowCredit.disabled = false;
                }
                if (data.credit) {
                    btnShowCredit.disabled = true;
                    btnShowCredit.classList.add('confirmed');
                    btnShowCredit.textContent = '✓ Credit Shown';
                }
            }
        } catch (e) {}
    }
    initRevealState();

    btnRevealTech.addEventListener('click', async () => {
        if (!confirm("Reveal TECH? This cannot be undone.")) return;
        try {
            await fetch('/api/reveal/tech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: true })
            });
            btnRevealTech.disabled = true;
            btnRevealTech.classList.add('confirmed');
            btnRevealTech.textContent = '✓ TECH Revealed';
            btnShowCredit.disabled = false;
        } catch (err) {}
    });

    btnShowCredit.addEventListener('click', async () => {
        if (!confirm("Show Credit? This cannot be undone.")) return;
        try {
            await fetch('/api/reveal/credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: true })
            });
            btnShowCredit.disabled = true;
            btnShowCredit.classList.add('confirmed');
            btnShowCredit.textContent = '✓ Credit Shown';
        } catch (err) {}
    });

    // ----- STATS -----
    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            statPlayers.textContent = data.totalPlayers;
            statWords.textContent = data.acceptedWords;
            statStruck.textContent = data.struckWords;
            statRate.textContent = data.wordsPerMinute;
            flowSpeedSpan.textContent = `${data.wordsPerMinute} words/min`;
            
            if (data.flowActive !== isFlowing) {
                isFlowing = data.flowActive;
                if (isFlowing) {
                    flowToggleBtn.textContent = '⏹ Stop Flow';
                    flowToggleBtn.classList.add('active');
                } else {
                    flowToggleBtn.textContent = '▶ Flow Words';
                    flowToggleBtn.classList.remove('active');
                }
            }
        } catch (e) {}
    }

    flowToggleBtn.addEventListener('click', async () => {
        isFlowing = !isFlowing;
        try {
            const res = await fetch('/api/moderate/flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: isFlowing })
            });
            const data = await res.json();
            isFlowing = data.active;
            if (isFlowing) {
                flowToggleBtn.textContent = '⏹ Stop Flow';
                flowToggleBtn.classList.add('active');
            } else {
                flowToggleBtn.textContent = '▶ Flow Words';
                flowToggleBtn.classList.remove('active');
            }
            fetchStats();
        } catch (err) {}
    });

    clearSystemBtn.addEventListener('click', async () => {
        if (!confirm("Strike all SYSTEM words from the projector?")) return;
        try {
            await fetch('/api/moderate/clear-system', { method: 'POST' });
            fetchFeed();
            fetchStats();
        } catch (err) {}
    });

    // ----- FEED LOGIC -----
    async function fetchFeed() {
        try {
            const res = await fetch(`/api/moderate/feed`);
            const data = await res.json();
            feedWords = data.words;
            renderFeed();
        } catch (err) { }
    }

    feedSearch.addEventListener('input', (e) => {
        feedSearchQuery = e.target.value.toLowerCase();
        renderFeed();
    });

    window.strikeWord = async function(id) {
        try {
            const res = await fetch('/api/moderate/strike', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId: id })
            });
            if (res.ok) {
                const word = feedWords.find(w => w.id === id);
                if (word) word.struck = 1;
                renderFeed();
                fetchStats();
                fetchFlagged();
            }
        } catch (err) { }
    };

    batchStrikeBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.feed-checkbox:checked');
        const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (ids.length === 0) return;
        
        try {
            await fetch('/api/moderate/strike-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordIds: ids })
            });
            fetchFeed();
            fetchStats();
            fetchFlagged();
        } catch (e) {}
    });

    function renderFeed() {
        const wasAtBottom = feedList.scrollTop + feedList.clientHeight >= feedList.scrollHeight - 20;
        
        feedList.innerHTML = '';
        const now = Date.now();
        
        const filtered = feedWords.filter(w => 
            w.serial.toLowerCase().includes(feedSearchQuery) || 
            (w.name && w.name.toLowerCase().includes(feedSearchQuery)) ||
            w.text.toLowerCase().includes(feedSearchQuery)
        );

        filtered.forEach(word => {
            const row = document.createElement('div');
            let classes = ['feed-row'];
            
            const isTech = TECH_WORDS.has(word.text.toLowerCase());
            classes.push(isTech ? 'word-tech' : 'word-nonttech');
            
            if (word.struck) classes.push('struck');
            else if (now - word.timestamp < 3000) classes.push('new-word');
            row.className = classes.join(' ');
            
            const timeAgo = Math.floor((now - word.timestamp) / 1000);
            const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo/60)}m ago`;

            row.innerHTML = `
                <input type="checkbox" class="feed-checkbox" value="${word.id}" ${word.struck ? 'disabled' : ''}>
                <div class="feed-serial">[${word.serial}]</div>
                <div class="feed-name">${escapeHTML(word.name || 'SYSTEM')}</div>
                <div class="feed-word">"${escapeHTML(word.text)}"</div>
                <div class="feed-time">${timeStr}</div>
                <button class="btn-strike" onclick="strikeWord(${word.id})" ${word.struck ? 'disabled' : ''}>
                    ${word.struck ? 'Struck' : 'Strike'}
                </button>
            `;
            feedList.appendChild(row);
        });
        
        if (feedAutoscroll.checked && wasAtBottom) {
            feedList.scrollTop = feedList.scrollHeight;
        }
    }

    // ----- PLAYERS LOGIC -----
    async function fetchPlayers() {
        try {
            const res = await fetch(`/api/moderate/players`);
            const data = await res.json();
            playersData = data.players;
            playerCountSpan.textContent = playersData.length;
            renderPlayers();
        } catch (err) { }
    }

    playerSearch.addEventListener('input', (e) => {
        playerSearchQuery = e.target.value.toLowerCase();
        renderPlayers();
    });
    
    playerSort.addEventListener('change', (e) => {
        currentPlayerSort = e.target.value;
        renderPlayers();
    });

    window.disqualifyPlayer = async function(serial, name) {
        if (!confirm(`Disqualify ${serial} ${name}? This zeroes their count and blocks further submissions.`)) {
            return;
        }
        try {
            const res = await fetch('/api/moderate/disqualify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serial })
            });
            if (res.ok) {
                fetchPlayers();
                fetchFeed();
                fetchStats();
            }
        } catch (err) { }
    };

    window.togglePlayerRow = async function(serial) {
        if (expandedPlayer === serial) {
            expandedPlayer = null;
            renderPlayers();
            return;
        }
        expandedPlayer = serial;
        renderPlayers();
    }

    function renderPlayers() {
        playerList.innerHTML = '';
        
        let filtered = playersData.filter(p => 
            p.serial.toLowerCase().includes(playerSearchQuery) || 
            p.name.toLowerCase().includes(playerSearchQuery)
        );
        
        if (currentPlayerSort === 'words') {
            filtered.sort((a, b) => b.count - a.count);
        } else if (currentPlayerSort === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else if (currentPlayerSort === 'time') {
            filtered.sort((a, b) => b.serial.localeCompare(a.serial)); 
        }

        let rank = 1;
        filtered.forEach(player => {
            const rowWrapper = document.createElement('div');
            
            let classes = ['player-row'];
            if (player.disqualified) classes.push('dq');
            else if (currentPlayerSort === 'words' && !playerSearchQuery && rank <= 3 && player.count > 0) {
                classes.push(`rank-${rank}`);
                rank++;
            }
            if (expandedPlayer === player.serial) classes.push('expanded');
            rowWrapper.className = classes.join(' ');
            
            rowWrapper.innerHTML = `
                <div class="player-main" onclick="togglePlayerRow('${player.serial}')">
                    <div class="player-serial">[${player.serial}]</div>
                    <div class="player-name">${escapeHTML(player.name)}</div>
                    <div class="player-count">${player.count} words</div>
                    <button class="btn-dq" onclick="disqualifyPlayer('${player.serial}', '${escapeHTML(player.name).replace(/'/g, "\\'")}')" ${player.disqualified ? 'disabled' : ''}>
                        ${player.disqualified ? 'DQ\'d' : 'DQ'}
                    </button>
                </div>
            `;
            
            if (expandedPlayer === player.serial) {
                const wordsDiv = document.createElement('div');
                wordsDiv.className = 'player-words';
                wordsDiv.innerHTML = '<span style="font-size:11px; color:#888;">Loading...</span>';
                rowWrapper.appendChild(wordsDiv);
                
                fetch(`/api/moderate/player-words/${player.serial}`)
                    .then(r => r.json())
                    .then(data => {
                        wordsDiv.innerHTML = '';
                        if (data.words.length === 0) {
                            wordsDiv.innerHTML = '<span style="font-size:11px; color:#888;">No words.</span>';
                        }
                        data.words.forEach(w => {
                            const isTech = TECH_WORDS.has(w.text.toLowerCase());
                            const chip = document.createElement('div');
                            chip.className = `chip ${isTech ? 'chip-tech' : 'chip-nontech'} ${w.struck ? 'chip-struck' : ''}`;
                            chip.innerHTML = `${escapeHTML(w.text)}`;
                            
                            chip.onclick = (e) => {
                                e.stopPropagation();
                                if (!w.struck) {
                                    strikeWord(w.id);
                                    chip.classList.add('chip-struck');
                                }
                            };
                            wordsDiv.appendChild(chip);
                        });
                    });
            }

            playerList.appendChild(rowWrapper);
        });
    }

    // ----- FLAGGED LOGIC -----
    async function fetchFlagged() {
        try {
            const res = await fetch(`/api/moderate/flagged`);
            const data = await res.json();
            flaggedWords = data.flagged;
            renderFlagged();
        } catch (err) { }
    }

    window.ignoreFlag = async function(id) {
        try {
            const res = await fetch('/api/moderate/ignore-flag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId: id })
            });
            if (res.ok) fetchFlagged();
        } catch (err) { }
    };

    function renderFlagged() {
        flaggedList.innerHTML = '';
        flaggedWords.forEach(word => {
            const row = document.createElement('div');
            row.className = 'flagged-row';
            
            let reason = "Suspicious activity";
            if (word.text.length > 15) reason = "Word too long (>15)";
            else if (/^\d+$/.test(word.text)) reason = "Numbers only";
            else reason = "High frequency spam";

            row.innerHTML = `
                <div class="flagged-reason">⚠️ ${reason}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="feed-serial">[${word.serial}]</span> 
                        <span class="feed-name">${escapeHTML(word.name)}</span>
                        <div><strong>"${escapeHTML(word.text)}"</strong></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <button class="btn-strike" onclick="strikeWord(${word.id})">Strike</button>
                        <button class="btn-ignore" onclick="ignoreFlag(${word.id})">Ignore</button>
                    </div>
                </div>
            `;
            flaggedList.appendChild(row);
        });
    }

    // ----- LEADERBOARD OVERLAY LOGIC -----
    btnLeaderboard.addEventListener('click', () => {
        lbOverlay.classList.add('visible');
        fetchLeaderboardFull();
    });
    
    lbCloseBtn.addEventListener('click', () => {
        lbOverlay.classList.remove('visible');
    });
    
    lbRefreshBtn.addEventListener('click', fetchLeaderboardFull);

    async function fetchLeaderboardFull() {
        try {
            const res = await fetch('/api/leaderboard/full');
            const data = await res.json();
            renderLeaderboardFull(data.players);
        } catch (e) {}
    }

    function renderLeaderboardFull(players) {
        lbPodium.innerHTML = '';
        lbRest.innerHTML = '';

        if (players.length > 0) {
            lbPodium.innerHTML += `
                <div class="lb-gold">
                    🥇 1st: ${escapeHTML(players[0].name)} [${players[0].serial}] — ${players[0].wordCount} words
                </div>
            `;
        }
        if (players.length > 1) {
            lbPodium.innerHTML += `
                <div class="lb-silver">
                    🥈 2nd: ${escapeHTML(players[1].name)} [${players[1].serial}] — ${players[1].wordCount} words
                </div>
            `;
        }
        if (players.length > 2) {
            lbPodium.innerHTML += `
                <div class="lb-bronze">
                    🥉 3rd: ${escapeHTML(players[2].name)} [${players[2].serial}] — ${players[2].wordCount} words
                </div>
            `;
        }

        for (let i = 3; i < players.length; i++) {
            const p = players[i];
            lbRest.innerHTML += `
                <div class="lb-row">
                    <div class="lb-rank">#${i+1}</div>
                    <div class="lb-name">${escapeHTML(p.name)}</div>
                    <div class="lb-serial">[${p.serial}]</div>
                    <div class="lb-count">${p.wordCount} words</div>
                </div>
            `;
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Pollers
    setInterval(fetchStats, 3000);
    setInterval(fetchFeed, 2000);
    setInterval(fetchPlayers, 5000);
    setInterval(fetchFlagged, 3000);

    // Initial Load
    fetchStats();
    fetchFeed();
    fetchPlayers();
    fetchFlagged();
}
