// UFO Defense — Final Optimized Version (with A‑10 two‑altitude orbit & lag fixes)

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

let activeDrone = null;
let activeA10 = null;
let a10CanFire = true;

const MAX_MISSILES = 6;
const MAX_30MM = 20;
const DRONE_COST = 20;
const A10_COST = 30;

document.addEventListener("DOMContentLoaded", () => {
    updateHUD();
    spawnUFOs();
    spawnBackgroundEvents();
    powerUpTimer = setInterval(spawnPowerUp, 15000);
});

// --- Sound helper ---
function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        const clone = sound.cloneNode();
        clone.play();
    }
}

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

// --- Smoke Trail (optimized) ---
function createSmoke(x, y) {
    const puffCount = 1 + Math.floor(Math.random() * 1);
    for (let i = 0; i < puffCount; i++) {
        const smoke = document.createElement("div");
        smoke.className = "smoke";

        const size = 8 + Math.random() * 8;
        smoke.style.width = size + "px";
        smoke.style.height = size + "px";
        smoke.style.opacity = 0.25 + Math.random() * 0.3;

        const offsetX = (Math.random() - 0.5) * 6;
        const offsetY = (Math.random() - 0.5) * 6;

        smoke.style.left = (x + offsetX) + "px";
        smoke.style.top = (y + offsetY) + "px";
        smoke.style.transform = "translate(-50%, -50%)";

        document.body.appendChild(smoke);
        setTimeout(() => smoke.remove(), 900 + Math.random() * 200);
    }
}

function spawnSmokeAtMissileTail(x, y, angleDeg) {
    createSmoke(x, y);
}

