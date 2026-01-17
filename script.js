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

// --- Smoke Trail ---
function createSmoke(x, y) {
    const puffCount = 2 + Math.floor(Math.random() * 2); // 2–3 puffs
    for (let i = 0; i < puffCount; i++) {
        const smoke = document.createElement("div");
        smoke.className = "smoke";

        // Random size & opacity
        const size = 10 + Math.random() * 10; // 10–20px
        smoke.style.width = size + "px";
        smoke.style.height = size + "px";
        smoke.style.opacity = 0.3 + Math.random() * 0.4;

        // Random drift
        const offsetX = (Math.random() - 0.5) * 10; // ±5px
        const offsetY = (Math.random() - 0.5) * 10; // ±5px

        smoke.style.left = (x + offsetX) + "px";
        smoke.style.top = (y + offsetY) + "px";
        smoke.style.transform = "translate(-50%, -50%)";

        document.body.appendChild(smoke);

        // Remove after 1.5–2s
        setTimeout(() => smoke.remove(), 1500 + Math.random() * 500);
    }
}


// --- Spawn smoke at missile tail (143x170 PNG) ---
function spawnSmokeAtMissileTail(missileX, missileY, angleDeg) {
    const angleRad = angleDeg * Math.PI / 180;
    const tailOffset = 0; // adjust this number until smoke aligns
    const offsetX = -Math.cos(angleRad) * tailOffset;
    const offsetY = -Math.sin(angleRad) * tailOffset;
    createSmoke(missileX + offsetX, missileY + offsetY);
}


