// UFO Defense — Mega Version (Complete)

let score = 0;
let lives = 3;
let gameOver = false;
let ufoInterval;
let spawnRate = 5000;
let fireFromLeft = true;
let comboCount = 0;
let lastHitTime = 0;
let level = 1;
let highScore = Number(localStorage.getItem("highScore")) || 0;
let achievements = [];
let paused = false;
let powerUpTimer = null;

// --- Sound helper ---
function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        const clone = sound.cloneNode();
        clone.play();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("activate");
    if (btn) btn.addEventListener("click", beamEffect);

    updateHUD();
    spawnUFOs();
    spawnBackgroundEvents();
    powerUpTimer = setInterval(spawnPowerUp, 15000);
});

// --- HUD Updates ---
function updateHUD() {
    const scoreEl = document.getElementById("score");
    const livesEl = document.getElementById("lives");
    if (scoreEl) {
        const comboText = comboCount > 1 ? ` (x${comboCount} combo!)` : "";
        scoreEl.innerText = `Score: ${score}${comboText} • High: ${highScore} • Level: ${level}`;
    }
    if (livesEl) livesEl.innerText = `Lives: ${lives}`;
}

// --- Shooting ---
function shootUFO(ufo) {
    if (gameOver || paused) return;
    launchMissile(ufo);
}

// --- Guided Missile ---
function launchMissile(ufo) {
    playSound("launchSound");

    const missile = document.createElement("div");
    missile.className = "missile";
    document.body.appendChild(missile);

    let missileX = fireFromLeft ? window.innerWidth * 0.15 : window.innerWidth * 0.85;
    let missileY = window.innerHeight - 100;
    fireFromLeft = !fireFromLeft;

    missile.style.left = missileX + "px";
    missile.style.top = missileY + "px";

    createFlash(missileX, missileY);

    const ufoRect = ufo.getBoundingClientRect();
    let targetX = ufoRect.left + ufoRect.width / 2;
    let targetY = ufoRect.top + ufoRect.height / 2;

    const interval = setInterval(() => {
        if (gameOver || paused) {
            clearInterval(interval);
            missile.remove();
            return;
        }
        if (!document.body.contains(ufo)) {
            clearInterval(interval);
            missile.remove();
            return;
        }

        const r = ufo.getBoundingClientRect();
        targetX = r.left + r.width / 2;
        targetY = r.top + r.height / 2;

        const dx = targetX - missileX;
        const dy = targetY - missileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            clearInterval(interval);
            missile.remove();
            hitUFO(ufo);
        } else {
            const speed = 15;
            missileX += (dx / dist) * speed;
            missileY += (dy / dist) * speed;
            missile.style.left = missileX + "px";
            missile.style.top = missileY + "px";
            createSmoke(missileX, missileY);
        }
    }, 30);
}

// --- Smoke Trail ---
function createSmoke(x, y) {
    const smoke = document.createElement("div");
    smoke.className = "smoke";
    smoke.style.left = x + "px";
    smoke.style.top = y + "px";
    document.body.appendChild(smoke);
    setTimeout(() => smoke.remove(), 1000);
}

// --- Muzzle Flash ---
function createFlash(x, y) {
    const flash = document.createElement("div");
    flash.className = "flash";
    flash.style.left = (x - 30) + "px";
    flash.style.top = (y - 30) + "px";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
}

// --- Hit UFO ---
function hitUFO(ufo) {
    if (gameOver) return;

    playSound("explosionSound");

    const type = ufo.dataset.type || "scout";
    let hp = Number(ufo.dataset.hp) || (type === "heavy" ? 2 : 1);

    hp -= 1;
    ufo.dataset.hp = hp;
    if (hp > 0) {
        ufo.style.filter = "drop-shadow(0 0 30px orange)";
        return;
    }

    ufo.style.animation = "explode 1s forwards";
    ufo.style.filter = "drop-shadow(0 0 40px red)";

    const r = ufo.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    createDebris(cx, cy);

    setTimeout(() => {
        if (document.body.contains(ufo)) {
            ufo.remove();

            const now = Date.now();
            comboCount = (now - lastHitTime < 2000) ? comboCount + 1 : 1;
            lastHitTime = now;

            const basePoints = type === "heavy" ? 2 : type === "stealth" ? 2 : 1;
            score += basePoints * comboCount;

            if (score > highScore) {
                highScore = score;
                localStorage.setItem("highScore", String(highScore));
            }

            updateHUD();

            if (score % 5 === 0) {
                increaseDifficulty();
                playSound("levelUpSound");
            }

            if (score % 20 === 0) spawnBoss();

            checkAchievements();
        }
    }, 1000);
}