// --- Guided Missile (Patriot) ---
function launchMissile(ufo) {
    if (document.querySelectorAll(".missile").length >= MAX_MISSILES) return;

    playSound("launchSound");

    const missile = document.createElement("img");
    missile.src = "missile.png";
    missile.className = "missile";
    document.body.appendChild(missile);

    let missileX = fireFromLeft ? window.innerWidth * 0.15 : window.innerWidth * 0.85;
    let missileY = window.innerHeight - 100;
    fireFromLeft = !fireFromLeft;

    createFlash(missileX, missileY);

    let missileSpeed = 8;
    const acceleration = 0.2;

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
        const tx = r.left + r.width / 2;
        const ty = r.top + r.height / 2;

        const dx = tx - missileX;
        const dy = ty - missileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            clearInterval(interval);
            missile.remove();
            hitUFO(ufo);
        } else {
            missileSpeed = Math.min(missileSpeed + acceleration, 22);

            missileX += (dx / dist) * missileSpeed;
            missileY += (dy / dist) * missileSpeed;

            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
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

// --- Hit UFO (crash sequence) ---
function hitUFO(ufo) {
    if (gameOver) return;

    playSound("explosionSound");

    const type = ufo.dataset.type || "scout";
    let hp = Number(ufo.dataset.hp);

    hp -= 1;
    ufo.dataset.hp = hp;

    if (hp > 0) {
        ufo.style.filter = "drop-shadow(0 0 30px orange)";
        return;
    }

    startUFODown(ufo, type);
}

// --- UFO Crash ---
function startUFODown(ufo, type) {
    if (ufo.dataset.crashing) return;
    ufo.dataset.crashing = "1";

    const r = ufo.getBoundingClientRect();
    let x = r.left;
    let y = r.top;
    let angle = 0;

    const fallSpeed = 7 + Math.random() * 2;
    const rotateSpeed = (Math.random() > 0.5 ? 4 : -4);
    const groundY = window.innerHeight - 120 - r.height / 2;

    ufo.style.animation = "none";
    ufo.style.pointerEvents = "none";

    const fallInterval = setInterval(() => {
        if (gameOver || !document.body.contains(ufo)) {
            clearInterval(fallInterval);
            return;
        }

        y += fallSpeed;
        x += (Math.random() - 0.5) * 3;
        angle += rotateSpeed;

        ufo.style.top = y + "px";
        ufo.style.left = x + "px";
        ufo.style.transform = `rotate(${angle}deg)`;

        createSmoke(x + r.width / 2, y + r.height / 2);

        if (y >= groundY) {
            clearInterval(fallInterval);

            const cx = x + r.width / 2;
            const cy = y + r.height / 2;

            const crashSound = document.getElementById("crashSound");
            if (crashSound) {
                crashSound.currentTime = 0;
                crashSound.play();
            }

            createExplosion(cx, cy, ufo);

            const now = Date.now();
            comboCount = (now - lastHitTime < 2000) ? comboCount + 1 : 1;
            lastHitTime = now;

            const basePoints = type === "heavy" ? 2 : type === "stealth" ? 2 : type === "boss" ? 5 : 1;
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
    }, 30);
}

// --- Explosion ---
function createExplosion(cx, cy, ufo) {
    const explosion = document.createElement("img");
    explosion.src = "explosion.png";
    explosion.className = "explosion";
    explosion.style.position = "absolute";
    explosion.style.left = (cx - 80) + "px";
    explosion.style.top = (cy - 80) + "px";
    explosion.style.width = "160px";
    explosion.style.zIndex = 8;
    document.body.appendChild(explosion);

    const flash = document.createElement("div");
    flash.className = "explosion-flash";
    flash.style.left = (cx - 100) + "px";
    flash.style.top = (cy - 100) + "px";
    document.body.appendChild(flash);

    const shockwave = document.createElement("div");
    shockwave.className = "shockwave";
    shockwave.style.left = (cx - 50) + "px";
    shockwave.style.top = (cy - 50) + "px";
    document.body.appendChild(shockwave);

    createDebris(cx, cy);

    setTimeout(() => {
        explosion.remove();
        flash.remove();
        shockwave.remove();
    }, 1000);

    if (document.body.contains(ufo)) ufo.remove();
}

// --- Debris ---
function createDebris(x, y) {
    for (let i = 0; i < 12; i++) {
        const d = document.createElement("div");
        d.className = "debris";
        d.style.left = x + "px";
        d.style.top = y + "px";
        d.style.setProperty("--dx", (Math.random() - 0.5) * 220 + "px");
        d.style.setProperty("--dy", (Math.random() - 0.5) * 220 + "px");
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 1000);
    }
}

// --- Drone Ally ---
function spawnDrone() {
    if (gameOver || paused) return;
    if (activeDrone) return;

    if (score < DRONE_COST) {
        alert("Not enough points to deploy MQ-9 Reaper!");
        return;
    }
    score -= DRONE_COST;
    updateHUD();

    const sound = document.getElementById("droneSound");
    if (sound) {
        sound.currentTime = 0;
        sound.play();
    }

    const drone = document.createElement("img");
    drone.src = "drone.png";
    drone.className = "drone";
    drone.style.top = "120px";
    drone.style.left = window.innerWidth / 2 + "px";
    document.body.appendChild(drone);
    activeDrone = drone;

    let direction = 1;
    let posX = window.innerWidth / 2;

    const moveInterval = setInterval(() => {
        if (gameOver || paused || !document.body.contains(drone)) return;

        posX += direction * 4;

        if (posX < 100 || posX > window.innerWidth - 200) {
            direction *= -1;
        }

        drone.style.transform = direction === 1 ? "scaleX(-1)" : "scaleX(1)";
        drone.style.left = posX + "px";
    }, 30);

    const fireInterval = setInterval(() => {
        if (gameOver || paused || !document.body.contains(drone)) return;
        const target = getActiveUFO();
        if (target) launchDroneMissile(drone, target);
    }, 2000);

    setTimeout(() => {
        clearInterval(moveInterval);
        clearInterval(fireInterval);
        if (document.body.contains(drone)) drone.remove();
        activeDrone = null;
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    }, 20000);
}

// --- Drone Missile ---
function launchDroneMissile(drone, ufo) {
    if (document.querySelectorAll(".missile").length >= MAX_MISSILES) return;

    playSound("launchSound");

    const missile = document.createElement("img");
    missile.src = "missile.png";
    missile.className = "missile";
    document.body.appendChild(missile);

    const r = drone.getBoundingClientRect();
    let x = r.left + r.width / 2;
    let y = r.top + r.height / 2;

    missile.style.left = x + "px";
    missile.style.top = y + "px";

    const speed = 12;

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

        const ur = ufo.getBoundingClientRect();
        const tx = ur.left + ur.width / 2;
        const ty = ur.top + ur.height / 2;

        const dx = tx - x;
        const dy = ty - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            clearInterval(interval);
            missile.remove();
            hitUFO(ufo);
        } else {
            x += (dx / dist) * speed;
            y += (dy / dist) * speed;

            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            missile.style.left = x + "px";
            missile.style.top = y + "px";
            missile.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;

            spawnSmokeAtMissileTail(x, y, angle + 90);
        }
    }, 30);
}

