const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const messageDisplay = document.getElementById('messageBoard');
const resetButton = document.getElementById('resetButton');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Game Settings
const PLAYER_SIZE = 30;
const PLAYER_SPEED = 5;
const ENEMY_SIZE = 25;
const ENEMY_SPEED = 1;
const LASER_WIDTH = 5;
const LASER_HEIGHT = 10; // Make lasers slightly shorter
const LASER_SPEED = 6;   // Speed is magnitude of velocity vector
const LASER_MAX_BOUNCES = 3; // How many times lasers can bounce
const ENEMY_SHOOT_INTERVAL_MIN = 100; // Frames
const ENEMY_SHOOT_INTERVAL_MAX = 250; // Frames
const MAX_ENEMIES = 5;
const BOSS_SIZE = 80;
const BOSS_SPEED = 2;
const BOSS_SHOOT_INTERVAL = 50; // Shoots faster
const BOSS_MAX_HEALTH = 10; // <<< New: Boss Health
const SCORE_TO_SPAWN_BOSS = 200;
const POINTS_PER_ENEMY = 10;
const POINTS_LOST_PER_HIT = 10;
const POINTS_FOR_BOSS = 100;

// Player (Tarantula)
let player = {
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
    y: CANVAS_HEIGHT - PLAYER_SIZE - 10,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    dx: 0,
    dy: 0,
    color: 'saddlebrown', // A tarantula-like color
    canDamageBoss: true, // <<< New: Prevent instant multi-hits on boss
    damageCooldownTimer: 0,
    damageCooldown: 30 // Frames of cooldown after hitting boss
};

// Game State
let score = 0;
let enemies = [];
let lasers = [];
let boss = null;
let bossActive = false;
let gameRunning = true;
let keys = {}; // Keep track of pressed keys

// --- Helper Functions ---

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function clearCanvas() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function updateScore(change) {
    score += change;
    if (score < 0) score = 0; // Score can't go below 0
    scoreDisplay.textContent = score;
}

function showMessage(msg) {
    messageDisplay.textContent = msg;
}

function isColliding(rect1, rect2) {
    if (!rect1 || !rect2) return false; // Make sure both objects exist
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// --- Drawing Functions ---

function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

// Utility to draw emojis centered in their bounding box
function drawEmoji(emoji, entity) {
    // Set font size slightly larger than the bounding box for better coverage
    const fontSize = entity.height * 1.2; // Adjust multiplier as needed
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; // Align vertically to the middle

    // Calculate center position
    const centerX = entity.x + entity.width / 2;
    const centerY = entity.y + entity.height / 2;

    ctx.fillText(emoji, centerX, centerY);
}

function drawPlayer() {
    // Draw cooldown effect first (optional semi-transparent box behind)
    if (!player.canDamageBoss) {
        ctx.fillStyle = 'rgba(139, 69, 19, 0.2)'; // Very faint brown box
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
    // Draw Tarantula Emoji
    drawEmoji('🕷️', player);
}

function drawEnemies() {
    enemies.forEach(enemy => {
        // Draw AI Bot Emoji
        drawEmoji('🤖', enemy);
    });
}

function drawLasers() { // Keep lasers as rectangles
    lasers.forEach(laser => {
        drawRect(laser.x, laser.y, laser.width, laser.height, laser.color);
    });
}

function drawBoss() {
    if (bossActive && boss) {
        // Save context state for transparency manipulation
        ctx.save();

        // Apply hit effect (transparency)
        if (boss.hitTimer > 0) {
             ctx.globalAlpha = 0.5; // Make boss semi-transparent when hit
        }

        // Draw Boss Emoji
        drawEmoji('👾', boss); // Using Alien Monster for Boss

        // Restore context state (removes transparency effect for subsequent drawings)
        ctx.restore();


        // Draw Health Bar (remains the same)
        const healthBarWidth = boss.width;
        const healthBarHeight = 10;
        const healthBarX = boss.x;
        const healthBarY = boss.y - healthBarHeight - 5; // Above the boss

        const currentHealthWidth = Math.max(0, (boss.health / BOSS_MAX_HEALTH) * healthBarWidth); // Ensure width doesn't go negative

        ctx.fillStyle = '#555'; // Dark background for health bar
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        ctx.fillStyle = 'lime'; // Foreground (current health)
        ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);
        ctx.strokeStyle = 'black'; // Border
        ctx.lineWidth = 1;
        ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    }
}

// --- Spawning Functions ---

function spawnEnemy() {
    if (enemies.length < MAX_ENEMIES && !bossActive) {
        const x = Math.random() * (CANVAS_WIDTH - ENEMY_SIZE);
        const y = -ENEMY_SIZE;
        enemies.push({
            x: x,
            y: y,
            width: ENEMY_SIZE,
            height: ENEMY_SIZE,
            speed: ENEMY_SPEED, // Still used for downward drift
            color: 'dodgerblue',
            shootTimer: 0,
            shootInterval: Math.floor(randomBetween(ENEMY_SHOOT_INTERVAL_MIN, ENEMY_SHOOT_INTERVAL_MAX))
        });
    }
}

function spawnInitialEnemies() {
    enemies = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
        const x = (CANVAS_WIDTH / (MAX_ENEMIES + 1)) * (i + 1) - ENEMY_SIZE / 2;
        const y = Math.random() * (CANVAS_HEIGHT / 4);
         enemies.push({
            x: x,
            y: y,
            width: ENEMY_SIZE,
            height: ENEMY_SIZE,
            speed: ENEMY_SPEED,
            color: 'dodgerblue',
            shootTimer: 0,
            shootInterval: Math.floor(randomBetween(ENEMY_SHOOT_INTERVAL_MIN, ENEMY_SHOOT_INTERVAL_MAX))
        });
    }
}

