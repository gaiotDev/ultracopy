import * as THREE from 'three';
import { PointerLockControls } from 'three-addons/controls/PointerLockControls.js';

/** ULTRACOPY - COMPLETE ENGINE | GAIOT O LEGAL **/

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

// Grappling Hook State
let grappleState = {
    active: false,
    target: new THREE.Vector3(),
    line: null,
    speed: 0.4
};

// Boss State
let boss = null;

// --- INICIALIZAÇÃO ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.04);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth / CONFIG.pixelScale, window.innerHeight / CONFIG.pixelScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.imageRendering = 'pixelated';
    document.getElementById('game-container').appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);
    document.getElementById('start-btn').addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => { document.getElementById('start-menu').style.display = 'none'; isStarted = true; });
    controls.addEventListener('unlock', () => { document.getElementById('start-menu').style.display = 'flex'; isStarted = false; });

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

    camera.position.set(0, CONFIG.playerHeight, 5);
}

// --- WORLD GENERATION (3 ROOMS WITH OPENINGS) ---
function generateWorld() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.PointLight(0xffffff, 2, 80);
    sun.position.set(0, 20, -40);
    scene.add(sun);

    // SALA 1 (ARENA - MAGENTA & CYAN)
    createBox(0, -0.5, 0, 30, 1, 30, 0xff00ff, false); // Chão Magenta (Não-colidível para Gancho)
    createBox(0, 10, 0, 30, 1, 30, 0x440044, true);  // Teto Roxo Escuro (Colidível)

    // Parede Norte com BURACO (Z = -15.5)
    createBox(-10.5, 5, -15, 9, 10, 1, 0x00ffff); // Esquerda
    createBox(10.5, 5, -15, 9, 10, 1, 0x00ffff);  // Direita
    createBox(0, 8.5, -15, 12, 3, 1, 0x00ffff);   // Topo (Viga)

    createBox(-15.5, 5, 0, 1, 10, 30, 0x00ffff); // Parede Oeste
    createBox(15.5, 5, 0, 1, 10, 30, 0x00ffff);  // Parede Leste
    createBox(0, 5, 15.5, 30, 10, 1, 0x00ffff);  // Parede Sul (Entrada Traseira)

    // CORREDOR E SAVE (AMARELO & LARANJA)
    createBox(0, -0.5, -30, 12, 1, 30, 0xffff00, false); // Chão Amarelo
    createBox(0, 10, -30, 12, 1, 30, 0xffaa00, true);   // Teto Laranja
    createBox(-6.5, 5, -30, 1, 10, 30, 0xff4400);   // Parede Esquerda
    createBox(6.5, 5, -30, 1, 10, 30, 0xff4400);    // Parede Direita

    const terminal = createBox(3, 0.75, -35, 0.8, 1.5, 0.8, 0x00ff00);
    interactiveObjects.push({
        mesh: terminal, name: 'Terminal de Save', action: () => {
            localStorage.setItem('ultracopy_save', JSON.stringify({ pos: camera.position, health: playerHealth }));
            flashScreen('yellow');
            alert("SISTEMA SALVO NO NÚCLEO");
        }
    });

    // Saída do Corredor com BURACO (Z = -45)
    createBox(-18.5, 15, -45, 13, 30, 1, 0xff0000); // Esquerda (na Sala 2)
    createBox(18.5, 15, -45, 13, 30, 1, 0xff0000);  // Direita
    createBox(0, 22.5, -45, 24, 15, 1, 0xff0000);  // Topo

    // SALA 2 (FINAL - NEON GREEN & BLOOD RED)
    createBox(0, -0.5, -80, 50, 1, 70, 0x39ff14, false); // Chão Arena (Não-colidível)
    createBox(0, 30, -80, 50, 1, 70, 0x0000ff, true);   // Teto Azul (Colidível)
    createBox(25.5, 15, -80, 1, 30, 70, 0xff0000);  // Lateral Direita

    // Parede Fundo Sala 2 com ABERTURA para o Boss (Z = -115.5)
    createBox(-19, 15, -115.5, 12, 30, 1, 0xff0000); // Esquerda
    createBox(19, 15, -115.5, 12, 30, 1, 0xff0000);  // Direita
    createBox(0, 22.5, -115.5, 26, 15, 1, 0xff0000); // Topo

    // Parede Frontal da Sala 2 (Z = -45.5 aproximado)
    createBox(-15.5, 15, -45, 19, 30, 1, 0xff0000); // Left 1
    createBox(15.5, 15, -45, 19, 30, 1, 0xff0000);  // Right 1

    // Inimigos
    spawnEnemy('Vigila', 5, 1, -5);
    spawnEnemy('Vigila', -5, 1, -10);
    spawnEnemy('Drone', 0, 12, -70);
    spawnEnemy('Drone', 10, 15, -80);
    spawnEnemy('Sentinela', 0, 1, -95);

    // SALA DO CHEFE (BOSS ROOM - DARK RED & BLACK)
    // Conector/Portão para o Boss (Z = -115)
    createBox(0, 5, -115, 12, 10, 5, 0x111111); // Bloco de transição

    // Arena do Boss (Z = -180)
    createBox(0, -0.5, -180, 60, 1, 80, 0x00ffff, false); // Chão Ciano Vibrante
    createBox(0, 30, -180, 60, 1, 80, 0xff00ff, true);   // Teto Magenta Vibrante

    // Parede Fundo com BURACO de Saída (Z = -220.5)
    createBox(-20, 15, -220.5, 20, 30, 1, 0xffff00); // Esquerda Amarela
    createBox(20, 15, -220.5, 20, 30, 1, 0xffff00);  // Direita Amarela
    createBox(0, 22.5, -220.5, 20, 15, 1, 0xffff00); // Topo
    // Buraco central (0, 7.5, -220.5) com 20x15 está vazio agora

    createBox(-30.5, 15, -180, 1, 30, 80, 0x00ff00); // Parede Oeste Verde Neon
    createBox(30.5, 15, -180, 1, 30, 80, 0x00ff00);  // Parede Leste Verde Neon
    createBox(0, 15, -139.5, 60, 30, 1, 0x00ff00);  // Parede Entrada

    // SPAWN BOSS
    boss = new ScorpionBoss(0, 3, -190);
    enemies.push(boss);

    // CORREDOR DE RETORNO (LOOP PARA A SALA 1)
    // Conecta o fundo da arena do boss (Z = -220) lateralmente de volta ao início
    createBox(-40, -0.5, -220, 40, 1, 15, 0x550055, false); // Saída lateral
    createBox(-55, -0.5, -100, 15, 1, 260, 0x550055, false); // Corredor longo
    createBox(-55, 10, -100, 15, 1, 260, 0x330033, true);   // Teto
    createBox(-62.5, 5, -100, 1, 10, 260, 0x00ffff);        // Parede externa
    createBox(-47.5, 5, -80, 1, 10, 220, 0x00ffff);         // Parede interna

    // Conexão final com a Sala 1 (Z = 10)
    createBox(-30, -0.5, 5, 40, 1, 15, 0x00ffff, false);
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
}