// --- Guided Missile ---
function launchMissile(ufo) {
    playSound("launchSound");

    const missile = document.createElement("img");
    missile.src = "missile.png";
    missile.className = "missile";
    document.body.appendChild(missile);

    let missileX = fireFromLeft ? window.innerWidth * 0.15 : window.innerWidth * 0.85;
    let missileY = window.innerHeight - 100;
    fireFromLeft = !fireFromLeft;

    createFlash(missileX, missileY);

    let missileSpeed = 8;       // starting speed
    const acceleration = 0.2;   // how much speed increases per frame

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
        const targetX = r.left + r.width / 2;
        const targetY = r.top + r.height / 2;

        const dx = targetX - missileX;
        const dy = targetY - missileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            clearInterval(interval);
            missile.remove();
            hitUFO(ufo);
        } else {
            // 🚀 Accelerating speed
            missileSpeed = Math.min(missileSpeed + acceleration, 25); // cap at 25

            missileX += (dx / dist) * missileSpeed;
            missileY += (dy / dist) * missileSpeed;

            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            missile.style.left = missileX + "px";
            missile.style.top = missileY + "px";
            missile.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;

            spawnSmokeAtMissileTail(missileX, missileY, angle + 90);
        }
    }, 30);
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

    // Determine UFO type and HP
    const type = ufo.dataset.type || "scout";
    let hp = Number(ufo.dataset.hp) || (type === "heavy" ? 2 : 1);

    hp -= 1;
    ufo.dataset.hp = hp;

    // If still alive, just flash damage
    if (hp > 0) {
        ufo.style.filter = "drop-shadow(0 0 30px orange)";
        return;
    }

    // Explosion + debris
    const r = ufo.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    createExplosion(cx, cy, ufo); // ✅ uses explosion.png + debris

    // Combo + scoring after removal
    setTimeout(() => {
        if (document.body.contains(ufo)) ufo.remove();

        const now = Date.now();
        comboCount = (now - lastHitTime < 2000) ? comboCount + 1 : 1;
        lastHitTime = now;

        const basePoints = type === "heavy" ? 2 : type === "stealth" ? 2 : type === "boss" ? 5 : 1;
        score += basePoints * comboCount;

        // High score persistence
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("highScore", String(highScore));
        }

        updateHUD();

        // Difficulty scaling
        if (score % 5 === 0) {
            increaseDifficulty();
            playSound("levelUpSound");
        }

        // Boss spawn
        if (score % 20 === 0) spawnBoss();

        // Achievements
        checkAchievements();
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

// --- Explosion PNG ---
function createExplosion(cx, cy, ufo) {
    // Core explosion PNG
    const explosion = document.createElement("img");
    explosion.src = "explosion.png";
    explosion.className = "explosion";
    explosion.style.position = "absolute";
    explosion.style.left = (cx - 80) + "px";
    explosion.style.top = (cy - 80) + "px";
    explosion.style.width = "160px";
    explosion.style.zIndex = 8;
    explosion.style.filter = "drop-shadow(0 0 20px orange)";
    document.body.appendChild(explosion);

    // Flash circle
    const flash = document.createElement("div");
    flash.className = "explosion-flash";
    flash.style.left = (cx - 100) + "px";
    flash.style.top = (cy - 100) + "px";
    document.body.appendChild(flash);

    // Shockwave ring
    const shockwave = document.createElement("div");
    shockwave.className = "shockwave";
    shockwave.style.left = (cx - 50) + "px";
    shockwave.style.top = (cy - 50) + "px";
    document.body.appendChild(shockwave);

    // Sparks
    for (let i = 0; i < 15; i++) {
        const spark = document.createElement("div");
        spark.className = "spark";
        spark.style.left = cx + "px";
        spark.style.top = cy + "px";
        document.body.appendChild(spark);

        const angle = Math.random() * 2 * Math.PI;
        const speed = 2 + Math.random() * 4;
        let posX = cx, posY = cy;

        const interval = setInterval(() => {
            posX += Math.cos(angle) * speed;
            posY += Math.sin(angle) * speed;
            spark.style.left = posX + "px";
            spark.style.top = posY + "px";
        }, 30);

        setTimeout(() => {
            clearInterval(interval);
            spark.remove();
        }, 600);
    }

    // Remove UFO
    if (document.body.contains(ufo)) ufo.remove();

    // Cleanup
    setTimeout(() => {
        explosion.remove();
        flash.remove();
        shockwave.remove();
    }, 1000);

    // Debris particles
    createDebris(cx, cy);
}

// --- Drone Ally (MQ-9 Reaper) ---
const DRONE_COST = 20; // ✅ change this number to set the price

function spawnDrone() {
    // Cost check
    if (score < DRONE_COST) {
        alert("Not enough points to deploy MQ-9 Reaper!");
        return;
    }
    score -= DRONE_COST;
    updateHUD();

    // Play drone sound (looping ambient)
    const sound = document.getElementById("droneSound");
    if (sound) {
        sound.currentTime = 0;
        sound.play();
    }

    // Create drone element
    const drone = document.createElement("img");
    drone.src = "drone.png"; // your MQ-9 Reaper PNG
    drone.className = "drone";
    drone.style.top = "120px";
    drone.style.left = window.innerWidth / 2 + "px";
    document.body.appendChild(drone);

    // Movement: drone patrols left ↔ right
    let direction = 1;
    let posX = window.innerWidth / 2;
    const moveInterval = setInterval(() => {
        if (gameOver || paused) return;
        posX += direction * 4; // patrol speed

        // Bounce at edges
        if (posX < 100 || posX > window.innerWidth - 200) {
            direction *= -1;
        }

        // Always set transform based on current direction
        if (direction === 1) {
            drone.style.transform = "scaleX(-1)";  // facing right
        } else {
            drone.style.transform = "scaleX(1)";   // facing left
        }

        drone.style.left = posX + "px";
    }, 30);

    // Auto-fire missiles from drone itself
    const fireInterval = setInterval(() => {
        if (gameOver || paused) return;
        const ufos = document.querySelectorAll(".ufo");
        if (ufos.length > 0) {
            const target = ufos[0]; // pick first UFO
            launchDroneMissile(drone, target); // custom missile from drone
        }
    }, 2000);

    // Drone disappears after 20s
    setTimeout(() => {
        clearInterval(moveInterval);
        clearInterval(fireInterval);
        if (document.body.contains(drone)) drone.remove();

        // Stop sound when drone leaves
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    }, 20000);
}


// --- Drone Missile ---
function launchDroneMissile(drone, ufo) {
    playSound("launchSound");

    const missile = document.createElement("img");
    missile.src = "missile.png";
    missile.className = "missile";
    document.body.appendChild(missile);

    // Start at drone’s position
    const droneRect = drone.getBoundingClientRect();
    let missileX = droneRect.left + droneRect.width / 2;
    let missileY = droneRect.top + droneRect.height / 2;

    missile.style.left = missileX + "px";
    missile.style.top = missileY + "px";

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
        const targetX = r.left + r.width / 2;
        const targetY = r.top + r.height / 2;

        const dx = targetX - missileX;
        const dy = targetY - missileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            clearInterval(interval);
            missile.remove();
            hitUFO(ufo);
        } else {
            const speed = 12;
            missileX += (dx / dist) * speed;
            missileY += (dy / dist) * speed;

            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            missile.style.left = missileX + "px";
            missile.style.top = missileY + "px";
            missile.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;

            spawnSmokeAtMissileTail(missileX, missileY, angle + 90);
        }
    }, 30);

    // Auto-fire missiles from drone itself
    const fireInterval = setInterval(() => {
        if (gameOver || paused) return;
        const ufos = document.querySelectorAll(".ufo");
        if (ufos.length > 0) {
            const target = ufos[0]; // pick first UFO
            launchDroneMissile(drone, target); // custom missile from drone
        }
    }, 2000);

    // Drone disappears after 20s
    setTimeout(() => {
        clearInterval(moveInterval);
        clearInterval(fireInterval);
        if (document.body.contains(drone)) drone.remove();
    }, 20000);
}


// --- Drone Missile ---
function launchDroneMissile(drone, ufo) {
    playSound("launchSound");

    const missile = document.createElement("img");
    missile.src = "missile.png";
    missile.className = "missile";
    document.body.appendChild(missile);

    // Start at drone’s position
    const droneRect = drone.getBoundingClientRect();
    let missileX = droneRect.left + droneRect.width / 2;
    let missileY = droneRect.top + droneRect.height / 2;

    missile.style.left = missileX + "px";
    missile.style.top = missileY + "px";

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
        const targetX = r.left + r.width / 2;
        const targetY = r.top + r.height / 2;

        const dx = targetX - missileX;
        const dy = targetY - missileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            clearInterval(interval);
            missile.remove();
            hitUFO(ufo);
        } else {
            const speed = 12;
            missileX += (dx / dist) * speed;
            missileY += (dy / dist) * speed;

            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            missile.style.left = missileX + "px";
            missile.style.top = missileY + "px";
            missile.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;

            spawnSmokeAtMissileTail(missileX, missileY, angle + 90);
        }
    }, 30);
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
