import * as THREE from 'three';
import { PointerLockControls } from 'three-addons/controls/PointerLockControls.js';

/** ULTRACOPY - 3 ROOMS SYSTEM | GAIOT O LEGAL **/

// --- CONFIGURAÇÃO ---
const CONFIG = {
    pixelScale: 2,
    gravity: 0.015,
    playerHeight: 1.8,
    speed: 0.12,
    dashForce: 0.7,
    parryWindow: 300 // ms
};

// --- ESTADO DO JOGO ---
let scene, camera, renderer, controls, clock = new THREE.Clock();
let keys = {}, velocity = new THREE.Vector3(), isStarted = false;
let playerHealth = 100, currentWeapon = 'pistol', canDash = true, lastDash = 0;
let enemies = [], projectiles = [], interactiveObjects = [], collidables = [];
let weaponGroup = new THREE.Group(), weaponMesh;
let doors = []; // Portas bloqueadas
let bossDefeated = false;

// Grappling Hook State
let grappleState = {
    active: false,
    target: new THREE.Vector3(),
    line: null,
    speed: 0.4
};

// --- INICIALIZAÇÃO ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.03);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth / CONFIG.pixelScale, window.innerHeight / CONFIG.pixelScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.imageRendering = 'pixelated';
    document.getElementById('game-container').appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);
    document.getElementById('start-btn').addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => { 
        document.getElementById('start-menu').style.display = 'none'; 
        isStarted = true; 
    });
    controls.addEventListener('unlock', () => { 
        if (playerHealth > 0 && !bossDefeated) {
            document.getElementById('start-menu').style.display = 'flex'; 
            isStarted = false; 
        }
    });

    document.addEventListener('keydown', (e) => { keys[e.code] = true; handleInputs(e); });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });
    document.addEventListener('mousedown', () => { if (isStarted) shoot(); });

    setupPlayer();
    generateWorld();
    animate();
}

function setupPlayer() {
    scene.add(camera);
    camera.add(weaponGroup);
    weaponGroup.position.set(0.4, -0.4, -1);

    const geo = new THREE.BoxGeometry(0.15, 0.2, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    weaponMesh = new THREE.Mesh(geo, mat);
    weaponGroup.add(weaponMesh);

    camera.position.set(0, CONFIG.playerHeight, 10);
}

// --- WORLD GENERATION (3 PROGRESSIVE ROOMS) ---
function generateWorld() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    // SALA 1 (ENTRADA)
    createBox(0, -0.5, 0, 30, 1, 30, 0x111111, false); 
    createBox(15.5, 5, 0, 1, 10, 30, 0x00ffff); // Leste
    createBox(-15.5, 5, 0, 1, 10, 30, 0x00ffff); // Oeste
    createBox(0, 5, 15.5, 30, 10, 1, 0x00ffff); // Sul
    
    // Conector Norte Sala 1
    createBox(10, 5, -15, 11, 10, 1, 0x00ffff);
    createBox(-10, 5, -15, 11, 10, 1, 0x00ffff);
    createBox(0, 8.5, -15, 9, 3, 1, 0x00ffff);
    
    // PORTA 1
    const door1 = createBox(0, 3.5, -15, 9, 7, 1, 0xff0044);
    doors.push({ mesh: door1, room: 1 });

    // SALA 2
    const s2z = -50;
    createBox(0, -0.5, s2z, 40, 1, 40, 0x111111, false);
    createBox(20.5, 7.5, s2z, 1, 15, 40, 0xff8800); // Leste
    createBox(-20.5, 7.5, s2z, 1, 15, 40, 0xff8800); // Oeste
    
    // Conector Norte Sala 2
    createBox(14, 7.5, -70, 13, 15, 1, 0xff8800);
    createBox(-14, 7.5, -70, 13, 15, 1, 0xff8800);
    createBox(0, 12.5, -70, 15, 5, 1, 0xff8800);
    
    // PORTA 2
    const door2 = createBox(0, 5, -70, 15, 10, 1, 0xff0044);
    doors.push({ mesh: door2, room: 2 });

    // SALA 3 (BOSS)
    const s3z = -120;
    createBox(0, -0.5, s3z, 60, 1, 80, 0x050505, false);
    createBox(30.5, 15, s3z, 1, 30, 80, 0x00ffff);
    createBox(-30.5, 15, s3z, 1, 30, 80, 0x00ffff);
    createBox(0, 15, -160.5, 60, 30, 1, 0x00ffff);

    // ENEMIES
    spawnEnemy('Vigila', 5, 1, 0, 1);
    spawnEnemy('Vigila', -5, 1, -5, 1);
    spawnEnemy('Drone', 0, 6, -5, 1);

    spawnEnemy('Sentinela', -10, 1, -45, 2);
    spawnEnemy('Sentinela', 10, 1, -55, 2);
    spawnEnemy('Drone', -5, 8, -50, 2);
    spawnEnemy('Drone', 5, 10, -60, 2);
    spawnEnemy('Vigila', 0, 1, -40, 2);

    enemies.push(new ScorpionBoss(0, 3, -120));

    // Terminal na Sala 1
    const terminal = createBox(13, 0.75, 13, 0.8, 1.5, 0.8, 0x00ff00);
    interactiveObjects.push({
        mesh: terminal, action: () => {
            localStorage.setItem('ultracopy_save', JSON.stringify({ pos: camera.position, health: playerHealth }));
            flashScreen('rgba(255,255,0,0.5)');
            alert("LOCALIZAÇÃO SALVA");
        }
    });
}