function dash() {
    const now = Date.now();
    if (now - lastDash < 1000) return;
    lastDash = now;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    velocity.add(dir.multiplyScalar(CONFIG.dashForce));

    document.getElementById('dash-indicator').style.width = '0%';
    setTimeout(() => document.getElementById('dash-indicator').style.width = '100%', 1000);
}

function parry() {
    weaponMesh.rotation.x = -Math.PI / 3;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.far = 4;

    projectiles.forEach((p, i) => {
        if (p.isParryable !== false && ray.ray.distanceToPoint(p.position) < 1.4) {
            p.velocity.multiplyScalar(-2);
            p.isReflected = true;
            heal(20);
            flashScreen('white');
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
    let name = type.toUpperCase().replace('_', ' ');
    document.getElementById('weapon-name').innerText = name;

    // Feedback visual da arma
    if (type === 'pistol') {
        weaponMesh.material.color.setHex(0x555555);
        document.querySelector('.crosshair').style.borderColor = 'var(--accent)';
    } else if (type === 'shotgun') {
        weaponMesh.material.color.setHex(0xaa5500);
        document.querySelector('.crosshair').style.borderColor = '#ff4400';
    } else if (type === 'instant_kill') {
        weaponMesh.material.color.setHex(0xffff00); // Amarelo Neon
        document.querySelector('.crosshair').style.borderColor = '#ffffff';
        flashScreen('rgba(255,255,0,0.2)'); // Piscar a tela amarelo ao equipar
    } else if (type === 'grapple') {
        weaponMesh.material.color.setHex(0x00ff00); // Verde Batman
        document.querySelector('.crosshair').style.borderColor = '#00ff00';
    }
}

function shoot() {
    if (currentWeapon === 'grapple') {
        if (grappleState.active) {
            cancelGrapple();
            return;
        }

        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits = ray.intersectObjects([...collidables, ...enemies.map(e => e.mesh)]);

        if (hits.length > 0) {
            // Se o normal da face for para cima (Y > 0.5), é um chão. Não grudar.
            if (hits[0].face.normal.y <= 0.5) {
                startGrapple(hits[0].point);
            }
        }
        return;
    }

    weaponGroup.position.z += 0.2;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);

    if (currentWeapon === 'instant_kill') {
        const hits = ray.intersectObjects(enemies.flatMap(e => e.weakPoint ? [e.mesh, e.weakPoint] : [e.mesh]));
        if (hits.length > 0) {
            // Priorizar o weakPoint se houver vários acertos
            let hitWeakpoint = hits.find(h => enemies.some(e => e.weakPoint === h.object));
            const hitObj = hitWeakpoint ? hitWeakpoint.object : hits[0].object;
            const enemy = enemies.find(e => e.mesh === hitObj || (e.weakPoint && e.weakPoint === hitObj));

            if (enemy) {
                if (enemy.type === 'ScorpionBoss') {
                    if (hitObj === enemy.weakPoint) {
                        enemy.takeDamage(500); // Super dano
                        flashScreen('rgba(255,255,0,0.6)');
                    }
                } else {
                    enemy.takeDamage(100000);
                    flashScreen('rgba(255,255,255,0.5)');
                }
            }
        }
    } else {
        const factor = currentWeapon === 'pistol' ? 1 : 10; // Mais estilhaços para shotgun
        for (let i = 0; i < factor; i++) {
            const spread = currentWeapon === 'pistol' ? new THREE.Vector2(0, 0) : new THREE.Vector2((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
            ray.setFromCamera(spread, camera);

            // Check enemies AND boss weakpoint
            const targets = enemies.flatMap(e => e.weakPoint ? [e.mesh, e.weakPoint] : [e.mesh]);
            const hits = ray.intersectObjects(targets);

            if (hits.length > 0) {
                // Priorizar o weakPoint
                let hitWeakpoint = hits.find(h => enemies.some(e => e.weakPoint === h.object));
                const hitObj = hitWeakpoint ? hitWeakpoint.object : hits[0].object;
                const enemy = enemies.find(e => e.mesh === hitObj || (e.weakPoint && e.weakPoint === hitObj));

                if (enemy) {
                    if (enemy.type === 'ScorpionBoss') {
                        if (hitObj === enemy.weakPoint) {
                            enemy.takeDamage(currentWeapon === 'pistol' ? 20 : 10);
                            flashScreen('rgba(255,0,0,0.3)');
                        }
                    } else {
                        enemy.takeDamage(currentWeapon === 'pistol' ? 25 : 15);
                    }
                }
            }
        }
    }
    setTimeout(() => weaponGroup.position.z -= 0.2, 50);
}

function startGrapple(point) {
    grappleState.active = true;
    grappleState.target.copy(point);

    // Create line mesh
    const points = [camera.position, point];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    grappleState.line = new THREE.Line(geometry, material);
    scene.add(grappleState.line);
}

function cancelGrapple() {
    grappleState.active = false;
    if (grappleState.line) {
        scene.remove(grappleState.line);
        grappleState.line = null;
    }
}

// --- ENEMIES & COMBAT ---
class Enemy {
    constructor(type, x, y, z) {
        this.type = type;
        this.hp = type === 'Sentinela' ? 200 : 60;
        const color = type === 'Vigila' ? 0xff0044 : (type === 'Drone' ? 0x00ffff : 0xffffff);
        this.mesh = createBox(x, y, z, 1, type === 'Vigila' ? 2 : 1, 1, color, false);
        this.mesh.material.wireframe = true;
    }
    update() {
        if (this.type === 'Vigila') {
            const dir = new THREE.Vector3().subVectors(camera.position, this.mesh.position).normalize();
            dir.y = 0;

            // Colisão simples do inimigo
            if (!checkCollision(this.mesh.position, dir.clone().multiplyScalar(0.04), 0.5)) {
                this.mesh.position.addScaledVector(dir, 0.04);
            }

            if (this.mesh.position.distanceTo(camera.position) < 1.5) damage(0.3);
        } else if (this.type === 'Drone') {
            if (Math.random() < 0.01) this.fire();
        } else if (this.type === 'Sentinela') {
            this.mesh.lookAt(camera.position);
            if (Math.random() < 0.005) this.fire();
        }
    }
    fire() {
        const p = createBox(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z, 0.3, 0.3, 0.3, 0x00ffff, false);
        p.velocity = new THREE.Vector3().subVectors(camera.position, this.mesh.position).normalize().multiplyScalar(0.2);
        projectiles.push(p);
    }
    takeDamage(d) {
        this.hp -= d;
        if (this.hp <= 0) {
            scene.remove(this.mesh);
            enemies = enemies.filter(e => e !== this);
        }
    }
}

class ScorpionBoss extends Enemy {
    constructor(x, y, z) {
        super('ScorpionBoss', x, y, z);
        this.hp = 1000;
        this.angle = 0;

        // Custom Mesh for Boss (Scorpion-like)
        scene.remove(this.mesh);
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);

        // Body (Dark Blue)
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 6), new THREE.MeshLambertMaterial({ color: 0x000044 }));
        this.group.add(body);
        this.mesh = body; // For reference in some logic

        // Tail (Dark Blue)
        const tail = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshLambertMaterial({ color: 0x000022 }));
        tail.position.set(0, 3, 3);
        this.group.add(tail);

        // WEAK POINT (The Red Part) - AUMENTADO E MAIS PROTRAÍDO
        this.weakPoint = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 0.8), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
        this.weakPoint.position.set(0, 0.5, -3.2); // Fica à frente do corpo azul
        this.group.add(this.weakPoint);

        scene.add(this.group);
    }

    update() {
        // Look at player
        this.group.lookAt(camera.position.x, this.group.position.y, camera.position.z);

        // Movement: Circle the arena center lightly
        this.angle += 0.01;
        this.group.position.x = Math.sin(this.angle) * 10;
        this.group.position.z = -180 + Math.cos(this.angle) * 5;

        // Mostrar HUD se o player estiver perto
        const dist = camera.position.distanceTo(this.group.position);
        const hud = document.getElementById('boss-hud');
        if (dist < 40) {
            hud.style.display = 'block';
            this.updateHUD();
        } else {
            hud.style.display = 'none';
        }

        // Attacks
        if (Math.random() < 0.03) this.fireStinger(); // Unparryable
        if (Math.random() < 0.01) this.fireBurst();   // Parryable
    }

    fireStinger() {
        const p = createBox(this.group.position.x, this.group.position.y + 4, this.group.position.z, 0.8, 0.8, 0.8, 0xffaa00, false);
        p.velocity = new THREE.Vector3().subVectors(camera.position, p.position).normalize().multiplyScalar(0.4);
        p.isParryable = false; // MECÂNICA PEDIDA
        p.material.emissive = new THREE.Color(0xff4400);
        projectiles.push(p);
    }

    fireBurst() {
        for (let i = 0; i < 3; i++) {
            const p = createBox(this.group.position.x + (i - 1), this.group.position.y + 1, this.group.position.z, 0.4, 0.4, 0.4, 0x00ffff, false);
            p.velocity = new THREE.Vector3().subVectors(camera.position, p.position).normalize().multiplyScalar(0.2);
            projectiles.push(p);
        }
    }

    updateHUD() {
        const bar = document.getElementById('boss-health-bar');
        const percentage = (this.hp / 1000) * 100;
        bar.style.width = Math.max(0, percentage) + '%';
    }

    takeDamage(d) {
        this.hp -= d;
        this.updateHUD();
        flashScreen('rgba(255, 0, 0, 0.3)');
        if (this.hp <= 0) {
            document.getElementById('boss-hud').style.display = 'none';
            scene.remove(this.group);
            enemies = enemies.filter(e => e !== this);
            alert("MAQUINÁRIO DESTRUÍDO: ESCORPIÃO ANIQUILADO");
        }
    }
}

