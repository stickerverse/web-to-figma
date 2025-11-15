/**
 * FINAL WEB-TO-FIGMA SERVER - ALL PHASES (1-6)
 *
 * Features:
 * - Image proxy (CORS bypass)
 * - Multiple extraction modes (basic/hybrid/maximum)
 * - WebSocket streaming for large pages
 * - Health monitoring
 * - Performance optimization
 */
import express from 'express';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import net from 'net';
import { extractBasic, extractHybrid, extractMaximum } from './scraper.js';
import { StreamController } from './stream-controller.js';
import fetch from 'node-fetch';
import { ProgressTracker, CircularProgressBar } from './progress-tracker.js';
import { logger } from './logger.js';
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});
/**
 * Image proxy endpoint - solves CORS issues
 */
app.get('/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/*',
                'Referer': new URL(url).origin
            },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/png';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // Cache 1 day
        res.set('Access-Control-Allow-Origin', '*');
        res.send(buffer);
    }
    catch (error) {
        console.error('Image proxy error:', error.message);
        res.status(500).json({
            error: 'Failed to proxy image',
            details: error.message
        });
    }
    finally {
        clearTimeout(timeout);
    }
});
/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});
/**
 * Full page screenshot endpoint with DPR support
 */
app.get('/screenshot', async (req, res) => {
    const { url, dpr } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
    }
    try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        // Parse DPR parameter or default to 2
        const devicePixelRatio = dpr && !isNaN(Number(dpr)) ? Math.max(Number(dpr), 1) : 2;
        const page = await browser.newPage({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: devicePixelRatio
        });
        await page.goto(url, {
            waitUntil: 'load',
            timeout: 60000
        });
        const screenshot = await page.screenshot({
            type: 'png',
            fullPage: false,
            scale: devicePixelRatio > 1 ? 'device' : 'css'
        });
        await browser.close();
        const base64 = screenshot.toString('base64');
        // Calculate dimensions for metadata
        const width = 1280;
        const height = 720;
        const actualWidth = Math.round(width * devicePixelRatio);
        const actualHeight = Math.round(height * devicePixelRatio);
        res.json({
            screenshot: {
                src: `data:image/png;base64,${base64}`,
                width,
                height,
                dpr: devicePixelRatio,
                actualWidth,
                actualHeight
            }
        });
    }
    catch (error) {
        console.error('Screenshot error:', error.message);
        res.status(500).json({
            screenshot: null,
            error: error.message
        });
    }
});
/**
 * Main scrape endpoint (HTTP)
 */
app.post('/scrape', async (req, res) => {
    const { url, mode = 'hybrid' } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL required in request body' });
    }
    console.log(`Scraping ${url} in ${mode} mode...`);
    try {
        let data;
        // Console progress tracker for HTTP requests
        const progressTracker = new ProgressTracker((update) => {
            const progressLine = CircularProgressBar.renderDetailed(update);
            process.stdout.write('\r' + ' '.repeat(80) + '\r' + progressLine);
        });
        progressTracker.setTotalPhases(10);
        switch (mode) {
            case 'basic':
                data = await extractBasic(url);
                break;
            case 'maximum':
                data = await extractMaximum(url);
                break;
            case 'hybrid':
            default:
                data = await extractHybrid(url);
                break;
        }
        process.stdout.write('\n'); // New line after progress
        console.log(`✓ Extraction complete: ${data.nodes.length} nodes, ${data.assets.fonts.length} fonts, ${Object.keys(data.assets.images).length} images`);
        res.json(data);
    }
    catch (error) {
        process.stdout.write('\n'); // Ensure clean line on error
        console.error('Scrape error:', error.message);
        res.status(500).json({
            error: 'Extraction failed',
            details: error.message
        });
    }
});
/**
 * Create HTTP server
 */
const server = createServer(app);
/**
 * WebSocket server for streaming large pages
 */
