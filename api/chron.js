import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

export default async function handler(req, res) {
    try {
   
    // Set up __dirname equivalent for ES modules
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const baseDomain = 'https://posthog-demo-3000.fly.dev/';

    // Load environment variables
    dotenv.config({ path: path.join(__dirname, '.env') });

    const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || '';
    const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || '';

    console.log('Sessions server starting...');


    // Generate random number of sessions between 23 and 52
    const sessionCount = Math.floor(Math.random() * (52 - 23 + 1)) + 23;
    console.log(`Starting ${sessionCount} random sessions...`);

    // Initialize Browserbase
    const bb = new Browserbase({
        apiKey: BROWSERBASE_API_KEY,
        projectId: BROWSERBASE_PROJECT_ID,
        region: 'us-east-1'
    });

    // Add device configurations and browser randomization
    const DEVICE_TYPES = {
        DESKTOP: 'desktop',
        TABLET: 'tablet',
        MOBILE: 'mobile',
    };

    const deviceConfigs = {
        desktop: {
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
        },
        tablet: {
            viewport: { width: 1024, height: 768 },
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
        },
        mobile: {
            iphone: {
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)',
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
            },
            android: {
                userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6)',
                viewport: { width: 393, height: 851 },
                deviceScaleFactor: 2.75,
                isMobile: true,
                hasTouch: true,
            },
        },
    };

    async function randomizeBrowser() {
        const browserType = chromium;
        const deviceTypes = Object.values(DEVICE_TYPES);
        const randomDeviceType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];

        let deviceConfig;
        if (randomDeviceType === DEVICE_TYPES.MOBILE) {
            const mobileTypes = ['iphone', 'android'];
            const randomMobileType = mobileTypes[Math.floor(Math.random() * mobileTypes.length)];
            deviceConfig = deviceConfigs.mobile[randomMobileType];
        } else {
            deviceConfig = deviceConfigs[randomDeviceType];
        }

        return {
            browserType: 'chromium',
            deviceType: randomDeviceType,
            deviceConfig,
        };
    }

    // Add mouse movement utilities
    function randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getBezierPoints(startX, startY, endX, endY, numPoints = 10) {
        const controlX1 = startX + (endX - startX) / 3 + randomNumber(-50, 50);
        const controlY1 = startY + (endY - startY) / 3 + randomNumber(-50, 50);
        const controlX2 = startX + (2 * (endX - startX)) / 3 + randomNumber(-50, 50);
        const controlY2 = endY + (startY - endY) / 3 + randomNumber(-50, 50);

        const points = [];
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const x = Math.pow(1 - t, 3) * startX +
                3 * Math.pow(1 - t, 2) * t * controlX1 +
                3 * (1 - t) * Math.pow(t, 2) * controlX2 +
                Math.pow(t, 3) * endX;
            const y = Math.pow(1 - t, 3) * startY +
                3 * Math.pow(1 - t, 2) * t * controlY1 +
                3 * (1 - t) * Math.pow(t, 2) * controlY2 +
                Math.pow(t, 3) * endY;
            points.push({ x: Math.round(x), y: Math.round(y) });
        }
        return points;
    }

    const PAUSE_TYPES = {
        MICRO: { min: 100, max: 300 },
        SHORT: { min: 300, max: 800 },
        MEDIUM: { min: 1000, max: 2000 },
        LONG: { min: 2000, max: 4000 },
        VERY_LONG: { min: 4000, max: 8000 },
    };

    async function humanPause(page, pauseType = 'SHORT', options = {}) {
        const range = PAUSE_TYPES[pauseType] || PAUSE_TYPES.SHORT;
        const delay = randomNumber(options.min || range.min, options.max || range.max);
        await page.waitForTimeout(delay);
    }

    async function moveMouseHuman(page, element, options = {}) {
        try {
            const elementHandle = await element.boundingBox();
            if (!elementHandle) return;

            const currentPosition = await page.evaluate(() => ({
                x: window.mouseX || 0,
                y: window.mouseY || 0,
            }));

            const targetX = elementHandle.x + elementHandle.width / 2 + randomNumber(-10, 10);
            const targetY = elementHandle.y + elementHandle.height / 2 + randomNumber(-10, 10);

            const points = getBezierPoints(
                currentPosition.x,
                currentPosition.y,
                targetX,
                targetY,
                randomNumber(10, 20)
            );

            for (const point of points) {
                await page.mouse.move(point.x, point.y);
                await page.waitForTimeout(randomNumber(10, 25));
            }

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

    async function naturalClick(page, selector) {
        try {
            const element = await page.$(selector);
            if (!element) return;

            await moveMouseHuman(page, element);
            await page.waitForTimeout(randomNumber(100, 200));

            await page.mouse.down();
            await page.waitForTimeout(randomNumber(50, 150));
            await page.mouse.up();
        } catch (error) {
            console.warn('Natural click failed:', error.message);
            await page.click(selector).catch(() => {});
        }
    }

    async function runSession(sessionNumber) {
        try {

            console.log(`Starting session ${sessionNumber}/${sessionCount}...`);
            const session = await bb.sessions.create({
                projectId: BROWSERBASE_PROJECT_ID,
                region: 'us-east-1'
            });

            // look at Browserbase.js fingerprint for viewports
            const { browserType, deviceType, deviceConfig } = await randomizeBrowser();
            console.log(`Using ${browserType} browser in ${deviceType} mode`);
            
            const browser = await chromium.connectOverCDP(session.connectUrl);
            const defaultContext = browser.contexts()[0];
            const page = defaultContext?.pages()[0];

            // Set viewport first
            await page.setViewportSize(deviceConfig.viewport);
            
            // Try/catch block for user agent setting
            try {
                if (deviceConfig.userAgent) {
                    await page.setExtraHTTPHeaders({
                        'User-Agent': deviceConfig.userAgent
                    });
                }
            } catch (e) {
                console.warn('Could not set user agent, continuing anyway:', e.message);
            }
            
            // Increased timeouts for page operations
            page.setDefaultTimeout(120000); // 60 seconds
            page.setDefaultNavigationTimeout(120000);
            
            // Generate random data
            const user = generateUser();
            const utmParams = generateUtm();
            const planSelection = generatePlanSelection();
            const movieNumber = generateMovieNumber();
            
            // Navigate and interact with the page
            console.log('Navigating to page...');
            const userAgent = await page.evaluate(() => navigator.userAgent)
            console.log('User agent:', userAgent);

            try {
                // Initial page load
                await page.goto(`${baseDomain}?utm_source=${utmParams.utm_source}&utm_medium=${utmParams.utm_medium}&utm_campaign=${utmParams.utm_campaign}`, { 
                    waitUntil: "networkidle",
                    timeout: 30000 
                });
                
                await humanPause(page, 'MEDIUM');
                
                // Navigate to signup with Promise.all to handle navigation
                await Promise.all([
                    page.waitForLoadState('networkidle'),
                    page.goto(`${baseDomain}signup`)
                ]);
                
                // Wait for form to be interactive
                await page.waitForSelector('.form-control', { state: 'visible' });
                await humanPause(page, 'SHORT');
                
            } catch (error) {
                console.error('Navigation error:', error);
                throw error;
            }

            await page.getByLabel('Username').fill(user.username);

            await page.keyboard.press('Tab');
            await humanPause(page, 'MEDIUM');
            await page.getByLabel('Email').fill(user.email);

            await page.keyboard.press("Tab");
            await humanPause(page, 'MEDIUM');
            await page.locator('input#password').fill(user.password);
            await page.keyboard.press("Tab");
            await humanPause(page, 'MEDIUM');
            await page.locator('input#password2').fill(user.password);


            await page.keyboard.press("Tab");
            
            // 55% chance to check the adult checkbox
            if (Math.random() < 0.55) {
                await page.keyboard.press("Tab");
                await naturalClick(page, '.form-check-input')
            }
            
            // Scroll to bottom for plan selection
            await humanPause(page, 'MEDIUM');
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            
            // Plan selection
            await humanPause(page, 'MEDIUM');
            await naturalClick(page, `button:has-text("SELECT ${planSelection.name}")`);
            
            // Continue with form submission and navigation
            await humanPause(page, 'MEDIUM');
            await naturalClick(page, '[accesskey="e"]')
            await humanPause(page, 'MEDIUM');

            console.log('Navigating to login page after signup...');
            console.log('username:', user.username);
            console.log('password:', user.password);

            
            // Login section
            await page.goto(`${baseDomain}login`, { waitUntil: "domcontentloaded" });
            try {
                await humanPause(page, 'MEDIUM');
                
                // Get CSRF token
                const csrfToken = await page.$eval('input[name="csrf_token"]', el => el.value);
                
                // Fill form
                await page.fill('#username', user.username);
                await humanPause(page, 'MEDIUM');
                await page.fill('#password', user.password);
                await humanPause(page, 'MEDIUM');
                console.log('Filled password');
                console.log('username:', user.username);
                console.log('password:', user.password);
                
                // Submit form and wait for navigation
                await page.click('input[type="submit"]')
                await humanPause(page, 'MEDIUM');

                // Check for error message
                const hasError = await page.evaluate(() => {
                    const errorElement = document.querySelector('.alert-error');
                    return errorElement ? errorElement.textContent.trim() : null;
                });
                
                if (hasError) {
                    console.error('Login error:', hasError);
                    throw new Error(`Login failed: ${hasError}`);
                }

            } catch (error) {
                console.error('Login process failed:', error);
                throw error;
            }

            // Movie selection and playback
            await humanPause(page, 'MEDIUM');

            // Wait for DOM to load
            await page.goto(`${baseDomain}`, { waitUntil: "domcontentloaded" });


            // First check and handle any modal
            const modalVisible = await page.evaluate(() => {
                const modal = document.querySelector('#signup-modal');
                return modal && window.getComputedStyle(modal).display !== 'none';
            });

            if (modalVisible) {
                console.log('Modal detected, attempting to close...');
                try {
                    await page.click('#close-modal');
                    await humanPause(page, 'SHORT');
                } catch (e) {
                    console.log('Could not find close button, removing modal programmatically');
                    await page.evaluate(() => {
                        document.querySelector('#signup-modal')?.remove();
                        document.querySelector('.modal-backdrop')?.remove();
                        document.body.classList.remove('modal-open');
                    });
                }
            }

            // Click movie link with navigation handling
            try {
                console.log('Attempting to click movie link...');
                await naturalClick(page, `a[accesskey="${movieNumber}"]`);
                console.log('Movie link clicked, waiting for network idle...');
                await page.waitForLoadState('networkidle');
            
                console.log('Video should be playing now');
                await humanPause(page, 'LONG');
            
                console.log('Waiting for userDropdown to be visible...');
                page.getByLabel({hasText:'Welcome back to Hogflix'}, { waitUntil: 'domcontentloaded' });
                // await page.locator('#userDropdown');  // test this

                
                console.log('Clicking userDropdown...');
                await naturalClick(page, ':text-matches("Welcome back to Hogflix")');
                await humanPause(page, 'MEDIUM');
                
                console.log('Attempting logout...');
                await Promise.all([
                    page.waitForLoadState('networkidle'),
                    naturalClick(page, 'a[accesskey="o"]')
                ]);
                console.log('Logout successful');
            
            } catch (error) {
                console.error('Error during movie playback or logout:', error);
                // Optionally, you could add recovery logic here
                throw error;
            }
        
            
            // Cleanup
            await humanPause(page, 'LONG');
            await page.close();
            await browser.close();
            
            // Build the full URL with UTM parameters
            const fullUrl = `${baseDomain}?utm_source=${utmParams.utm_source}&utm_medium=${utmParams.utm_medium}&utm_campaign=${utmParams.utm_campaign}${utmParams.utm_term ? '&utm_term=' + utmParams.utm_term : ''}`;

            console.log(
                `Session ${sessionNumber} complete!\n` +
                `- Replay: https://browserbase.com/sessions/${session.id}\n` +
                `- Username: ${user.username}\n` +
                `- Password: ${user.password}\n` +
                `- Browser: ${browserType}\n` +
                `- Screen: ${deviceConfig.viewport.width}x${deviceConfig.viewport.height}\n` +
                `- Device: ${deviceType}\n` +
                `- URL: ${fullUrl}`
            );
            return true;
        } catch (error) {
            console.error(`Error in session ${sessionNumber}:`, error.message);
            return false;
        }
    }

    // Main execution loop
    (async () => {
        const results = [];
        for (let i = 1; i <= sessionCount; i++) {
            const result = await runSession(i);
            results.push(result);
            
            // Add a random delay between sessions (2-5 seconds)
            const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Final statistics
        const successCount = results.filter(r => r).length;
        console.log(`\nCompleted ${successCount}/${sessionCount} sessions successfully`);
        process.exit(0);
    })();

    // Random generators for user credentials and UTM parameters
    function generatePlanSelection() {
        const plans = [
            { name: "FREE", amount: 0 },
            { name: "PREMIUM", amount: 9.99 },
            { name: "MAX-IMAL", amount: 19.99 }
        ];
        return plans[Math.floor(Math.random() * plans.length)];
    }

    function generateUser() {
        const adjectives = [
            // Hedgehog traits
            "spiky", "sleepy", "speedy", "grumpy", "happy", "snuggly", "tiny", "rolly", "fuzzy",
            "cozy", "sniffing", "curious", "hungry", "adventurous", "bouncy", "wiggly", "giggly",
            // Engineering traits
            "debugging", "coding", "hacking", "building", "shipping", "testing", "deploying",
            "scaling", "optimizing", "refactoring",
            // Growth/Product traits
            "growing", "launching", "iterating", "measuring", "analyzing", "converting"
        ];

        const names = [
            // Hedgehog names
            "sonic", "spike", "prickles", "hoglet", "nibbles", "waddles", "pokey", "ziggy",
            "quills", "bramble", "thistle",
            // Engineering terms
            "dev", "sre", "backend", "frontend", "fullstack", "devops", "sysadmin", "architect",
            // Growth/Product terms
            "product", "growth", "metrics", "funnel", "journey", "northstar", "pmf", "mvp"
        ];

        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomName = names[Math.floor(Math.random() * names.length)];
        const username = `${randomAdjective}_${randomName}`;
        const utmParams = generateUtm();
        
        // Generate random password
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const password = Array.from({ length: 12 }, () => 
            characters.charAt(Math.floor(Math.random() * characters.length))
        ).join('');

        return {
            username,
            email: `${username}@example.com`,
            password,
            utmParams
        };
    }

    function generateUtm() {
        const sources = ["google", "facebook", "twitter", "direct", "email"];
        const campaigns = ["winter2024", "socialads", "emailblast", "organic"];
        const mediums = ["search", "social", "cpc", "email", "organic"];
        const searchTerms = ["movie streaming", "watch movies online", "best streaming service", "new movies"];
        
        const utm_medium = mediums[Math.floor(Math.random() * mediums.length)];
        const params = {
            utm_source: sources[Math.floor(Math.random() * sources.length)],
            utm_medium,
            utm_campaign: campaigns[Math.floor(Math.random() * campaigns.length)]
        };
        // DEBUG
        // Add utm_term only if medium is search
        if (utm_medium === "search") {
            params.utm_term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        }
        console.log(params);

        return params;
    }

    function generateMovieNumber() {
        // Generate a number between 1-3 for movie selection
        return Math.floor(Math.random() * 3) + 1;
    }
      
      
      // For successful execution
      res.status(200).json({ message: 'Cron job executed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to execute cron job' });
    }
  }