// --- A‑10 Warthog (Two‑Altitude Orbit, Optimized) ---
function spawnA10() {
    if (gameOver || paused) return;
    if (activeA10) return;

    if (score < A10_COST) {
        alert("Not enough points to call A‑10 Warthog!");
        return;
    }
    score -= A10_COST;
    updateHUD();

    const a10Sound = document.getElementById("a10Sound");
    if (a10Sound) {
        a10Sound.currentTime = 0;
        a10Sound.play();
    }

    const a10 = document.createElement("img");
    a10.src = "a10.png";
    a10.className = "a10";
    a10.style.left = window.innerWidth / 2 + "px";
    a10.style.top = "160px";
    a10.style.zIndex = "7";
    document.body.appendChild(a10);
    activeA10 = a10;

    let direction = 1;
    let posX = window.innerWidth / 2;

    let altitude = 160;
    let nextAltitude = 220;

    let lastBurstTime = 0;
    const burstCooldown = 1200; // 1.2s between bursts

    const moveInterval = setInterval(() => {
        if (gameOver || paused || !document.body.contains(a10)) return;

        // Horizontal patrol
        posX += direction * 7;
        if (posX < 50 || posX > window.innerWidth - 250) direction *= -1;

        a10.style.transform = direction === 1 ? "scaleX(1)" : "scaleX(-1)";
        a10.style.left = posX + "px";

        // Smooth altitude switching
        altitude += (nextAltitude - altitude) * 0.05;
        a10.style.top = altitude + "px";

        // Random altitude change
        if (Math.random() < 0.01) {
            nextAltitude = nextAltitude === 160 ? 220 : 160;
        }

        const target = getActiveUFO();
        if (!target) return;

        const now = Date.now();
        if (now - lastBurstTime < burstCooldown) return;

        const ur = target.getBoundingClientRect();
        const ar = a10.getBoundingClientRect();
        const dx = (ur.left + ur.width / 2) - (ar.left + ar.width / 2);
        const dy = (ur.top + ur.height / 2) - (ar.top + ar.height / 2);
        const dist = Math.hypot(dx, dy);

        if (dist < 250) {
            lastBurstTime = now;
            fire30mmBurst(a10, target);
        }

    }, 40);

    setTimeout(() => {
    clearInterval(moveInterval);
    if (document.body.contains(a10)) a10.remove();
    activeA10 = null;

    if (a10Sound) {
        a10Sound.pause();
        a10Sound.currentTime = 0;
    }

}, 60000);
}

// --- 30mm Burst ---
function fire30mmBurst(a10, ufo) {
    if (!document.body.contains(a10) || !document.body.contains(ufo)) return;

    const rounds = 5;
    for (let i = 0; i < rounds; i++) {
        setTimeout(() => fire30mmRound(a10, ufo), i * 70);
    }

    const gunSound = document.getElementById("gun30mmSound");
    if (gunSound) {
        gunSound.currentTime = 0;
        gunSound.play();
    }
}

