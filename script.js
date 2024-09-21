// Define the name to display as obstacles
let gameName = ""; // Will be set by user input

/**
 * Generates a random hex color.
 * @returns {string} - Hex color string.
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Generates a random font style from a predefined list.
 * @returns {string} - Font style string.
 */
function getRandomFontStyle() {
    const fonts = [
        'Arial',
        'Verdana',
        'Helvetica',
        'Courier New',
        'Georgia',
        'Times New Roman',
        'Impact',
        'Comic Sans MS',
        'Lucida Console',
        'Tahoma'
    ];
    return fonts[Math.floor(Math.random() * fonts.length)];
}

// Get HTML elements
const nameInputContainer = document.getElementById('nameInputContainer');
const nameInput = document.getElementById('nameInput');
const startButton = document.getElementById('startButton');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');

// Get Apple Image
const appleImage = document.getElementById('appleImage');

// Set canvas dimensions
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

// Define the size of each grid cell
const gridSize = 20; // Adjusted for better visuals

// Initialize game variables
let snake = [];
let dx = gridSize; // Moving right initially
let dy = 0;
let obstacles = [];
let food = null;
let score = 0;
let highScore = parseInt(localStorage.getItem('highScore')) || 0;
let obstacleColor = getRandomColor(); // Initial random color
let gameSpeed = 150; // Initial game speed in milliseconds
let gameInterval = null;
let gracePeriod = false;
let gracePeriodDuration = 3000; // 3 seconds

// Initialize score display
updateScore();

// Add event listener to the start button
startButton.addEventListener('click', () => {
    const input = nameInput.value.trim();
    if (input) {
        gameName = input;
        startButton.disabled = true; // Prevent multiple clicks
        nameInput.disabled = true; // Disable input during the game
        initializeGame();
    } else {
        alert("Please enter a valid name.");
    }
});

/**
 * Initializes the game after the user inputs a name.
 */
function initializeGame() {
    // Generate a random font style for the current game
    const currentFontStyle = getRandomFontStyle();

    // Generate obstacles based on the entered name and current font style
    obstacles = generateObstaclesFromText(gameName, currentFontStyle);

    // Reset variables
    snake = generateInitialSnakePosition();
    dx = gridSize;
    dy = 0;
    score = 0;
    updateScore();

    // Generate food position
    food = generateFood();

    // Randomize obstacle color
    obstacleColor = getRandomColor();

    // Show the canvas
    canvas.style.display = 'block';

    // Hide the name input container
    nameInputContainer.style.display = 'none';

    // Start the grace period
    gracePeriod = true;
    setTimeout(() => {
        gracePeriod = false;
    }, gracePeriodDuration);

    // Start the game loop
    startGame();
}

/**
 * Generates obstacle positions by rendering text onto an off-screen canvas with increased letter spacing.
 * @param {string} text - The text to render as obstacles.
 * @param {string} fontStyle - The font style to use for rendering text.
 * @returns {Array} - Array of obstacle positions.
 */
