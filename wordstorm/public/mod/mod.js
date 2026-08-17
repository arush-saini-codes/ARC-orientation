const feedList = document.getElementById('feed-list');
const playerList = document.getElementById('player-list');

let lastFeedTime = 0;
let feedWords = [];
let playersData = [];

// API Calls
async function fetchFeed() {
    try {
        const res = await fetch(`/api/moderate/feed`);
        const data = await res.json();
        feedWords = data.words;
        renderFeed();
    } catch (err) {
        console.error("Failed to fetch feed", err);
    }
}

async function fetchPlayers() {
    try {
        const res = await fetch(`/api/moderate/players`);
        const data = await res.json();
        playersData = data.players;
        renderPlayers();
    } catch (err) {
        console.error("Failed to fetch players", err);
    }
}

async function strikeWord(id) {
    try {
        const res = await fetch('/api/moderate/strike', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wordId: id })
        });
        if (res.ok) {
            // Optimistic update
            const word = feedWords.find(w => w.id === id);
            if (word) word.struck = 1;
            renderFeed();
        }
    } catch (err) {
        alert("Failed to strike word");
    }
}

async function disqualifyPlayer(serial, name) {
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
        }
    } catch (err) {
        alert("Failed to disqualify player");
    }
}

// Rendering
function renderFeed() {
    feedList.innerHTML = '';
    feedWords.forEach(word => {
        const row = document.createElement('div');
        row.className = `feed-row ${word.struck ? 'struck' : ''}`;
        
        row.innerHTML = `
            <div>
                <span class="feed-meta">[${word.serial}] ${escapeHTML(word.name)}</span>
                <span class="feed-text">"${escapeHTML(word.text)}"</span>
            </div>
            <button class="strike-btn" onclick="strikeWord(${word.id})" ${word.struck ? 'disabled' : ''}>
                ${word.struck ? 'Struck' : 'Strike'}
            </button>
        `;
        feedList.appendChild(row);
    });
}

function renderPlayers() {
    playerList.innerHTML = '';
    playersData.forEach(player => {
        const row = document.createElement('div');
        row.className = `player-row ${player.disqualified ? 'dq' : ''}`;
        
        row.innerHTML = `
            <div>
                <div class="player-name">
                    ${player.serial} — ${escapeHTML(player.name)}
                    ${player.disqualified ? '<span class="dq-badge">(DQ)</span>' : ''}
                </div>
                <div class="player-stats">Words: ${player.count}</div>
            </div>
            <button class="dq-btn" onclick="disqualifyPlayer('${player.serial}', '${escapeHTML(player.name).replace(/'/g, "\\'")}')" ${player.disqualified ? 'disabled' : ''}>
                ${player.disqualified ? 'Disqualified' : 'Disqualify'}
            </button>
        `;
        playerList.appendChild(row);
    });
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
setInterval(fetchFeed, 2000);
setInterval(fetchPlayers, 5000);

// Initial Load
fetchFeed();
fetchPlayers();

// Flow toggle logic
let isFlowing = false;
const flowBtn = document.getElementById('flow-btn');
flowBtn.addEventListener('click', async () => {
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
            flowBtn.textContent = '⏹ Stop Flow';
            flowBtn.classList.add('active');
        } else {
            flowBtn.textContent = '▶ Flow Words';
            flowBtn.classList.remove('active');
        }
    } catch (err) {
        alert("Failed to toggle flow");
    }
});

// Reveal Logic
const btnTech = document.getElementById('btn-mod-reveal-tech');
const btnCredit = document.getElementById('btn-mod-show-credit');

async function initRevealState() {
    try {
        const res = await fetch('/api/reveal/state');
        if (res.ok) {
            const data = await res.json();
            if (data.tech) {
                btnTech.disabled = true;
                btnTech.classList.add('revealed');
                btnTech.textContent = '✓ TECH Revealed';
                btnCredit.disabled = false;
            }
            if (data.credit) {
                btnCredit.disabled = true;
                btnCredit.classList.add('revealed');
                btnCredit.textContent = '✓ Credit Shown';
            }
        }
    } catch (e) {}
}
initRevealState();

btnTech.addEventListener('click', async () => {
    if (!confirm("Reveal TECH? This cannot be undone.")) return;
    try {
        await fetch('/api/reveal/tech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true })
        });
        btnTech.disabled = true;
        btnTech.classList.add('revealed');
        btnTech.textContent = '✓ TECH Revealed';
        btnCredit.disabled = false;
    } catch (err) {}
});

btnCredit.addEventListener('click', async () => {
    if (!confirm("Show Credit? This cannot be undone.")) return;
    try {
        await fetch('/api/reveal/credit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true })
        });
        btnCredit.disabled = true;
        btnCredit.classList.add('revealed');
        btnCredit.textContent = '✓ Credit Shown';
    } catch (err) {}
});
