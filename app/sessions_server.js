import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { randomizeBrowser } from '../tools/randomBrowser.js';
import { randomizeGeolocation } from '../tools/randomGeolocation.js';
import { 
    moveMouseHuman, 
    naturalClick, 
    naturalScroll, 
    naturalType,
    humanPause
} from '../tools/mouseMove.js';

// Configure timezone for cron jobs
process.env.TZ = process.env.TZ || 'America/Los_Angeles';

// Set up __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || '';
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || '';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'https://posthog-demo-3000.fly.dev/';

// Validate required environment variables
if (!BROWSERBASE_API_KEY) {
    console.error('Error: BROWSERBASE_API_KEY is required but not set');
    process.exit(1);
}

if (!BROWSERBASE_PROJECT_ID) {
    console.error('Error: BROWSERBASE_PROJECT_ID is required but not set');
    process.exit(1);
}

// Validate BASE_DOMAIN format
try {
    new URL(BASE_DOMAIN);
} catch (error) {
    console.error('Error: BASE_DOMAIN must be a valid URL');
    process.exit(1);
}

// Initialize Browserbase globally
const bb = new Browserbase({
    apiKey: BROWSERBASE_API_KEY,
    projectId: BROWSERBASE_PROJECT_ID,
    region: 'us-east-1'
});

// Add validation for Browserbase connection
try {
    // Test the connection by attempting to list sessions
    await bb.sessions.list({ projectId: BROWSERBASE_PROJECT_ID });
    console.log('Successfully connected to Browserbase');
} catch (error) {
    console.error('Failed to connect to Browserbase:', error.message);
    process.exit(1);
}

// Add a lock mechanism to prevent multiple instances from running the same job
let isJobRunning = false;

// Unified cron job function
async function runScheduledSessions(dayType) {
    if (isJobRunning) {
        console.log('Another job is already running. Skipping this execution.');
        return;
    }

    try {
        isJobRunning = true;
        console.log(`[${new Date().toISOString()}] Starting ${dayType} session management logic...`);
        
        // Generate random number of sessions between 23 and 52
        const sessionCount = Math.floor(Math.random() * (52 - 23 + 1)) + 23;
        console.log(`Starting ${sessionCount} random sessions...`);

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

    } catch (error) {
        console.error('Error in scheduled job:', error);
    } finally {
        isJobRunning = false;
    }
}

// Schedule for Sunday-Wednesday: Runs twice a day at 8 AM and 6 PM Pacific Time
cron.schedule('0 8,18 * * 0-3', () => {
    runScheduledSessions('Sunday-Wednesday');
}, {
    timezone: "America/Los_Angeles"
});

// Schedule for Thursday-Saturday: Runs three times a day at 8 AM, 1 PM, and 6 PM Pacific Time
cron.schedule('0 8,13,18 * * 4-6', () => {
    runScheduledSessions('Thursday-Saturday');
}, {
    timezone: "America/Los_Angeles"
});

// Health check endpoint for Fly.io
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        timezone: process.env.TZ,
        isJobRunning
    });
});

app.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Performing graceful shutdown...');
    if (isJobRunning) {
        console.log('Waiting for current job to complete...');
        // Wait for up to 5 minutes for the current job to complete
        let waitTime = 0;
        while (isJobRunning && waitTime < 300000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            waitTime += 1000;
        }
    }
    process.exit(0);
});

console.log('Sessions server starting...');
console.log(`Base domain: ${BASE_DOMAIN}`);