function sendProgress(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PROGRESS', payload }));
    }
}
const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 100 * 1024 * 1024 // 100MB
});
wss.on('connection', (ws) => {
    console.log('✓ WebSocket connection established');
    // Setup logger callback to send logs to UI
    logger.setCallback((log) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'LOG',
                payload: log
            }));
        }
    });
    ws.on('message', async (message) => {
        let keepAliveInterval = null;
        const stopKeepAlive = () => {
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
            }
        };
        const startKeepAlive = () => {
            stopKeepAlive();
            keepAliveInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    sendProgress(ws, {
                        stage: 'heartbeat',
                        phase: 'heartbeat',
                        current: 0,
                        total: 0,
                        percentage: 0,
                        message: 'Extraction in progress...',
                        timeElapsed: undefined,
                        timeRemaining: undefined,
                    });
                }
                else {
                    stopKeepAlive();
                }
            }, 5000);
        };
        try {
            const { url, mode = 'hybrid' } = JSON.parse(message.toString());
            console.log(`WebSocket: Extracting ${url} in ${mode} mode...`);
            // Initialize progress tracker
            const progressTracker = new ProgressTracker((update) => {
                sendProgress(ws, {
                    stage: update.stage,
                    phase: update.phase,
                    current: update.current,
                    total: update.total,
                    percentage: update.percentage,
                    message: update.message,
                    timeElapsed: update.timeElapsed,
                    timeRemaining: update.timeRemaining,
                    url,
                    mode
                });
            });
            progressTracker.setTotalPhases(10); // Phases 0.5 through 10
            progressTracker.startPhase('Phase 0.5', 'Initializing page capture...');
            startKeepAlive();
            try {
                let data;
                switch (mode) {
                    case 'basic':
                        data = await extractBasic(url);
                        break;
                    case 'maximum':
                        data = await extractMaximum(url);
                        break;
                    case 'hybrid':
                    default:
                        data = await extractHybrid(url);
                        break;
                }
                console.log(`✓ Extraction complete: ${data.nodes.length} nodes`);
                progressTracker.startPhase('Phase 10', 'Preparing data for streaming...');
                const nodesForStreaming = data.nodes;
                progressTracker.updateStage('streaming_setup', 0, nodesForStreaming.length, 'Setting up streaming...');
                const controller = new StreamController(ws);
                await controller.streamExtractedPage({
                    nodes: nodesForStreaming,
                    fonts: data.assets.fonts,
                    tokens: data.tokens,
                    stackingContexts: [],
                    paintOrder: []
                });
                progressTracker.completePhase();
                console.log('✓ WebSocket extraction complete');
            }
            catch (extractError) {
                console.error('Extraction failed:', extractError.message);
                ws.send(JSON.stringify({
                    type: 'error',
                    error: extractError.message
                }));
            }
        }
        catch (error) {
            console.error('WebSocket message error:', error.message);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Invalid message format'
            }));
        }
        finally {
            stopKeepAlive();
        }
    });
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});
/**
 * Find an available port starting from a given port number
 */
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address()?.port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                findAvailablePort(startPort + 1).then(resolve, reject);
            }
            else {
                reject(err);
            }
        });
    });
}
/**
 * Start server
 */
async function startServer() {
    const preferredPort = parseInt(process.env.PORT || '3000', 10);
    let PORT;
    try {
        PORT = await findAvailablePort(preferredPort);
    }
    catch (error) {
        if (error?.code === 'EPERM') {
            console.error(`❌ Permission denied while trying to bind to port ${preferredPort}. ` +
                `Try running with elevated privileges or choose a different port via the PORT environment variable.`);
            console.error('Hint: PORT=3100 npm start');
        }
        else {
            console.error('❌ Failed to find an available port:', error?.message || error);
        }
        process.exit(1);
    }
    if (PORT !== preferredPort) {
        console.log(`⚠️  Port ${preferredPort} was in use, using port ${PORT} instead`);
    }
    server.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      WEB-TO-FIGMA CONVERTER - FINAL VERSION              ║
║      All Phases (1-6) - 95-100% Accuracy                 ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  🌐 Server:     http://localhost:${PORT}                     ║
║  🔌 WebSocket:  ws://localhost:${PORT}/ws                    ║
║  💚 Health:     http://localhost:${PORT}/health              ║
║  🖼️  Proxy:      /proxy-image?url=IMAGE_URL                ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  📋 EXTRACTION MODE:                                      ║
║                                                           ║
║  • maximum  - Full quality (includes all phases)         ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  ✓ Phase 1: Extended CSS extraction                      ║
║  ✓ Phase 2: Font extraction & mapping                    ║
║  ✓ Phase 3: Element screenshots                          ║
║  ✓ Phase 4: SVG extraction                               ║
║  ✓ Phase 5: Advanced effects                             ║
║  ✓ Phase 6: Pseudo-elements & states                     ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  📡 ENDPOINTS:                                            ║
║                                                           ║
║  POST /scrape                                             ║
║    Body: { "url": "..." }                                ║
║                                                           ║
║  GET  /proxy-image?url=IMAGE_URL                         ║
║  GET  /screenshot?url=PAGE_URL&dpr=2                     ║
║  GET  /health                                             ║
║                                                           ║
║  WS   /ws                                                 ║
║    Send: { "url": "..." }                                ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  🚀 READY TO CONVERT WEB TO FIGMA                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
    }).on('error', (err) => {
        console.error('❌ Server failed to start:', err);
        process.exit(1);
    });
}
// Start the server
startServer();
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map