function generateObstaclesFromText(text, fontStyle) {
    const obstacles = [];

    // Create an off-screen canvas
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');

    // Set dimensions for the off-screen canvas
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;

    // Adjust font size and style
    const fontSize = 200; // Increased font size for larger text
    offscreenCtx.font = `${fontSize}px ${fontStyle}`;
    offscreenCtx.textAlign = 'left'; // Change to 'left' for manual spacing
    offscreenCtx.textBaseline = 'middle';

    // Disable image smoothing to prevent anti-aliasing
    offscreenCtx.imageSmoothingEnabled = false;

    // Calculate starting position with increased spacing
    const startingX = canvasWidth / 4; // Start from quarter width to add left margin
    const startingY = canvasHeight / 2; // Center vertically
    const letterSpacing = 50; // Space between letters in pixels

    // Clear the offscreen canvas before drawing
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Iterate over each character to render separately with spacing
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charX = startingX + i * (fontSize * 0.6 + letterSpacing); // Adjust 0.6 based on font
        offscreenCtx.fillStyle = '#000';
        offscreenCtx.fillText(char, charX, startingY);
    }

    // Get pixel data
    const imageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const data = imageData.data;

    // Map to track which grid positions have been added
    const obstacleSet = new Set();

    // Define the density of passways (e.g., 20% of obstacles are removed)
    const passwayDensity = 0.2; // 20%

    // Iterate over every pixel to capture the text accurately
    for (let y = 0; y < offscreenCanvas.height; y++) {
        for (let x = 0; x < offscreenCanvas.width; x++) {
            const pixelIndex = (y * offscreenCanvas.width + x) * 4;
            const alpha = data[pixelIndex + 3]; // Alpha channel
            if (alpha > 128) { // Threshold to determine if pixel is part of text
                // Introduce passways by randomly skipping some obstacles
                if (Math.random() < passwayDensity) {
                    continue; // Skip adding this obstacle to create a passway
                }

                // Map the pixel coordinates to grid coordinates
                const gridX = Math.floor(x / gridSize) * gridSize;
                const gridY = Math.floor(y / gridSize) * gridSize;

                const key = `${gridX},${gridY}`;
                if (!obstacleSet.has(key)) {
                    obstacleSet.add(key);
                    obstacles.push({
                        x: gridX,
                        y: gridY
                    });
                }
            }
        }
    }

    return obstacles;
}

/**
 * Generates a starting position for the snake that doesn't collide with obstacles.
 * @returns {Array} - Initial snake segments.
 */
function generateInitialSnakePosition() {
    let startX, startY;
    let maxAttempts = 100;
    let attempts = 0;

    do {
        startX = Math.floor(Math.random() * (canvasWidth / gridSize)) * gridSize;
        startY = Math.floor(Math.random() * (canvasHeight / gridSize)) * gridSize;
        attempts++;
    } while (isOccupied({ x: startX, y: startY }, obstacles) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
        alert("Unable to find a safe starting position for the snake.");
        // Fallback to center if no safe position is found
        startX = Math.floor(canvasWidth / 2 / gridSize) * gridSize;
        startY = Math.floor(canvasHeight / 2 / gridSize) * gridSize;
    }

    return [
        { x: startX, y: startY },
        { x: startX - gridSize, y: startY },
        { x: startX - (2 * gridSize), y: startY }
    ];
}

/**
 * Generates food position ensuring it doesn't collide with snake or obstacles.
 * @returns {Object|null} - Food position or null if not found.
 */
function generateFood() {
    let newFood;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
        newFood = {
            x: Math.floor(Math.random() * (canvasWidth / gridSize)) * gridSize,
            y: Math.floor(Math.random() * (canvasHeight / gridSize)) * gridSize
        };
        if (!isOccupied(newFood, snake) && !isOccupied(newFood, obstacles)) {
            return newFood;
        }
        attempts++;
    }
    // If unable to place food, return null
    return null;
}

/**
 * Checks if a position is occupied by any segment in the given list.
 * @param {Object} position - The position to check.
 * @param {Array} segments - Array of segments (snake or obstacles).
 * @returns {boolean} - True if occupied, else false.
 */
function isOccupied(position, segments) {
    for (let segment of segments) {
        if (segment.x === position.x && segment.y === position.y) {
            return true;
        }
    }
    return false;
}

/**
 * Starts the game loop.
 */
function startGame() {
    gameInterval = setInterval(gameLoop, gameSpeed);
    // Add event listener for key presses
    document.addEventListener('keydown', changeDirection);
}

/**
 * The main game loop handling movement, collision, and rendering.
 */
function gameLoop() {
    moveSnake();
    if (checkCollision()) {
        gameOver();
        return;
    }
    if (checkFoodCollision()) {
        score++;
        updateScore();
        food = generateFood();
        // Increase speed every 5 points
        if (score % 5 === 0 && gameSpeed > 50) {
            gameSpeed -= 10;
            clearInterval(gameInterval);
            gameInterval = setInterval(gameLoop, gameSpeed);
        }
    } else {
        snake.pop(); // Remove the tail
    }
    drawEverything();
}