function createBox(x, y, z, w, h, d, col, collidable = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    if (collidable) collidables.push(mesh);
    return mesh;
}

// --- GAMEPLAY LOGIC ---
function handleInputs(e) {
    if (!isStarted) return;
    if (e.code === 'ShiftLeft' && canDash) dash();
    if (e.code === 'KeyF') parry();
    if (e.code === 'KeyE') interact();
    if (e.code === 'Digit1') switchWeapon('pistol');
    if (e.code === 'Digit2') switchWeapon('shotgun');
    if (e.code === 'Digit3') switchWeapon('instant_kill');
    if (e.code === 'Digit4') switchWeapon('grapple');
    if (e.code === 'Space' && camera.position.y <= CONFIG.playerHeight + 0.1) velocity.y = 0.25;
}

function dash() {
    const now = Date.now(); if (now - lastDash < 1000) return;
    lastDash = now;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize(); velocity.add(dir.multiplyScalar(CONFIG.dashForce));
    document.getElementById('dash-indicator').style.width = '0%';
    setTimeout(() => document.getElementById('dash-indicator').style.width = '100%', 1000);
}

function parry() {
    weaponMesh.rotation.x = -Math.PI / 3;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    projectiles.forEach(p => {
        if (p.isParryable !== false && ray.ray.distanceToPoint(p.position) < 2) {
            p.velocity.multiplyScalar(-2); p.isReflected = true; heal(20); flashScreen('white');
        }
    });
    setTimeout(() => weaponMesh.rotation.x = 0, 200);
}

function interact() {
    interactiveObjects.forEach(obj => {
        if (camera.position.distanceTo(obj.mesh.position) < 3) obj.action();
    });
}

function switchWeapon(type) {
    currentWeapon = type;
    document.getElementById('weapon-name').innerText = type.toUpperCase().replace('_', ' ');
    const colors = { pistol: 0x555555, shotgun: 0xaa5500, instant_kill: 0xffff00, grapple: 0x00ff00 };
    weaponMesh.material.color.setHex(colors[type] || 0xffffff);
}

