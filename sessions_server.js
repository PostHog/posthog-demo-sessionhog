import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomizeBrowser } from './tools/randomBrowser.js';
import { 
    moveMouseHuman, 
    naturalClick, 
    naturalScroll, 
    naturalType,
    humanPause
} from './tools/mouseMove.js';

// Set up __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// const baseDomain = 'https://friendly-dollop-7rj6qj44773rv46-5000.app.github.dev/';
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

    // Add utm_term only if medium is search
    if (utm_medium === "search") {
        params.utm_term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    }

    return params;
}

function generateMovieNumber() {
    // Generate a number between 1-3 for movie selection
    return Math.floor(Math.random() * 3) + 1;
}