// --- 30mm Round ---
function fire30mmRound(a10, ufo) {
    if (!document.body.contains(a10) || !document.body.contains(ufo)) return;

    if (document.querySelectorAll(".bullet30mm").length >= MAX_30MM) return;

    const r = a10.getBoundingClientRect();
    let x = r.left + r.width * 0.8;
    let y = r.top + r.height * 0.5;

    const bullet = document.createElement("div");
    bullet.className = "bullet30mm";
    bullet.style.left = x + "px";
    bullet.style.top = y + "px";
    document.body.appendChild(bullet);

    const ur = ufo.getBoundingClientRect();
    const tx = ur.left + ur.width / 2;
    const ty = ur.top + ur.height / 2;

    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 30;

    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    const colors = ["yellow", "gold", "orange", "orangered"];
    bullet.style.background = colors[Math.floor(Math.random() * colors.length)];

    const startTime = Date.now();

    const interval = setInterval(() => {
        if (gameOver || paused) {
            clearInterval(interval);
            bullet.remove();
            return;
        }

        if (!document.body.contains(ufo)) {
            clearInterval(interval);
            bullet.remove();
            return;
        }

        x += vx;
        y += vy;
        bullet.style.left = x + "px";
        bullet.style.top = y + "px";

        const ur2 = ufo.getBoundingClientRect();
        const cx = ur2.left + ur2.width / 2;
        const cy = ur2.top + ur2.height / 2;
        const d2 = Math.hypot(cx - x, cy - y);

        if (d2 < 20) {
            clearInterval(interval);
            bullet.remove();
            hitUFO(ufo);
        }

        if (Date.now() - startTime > 700) {
            clearInterval(interval);
            bullet.remove();
        }

    }, 20);
}

// --- Active UFO helper ---
function getActiveUFO() {
    return [...document.querySelectorAll(".ufo")]
        .filter(u => !u.dataset.crashing)
        .filter(u => document.body.contains(u))[0] || null;
}

// --- UFO Spawner ---
function spawnUFOs() {
    if (ufoInterval) clearInterval(ufoInterval);

    ufoInterval = setInterval(() => {
        if (gameOver || paused) return;

        const ufo = document.createElement("img");
        ufo.className = "ufo";

        const types = ["scout", "heavy", "stealth"];
        const type = types[Math.floor(Math.random() * types.length)];
        ufo.dataset.type = type;
        ufo.dataset.hp = (type === "heavy" ? 2 : 1);

        if (type === "scout") ufo.src = "ufo.png";
        if (type === "heavy") ufo.src = "ufo_heavy.png";
        if (type === "stealth") ufo.src = "ufo_stealth.png";

        ufo.style.top = Math.floor(Math.random() * 300 + 50) + "px";
        const speed = type === "scout" ? 8 : type === "heavy" ? 20 : 15;
        ufo.style.animation = `flyAcross ${speed}s linear forwards, hover 2s ease-in-out infinite alternate`;

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

        ufo.addEventListener("animationend", () => {
            if (document.body.contains(ufo) && !ufo.dataset.crashing) {
                ufo.remove();
                loseLife();
            }
        });

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
        if (document.body.contains(boss) && !boss.dataset.crashing) {
            boss.remove();
            loseLife();
        }
    });

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

    if (activeDrone && document.body.contains(activeDrone)) activeDrone.remove();
    activeDrone = null;
    if (activeA10 && document.body.contains(activeA10)) activeA10.remove();
    activeA10 = null;

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
    activeDrone = null;
    activeA10 = null;
    document.querySelectorAll(".ufo,.smoke,.flash,.debris,.meteor,.powerup,.bullet30mm,.missile").forEach(e => e.remove());
    document.querySelectorAll("div").forEach(d => { if (d.innerText && d.innerText.includes("GAME OVER")) d.remove(); });
    updateHUD();
    spawnUFOs();
    spawnBackgroundEvents();
    powerUpTimer = setInterval(spawnPowerUp, 15000);
}