// --- Debris Explosion ---
function createDebris(x, y) {
    for (let i = 0; i < 12; i++) {
        const debris = document.createElement("div");
        debris.className = "debris";
        debris.style.left = x + "px";
        debris.style.top = y + "px";
        const dx = (Math.random() - 0.5) * 220 + "px";
        const dy = (Math.random() - 0.5) * 220 + "px";
        debris.style.setProperty("--dx", dx);
        debris.style.setProperty("--dy", dy);
        document.body.appendChild(debris);
        setTimeout(() => debris.remove(), 1000);
    }
}

// --- UFO Spawner ---
function spawnUFOs() {
    if (ufoInterval) clearInterval(ufoInterval);

    ufoInterval = setInterval(() => {
        if (gameOver || paused) return;

        const ufo = document.createElement("img");
        ufo.className = "ufo";

        // Add more types here
        const types = ["scout", "heavy", "stealth"];
        const type = types[Math.floor(Math.random() * types.length)];
        ufo.dataset.type = type;
        ufo.dataset.hp = (type === "heavy" ? 2 : 1);

        // Pick PNG based on type
        if (type === "scout") ufo.src = "ufo.png";
        if (type === "heavy") ufo.src = "ufo_heavy.png";
        if (type === "stealth") ufo.src = "ufo_stealth.png";

        // Position and animation
        ufo.style.top = Math.floor(Math.random() * 300 + 50) + "px";
        const speed = type === "scout" ? 8 : type === "heavy" ? 20 : type === "plane" ? 12 : 15;
        ufo.style.animation = `flyAcross ${speed}s linear forwards, hover 2s ease-in-out infinite alternate`;

        // Stealth blinking effect
        if (type === "stealth") {
            ufo.style.opacity = "0.6";
            const blink = setInterval(() => {
                if (!document.body.contains(ufo)) {
                    clearInterval(blink);
                    return;
                }
                ufo.style.opacity = (ufo.style.opacity === "0.6") ? "1" : "0.6";
            }, 800);
        }

        // Remove UFO if it finishes flying across
        ufo.addEventListener("animationend", () => {
            if (document.body.contains(ufo)) {
                ufo.remove();
                loseLife();
            }
        });

        // Shooting interaction
        ufo.addEventListener("click", () => shootUFO(ufo));

        document.body.appendChild(ufo);
    }, spawnRate);
}

// --- Boss UFO ---
function spawnBoss() {
    if (gameOver || paused) return;

    const boss = document.createElement("img");
    boss.src = "ufo_boss.png";
    boss.className = "ufo";
    boss.style.width = "300px";
    boss.style.top = "150px";
    boss.dataset.type = "boss";
    boss.dataset.hp = 5;
    boss.style.filter = "drop-shadow(0 0 40px magenta)";
    boss.style.animation = "flyAcross 25s linear forwards";

    boss.addEventListener("animationend", () => {
        if (document.body.contains(boss)) {
            boss.remove();
            loseLife();
        }
    });

    boss.addEventListener("click", () => shootUFO(boss));
    document.body
    boss.addEventListener("click", () => shootUFO(boss));
    document.body.appendChild(boss);
}