function spawnEnemy(t, x, y, z) { enemies.push(new Enemy(t, x, y, z)); }

function damage(val) {
    playerHealth -= val;
    updateHUD();
    flashScreen('red');
    if (playerHealth <= 0) location.reload();
}

function heal(val) {
    playerHealth = Math.min(100, playerHealth + val);
    updateHUD();
}

function flashScreen(c) {
    const f = document.getElementById('screen-flash');
    f.style.backgroundColor = c;
    f.style.opacity = 0.4;
    setTimeout(() => f.style.opacity = 0, 100);
}

function updateHUD() {
    document.getElementById('health-text').innerText = Math.ceil(playerHealth);
    document.getElementById('health-bar').style.width = playerHealth + '%';
}

// --- COLLISION SYSTEM ---
function checkCollision(pos, move, radius = 0.5) {
    const nextPos = pos.clone().add(move);
    for (let obj of collidables) {
        const box = new THREE.Box3().setFromObject(obj);
        // Expandir a caixa com o raio do jogador
        box.expandByScalar(radius);
        if (box.containsPoint(nextPos)) return true;
    }
    return false;
}

// --- UPDATE LOOP ---
function animate() {
    requestAnimationFrame(animate);
    if (!isStarted) return;

    const delta = clock.getDelta();

    // Física de Gravidade
    if (!grappleState.active) velocity.y -= CONFIG.gravity;

    // Grappling Hook Movement
    if (grappleState.active) {
        const dir = new THREE.Vector3().subVectors(grappleState.target, camera.position);
        if (dir.length() < 2) {
            cancelGrapple();
        } else {
            dir.normalize();
            velocity.add(dir.multiplyScalar(grappleState.speed));

            // Ativar visual da corda
            if (grappleState.line) {
                const positions = grappleState.line.geometry.attributes.position.array;
                // Posição 0: Câmera (Origem)
                positions[0] = camera.position.x;
                positions[1] = camera.position.y - 0.2;
                positions[2] = camera.position.z;
                // Posição 1: Alvo (Já está fixo)
                grappleState.line.geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    // Inputs de movimento (WASD corrigido para direção da câmera)
    let moveForward = Number(keys['KeyW'] || 0) - Number(keys['KeyS'] || 0);
    let moveRight = Number(keys['KeyD'] || 0) - Number(keys['KeyA'] || 0);

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const sideDirection = new THREE.Vector3();
    sideDirection.crossVectors(camera.up, direction).normalize();

    const finalMove = new THREE.Vector3();
    finalMove.addScaledVector(direction, moveForward * CONFIG.speed);
    finalMove.addScaledVector(sideDirection, -moveRight * CONFIG.speed);

    // Colisão Horizontal
    if (!checkCollision(camera.position, new THREE.Vector3(finalMove.x, 0, 0))) {
        camera.position.x += finalMove.x;
    }
    if (!checkCollision(camera.position, new THREE.Vector3(0, 0, finalMove.z))) {
        camera.position.z += finalMove.z;
    }

    // Dash e Inércia
    velocity.multiplyScalar(0.9);
    if (!checkCollision(camera.position, new THREE.Vector3(velocity.x, 0, 0))) camera.position.x += velocity.x;
    if (!checkCollision(camera.position, new THREE.Vector3(0, 0, velocity.z))) camera.position.z += velocity.z;

    // Movimento Vertical
    camera.position.y += velocity.y;
    if (camera.position.y < CONFIG.playerHeight) {
        camera.position.y = CONFIG.playerHeight;
        velocity.y = 0;
        if (keys['Space']) velocity.y = 0.25;
    }

    // Inimigos e Projéteis
    enemies.forEach(e => e.update());
    projectiles.forEach((p, i) => {
        p.position.add(p.velocity);
        if (p.position.distanceTo(camera.position) < 1.2 && !p.isReflected) {
            damage(20);
            scene.remove(p);
            projectiles.splice(i, 1);
        }
        if (p.position.length() > 200) { scene.remove(p); projectiles.splice(i, 1); }
    });

    // Weapon Sway
    const time = Date.now() * 0.005;
    weaponGroup.position.y = -0.4 + Math.sin(time * 2) * 0.01;
    weaponGroup.position.x = 0.4 + Math.cos(time) * 0.01;

    // Check interaction range
    let near = false;
    interactiveObjects.forEach(obj => { if (camera.position.distanceTo(obj.mesh.position) < 3) near = true; });
    document.getElementById('interaction-msg').style.display = near ? 'block' : 'none';

    renderer.render(scene, camera);
}

init();