function shoot() {
    if (currentWeapon === 'grapple') {
        if (grappleState.active) { cancelGrapple(); return; }
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits = ray.intersectObjects(collidables);
        if (hits.length > 0) startGrapple(hits[0].point);
        return;
    }
    const ray = new THREE.Raycaster();
    const isShotgun = currentWeapon === 'shotgun';
    const num = isShotgun ? 10 : 1;
    for (let i = 0; i < num; i++) {
        const spread = isShotgun ? new THREE.Vector2((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2) : new THREE.Vector2(0, 0);
        ray.setFromCamera(spread, camera);
        const targets = enemies.flatMap(e => e.weakPoint ? [e.mesh, e.weakPoint] : [e.mesh]);
        const hits = ray.intersectObjects(targets);
        if (hits.length > 0) {
            const hitObj = hits[0].object;
            const enemy = enemies.find(e => e.mesh === hitObj || (e.weakPoint && e.weakPoint === hitObj));
            if (enemy) {
                let d = currentWeapon === 'instant_kill' ? 1000 : (isShotgun ? 12 : 25);
                if (hitObj === enemy.weakPoint) d *= 2;
                enemy.takeDamage(d);
            }
        }
    }
}

function startGrapple(p) {
    grappleState.active = true; grappleState.target.copy(p);
    const geom = new THREE.BufferGeometry().setFromPoints([camera.position, p]);
    grappleState.line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    scene.add(grappleState.line);
}

function cancelGrapple() { 
    grappleState.active = false; 
    if (grappleState.line) { scene.remove(grappleState.line); grappleState.line = null; }
}

// --- ENEMIES & COMBAT ---
class Enemy {
    constructor(type, x, y, z, room) {
        this.type = type; this.room = room; this.hp = type === 'Sentinela' ? 200 : 80;
        const col = type === 'Vigila' ? 0xff0044 : 0x00ffff;
        this.mesh = createBox(x, y, z, 1.2, type === 'Vigila' ? 2.2 : 1.2, 1.2, col, false);
        this.mesh.material.wireframe = true;
    }
    update() {
        if (this.type === 'Vigila') {
            const dir = new THREE.Vector3().subVectors(camera.position, this.mesh.position).normalize();
            dir.y = 0; this.mesh.position.addScaledVector(dir, 0.05);
            if (this.mesh.position.distanceTo(camera.position) < 1.5) damage(0.25);
        } else if (Math.random() < 0.01) this.fire();
    }
    fire() {
        const p = createBox(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z, 0.3, 0.3, 0.3, 0x00ffff, false);
        p.velocity = new THREE.Vector3().subVectors(camera.position, p.position).normalize().multiplyScalar(0.2);
        projectiles.push(p);
    }
    flashRed() {
        if (!this.mesh) return;
        const oldCol = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => { if (this.mesh) this.mesh.material.color.setHex(oldCol); }, 100);
    }
    takeDamage(d) {
        this.hp -= d;
        this.flashRed();
        if (this.hp <= 0) { 
            this.disintegrate();
        }
    }
    disintegrate() {
        if (this.isDying) return;
        this.isDying = true;
        const mesh = this.mesh;
        const interval = setInterval(() => {
            if (mesh.scale.x > 0.1) {
                mesh.scale.multiplyScalar(0.8);
                mesh.position.y += 0.1;
                mesh.rotation.y += 0.5;
            } else {
                clearInterval(interval);
                scene.remove(mesh);
                enemies = enemies.filter(e => e !== this); 
                checkRoomClear(this.room);
            }
        }, 30);
    }
}

class ScorpionBoss extends Enemy {
    constructor(x, y, z) {
        super('Boss', x, y, z, 3); this.hp = 1200; this.angle = 0;
        scene.remove(this.mesh);
        this.group = new THREE.Group(); this.group.position.set(x, y, z);
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 6), new THREE.MeshLambertMaterial({ color: 0x000044 }));
        this.group.add(this.mesh);
        this.weakPoint = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 1.2), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
        this.weakPoint.position.set(0, 0, -3.2); this.group.add(this.weakPoint);
        scene.add(this.group);
    }
    update() {
        this.group.lookAt(camera.position.x, 3, camera.position.z);
        this.angle += 0.01; this.group.position.x = Math.sin(this.angle) * 15;
        if (camera.position.distanceTo(this.group.position) < 60) {
            document.getElementById('boss-hud').style.display = 'block';
            document.getElementById('boss-health-bar').style.width = (this.hp / 1200) * 100 + '%';
        }
        if (Math.random() < 0.02) this.fire();
    }
    takeDamage(d) {
        this.hp -= d; 
        // Flash red for both parts
        this.mesh.material.color.setHex(0xff0000);
        this.weakPoint.material.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.mesh) this.mesh.material.color.setHex(0x000044);
            if (this.weakPoint) this.weakPoint.material.color.setHex(0xff0000);
        }, 100);

        flashScreen('rgba(255,0,0,0.3)');
        if (this.hp <= 0) { 
            this.disintegrate();
        }
    }
    disintegrate() {
        if (this.isDying) return;
        this.isDying = true;
        const group = this.group;
        const interval = setInterval(() => {
            if (group.scale.x > 0.05) {
                group.scale.multiplyScalar(0.9);
                group.position.y += 0.2;
                group.rotation.x += 0.2;
            } else {
                clearInterval(interval);
                scene.remove(group); 
                enemies = enemies.filter(e => e !== this); 
                bossDefeated = true; 
                showVictory(); 
            }
        }, 30);
        document.getElementById('boss-hud').style.display = 'none';
    }
}