// --- Power-Ups ---
function spawnPowerUp() {
    if (gameOver || paused) return;

    const powerUps = ["life", "shield", "emp", "double"];
    const type = powerUps[Math.floor(Math.random() * powerUps.length)];

    const pu = document.createElement("div");
    pu.className = "powerup " + type;
    pu.style.left = Math.floor(Math.random() * (window.innerWidth - 100)) + "px";
    pu.style.top = Math.floor(Math.random() * 200 + 50) + "px";
    pu.style.position = "fixed";
    pu.style.width = "30px";
    pu.style.height = "30px";
    pu.style.borderRadius = "50%";
    pu.style.zIndex = "7";
    pu.style.cursor = "pointer";

    // Color by type
    if (type === "life") pu.style.background = "lime";
    if (type === "shield") pu.style.background = "cyan";
    if (type === "emp") pu.style.background = "yellow";
    if (type === "double") pu.style.background = "orange";

    document.body.appendChild(pu);

    pu.addEventListener("click", () => {
        if (type === "life") lives++;
        if (type === "shield") lives += 2;
        if (type === "emp") document.querySelectorAll(".ufo").forEach(u => u.remove());
        if (type === "double") comboCount += 2;
        pu.remove();
        updateHUD();
    });

    setTimeout(() => { if (document.body.contains(pu)) pu.remove(); }, 6000);
}

// --- Background Events ---
function spawnBackgroundEvents() {
    setInterval(() => {
        if (gameOver || paused) return;
        const meteor = document.createElement("div");
        meteor.className = "meteor";
        meteor.style.position = "fixed";
        meteor.style.width = "6px";
        meteor.style.height = "6px";
        meteor.style.borderRadius = "50%";
        meteor.style.background = "white";
        meteor.style.left = "0px";
        meteor.style.top = Math.floor(Math.random() * 200) + "px";
        document.body.appendChild(meteor);

        let x = 0;
        let y = parseInt(meteor.style.top);
        const vx = 8, vy = 2;
        const t = setInterval(() => {
            if (!document.body.contains(meteor) || paused) { clearInterval(t); return; }
            x += vx; y += vy;
            meteor.style.left = x + "px";
            meteor.style.top = y + "px";
            if (x > window.innerWidth || y > window.innerHeight) { clearInterval(t); meteor.remove(); }
        }, 30);
    }, 20000);
}

// --- Difficulty ---
function increaseDifficulty() {
    spawnRate = Math.max(1000, spawnRate - 500);
    level++;
    spawnUFOs();
    updateHUD();
}

// --- Lives ---
function loseLife() {
    lives--;
    comboCount = 0;
    updateHUD();
    if (lives <= 0) endGame();
}

// --- Achievements ---
function checkAchievements() {
    const unlock = name => {
        if (!achievements.includes(name)) {
            achievements.push(name);
            alert("Achievement unlocked: " + name);
        }
    };
    if (comboCount >= 5) unlock("Sharpshooter");
    if (score >= 50) unlock("Defender");
    if (level >= 5) unlock("Sky Marshal");
}

// --- Game Over ---
function endGame() {
    gameOver = true;
    clearInterval(ufoInterval);
    if (powerUpTimer) clearInterval(powerUpTimer);

    const overlay = document.createElement("div");
    overlay.innerHTML = `
        <h1 style="color:red;">GAME OVER</h1>
        <p style="color:white;">Final Score: ${score} • High Score: ${highScore}</p>
        <button onclick="restartGame()">Restart</button>
    `;
    overlay.style.position = "fixed";
    overlay.style.top = "50%";
    overlay.style.left = "50%";
    overlay.style.transform = "translate(-50%, -50%)";
    overlay.style.textAlign = "center";
    overlay.style.zIndex = "10";
    document.body.appendChild(overlay);
}

// --- Restart ---
function restartGame() {
    score = 0; lives = 3; gameOver = false;
    spawnRate = 5000; fireFromLeft = true;
    comboCount = 0; lastHitTime = 0; level = 1;
    document.querySelectorAll(".ufo,.smoke,.flash,.debris,.meteor,.powerup").forEach(e => e.remove());
    document.querySelectorAll("div").forEach(d => { if (d.innerText && d.innerText.includes("GAME OVER")) d.remove(); });
    updateHUD();
    spawnUFOs();
    spawnBackgroundEvents();
    powerUpTimer = setInterval(spawnPowerUp, 15000);
}