function spawnBoss() {
    if (!bossActive) {
        bossActive = true;
        enemies = [];
        lasers = [];
        boss = {
            x: CANVAS_WIDTH / 2 - BOSS_SIZE / 2,
            y: 50,
            width: BOSS_SIZE,
            height: BOSS_SIZE,
            speed: BOSS_SPEED,
            dx: BOSS_SPEED,
            color: 'rebeccapurple',
            shootTimer: 0,
            shootInterval: BOSS_SHOOT_INTERVAL,
            health: BOSS_MAX_HEALTH, // <<< Initialize health
            hitTimer: 0 // <<< Timer for hit flash effect
        };
        showMessage(`BOSS BATTLE! Hit the Boss ${BOSS_MAX_HEALTH} times!`);
    }
}

function shootLaser(source) {
    // Calculate center points
    const sourceCenterX = source.x + source.width / 2;
    const sourceCenterY = source.y + source.height / 2;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    // Calculate direction vector
    let diffX = playerCenterX - sourceCenterX;
    let diffY = playerCenterY - sourceCenterY;

    // Calculate distance (magnitude)
    let dist = Math.sqrt(diffX * diffX + diffY * diffY);
    if (dist === 0) dist = 1; // Avoid division by zero if player is exactly at source center

    // Normalize vector and multiply by speed
    let laserDx = (diffX / dist) * LASER_SPEED;
    let laserDy = (diffY / dist) * LASER_SPEED;

    // Create laser object
     lasers.push({
        x: sourceCenterX - LASER_WIDTH / 2, // Start from center
        y: sourceCenterY - LASER_HEIGHT / 2,
        width: LASER_WIDTH,
        height: LASER_HEIGHT,
        dx: laserDx, // <<< Use calculated dx
        dy: laserDy, // <<< Use calculated dy
        color: 'red',
        bounces: 0 // <<< Initialize bounce count
    });
}


// --- Update Functions ---

function updatePlayer() {
    // Handle damage cooldown timer
    if (!player.canDamageBoss) {
        player.damageCooldownTimer++;
        if (player.damageCooldownTimer >= player.damageCooldown) {
            player.canDamageBoss = true;
            player.damageCooldownTimer = 0;
        }
    }


    // Calculate movement based on keys pressed
    player.dx = 0;
    player.dy = 0;
    if (keys['ArrowLeft'] || keys['a']) player.dx = -player.speed;
    if (keys['ArrowRight'] || keys['d']) player.dx = player.speed;
    if (keys['ArrowUp'] || keys['w']) player.dy = -player.speed;
    if (keys['ArrowDown'] || keys['s']) player.dy = player.speed;

    // Update position
    player.x += player.dx;
    player.y += player.dy;

    // Boundary detection
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > CANVAS_WIDTH) player.x = CANVAS_WIDTH - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > CANVAS_HEIGHT) player.y = CANVAS_HEIGHT - player.height;
}

