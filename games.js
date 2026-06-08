const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const coinScoreEl = document.getElementById("coin-score");
const distScoreEl = document.getElementById("dist-score");
const fuelGaugeEl = document.getElementById("fuel-gauge");
const gameOverScreen = document.getElementById("game-over-screen");
const failReasonEl = document.getElementById("fail-reason");
const garageScreen = document.getElementById("garage-screen");
const garageCoinsTxt = document.getElementById("garage-coins-txt");
const garageHsTxt = document.getElementById("garage-hs-txt");
const airtimeAlertEl = document.getElementById("airtime-alert");
const airtimeBonusEl = document.getElementById("airtime-bonus");

// --- BANCO DE DADOS LOCAL (LOCALSTORAGE) ---
let totalCoins = parseInt(localStorage.getItem("hc_coins")) || 0; 
let highscore = parseInt(localStorage.getItem("hc_highscore")) || 0;
let upgrades = JSON.parse(localStorage.getItem("hc_upgrades")) || { motor: 1, sus: 1, pneu: 1 };
let costs = JSON.parse(localStorage.getItem("hc_costs")) || { motor: 1200, sus: 1000, pneu: 800 };

// SISTEMA DE SKINS
let equippedSkin = localStorage.getItem("hc_equipped_skin") || "default";
let ownedSkins = JSON.parse(localStorage.getItem("hc_owned_skins")) || ["default"];
const skinPrices = { hulk: 500, cyber: 1500, gold: 3000 };

const skinColors = {
    default: ["#c0392b", "#e74c3c"],
    hulk: ["#27ae60", "#2ecc71"],
    cyber: ["#2980b9", "#3498db"],
    gold: ["#f1c40f", "#2c3e50"]
};

let inGame = false;
let airTimeFrames = 0; 

const initialCarState = {
    x: 200, y: 100, vx: 0, vy: 0, angle: 0, vAngle: 0,
    width: 54, height: 18, radius: 12,
    speed: 0.23, friction: 0.975, gravity: 0.4,
    isGrounded: false, fuel: 100, coins: 0, distance: 0, alive: true
};
let car = { ...initialCarState };

let particles = [];
let spawnMarkers = {};
let activeItems = [];
let clouds = [];

for(let i=0; i<5; i++) {
    clouds.push({ x: Math.random() * canvas.width, y: 40 + Math.random()*80, size: 30 + Math.random()*20, speed: 0.2 + Math.random()*0.3 });
}

const keys = { ArrowRight: false, ArrowLeft: false };

window.addEventListener("keydown", (e) => {
    if (!car.alive || !inGame) return;
    if (e.key === "ArrowRight") keys.ArrowRight = true;
    if (e.key === "ArrowLeft") keys.ArrowLeft = true;
});
window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowRight") keys.ArrowRight = false;
    if (e.key === "ArrowLeft") keys.ArrowLeft = false;
});

function switchTab(tab) {
    document.getElementById('tab-upgrades-btn').className = 'tab-btn' + (tab === 'upgrades' ? ' active' : '');
    document.getElementById('tab-skins-btn').className = 'tab-btn' + (tab === 'skins' ? ' active' : '');
    
    document.getElementById('panel-upgrades').style.display = tab === 'upgrades' ? 'flex' : 'none';
    document.getElementById('panel-skins').style.display = tab === 'skins' ? 'flex' : 'none';
}