async function runSession(sessionNumber) {
    let session;
    try {
        console.log(`Starting session ${sessionNumber}/${sessionCount}...`);     
        const geoLocation = randomizeGeolocation();
        
        session = await bb.sessions.create({
            projectId: BROWSERBASE_PROJECT_ID,
            region: 'us-east-1',
            proxies: [{
                type: 'browserbase',
                geolocation: {
                    city: geoLocation.city,
                    country: geoLocation.country,
                    ...(geoLocation.state && { state: geoLocation.state })
                }
            }]
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
            await page.goto(`${BASE_DOMAIN}?utm_source=${utmParams.utm_source}&utm_medium=${utmParams.utm_medium}&utm_campaign=${utmParams.utm_campaign}`, { 
                waitUntil: "networkidle",
                timeout: 60000 
            });

            // Handle GitHub Codespaces Continue button if feeding sessions to private demo project
            try {
                const continueButton = await page.waitForSelector([
                    'button.btn-primary.btn.js-toggle-hidden',
                    'button:has-text("Continue")',
                    '[onclick*="tunnel_phishing_protection"]'
                ].join(','), { timeout: 5000 });
                
                if (continueButton) {
                    await continueButton.click();
                    // Wait for the cookie to be set and page to settle
                    await page.waitForLoadState('networkidle');
                }
            } catch (buttonError) {
                // Button wasn't found or wasn't needed, continue with normal flow
                console.log('No CodeSpaces continue button found, proceeding with normal flow');
            }
            
            await humanPause(page, 'MEDIUM');
            
            // Navigate to signup with Promise.all to handle navigation
            await Promise.all([
                page.waitForLoadState('networkidle'),
                page.goto(`${BASE_DOMAIN}signup`)
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
        await page.goto(`${BASE_DOMAIN}login`, { waitUntil: "domcontentloaded" });
        try {
            await humanPause(page, 'MEDIUM');
            
            // Get CSRF token with better error handling and fallbacks
            let csrfToken;
            try {
                // Try multiple selectors in order of preference
                csrfToken = await page.evaluate(() => {
                    return (
                        document.querySelector('input[name="csrf_token"]')?.value ||
                        document.querySelector('meta[name="csrf-token"]')?.content ||
                        document.querySelector('[data-csrf]')?.getAttribute('data-csrf')
                    );
                });
                
                if (!csrfToken) {
                    console.warn('CSRF token not found, proceeding without it');
                }
            } catch (error) {
                console.warn('Error getting CSRF token:', error.message);
            }
            
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
        await page.goto(`${BASE_DOMAIN}`, { waitUntil: "domcontentloaded" });


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
        const fullUrl = `${BASE_DOMAIN}?utm_source=${utmParams.utm_source}&utm_medium=${utmParams.utm_medium}&utm_campaign=${utmParams.utm_campaign}${utmParams.utm_term ? '&utm_term=' + utmParams.utm_term : ''}`;

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
    } finally {
        // Cleanup if session was created but something went wrong
        if (session?.id) {
            try {
                await bb.sessions.update(session.id, {
                    status: "REQUEST_RELEASE",
                    projectId: BROWSERBASE_PROJECT_ID,
                });
            } catch (cleanupError) {
                console.warn(`Failed to cleanup session ${session.id}:`, cleanupError.message);
            }
        }
    }
}

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
    const regularDomains = [
        "hogmail.com",
        "squeak.com", 
        "furryfamilies.com",
        "quillpost.net",
        "spikeymail.org",
        "hedgehoghaven.com",
        "pricklypal.net",
        "snufflemail.com",
        "spinyspace.org",
        "hedgenet.com"
    ];

    const industryDomains = [
        "pixhog.biz",
        "imaginhog.ai",
        "marvelhogstudios.io",
        "hannahogbera.com",
        "dreamhogs.biz",
        "bluespiky.com",
        "illuminhogion.tech",
        "hogartsentertainment.tech",
        "pricklypictures.app",
        "spinemation.io"
    ];

    const adjectives = [
        // Hedgehog traits
        "spiky", "sleepy", "speedy", "grumpy", "happy", "snuggly", "tiny", "rolly", "fuzzy",
        "cozy", "sniffing", "curious", "hungry", "adventurou$", "bouncy", "wiggly", "giggly",
        // Movie watching traits
        "binging", "watching", "streaming", "viewing", "chilling", "relaxing", "comfy",
        "snacking", "moviegoing", "cinematic",
        // Kid-friendly adjectives
        "silli", "jumpy", "sparkly", "magical", "dancing", "singing", "laffy",
        // Engineering traits
        "debugging", "coding", "hacking", "building", "shipping", "testing", "deploying",
        "scaling", "optimizing", "refactoring",
        // Growth/Product traits
        "GrowinG", "launching", "iterating", "mea$uring", "analy$ing", "convert|ng"
    ];

    const names = [
        // Hedgehog names
        "sonic", "spike", "prickles", "hoglet", "nibbles", "waddles", "pokey", "ziggy",
        "quills", "bramble", "thistle",
        // Movie watching names
        "moviebuff", "cinephile", "filmfan", "bingewatcher", "couchpotato", "streammaster",
        "flickpicker", "showtime", "cinema",
        // Kid names
        "princess", "superhero", "dragon", "unicorn", "wizard", "fairy", "pirate", "ninja",
        "astronaut", "dinosaur", "mermaid",
        // Engineering terms
        "dev", "sre", "backend", "frontend", "fullstack", "devops", "ai_ops", "architect", "llm_ops",
        // Growth/Product terms
        "product", "growth", "metrics", "funnel", "journey", "northstar", "pmf", "mvp"
    ];

    const useIndustryDomain = Math.random() < 0.1; // 10% chance
    const domainList = useIndustryDomain ? industryDomains : regularDomains;
    const randomDomain = domainList[Math.floor(Math.random() * domainList.length)];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomName = names[Math.floor(Math.random() * names.length)]
        .charAt(0).toUpperCase() + names[Math.floor(Math.random() * names.length)];
    
    // Generate random alphanumeric suffix (6 characters)
    const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const suffix = Array.from({ length: 3 }, () => 
        alphanumeric.charAt(Math.floor(Math.random() * alphanumeric.length))
    ).join('');
    
    const username = `${randomAdjective}${randomName}${suffix}`;
    const utmParams = generateUtm();
    
    // Generate random password
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const password = Array.from({ length: 9 }, () => 
        characters.charAt(Math.floor(Math.random() * characters.length))
    ).join('');

    return {
        username,
        email: `${username}@${randomDomain}`,
        password,
        utmParams
    };
}

function generateUtm() {
    const sources = ["google", "chatgpt", "facebook", "twitter", "direct", "email"];
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