function updateEnemies() {
    if (enemies.length < MAX_ENEMIES && Math.random() < 0.01 && !bossActive) {
       spawnEnemy();
    }

    enemies.forEach((enemy, index) => {
        // Basic downward drift
        enemy.y += enemy.speed;

        // Remove enemies that go off bottom screen
        if (enemy.y > CANVAS_HEIGHT) {
            enemies.splice(index, 1);
            return;
        }

        // Shooting logic
        enemy.shootTimer++;
        if (enemy.shootTimer >= enemy.shootInterval) {
            shootLaser(enemy);
            enemy.shootTimer = 0;
            enemy.shootInterval = Math.floor(randomBetween(ENEMY_SHOOT_INTERVAL_MIN, ENEMY_SHOOT_INTERVAL_MAX));
        }
    });
}

function updateLasers() {
    lasers.forEach((laser, index) => {
        // Move laser
        laser.x += laser.dx;
        laser.y += laser.dy;

        // Bounce logic
        let bounced = false;
        // Left/Right walls
        if (laser.x <= 0) {
            laser.dx *= -1;
            laser.x = 0; // Clamp position
            bounced = true;
        } else if (laser.x + laser.width >= CANVAS_WIDTH) {
            laser.dx *= -1;
            laser.x = CANVAS_WIDTH - laser.width; // Clamp position
            bounced = true;
        }

        // Top/Bottom walls
        if (laser.y <= 0) {
            laser.dy *= -1;
            laser.y = 0; // Clamp position
            bounced = true;
        } else if (laser.y + laser.height >= CANVAS_HEIGHT) {
            laser.dy *= -1;
            laser.y = CANVAS_HEIGHT - laser.height; // Clamp position
            bounced = true;
        }

        // Increment bounce count and check limit
        if (bounced) {
            laser.bounces++;
            if (laser.bounces > LASER_MAX_BOUNCES) {
                lasers.splice(index, 1); // Remove laser after max bounces
                return; // Skip to next laser
            }
        }
    });
}

function updateBoss() {
    if (!bossActive || !boss) return;

     // Update hit flash timer
     if (boss.hitTimer > 0) {
        boss.hitTimer--;
    }

    // Movement
    boss.x += boss.dx;
    if (boss.x <= 0 || boss.x + boss.width >= CANVAS_WIDTH) {
        boss.dx *= -1; // Reverse direction at edges
        // Optional: Move down slightly when hitting side walls?
        // boss.y += 5;
    }
     // Prevent boss going too low (optional)
    // if (boss.y + boss.height > CANVAS_HEIGHT * 0.75) {
    //     boss.y = CANVAS_HEIGHT * 0.75 - boss.height;
    // }


    // Shooting logic
    boss.shootTimer++;
    if (boss.shootTimer >= boss.shootInterval) {
        shootLaser(boss);
        // Optional: Shoot multiple lasers or patterns
        // shootLaser({ ...boss, x: boss.x - 20 }); // Example offset shot
        // shootLaser({ ...boss, x: boss.x + 20 }); // Example offset shot
        boss.shootTimer = 0;
    }
}

// --- Collision Detection ---

