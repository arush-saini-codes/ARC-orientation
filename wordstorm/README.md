# ARC × Tech — Live Word-Storm

A live interactive word-storm activity. Students scan a QR code, register, and submit words answering "What does TECH mean to you?". Words animate onto a projector screen to form the letters ARC.

## Setup and Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Open firewall port:**
   Before running, open port 4521 on your firewall if needed (e.g. on Ubuntu):
   ```bash
   sudo ufw allow 4521
   ```

3. **Run the server:**
   ```bash
   node server.js
   ```

   The server will start on port `4521` bound to all interfaces.

## Access URLs

The application exposes three different interfaces. When the server starts, it will print your local IP address. You can access the interfaces from any device on your local network (LAN) using that IP:

- **Player view (for students):** `http://<YOUR-IP>:4521/player/`
- **Projector view (main display):** `http://<YOUR-IP>:4521/projector/`
- **Moderator view (for filtering/DQ):** `http://<YOUR-IP>:4521/mod/`

### Finding your local IP manually

If the server logs `localhost` or you need to check manually:
- **Windows:** Run `ipconfig` in Command Prompt and look for "IPv4 Address".
- **Mac/Linux:** Run `ifconfig` or `ip addr show` or `hostname -I` in Terminal.

## Features

- **Robust Sync:** Synchronous SQLite writes via `better-sqlite3` to handle high concurrency without race conditions.
- **Offline Resilience:** The player view caches words if the network drops and retries them automatically. The projector view continues animating gracefully and falls back to a preset word list if real submissions stall.
- **Auto QR Code:** The projector loading screen automatically generates a QR code pointing to the correct LAN IP for students to scan.
- **Hidden Controls:** Moderators can strike inappropriate words instantly or disqualify spamming players. A hidden input (Ctrl+Shift+W) exists on the projector screen for manual word injection if needed.

## Tech Stack
- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML5, CSS3, JS (Canvas API for animations)
- **Font:** Kalam (Google Fonts)

## Deploying to Railway (recommended for public access)

1. Go to railway.app and create a free account
2. Click New Project → Deploy from GitHub repo
3. Or use CLI: `npm install -g @railway/cli` → `railway login` → `railway init` → `railway up`
4. Once deployed, Railway gives a public URL like `https://wordstorm-xyz.railway.app`
5. Share that URL with students directly or generate a QR from qr-code-generator.com

Note: Railway provides persistent storage — SQLite data survives redeploys.