function checkRoomClear(roomID) {
    if (enemies.filter(e => e.room === roomID).length === 0) {
        const d = doors.find(door => door.room === roomID);
        if (d) { 
            scene.remove(d.mesh); 
            collidables = collidables.filter(c => c !== d.mesh); 
            flashScreen('rgba(0,255,0,0.3)'); 
        }
    }
}

function showVictory() {
    isStarted = false; controls.unlock();
    document.getElementById('victory-menu').style.display = 'flex';
}

function spawnEnemy(t, x, y, z, r) { enemies.push(new Enemy(t, x, y, z, r)); }

function damage(v) {
    if (bossDefeated) return;
    playerHealth -= v; updateHUD(); flashScreen('rgba(255,0,0,0.5)');
    if (playerHealth <= 0) location.reload();
}

function heal(v) { playerHealth = Math.min(100, playerHealth + v); updateHUD(); }

function flashScreen(c) {
    const f = document.getElementById('screen-flash');
    f.style.backgroundColor = c; f.style.opacity = 0.5;
    setTimeout(() => f.style.opacity = 0, 100);
}

function updateHUD() {
    document.getElementById('health-text').innerText = Math.ceil(playerHealth);
    document.getElementById('health-bar').style.width = playerHealth + '%';
}

function animate() {
    requestAnimationFrame(animate);
    if (!isStarted) return;
    
    if (!grappleState.active) velocity.y -= CONFIG.gravity;
    else {
        const dir = new THREE.Vector3().subVectors(grappleState.target, camera.position);
        if (dir.length() < 2) cancelGrapple();
        else {
            velocity.add(dir.normalize().multiplyScalar(0.4));
            if (grappleState.line) {
                const pos = grappleState.line.geometry.attributes.position.array;
                pos[0] = camera.position.x; pos[1] = camera.position.y - 0.2; pos[2] = camera.position.z;
                grappleState.line.geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    let moveForward = Number(keys['KeyW'] || 0) - Number(keys['KeyS'] || 0);
    let moveRight = Number(keys['KeyD'] || 0) - Number(keys['KeyA'] || 0);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
    const move = new THREE.Vector3().addScaledVector(dir, moveForward * CONFIG.speed).addScaledVector(side, -moveRight * CONFIG.speed);
    
    // Simplifed Movement/Collision
    camera.position.x += move.x + velocity.x;
    camera.position.z += move.z + velocity.z;
    velocity.multiplyScalar(0.9);

    camera.position.y += velocity.y;
    if (camera.position.y < CONFIG.playerHeight) { camera.position.y = CONFIG.playerHeight; velocity.y = 0; }

    enemies.forEach(e => e.update());
    projectiles.forEach((p, i) => {
        p.position.add(p.velocity);
        if (p.position.distanceTo(camera.position) < 1.4 && !p.isReflected) {
            damage(20); scene.remove(p); projectiles.splice(i, 1);
        } else if (p.position.length() > 300) {
            scene.remove(p); projectiles.splice(i, 1);
        }
    });

    renderer.render(scene, camera);
}

init();