function updateGarageUI() {
    garageCoinsTxt.innerText = totalCoins.toLocaleString('pt-BR');
    garageHsTxt.innerText = highscore;
    
    localStorage.setItem("hc_coins", totalCoins);
    localStorage.setItem("hc_highscore", highscore);
    localStorage.setItem("hc_upgrades", JSON.stringify(upgrades));
    localStorage.setItem("hc_costs", JSON.stringify(costs));
    localStorage.setItem("hc_equipped_skin", equippedSkin);
    localStorage.setItem("hc_owned_skins", JSON.stringify(ownedSkins));

    ['motor', 'sus', 'pneu'].forEach(type => {
        document.getElementById(`lvl-${type}`).innerText = upgrades[type];
        let container = document.getElementById(`bars-${type}`);
        container.innerHTML = '';
        for(let i = 1; i <= 5; i++) {
            let bar = document.createElement('div');
            bar.className = 'bar' + (i <= upgrades[type] ? ' fill' : '');
            container.appendChild(bar);
        }

        let btn = document.getElementById(`btn-upgrade-${type}`);
        if (upgrades[type] >= 5) {
            btn.innerText = "MAX";
            btn.disabled = true;
        } else {
            btn.innerText = costs[type].toLocaleString('pt-BR');
            btn.disabled = totalCoins < costs[type];
        }
    });

    updateSkinButton("default", "default");
    updateSkinButton("hulk", "hulk");
    updateSkinButton("cyber", "cyber");
    updateSkinButton("gold", "gold");
}

function updateSkinButton(id, skinName) {
    let btn = document.getElementById(`btn-skin-${id}`);
    if (equippedSkin === skinName) {
        btn.innerText = "USANDO";
        btn.className = "btn-skin equipped";
        btn.disabled = false;
    } else if (ownedSkins.includes(skinName)) {
        btn.innerText = "EQUIPAR";
        btn.className = "btn-skin";
        btn.style.background = "#3498db";
        btn.disabled = false;
    } else {
        btn.innerText = skinPrices[skinName].toLocaleString('pt-BR');
        btn.className = "btn-skin";
        btn.style.background = "#e67e22";
        btn.disabled = totalCoins < skinPrices[skinName];
    }
}

function selectSkin(skinName) {
    if (ownedSkins.includes(skinName)) {
        equippedSkin = skinName;
    } else if (totalCoins >= skinPrices[skinName]) {
        totalCoins -= skinPrices[skinName];
        ownedSkins.push(skinName);
        equippedSkin = skinName;
    }
    updateGarageUI();
}

function buyUpgrade(type) {
    if (totalCoins >= costs[type] && upgrades[type] < 5) {
        totalCoins -= costs[type];
        upgrades[type]++;
        costs[type] = Math.floor(costs[type] * 1.6);
        updateGarageUI();
    }
}

function startGame() {
    garageScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    airtimeAlertEl.style.display = "none";
    
    car = { ...initialCarState };
    car.speed += (upgrades.motor - 1) * 0.06;      
    car.friction += (upgrades.pneu - 1) * 0.004;   
    
    activeItems = [];
    particles = [];
    spawnMarkers = {};
    airTimeFrames = 0;
    coinScoreEl.innerText = "0";
    distScoreEl.innerText = "0";
    fuelGaugeEl.style.width = "100%";
    fuelGaugeEl.style.background = "#2ecc71";
    
    inGame = true;
}

function backToGarage() {
    totalCoins += car.coins; 
    if(car.distance > highscore) {
        highscore = car.distance;
    }
    gameOverScreen.style.display = "none";
    garageScreen.style.display = "flex";
    inGame = false;
    updateGarageUI();
}

function getTerrain(x) {
    return canvas.height - 140 + Math.sin(x * 0.005) * 65 + Math.sin(x * 0.0015) * 45;
}

function generateWorldElements(carX) {
    let block = Math.floor(carX / 450);
    for (let i = block - 1; i <= block + 3; i++) {
        if (!spawnMarkers[i] && i > 0) {
            spawnMarkers[i] = true;
            let spawnX = i * 450 + Math.random() * 50;
            
            if (i % 2 === 0) {
                activeItems.push({ type: 'fuel', x: spawnX, y: 0, size: 14, collected: false });
            }
            
            activeItems.push({ type: 'coin', x: spawnX + 100, y: 0, size: 8, collected: false });
            activeItems.push({ type: 'coin', x: spawnX + 140, y: 0, size: 8, collected: false });
            activeItems.push({ type: 'coin', x: spawnX + 180, y: 0, size: 8, collected: false });
        }
    }
}