/**
 * Moves the snake in the current direction.
 */
function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Screen wrapping
    if (head.x >= canvasWidth) {
        head.x = 0;
    } else if (head.x < 0) {
        head.x = canvasWidth - gridSize;
    }

    if (head.y >= canvasHeight) {
        head.y = 0;
    } else if (head.y < 0) {
        head.y = canvasHeight - gridSize;
    }

    snake.unshift(head);
}

/**
 * Changes the direction of the snake based on key presses.
 * @param {KeyboardEvent} event 
 */
function changeDirection(event) {
    const keyPressed = event.keyCode;
    const LEFT = 37;
    const UP = 38;
    const RIGHT = 39;
    const DOWN = 40;

    // Prevent the snake from reversing
    if (keyPressed === LEFT && dx === 0) {
        dx = -gridSize;
        dy = 0;
    }
    if (keyPressed === UP && dy === 0) {
        dx = 0;
        dy = -gridSize;
    }
    if (keyPressed === RIGHT && dx === 0) {
        dx = gridSize;
        dy = 0;
    }
    if (keyPressed === DOWN && dy === 0) {
        dx = 0;
        dy = gridSize;
    }
}

/**
 * Checks for collisions with self or obstacles.
 * @returns {boolean} - True if collision detected, else false.
 */
function checkCollision() {
    // Check collision with self
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {
            return true;
        }
    }

    // Check collision with obstacles, unless in grace period
    if (!gracePeriod) {
        for (let obstacle of obstacles) {
            if (snake[0].x === obstacle.x && snake[0].y === obstacle.y) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Checks if the snake has eaten the food.
 * @returns {boolean} - True if food is eaten, else false.
 */
function checkFoodCollision() {
    if (snake[0].x === food.x && snake[0].y === food.y) {
        return true;
    }
    return false;
}

/**
 * Draws the game elements on the canvas.
 */
function drawEverything() {
    // Clear the canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw the snake as green rectangles
    ctx.fillStyle = '#28a745'; // Green color
    for (let i = 0; i < snake.length; i++) {
        ctx.fillRect(snake[i].x, snake[i].y, gridSize - 2, gridSize - 2);
    }

    // Draw the food as a shiny red apple image
    if (food) {
        // Increase the size of the apple image by 50%
        const appleSize = gridSize * 1.5;
        // Center the apple image within the grid cell
        ctx.drawImage(
            appleImage,
            food.x - (appleSize - gridSize) / 2,
            food.y - (appleSize - gridSize) / 2,
            appleSize,
            appleSize
        );
    }

    // Draw obstacles
    ctx.fillStyle = obstacleColor;
    for (let obstacle of obstacles) {
        ctx.fillRect(obstacle.x, obstacle.y, gridSize - 2, gridSize - 2);
    }

    // If in grace period, display a message
    if (gracePeriod) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Grace Period: No Collision with Obstacles', canvasWidth / 2, canvasHeight - 30);
    }
}

/**
 * Updates the score display and high score.
 */
function updateScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }
    scoreDisplay.innerText = `Score: ${score} | High Score: ${highScore}`;
}

/**
 * Resets the game to initial state.
 */
function resetGame() {
    // Reset variables
    snake = generateInitialSnakePosition();
    dx = gridSize;
    dy = 0;
    score = 0;
    updateScore();
    obstacles = generateObstaclesFromText(gameName, getRandomFontStyle());
    food = generateFood();

    // Randomize obstacle color
    obstacleColor = getRandomColor();

    // Start the grace period
    gracePeriod = true;
    setTimeout(() => {
        gracePeriod = false;
    }, gracePeriodDuration);

    // Restart the game loop
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, gameSpeed);
}

/**
 * Ends the game, records the score, and resets the game.
 */
function gameOver() {
    clearInterval(gameInterval);
    alert(`Game Over! Your final score was: ${score}`);
    // Optionally, update the leaderboard here
    resetGame();
}