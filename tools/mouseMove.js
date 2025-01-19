/**
 * mouseMove.js
 * Utilities for simulating human-like mouse movements in Playwright
 */

// Utility function to generate random number within a range
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates points along a bezier curve for smooth mouse movement
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @param {number} numPoints - Number of points to generate
 * @returns {Array<{x: number, y: number}>} Array of coordinate points
 */
function getBezierPoints(startX, startY, endX, endY, numPoints = 10) {
  // Create control points for natural curve with some randomization
  const controlX1 = startX + (endX - startX) / 3 + randomNumber(-50, 50);
  const controlY1 = startY + (endY - startY) / 3 + randomNumber(-50, 50);
  const controlX2 = startX + (2 * (endX - startX)) / 3 + randomNumber(-50, 50);
  const controlY2 = endY + (startY - endY) / 3 + randomNumber(-50, 50);

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x =
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * controlX1 +
      3 * (1 - t) * Math.pow(t, 2) * controlX2 +
      Math.pow(t, 3) * endX;
    const y =
      Math.pow(1 - t, 3) * startY +
      3 * Math.pow(1 - t, 2) * t * controlY1 +
      3 * (1 - t) * Math.pow(t, 2) * controlY2 +
      Math.pow(t, 3) * endY;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

/**
 * Simulates human-like mouse movement to an element
 * @param {import('playwright').Page} page - Playwright page object
 * @param {import('playwright').ElementHandle} element - Target element
 * @param {Object} options - Additional options for movement
 * @returns {Promise<void>}
 */
async function moveMouseHuman(page, element, options = {}) {
  try {
    // Get element position
    const elementHandle = await element.boundingBox();
    if (!elementHandle) return;

    // Get current mouse position or use default
    const currentPosition = await page.evaluate(() => ({
      x: window.mouseX || 0,
      y: window.mouseY || 0,
    }));

    // Calculate target position with slight randomization
    const targetX = elementHandle.x + elementHandle.width / 2 + randomNumber(-10, 10);
    const targetY = elementHandle.y + elementHandle.height / 2 + randomNumber(-10, 10);

    // Generate movement points
    const points = getBezierPoints(
      currentPosition.x,
      currentPosition.y,
      targetX,
      targetY,
      randomNumber(10, 20)
    );

    // Move through points with random delays
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(randomNumber(10, 25));
    }

    // Store final position in page context
    await page.evaluate(
      ({ x, y }) => {
        window.mouseX = x;
        window.mouseY = y;
      },
      { x: targetX, y: targetY }
    );
  } catch (error) {
    console.warn('Mouse movement failed:', error.message);
  }
}

/**
 * Performs a natural mouse click on an element
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @returns {Promise<void>}
 */
async function naturalClick(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return;

    // Move to element
    await moveMouseHuman(page, element);

    // Add human reaction time delay
    await page.waitForTimeout(randomNumber(100, 200));

    // Click with random pressure duration
    await page.mouse.down();
    await page.waitForTimeout(randomNumber(50, 150));
    await page.mouse.up();
  } catch (error) {
    console.warn('Natural click failed:', error.message);
    // Fallback to regular click
    await page.click(selector).catch(() => {});
  }
}

/**
 * Performs a natural scroll movement
 * @param {import('playwright').Page} page - Playwright page object
 * @param {number} targetPosition - Scroll target position
 * @returns {Promise<void>}
 */
async function naturalScroll(page, targetPosition) {
  try {
    await page.evaluate((scrollTarget) => {
      window.scrollTo({
        top: scrollTarget,
        behavior: 'smooth',
      });
    }, targetPosition);
    await page.waitForTimeout(randomNumber(500, 1000));
  } catch (error) {
    console.warn('Smooth scroll failed:', error.message);
  }
}

/**
 * Moves to an input field and types with human-like delays
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} selector - Input field selector
 * @param {string} text - Text to type
 * @returns {Promise<void>}
 */
async function naturalType(page, selector, text) {
  try {
    const element = await page.$(selector);
    if (!element) return;

    // Move to input field
    await moveMouseHuman(page, element);
    await page.waitForTimeout(randomNumber(100, 200));

    // Click the input field
    await page.mouse.down();
    await page.waitForTimeout(randomNumber(50, 150));
    await page.mouse.up();

    // Type with random delays between characters
    for (const char of text) {
      await page.keyboard.type(char, { delay: randomNumber(100, 200) });
    }
  } catch (error) {
    console.warn('Natural typing failed:', error.message);
    // Fallback to regular fill
    await page.fill(selector, text).catch(() => {});
  }
}

// Add to mouseMove.js

/**
 * Types of human pauses with min/max ranges in milliseconds
 */
const PAUSE_TYPES = {
  MICRO: { min: 100, max: 300 }, // Tiny pauses between actions
  SHORT: { min: 300, max: 800 }, // Brief thinking pauses
  MEDIUM: { min: 1000, max: 2000 }, // Reading or decision making
  LONG: { min: 2000, max: 4000 }, // Complex thinking or distraction
  VERY_LONG: { min: 4000, max: 8000 }, // Major distraction or task switching
};

/**
 * Simulates a natural human pause
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} pauseType - Type of pause from PAUSE_TYPES
 * @param {Object} options - Optional override for min/max
 */
async function humanPause(page, pauseType = 'SHORT', options = {}) {
  const range = PAUSE_TYPES[pauseType] || PAUSE_TYPES.SHORT;
  const delay = randomNumber(options.min || range.min, options.max || range.max);
  await page.waitForTimeout(delay);
}

export {
  moveMouseHuman,
  naturalClick,
  naturalScroll,
  naturalType,
  randomNumber,
  getBezierPoints,
  humanPause,
};