function drawGauge(x, y, radius, value, minVal, maxVal, label, unit, color, forceRedFlash = false) {
    if (forceRedFlash && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.fillStyle = "rgba(192, 57, 43, 0.9)";
    } else {
        ctx.fillStyle = "rgba(44, 62, 80, 0.85)";
    }
    
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2;
    for(let a = 0.75 * Math.PI; a <= 2.25 * Math.PI; a += 0.15 * Math.PI) {
        ctx.beginPath(); ctx.arc(x, y, radius - 4, a, a + 0.02); ctx.stroke();
    }

    let percent = (value - minVal) / (maxVal - minVal);
    percent = Math.max(0, Math.min(1, percent)); 
    let targetAngle = 0.75 * Math.PI + percent * (1.5 * Math.PI);

    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(targetAngle) * (radius - 12), y + Math.sin(targetAngle) * (radius - 12));
    ctx.stroke();

    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
    ctx.fillText(label, x, y + radius - 14);
    ctx.fillStyle = "#fffa65"; ctx.font = "11px Arial"; ctx.fillText(Math.floor(value) + unit, x, y - 8);
}

function update() {
    clouds.forEach(c => {
        if(inGame && car.alive) c.x -= car.vx * 0.1; 
        c.x -= c.speed;
        if(c.x + c.size * 2 < 0) c.x = canvas.width + c.size;
    });

    if (!inGame) {
        requestAnimationFrame(update);
        return;
    }

    // --- CÁLCULO DE COMBUSTÍVEL MODIFICADO (MAIS RÁPIDO) ---
    if (car.alive) {
        let fuelBurn = 0.12; // Consumo padrão aumentado para 0.12
        if (keys.ArrowRight) {
            fuelBurn = 0.35; // Consumo acelerando aumentado para 0.35
            if(Math.random()<0.4 && car.isGrounded) particles.push({ x: car.x - Math.cos(car.angle)*25, y: car.y - Math.sin(car.angle)*10, vx: -2, vy: -1, size: 5, alpha: 1 });
        }
        car.fuel -= fuelBurn;

        if (car.fuel <= 0) {
            car.fuel = 0; car.alive = false;
            failReasonEl.innerText = "SEM COMBUSTÍVEL!";
            gameOverScreen.style.display = "flex";
        }

        if (car.isGrounded) {
            if (keys.ArrowRight) car.vx += car.speed;
            if (keys.ArrowLeft) car.vx -= car.speed * 0.5;
        } else {
            if (keys.ArrowRight) car.vAngle += 0.01;
            if (keys.ArrowLeft) car.vAngle -= 0.01;
        }
    }

    car.vx *= car.friction; car.vy += car.gravity;
    car.angle += car.vAngle; car.vAngle *= 0.95;
    car.x += car.vx; car.y += car.vy;

    const groundY = getTerrain(car.x);
    const groundAheadY = getTerrain(car.x + 18);
    const groundBackY = getTerrain(car.x - 18);
    const targetAngle = Math.atan2(groundAheadY - groundBackY, 36);

    if (car.y + car.radius >= groundY) {
        car.y = groundY - car.radius;
        if (car.vy > 0) car.vy = car.vx * Math.sin(targetAngle);
        
        if (!car.isGrounded && airTimeFrames > 50) {
            let bonus = Math.floor(airTimeFrames * 1.5);
            car.coins += bonus;
            coinScoreEl.innerText = car.coins;
        }
        airTimeFrames = 0;
        airtimeAlertEl.style.display = "none";
        car.isGrounded = true;

        let susFactor = 0.3 + (upgrades.sus * 0.06); 
        car.angle = car.angle * (1 - susFactor) + targetAngle * susFactor;
        car.vAngle *= 0.5;

        let normalAngle = car.angle % (Math.PI * 2);
        if (Math.abs(normalAngle) > 1.5 && Math.abs(normalAngle) < 4.7 && car.alive) {
            car.alive = false;
            failReasonEl.innerText = "MOTORISTA CAPOTOU!";
            gameOverScreen.style.display = "flex";
        }
    } else {
        car.isGrounded = false;
        if (car.alive) {
            airTimeFrames++;
            if (airTimeFrames > 50) {
                airtimeAlertEl.style.display = "block";
                airtimeBonusEl.innerText = "+" + Math.floor(airTimeFrames * 1.5) + " BÔNUS";
            }
        }
    }

    let currentDist = Math.floor(car.x / 10) - 20;
    if (currentDist > car.distance) { car.distance = currentDist; distScoreEl.innerText = car.distance; }

    generateWorldElements(car.x);

    activeItems.forEach(item => {
        if (!item.y_fixed) { item.y = getTerrain(item.x) - (item.type==='fuel'?25:20); item.y_fixed = true; }
        if (!item.collected && Math.abs(car.x - item.x) < 30 && Math.abs(car.y - item.y) < 30) {
            item.collected = true;
            if (item.type === 'coin') { 
                car.coins += 50; 
                coinScoreEl.innerText = car.coins; 
            } else { 
                car.fuel = Math.min(100, car.fuel + 45); 
                fuelGaugeEl.style.background = "#2ecc71"; 
            }
        }
    });

    activeItems = activeItems.filter(item => item.x > car.x - 400);
    particles.forEach((p, idx) => { p.x += p.vx; p.y += p.vy; p.alpha -= 0.02; if(p.alpha<=0) particles.splice(idx,1); });

    fuelGaugeEl.style.width = car.fuel + "%";
    if (car.fuel < 25) fuelGaugeEl.style.background = "#e74c3c";

    ctx.fillStyle = "#74b9ff"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    clouds.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI*2);
        ctx.arc(c.x + c.size*0.6, c.y - c.size*0.2, c.size*0.8, 0, Math.PI*2);
        ctx.arc(c.x + c.size*1.2, c.y, c.size*0.6, 0, Math.PI*2);
        ctx.fill();
    });

    ctx.save();
    ctx.translate(-car.x + 200, 0);

    ctx.beginPath(); ctx.fillStyle = "#795548";
    for (let x = car.x - 300; x < car.x + 1000; x += 5) { let ty = getTerrain(x); if (x === car.x - 300) ctx.moveTo(x, canvas.height); ctx.lineTo(x, ty); }
    ctx.lineTo(car.x + 1000, canvas.height); ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = "#27ae60"; ctx.lineWidth = 6;
    for (let x = car.x - 300; x < car.x + 1000; x += 5) { let ty = getTerrain(x); if (x === car.x - 300) ctx.moveTo(x, ty); ctx.lineTo(x, ty); }
    ctx.stroke();

    activeItems.forEach(item => {
        if (!item.collected) {
            if (item.type === 'coin') { ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(item.x, item.y, item.size, 0, Math.PI*2); ctx.fill(); }
            else { ctx.fillStyle = "#e74c3c"; ctx.fillRect(item.x-10, item.y-12, 20, 24); }
        }
    });

    particles.forEach(p => { ctx.fillStyle = `rgba(140,140,140,${p.alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); });

    // CARRO COM A SKIN EQUIPADA
    let colors = skinColors[equippedSkin] || skinColors["default"];
    
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.fillStyle = colors[0]; ctx.fillRect(-car.width/2, -car.height, car.width, car.height);
    ctx.fillStyle = colors[1]; ctx.fillRect(-car.width/2, -car.height-6, 18, 6);
    ctx.fillStyle = "#3498db"; ctx.fillRect(8, -car.height-12, 14, 12);
    ctx.fillStyle = "#2c3e50"; ctx.beginPath(); ctx.arc(-car.width/3, 2, car.radius, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(car.width/3, 2, car.radius, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.restore();

    let speedKmh = Math.abs(car.vx) * 160; 
    let mockRPM = keys.ArrowRight ? 3000 + (speedKmh * 35) : 900 + (speedKmh * 15);
    
    let redlineFlash = false;
    if (!car.isGrounded && keys.ArrowRight) { 
        mockRPM = 7600 + Math.random() * 350; 
        redlineFlash = true; 
    }

    drawGauge(360, canvas.height - 55, 42, speedKmh, 0, 180, "SPEED", " km/h", "#e67e22");
    drawGauge(540, canvas.height - 55, 42, mockRPM, 0, 8000, "RPM", "", "#e74c3c", redlineFlash);

    requestAnimationFrame(update);
}

updateGarageUI();
update();
