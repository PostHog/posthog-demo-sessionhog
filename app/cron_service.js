import Browserbase from "@browserbasehq/sdk";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSession } from './session_helpers.js';

// Set up __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

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

// Initialize Browserbase
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

async function runScheduledSessions() {
    try {
        // Generate a random number of sessions between 23 and 52
        const sessionCount = Math.floor(Math.random() * (52 - 23 + 1)) + 23;
        
        console.log(`[${new Date().toISOString()}] Starting scheduled session run...`);
        console.log(`Starting ${sessionCount} random sessions...`);

        const results = [];
        for (let i = 1; i <= sessionCount; i++) {
            try {
                const result = await runSession(i, sessionCount, bb, BASE_DOMAIN);
                results.push(result);
            } catch (error) {
                console.error(`Error in session ${i}:`, error.message);
            }
            
            // Add a random delay between sessions (2-5 seconds)
            const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Final statistics
        const successCount = results.filter(r => r).length;
        console.log(`\nCompleted ${successCount}/${sessionCount} sessions successfully`);
        return true;

    } catch (error) {
        console.error('Error in scheduled job:', error);
        return false;
    }
}

// Run the sessions and exit
console.log('Starting cron service...');
runScheduledSessions()
    .then(() => {
        console.log('Cron service completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Cron service failed:', error);
        process.exit(1);
    }); 