function checkCollisions() {
    // 1. Player vs Enemy
    enemies.forEach((enemy, index) => {
        if (isColliding(player, enemy)) {
            enemies.splice(index, 1);
            updateScore(POINTS_PER_ENEMY);
            showMessage(`Ate AI! +${POINTS_PER_ENEMY} points!`);
            // spawnEnemy(); // Option to spawn replacement

            // Check if boss should spawn
            if (score >= SCORE_TO_SPAWN_BOSS && !bossActive) {
                spawnBoss();
            }
        }
    });

    // 2. Player vs Laser
    // Use a reverse loop to safely remove items while iterating
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        if (isColliding(player, laser)) {
            lasers.splice(i, 1); // Remove the laser that hit

            // Determine penalty based on whether the boss is active
            const penalty = bossActive ? 20 : POINTS_LOST_PER_HIT; // 20 points if boss active, else 10
            updateScore(-penalty); // Use updateScore which handles the score display

            // Check for game over condition immediately after score update
            if (score <= 0) {
                showMessage(`Hit! Score reached 0! Game Over!`);
                triggerGameOver(); // Call the game over sequence
                return; // Exit collision check early as game is ending
            } else {
                 showMessage(`Hit by laser! -${penalty} points! Score: ${score}`);
            }

             // --- OLD LOGIC REMOVED ---
             // No longer immediately resetting score to 0 just for being hit during boss fight
             // if (bossActive) { ... } // This block is removed.
             // --- END OLD LOGIC REMOVAL ---

             break; // Optional: Stop checking other lasers in this frame if player was hit once
        }
    }
// --- Game Over Trigger ---
function triggerGameOver() {
    gameRunning = false; // Stop the current game loop
    // Message is already set before calling this function
    resetButton.textContent = "Retry?"; // <<< Change button text
    resetButton.style.display = 'block'; // <<< Show the button
    // REMOVE the setTimeout for automatic restart
    // setTimeout(() => {
    //     resetGame();
    // }, 2500);
}
    // 2. Player vs Laser
    lasers.forEach((laser, index) => {
        if (isColliding(player, laser)) {
            lasers.splice(index, 1); // Remove the laser that hit
            updateScore(-POINTS_LOST_PER_HIT);
            showMessage(`Hit by laser! -${POINTS_LOST_PER_HIT} points!`);

            // If hit during boss battle, reset score and end boss fight
            if (bossActive) {
                showMessage(`Hit during Boss Battle! Score Reset!`);
                score = 0; // Reset score
                scoreDisplay.textContent = score;
                bossActive = false;
                boss = null;
                player.canDamageBoss = true; // Reset damage capability
                player.damageCooldownTimer = 0;
                spawnInitialEnemies(); // Restart with regular enemies
            }
            return; // Stop checking this laser after collision
        }
    });

    // 3. Player vs Boss
    if (bossActive && boss && player.canDamageBoss && isColliding(player, boss)) {
        boss.health--; // Decrement health
        boss.hitTimer = 5; // Start flash timer (5 frames)
        player.canDamageBoss = false; // Start player cooldown
        player.damageCooldownTimer = 0;

        if (boss.health <= 0) {
            // Boss defeated
            updateScore(POINTS_FOR_BOSS);
            showMessage(`BOSS DEFEATED! YOU WIN! Final Score: ${score}`);
            bossActive = false;
            boss = null;
            gameRunning = false; // Stop the game loop
            resetButton.style.display = 'block'; // Show reset button
        } else {
            // Boss hit but not defeated
            showMessage(`Boss Hit! ${boss.health} HP remaining.`);
        }
    }
}

// --- Game Loop ---

function gameLoop() {
    if (!gameRunning) return;

    clearCanvas();

    updatePlayer();
    if (!bossActive) {
        updateEnemies();
    }
    updateLasers();
    updateBoss();

    checkCollisions();

    drawPlayer();
    drawEnemies();
    drawLasers();
    drawBoss(); // Handles drawing boss and health bar if active

    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---

window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

resetButton.addEventListener('click', () => {
    resetGame();
});


// --- Game Initialization ---
function resetGame() {
    score = 0;
    scoreDisplay.textContent = score;
    player.x = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
    player.y = CANVAS_HEIGHT - PLAYER_SIZE - 10;
    player.canDamageBoss = true;
    player.damageCooldownTimer = 0;
    enemies = [];
    lasers = [];
    boss = null;
    bossActive = false;
    keys = {};
    gameRunning = true;
    resetButton.style.display = 'none';
    showMessage("Use Arrow Keys/WASD. Eat AI! Avoid lasers! Hit Boss to win!");
    spawnInitialEnemies();
    requestAnimationFrame(gameLoop); // Use rAF to start the loop smoothly
}


// Start the game when script loads
resetGame();
