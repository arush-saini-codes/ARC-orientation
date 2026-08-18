let playerSerial = null;
let playerName = null;

const screens = [
    document.getElementById('screen-1'),
    document.getElementById('screen-2'),
    document.getElementById('screen-3')
];

function showScreen(index) {
    screens.forEach((s, i) => {
        if (i === index) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });
    if (index === 2) {
        setTimeout(() => {
            const input = document.getElementById('word-input');
            if (input) input.focus();
        }, 100);
    }
}

// Initialization
(async function init() {
    try {
        const res = await fetch('/api/session');
        if (res.ok) {
            const data = await res.json();
            const currentSession = localStorage.getItem('arc_session');
            if (currentSession !== data.sessionId) {
                localStorage.removeItem('arc_serial');
                localStorage.removeItem('arc_name');
                localStorage.removeItem('arc_session');
                localStorage.removeItem('pendingWords');
                localStorage.setItem('arc_session', data.sessionId);
            }
        }
    } catch(e) {}

    const savedSerial = localStorage.getItem('arc_serial');
    const savedName = localStorage.getItem('arc_name');
    if (savedSerial && savedName) {
      playerSerial = savedSerial;
      playerName = savedName;
      document.getElementById('badge-serial').textContent = playerSerial;
      const reRegister = document.getElementById('re-register');
      if (reRegister) {
          reRegister.textContent = `Not ${playerSerial}? Tap to re-register`;
          reRegister.addEventListener('click', () => {
              localStorage.removeItem('arc_serial');
              localStorage.removeItem('arc_name');
              localStorage.removeItem('arc_session');
              window.location.reload();
          });
      }
      showScreen(2);
    } else {
      showScreen(0);
    }
})();

// Screen 1: Registration
const registerForm = document.getElementById('register-form');
const nameInput = document.getElementById('name-input');
const registerError = document.getElementById('register-error');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2) return;

    try {
        registerError.textContent = 'Registering...';
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            registerError.textContent = data.error || 'Registration failed.';
            return;
        }

        playerSerial = data.serial;
        playerName = data.name;
        
        localStorage.setItem('arc_serial', playerSerial);
        localStorage.setItem('arc_name', playerName);
        
        document.getElementById('serial-display').textContent = `You are ${playerSerial}`;
        document.getElementById('badge-serial').textContent = playerSerial;
        const reRegister = document.getElementById('re-register');
        if (reRegister) {
            reRegister.textContent = `Not ${playerSerial}? Tap to re-register`;
            reRegister.addEventListener('click', () => {
                localStorage.removeItem('arc_serial');
                localStorage.removeItem('arc_name');
                window.location.reload();
            });
        }
        
        showScreen(1);
        
        setTimeout(() => {
            showScreen(2);
        }, 2500);

    } catch (err) {
        registerError.textContent = 'Network error. Try again.';
    }
});

// Screen 3: Word Submission
const wordForm = document.getElementById('word-form');
const wordInput = document.getElementById('word-input');
const chatArea = document.getElementById('chat-area');

let pendingQueue = JSON.parse(localStorage.getItem('pendingWords') || '[]');

function saveQueue() {
    localStorage.setItem('pendingWords', JSON.stringify(pendingQueue));
}

function addBubble(id, text, status) {
    // status: 'pending', 'accepted', 'rejected'
    const div = document.createElement('div');
    div.className = `bubble ${status}`;
    div.id = `bubble-${id}`;
    
    if (status === 'rejected') {
        div.textContent = 'Try another word!';
    } else if (status === 'pending' && id.toString().startsWith('offline-')) {
        div.textContent = `📶 Saved — will retry`;
    } else {
        div.textContent = text;
    }
    
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;

    // keep only last 5 bubbles
    while (chatArea.children.length > 5) {
        chatArea.removeChild(chatArea.firstChild);
    }
}

function updateBubble(id, status, text) {
    const div = document.getElementById(`bubble-${id}`);
    if (div) {
        div.className = `bubble ${status}`;
        if (status === 'rejected') {
            div.textContent = 'Try another word!';
        } else {
            div.textContent = text;
        }
    }
}

async function submitWord(text, bubbleId, retries = 3) {
    try {
        const res = await fetch('/api/word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: playerSerial, text })
        });
        
        if (!res.ok) {
            if (res.status === 403) { // DQ
                updateBubble(bubbleId, 'rejected', '');
                return false;
            }
            throw new Error('Server error');
        }

        const data = await res.json();
        if (data.accepted) {
            updateBubble(bubbleId, 'accepted', data.word);
            return true;
        } else {
            if (data.reason === 'duplicate') {
                updateBubble(bubbleId, 'duplicate', 'Already sent! ✓');
            } else {
                updateBubble(bubbleId, 'rejected', '');
            }
            return true; // it was successfully processed (rejected by filter or duplicate)
        }
    } catch (err) {
        if (retries > 0) {
            // Retry logic
            await new Promise(r => setTimeout(r, 1000));
            return submitWord(text, bubbleId, retries - 1);
        } else {
            // Out of retries, queue for offline sync
            updateBubble(bubbleId, 'pending', '📶 Saved — will retry');
            pendingQueue.push({ id: bubbleId, text });
            saveQueue();
            return false;
        }
    }
}

wordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = wordInput.value.trim();
    if (!text || text.includes(' ')) {
        alert("Please enter a single word.");
        return;
    }

    wordInput.value = '';
    
    const bubbleId = Date.now().toString();
    addBubble(bubbleId, text, 'pending');
    
    submitWord(text, bubbleId, 3);
});

// Offline retry loop (every 5 seconds)
setInterval(async () => {
    if (pendingQueue.length === 0) return;
    
    // Test connection first
    try {
        const ping = await fetch('/api/ping');
        if (!ping.ok) return;
    } catch (e) {
        return; // still offline
    }

    // Attempt to process queue
    const currentQueue = [...pendingQueue];
    pendingQueue = []; // clear, if fails will be re-added
    saveQueue();

    for (const item of currentQueue) {
        submitWord(item.text, item.id, 0);
    }
}, 5000);

// Contest State Polling
let contestWasClosed = false;
setInterval(async () => {
    try {
        const res = await fetch('/api/contest/state');
        if (res.ok) {
            const data = await res.json();
            const msg = document.getElementById('contest-closed-msg');
            const btn = document.getElementById('word-submit');
            
            if (!data.contestOpen) {
                if (wordInput) wordInput.disabled = true;
                if (btn) btn.disabled = true;
                if (msg) msg.style.display = 'block';
                contestWasClosed = true;
            } else if (contestWasClosed) {
                if (wordInput) wordInput.disabled = false;
                if (btn) btn.disabled = false;
                if (msg) msg.style.display = 'none';
                contestWasClosed = false;
            }
        }
    } catch (e) {}
}, 5000);
