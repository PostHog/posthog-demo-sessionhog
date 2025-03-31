import Browserbase from "@browserbasehq/sdk";
import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { runSession } from './session_helpers.js';

// Configure timezone for cron jobs
process.env.TZ = process.env.TZ || 'America/Los_Angeles';

// Set up __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || '';
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || '';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'https://posthog-demo-3000.fly.dev/';
const API_KEY = process.env.API_KEY || '';

// Validate required environment variables
if (!BROWSERBASE_API_KEY) {
    console.error('Error: BROWSERBASE_API_KEY is required but not set');
    process.exit(1);
}

if (!BROWSERBASE_PROJECT_ID) {
    console.error('Error: BROWSERBASE_PROJECT_ID is required but not set');
    process.exit(1);
}

if (!API_KEY) {
    console.error('Error: API_KEY is required but not set');
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
let currentJobStats = {
    startTime: null,
    completedSessions: 0,
    totalSessions: 0,
    errors: []
};

// API key middleware
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized'
        });
    }
    next();
};

// Unified session running function
async function runScheduledSessions(type, options = {}) {
    if (isJobRunning) {
        console.log('Another job is already running. Skipping this execution.');
        return false;
    }

    try {
        isJobRunning = true;
        const sessionCount = options.sessionCount || Math.floor(Math.random() * (52 - 23 + 1)) + 23;
        
        currentJobStats = {
            startTime: new Date().toISOString(),
            completedSessions: 0,
            totalSessions: sessionCount,
            errors: []
        };

        console.log(`[${new Date().toISOString()}] Starting ${type} session management logic...`);
        console.log(`Starting ${sessionCount} random sessions...`);

        const results = [];
        for (let i = 1; i <= sessionCount; i++) {
            try {
                const result = await runSession(i, sessionCount, bb, BASE_DOMAIN);
                results.push(result);
                if (result) {
                    currentJobStats.completedSessions++;
                }
            } catch (error) {
                currentJobStats.errors.push({
                    session: i,
                    error: error.message
                });
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
        currentJobStats.errors.push({
            session: 'global',
            error: error.message
        });
        return false;
    } finally {
        isJobRunning = false;
    }
}

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        timezone: process.env.TZ,
        isJobRunning
    });
});

// Status endpoint
app.get('/status', apiKeyAuth, (req, res) => {
    res.status(200).json({
        isJobRunning,
        currentJob: isJobRunning ? currentJobStats : null
    });
});

// Trigger sessions endpoint
app.post('/trigger-sessions', apiKeyAuth, async (req, res) => {
    if (isJobRunning) {
        return res.status(409).json({
            status: 'error',
            message: 'Another job is already running',
            currentJob: currentJobStats
        });
    }

    const {
        sessionCount,
        maxConcurrent = 1
    } = req.body;

    try {
        // Start the session run asynchronously
        runScheduledSessions('on-demand', {
            sessionCount,
            maxConcurrent
        }).catch(error => {
            console.error('Error in on-demand session:', error);
        });

        res.status(202).json({
            status: 'accepted',
            message: 'Session simulation started',
            config: {
                sessionCount: sessionCount || 'random(23-52)',
                maxConcurrent
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Base domain: ${BASE_DOMAIN}`);
});

console.log('Sessions server starting...');
console.log(`Base domain: ${BASE_DOMAIN}`);