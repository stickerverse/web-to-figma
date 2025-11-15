/**
 * ULTIMATE WEB-TO-FIGMA SCRAPER - ALL PHASES (0.5-9)
 *
 * Target Accuracy: 95-100% (Builder.io + html2figma combined)
 *
 * PHASE BREAKDOWN:
 * - Phase 0.5: Screenshot-Everything-First (Builder.io approach)
 * - Phase 1: Extended CSS extraction, auto-scroll, comprehensive properties
 * - Phase 2: Font extraction and downloading
 * - Phase 3: Element screenshots and hybrid rendering
 * - Phase 4: SVG extraction, stacking contexts, paint order
 * - Phase 5: Advanced effects, typography (30+ properties)
 * - Phase 6: Text rasterization with system font detection (NEW)
 * - Phase 7: Figma-native pre-conversion (NEW)
 * - Phase 8: Validation & confidence scoring (NEW)
 * - Phase 9: Layer optimization metadata (NEW)
 */
import { chromium } from "playwright";
import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { legacyMigrator, CSSInheritanceResolver, GridUtils } from "../../ir.cjs";
import { compileIR } from "./ir-compiler.js";
import { parseEffectsToIR } from "./effects-parser.js";
// ==================== CONSTANTS ====================
const SYSTEM_FONTS = [
    "arial",
    "helvetica",
    "times new roman",
    "times",
    "courier new",
    "courier",
    "georgia",
    "verdana",
    "trebuchet ms",
    "palatino",
    "system-ui",
    "-apple-system",
    "blinkmacsystemfont",
    "segoe ui",
    "roboto",
    "oxygen",
    "ubuntu",
    "cantarell",
    "fira sans",
    "sf pro display",
    "sf pro text",
    "sf pro icons",
    "san francisco",
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "fantasy",
];
const RESTRICTED_FONT_HOST_PATTERNS = [
    /https?:\/\/(?:www\.)?apple\.com\/wss\/fonts/i,
    /https?:\/\/(?:www\.)?apple\.com\/assets\/ac-footer\/legacy/i,
];
const RESTRICTED_FONT_FAMILY_PATTERNS = [
    /^sf[\s-]?pro/i,
    /^san\s+francisco/i,
    /^appleicons?/i,
];
const FONT_SOURCE_PRIORITY = ["ttf", "otf", "woff", "woff2", "eot", "svg"];
function prioritizeFontSources(sources) {
    return [...sources].sort((a, b) => {
        const extA = getFontExtension(a.url);
        const extB = getFontExtension(b.url);
        const priorityA = getFontPriority(extA);
        const priorityB = getFontPriority(extB);
        return priorityA - priorityB;
    });
}
function getFontExtension(url) {
    try {
        const cleaned = url.split("?")[0];
        const parts = cleaned.split(".");
        if (parts.length < 2)
            return undefined;
        return parts.pop()?.toLowerCase();
    }
    catch {
        return undefined;
    }
}
function getFontPriority(extension) {
    if (!extension)
        return FONT_SOURCE_PRIORITY.length + 1;
    const idx = FONT_SOURCE_PRIORITY.indexOf(extension);
    return idx === -1 ? FONT_SOURCE_PRIORITY.length : idx;
}
function shouldTreatAsSystemFont(family, sources) {
    const lowerFamily = family.toLowerCase();
    if (RESTRICTED_FONT_FAMILY_PATTERNS.some((pattern) => pattern.test(lowerFamily))) {
        return true;
    }
    if (sources.length > 0 &&
        sources.every((source) => RESTRICTED_FONT_HOST_PATTERNS.some((pattern) => pattern.test(source.url)))) {
        return true;
    }
    return false;
}
const MAX_RASTERIZE_COUNT = 50;
const MIN_LARGE_HEADING_SIZE = 40;
const TEXT_SHADOW_BLUR_THRESHOLD = 2;
const RASTER_PADDING = 2;
const SCREENSHOT_QUALITY = 95;
const MAX_RETRY_ATTEMPTS = 3;
const CONFIDENCE_THRESHOLD = 0.9;
// ==================== HELPER FUNCTIONS ====================
function calculateScreenshotDPR(renderEnv) {
    const deviceDPR = renderEnv?.device?.devicePixelRatio || 1;
    if (deviceDPR > 1) {
        return Math.max(deviceDPR, 2);
    }
    return 1;
}
async function applyRenderingStabilityLayer(page) {
    const { CONFIG } = await import('./config.js');
    // Skip if freeze layer is disabled
    if (!CONFIG.FREEZE_LAYER_ENABLED) {
        console.log('[FreezePage] ⏭️ Freeze layer disabled via config');
        return;
    }
    await page.evaluate((config) => {
        const marker = "__webToFigmaFreezeApplied";
        if (window[marker]) {
            return;
        }
        window[marker] = true;
        // ==================== FREEZE PAGE HELPER ====================
        function freezePage() {
            // 1. Inject comprehensive CSS to disable animations and force layout stability
            if (config.FREEZE_DISABLE_ANIMATIONS) {
                const styleId = "__web_to_figma_freeze_style__";
                if (!document.getElementById(styleId)) {
                    const freezeStyle = document.createElement("style");
                    freezeStyle.id = styleId;
                    freezeStyle.textContent = `
            /* Disable ALL animations and transitions */
            *,
            *::before,
            *::after {
              transition-duration: 0s !important;
              transition-delay: 0s !important;
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              animation-play-state: paused !important;
              transform-origin: 50% 50% !important;
            }
            
            /* Force html/body overflow to be visible for accurate capture */
            html, body {
              overflow: visible !important;
              scroll-behavior: auto !important;
              overscroll-behavior: contain !important;
              scroll-snap-type: none !important;
            }
            
            /* Disable CSS smooth scrolling */
            * {
              scroll-behavior: auto !important;
            }
            
            /* Pause CSS animations */
            @media (prefers-reduced-motion: no-preference) {
              * {
                animation-play-state: paused !important;
              }
            }
            
            /* Stop video autoplay that might affect layout */
            video {
              autoplay: false !important;
            }
          `;
                    document.head.appendChild(freezeStyle);
                }
            }
            // 2. Capture and lock scroll positions (if enabled)
            if (config.FREEZE_DISABLE_SCROLL) {
                const scrollableElements = new Map();
                // Get all potentially scrollable elements
                const allElements = Array.from(document.querySelectorAll('*'));
                for (const element of allElements) {
                    const computedStyle = window.getComputedStyle(element);
                    const isScrollable = computedStyle.overflow === 'auto' ||
                        computedStyle.overflow === 'scroll' ||
                        computedStyle.overflowY === 'auto' ||
                        computedStyle.overflowY === 'scroll' ||
                        computedStyle.overflowX === 'auto' ||
                        computedStyle.overflowX === 'scroll';
                    if (isScrollable && (element.scrollTop > 0 || element.scrollLeft > 0)) {
                        scrollableElements.set(element, {
                            top: element.scrollTop,
                            left: element.scrollLeft
                        });
                    }
                }
                // Also capture main document scroll position
                scrollableElements.set(document.documentElement, {
                    top: document.documentElement.scrollTop,
                    left: document.documentElement.scrollLeft
                });
                scrollableElements.set(document.body, {
                    top: document.body.scrollTop,
                    left: document.body.scrollLeft
                });
                // 3. Monkey-patch scroll functions to become no-ops
                const noop = () => { };
                const originalScrollTo = window.scrollTo;
                const originalScrollBy = window.scrollBy;
                window.scrollTo = noop;
                window.scrollBy = noop;
                window.scroll = noop;
                // 4. Patch scroll properties on all scrollable elements to lock their positions
                const patchElementScroll = (element, savedPos) => {
                    const scrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
                    const scrollLeftDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
                    if (scrollTopDescriptor) {
                        Object.defineProperty(element, 'scrollTop', {
                            get: () => savedPos.top,
                            set: () => { }, // Ignore scroll attempts
                            configurable: true
                        });
                    }
                    if (scrollLeftDescriptor) {
                        Object.defineProperty(element, 'scrollLeft', {
                            get: () => savedPos.left,
                            set: () => { }, // Ignore scroll attempts
                            configurable: true
                        });
                    }
                };
                // Apply scroll locking to all captured scrollable elements
                for (const [element, position] of scrollableElements) {
                    patchElementScroll(element, position);
                }
            }
            // 5. Disable async timing functions that could trigger layout changes (if enabled)
            if (config.FREEZE_DISABLE_TIMING) {
                const originalSetTimeout = window.setTimeout;
                const originalSetInterval = window.setInterval;
                const originalRequestAnimationFrame = window.requestAnimationFrame;
                const originalRequestIdleCallback = window.requestIdleCallback;
                // Store original functions for potential cleanup
                window.__originalTimingFunctions = {
                    setTimeout: originalSetTimeout,
                    setInterval: originalSetInterval,
                    requestAnimationFrame: originalRequestAnimationFrame,
                    requestIdleCallback: originalRequestIdleCallback
                };
                // Replace with no-ops or controlled execution
                window.setTimeout = (callback, delay, ...args) => {
                    // Only allow immediate execution for critical functions
                    if (delay === 0 || delay === undefined) {
                        try {
                            if (typeof callback === 'function') {
                                callback.apply(null, args);
                            }
                        }
                        catch (e) {
                            // Silently ignore callback errors during freeze
                        }
                    }
                    return -1; // Return dummy timer ID
                };
                window.setInterval = () => -1; // Return dummy interval ID
                window.requestAnimationFrame = (callback) => {
                    // Don't execute animation frames during freeze
                    return -1;
                };
                if (window.requestIdleCallback) {
                    window.requestIdleCallback = () => -1;
                }
            }
            // 6. Disable pointer events temporarily to prevent interaction-based layout changes
            document.body.style.pointerEvents = 'none';
            // 7. Force immediate layout calculation to ensure everything is settled
            document.body.offsetHeight; // Force reflow
            console.log('[FreezePage] ✅ Page frozen for stable extraction');
        }
        // Execute the freeze
        freezePage();
        // ==================== LEGACY COMPATIBILITY ====================
        // Keep existing dimension patching for backward compatibility
        const patchDimensionProp = (prop, axis) => {
            Object.defineProperty(HTMLElement.prototype, prop, {
                get: function () {
                    const rect = this.getBoundingClientRect();
                    const value = axis === "height" ? rect.height : rect.width;
                    return Math.round(value);
                },
                configurable: true,
            });
        };
        patchDimensionProp("offsetHeight", "height");
        patchDimensionProp("offsetWidth", "width");
        const originalGetClientRects = Element.prototype.getClientRects;
        Element.prototype.getClientRects = function () {
            const rect = this.getBoundingClientRect();
            if (!rect) {
                return originalGetClientRects.call(this);
            }
            const list = [rect];
            list.item = (index) => list[index] || null;
            return list;
        };
    }, CONFIG);
}
// ==================== PHASE 0.5: SCREENSHOT-EVERYTHING-FIRST ====================
/**
 * PHASE 0.5: Screenshot-Everything-First (Builder.io approach)
 * Captures screenshots of EVERYTHING before extraction
 */
async function screenshotEverything(page, renderEnv, enableElementScreenshots = false, enablePageScreenshot = false // NEW: Control page screenshot (default: disabled to prevent hanging)
) {
    console.log("[Phase 0.5] 📸 Capturing primary screenshots...");
    console.log(`  📄 Page screenshot: ${enablePageScreenshot ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  🔲 Element screenshots: ${enableElementScreenshots ? 'ENABLED' : 'DISABLED'}`);
    const startTime = performance.now();
    const MAX_PHASE_TIME = 60000; // 60 seconds maximum for entire phase
    const MAX_ELEMENTS = 50; // Limit to prevent stalling
    const ELEMENT_TIMEOUT = 5000; // 5 seconds per element
    const ELEMENT_QUERY_TIMEOUT = 10000; // 10 seconds to query all elements
    const PAGE_SCREENSHOT_TIMEOUT = 10000; // REDUCED: 10 seconds (was 30s) for faster failure
    const screenshotDPR = calculateScreenshotDPR(renderEnv);
    const viewport = await page.viewportSize();
    // 1. Full page screenshot with timeout (OPTIONAL - disabled by default to prevent hanging)
    let pageScreenshot;
    let pageHash;
    if (enablePageScreenshot) {
        try {
            console.log("[Phase 0.5] ⏳ Capturing page screenshot (10s timeout)...");
            pageScreenshot = await Promise.race([
                page.screenshot({
                    type: "png",
                    fullPage: true,
                    scale: screenshotDPR > 1 ? "device" : "css",
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Page screenshot timeout')), PAGE_SCREENSHOT_TIMEOUT))
            ]);
            console.log(`[Phase 0.5] ✅ Full page screenshot captured (${(pageScreenshot.length / 1024).toFixed(1)} KB)`);
            pageHash = crypto.createHash("sha256").update(pageScreenshot).digest("hex");
        }
        catch (error) {
            console.error(`[Phase 0.5] ❌ Full page screenshot failed: ${error.message}`);
            console.log("[Phase 0.5] ⚠️  Continuing without page screenshot (using empty buffer)");
            // Don't throw - create empty buffer and continue
            pageScreenshot = Buffer.alloc(0);
            pageHash = '';
        }
    }
    else {
        console.log("[Phase 0.5] ⏭️  Page screenshot disabled (prevents hanging on complex sites)");
        pageScreenshot = Buffer.alloc(0); // Empty buffer
        pageHash = '';
    }
    const result = {
        page: {
            src: pageScreenshot.length > 0 ? `data:image/png;base64,${pageScreenshot.toString("base64")}` : '',
            width: viewport?.width || 0,
            height: viewport?.height || 0,
            dpr: screenshotDPR,
            hash: pageHash,
        },
        elementCount: 0,
    };
    // Skip element screenshots if not explicitly enabled
    if (!enableElementScreenshots) {
        console.log(`[Phase 0.5] ✅ Page screenshot captured, element screenshots disabled (use capturePhase0Screenshots: true to enable)`);
        return result;
    }
    // 2. Individual element screenshots (LIMITED & TIMED)
    console.log("[Phase 0.5] ⚙️  Element screenshots enabled, querying DOM...");
    // First, estimate element count with timeout to prevent hanging
    let totalElements = 0;
    try {
        totalElements = await Promise.race([
            page.evaluate(() => document.getElementsByTagName('*').length),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Element count timeout')), 3000))
        ]);
        console.log(`[Phase 0.5] Estimated ${totalElements} elements in DOM`);
    }
    catch (error) {
        console.warn(`[Phase 0.5] ⚠️  Could not estimate element count, skipping element screenshots: ${error.message}`);
        return result;
    }
    // Skip Phase 0.5 element screenshots for complex sites
    if (totalElements > 5000) {
        console.log(`[Phase 0.5] ⚠️  Complex site detected (${totalElements} elements) - skipping individual screenshots`);
        console.log(`[Phase 0.5] ✅ Page screenshot captured, relying on Phase 3 for element screenshots`);
        return result;
    }
    // Query elements with timeout protection
    let allElements;
    try {
        allElements = await Promise.race([
            page.$$("*"),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Element query timeout')), ELEMENT_QUERY_TIMEOUT))
        ]);
        console.log(`[Phase 0.5] ✅ Successfully queried ${allElements.length} elements`);
    }
    catch (error) {
        console.warn(`[Phase 0.5] ⚠️  Element query timed out after ${ELEMENT_QUERY_TIMEOUT}ms, skipping element screenshots`);
        console.log(`[Phase 0.5] ✅ Page screenshot captured, relying on Phase 3 for element screenshots`);
        return result;
    }
    const elements = allElements.slice(0, MAX_ELEMENTS);
    const elementScreenshots = new Map();
    let capturedCount = 0;
    let skippedCount = 0;
    for (const element of elements) {
        // Check phase timeout
        if (performance.now() - startTime > MAX_PHASE_TIME) {
            console.log(`[Phase 0.5] ⏱️  Phase timeout reached (${MAX_PHASE_TIME}ms), stopping early`);
            break;
        }
        try {
            // Timeout wrapper for each element
            const captureWithTimeout = async () => {
                const rect = await element.boundingBox();
                if (!rect || rect.width === 0 || rect.height === 0) {
                    skippedCount++;
                    return;
                }
                const elementId = await element.evaluate((el) => {
                    if (el.id)
                        return el.id;
                    const parent = el.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children);
                        const index = siblings.indexOf(el);
                        return `__elem_${el.tagName.toLowerCase()}_${index}`;
                    }
                    return `__elem_${el.tagName.toLowerCase()}_0`;
                });
                const screenshot = await element.screenshot({
                    type: "png",
                    omitBackground: false,
                    scale: screenshotDPR > 1 ? "device" : "css",
                });
                const hash = crypto.createHash("sha256").update(screenshot).digest("hex");
                elementScreenshots.set(elementId, {
                    src: `data:image/png;base64,${screenshot.toString("base64")}`,
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    dpr: screenshotDPR,
                    hash,
                });
                capturedCount++;
            };
            // Apply timeout to prevent hanging
            await Promise.race([
                captureWithTimeout(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Element screenshot timeout')), ELEMENT_TIMEOUT))
            ]);
        }
        catch (error) {
            skippedCount++;
            if (error.message.includes('timeout')) {
                console.warn(`[Phase 0.5] ⚠️  Element screenshot timeout (${capturedCount}/${MAX_ELEMENTS})`);
            }
        }
    }
    result.elementCount = capturedCount;
    const duration = performance.now() - startTime;
    console.log(`[Phase 0.5] ✅ Captured ${capturedCount} screenshots (skipped ${skippedCount}) in ${(duration / 1000).toFixed(1)}s`);
    // Store in page context
    await page.evaluate((screenshots) => {
        window.__primaryScreenshots = screenshots;
    }, Object.fromEntries(elementScreenshots));
    return result;
}
// ==================== PHASE 1: WAIT FOR FULLY LOADED ====================
async function waitForFullyLoaded(page) {
    const startTime = Date.now();
    const timestamps = {
        documentReady: 0,
        fontsReady: 0,
        imagesReady: 0,
        lazyContentReady: 0,
        domStabilized: 0,
        extractionStart: 0,
    };
    const stats = {
        totalWaitMs: 0,
        fontsLoaded: 0,
        fontsFailed: 0,
        failedFonts: [],
        imagesLoaded: 0,
        imagesBlocked: 0,
        imagesFailed: 0,
        lazyElementsActivated: 0,
        domStable: false,
        timedOut: false,
    };
    const errors = [];
    const globalTimeout = setTimeout(() => {
        stats.timedOut = true;
    }, 60000);
    try {
        // STEP 1: Document Ready
        try {
            await page.waitForFunction(() => document.readyState === "complete", {
                timeout: 30000,
            });
            await page.waitForTimeout(500);
            timestamps.documentReady = Date.now();
        }
        catch (error) {
            errors.push({
                phase: "documentReady",
                message: `Document ready timeout: ${error}`,
            });
            timestamps.documentReady = Date.now();
        }
        // STEP 2: Font Loading
        try {
            const fontLoadPromise = page.evaluate(async () => {
                const result = {
                    fontsLoaded: 0,
                    fontsFailed: 0,
                    failedFonts: [],
                };
                if (!document.fonts) {
                    return result;
                }
                try {
                    await document.fonts.ready;
                }
                catch (e) {
                    // Continue even if fonts.ready fails
                }
                const fontFamilies = new Set();
                try {
                    for (const sheet of Array.from(document.styleSheets)) {
                        try {
                            const rules = sheet.cssRules || sheet.rules;
                            for (const rule of Array.from(rules)) {
                                if (rule instanceof CSSFontFaceRule) {
                                    const style = rule.style;
                                    let family = style.getPropertyValue("font-family");
                                    family = family.replace(/['"]/g, "").trim();
                                    if (family) {
                                        fontFamilies.add(family);
                                    }
                                }
                            }
                        }
                        catch (e) {
                            // CORS blocked
                        }
                    }
                }
                catch (e) {
                    // StyleSheets access failed
                }
                for (const family of Array.from(fontFamilies)) {
                    try {
                        await document.fonts.load(`16px "${family}"`);
                        result.fontsLoaded++;
                    }
                    catch (e) {
                        result.fontsFailed++;
                        result.failedFonts.push(family);
                    }
                }
                return result;
            });
            const fontResult = await Promise.race([
                fontLoadPromise,
                new Promise((resolve) => setTimeout(() => resolve({
                    fontsLoaded: 0,
                    fontsFailed: 0,
                    failedFonts: [],
                }), 10000)),
            ]);
            stats.fontsLoaded = fontResult.fontsLoaded;
            stats.fontsFailed = fontResult.fontsFailed;
            stats.failedFonts = fontResult.failedFonts;
            timestamps.fontsReady = Date.now();
        }
        catch (error) {
            errors.push({
                phase: "fontLoading",
                message: `Font loading error: ${error}`,
            });
            timestamps.fontsReady = Date.now();
        }
        // STEP 3: Image Loading
        try {
            const imageLoadPromise = page.evaluate(async () => {
                const result = {
                    imagesLoaded: 0,
                    imagesBlocked: 0,
                    imagesFailed: 0,
                };
                const allImages = document.querySelectorAll("img");
                const incompleteImages = Array.from(allImages).filter((img) => !img.complete || img.naturalWidth === 0);
                const imagePromises = incompleteImages.map((img) => {
                    return new Promise((resolve) => {
                        const onLoad = () => {
                            result.imagesLoaded++;
                            cleanup();
                            resolve();
                        };
                        const onError = (event) => {
                            const error = event;
                            if (error.message && error.message.includes("CORS")) {
                                result.imagesBlocked++;
                            }
                            else {
                                result.imagesFailed++;
                            }
                            cleanup();
                            resolve();
                        };
                        const cleanup = () => {
                            img.removeEventListener("load", onLoad);
                            img.removeEventListener("error", onError);
                        };
                        img.addEventListener("load", onLoad);
                        img.addEventListener("error", onError);
                        if (img.complete) {
                            if (img.naturalWidth > 0) {
                                result.imagesLoaded++;
                            }
                            else {
                                result.imagesFailed++;
                            }
                            cleanup();
                            resolve();
                        }
                    });
                });
                await Promise.all(imagePromises);
                return result;
            });
            const imageResult = await Promise.race([
                imageLoadPromise,
                new Promise((resolve) => setTimeout(() => resolve({
                    imagesLoaded: 0,
                    imagesBlocked: 0,
                    imagesFailed: 0,
                }), 15000)),
            ]);
            stats.imagesLoaded = imageResult.imagesLoaded;
            stats.imagesBlocked = imageResult.imagesBlocked;
            stats.imagesFailed = imageResult.imagesFailed;
            timestamps.imagesReady = Date.now();
        }
        catch (error) {
            errors.push({
                phase: "imageLoading",
                message: `Image loading error: ${error}`,
            });
            timestamps.imagesReady = Date.now();
        }
        // STEP 4: Lazy Content Activation
        try {
            const lazyLoadPromise = page.evaluate(async () => {
                let lazyElementsActivated = 0;
                const lazySelectors = [
                    '[loading="lazy"]',
                    "[data-src]",
                    "[data-lazy]",
                    ".lazyload",
                ];
                const lazyElements = [];
                lazySelectors.forEach((selector) => {
                    lazyElements.push(...Array.from(document.querySelectorAll(selector)));
                });
                const uniqueLazyElements = Array.from(new Set(lazyElements));
                for (const element of uniqueLazyElements) {
                    try {
                        element.scrollIntoView({ behavior: "instant", block: "center" });
                        lazyElementsActivated++;
                        await new Promise((resolve) => setTimeout(resolve, 200));
                    }
                    catch (e) {
                        // Failed to scroll
                    }
                }
                const newImages = document.querySelectorAll("img");
                const newIncompleteImages = Array.from(newImages).filter((img) => !img.complete || img.naturalWidth === 0);
                const newImagePromises = newIncompleteImages.map((img) => {
                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            cleanup();
                            resolve();
                        }, 5000);
                        const onLoad = () => {
                            clearTimeout(timeout);
                            cleanup();
                            resolve();
                        };
                        const onError = () => {
                            clearTimeout(timeout);
                            cleanup();
                            resolve();
                        };
                        const cleanup = () => {
                            img.removeEventListener("load", onLoad);
                            img.removeEventListener("error", onError);
                        };
                        img.addEventListener("load", onLoad);
                        img.addEventListener("error", onError);
                        if (img.complete) {
                            clearTimeout(timeout);
                            cleanup();
                            resolve();
                        }
                    });
                });
                await Promise.all(newImagePromises);
                return { lazyElementsActivated };
            });
            const lazyResult = await Promise.race([
                lazyLoadPromise,
                new Promise((resolve) => setTimeout(() => resolve({
                    lazyElementsActivated: 0,
                }), 10000)),
            ]);
            stats.lazyElementsActivated = lazyResult.lazyElementsActivated;
            timestamps.lazyContentReady = Date.now();
        }
        catch (error) {
            errors.push({
                phase: "lazyContent",
                message: `Lazy content activation error: ${error}`,
            });
            timestamps.lazyContentReady = Date.now();
        }
        // STEP 5: Dynamic Content Stabilization
        try {
            const stabilizationResult = await page.evaluate(async () => {
                let checks = 0;
                let stable = false;
                let lastLength = document.body.innerHTML.length;
                while (checks < 3 && !stable) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const newLength = document.body.innerHTML.length;
                    const changePercent = (Math.abs(newLength - lastLength) / lastLength) * 100;
                    if (changePercent <= 5) {
                        stable = true;
                    }
                    else {
                        lastLength = newLength;
                        checks++;
                    }
                }
                return { domStable: stable };
            });
            stats.domStable = stabilizationResult.domStable;
            timestamps.domStabilized = Date.now();
        }
        catch (error) {
            errors.push({
                phase: "domStabilization",
                message: `DOM stabilization error: ${error}`,
            });
            timestamps.domStabilized = Date.now();
        }
        // STEP 6: Layout Stabilization
        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => requestAnimationFrame(resolve));
                await new Promise((resolve) => requestAnimationFrame(resolve));
                await new Promise((resolve) => requestAnimationFrame(resolve));
            });
        }
        catch (error) {
            errors.push({
                phase: "layoutStabilization",
                message: `Layout stabilization error: ${error}`,
            });
        }
        timestamps.extractionStart = Date.now();
        stats.totalWaitMs = timestamps.extractionStart - startTime;
    }
    finally {
        clearTimeout(globalTimeout);
    }
    return {
        timestamps,
        stats,
        errors,
    };
}
// ==================== PHASE 2: CAPTURE RENDER ENVIRONMENT ====================
async function captureRenderEnvironment(page) {
    const renderEnv = await page.evaluate(() => {
        const unsupportedAPIs = [];
        const safeGet = (fn, fallback = null, apiName) => {
            try {
                const result = fn();
                return result !== undefined && result !== null ? result : fallback;
            }
            catch (error) {
                if (apiName) {
                    unsupportedAPIs.push(apiName);
                }
                return fallback;
            }
        };
        const innerWidth = safeGet(() => window.innerWidth, 0, "window.innerWidth");
        const innerHeight = safeGet(() => window.innerHeight, 0, "window.innerHeight");
        const outerWidth = safeGet(() => window.outerWidth, 0, "window.outerWidth");
        const outerHeight = safeGet(() => window.outerHeight, 0, "window.outerHeight");
        const devicePixelRatio = safeGet(() => window.devicePixelRatio, 1, "window.devicePixelRatio");
        const screenWidth = safeGet(() => window.screen.width, 0, "window.screen.width");
        const screenHeight = safeGet(() => window.screen.height, 0, "window.screen.height");
        const docClientWidth = safeGet(() => document.documentElement.clientWidth, 0, "document.documentElement.clientWidth");
        const docClientHeight = safeGet(() => document.documentElement.clientHeight, 0, "document.documentElement.clientHeight");
        const docScrollWidth = safeGet(() => document.documentElement.scrollWidth, 0, "document.documentElement.scrollWidth");
        const docScrollHeight = safeGet(() => document.documentElement.scrollHeight, 0, "document.documentElement.scrollHeight");
        const bodyClientWidth = safeGet(() => document.body?.clientWidth, 0, "document.body.clientWidth");
        const bodyClientHeight = safeGet(() => document.body?.clientHeight, 0, "document.body.clientHeight");
        const scrollX = safeGet(() => window.scrollX, null) ??
            safeGet(() => window.pageXOffset, 0, "window.scrollX/pageXOffset");
        const scrollY = safeGet(() => window.scrollY, null) ??
            safeGet(() => window.pageYOffset, 0, "window.scrollY/pageYOffset");
        const userAgent = safeGet(() => navigator.userAgent, "", "navigator.userAgent");
        const platform = safeGet(() => navigator.platform, "", "navigator.platform");
        const language = safeGet(() => navigator.language, "", "navigator.language");
        const hardwareConcurrency = safeGet(() => navigator.hardwareConcurrency, 0, "navigator.hardwareConcurrency");
        const maxTouchPoints = safeGet(() => navigator.maxTouchPoints, 0, "navigator.maxTouchPoints");
        let zoomLevel = 1;
        try {
            const baseDevicePixelRatio = devicePixelRatio || 1;
            if (docClientWidth && innerWidth) {
                const ratio = innerWidth / docClientWidth;
                if (ratio > 0.5 && ratio < 3) {
                    zoomLevel = ratio;
                }
            }
            if (zoomLevel === 1 &&
                baseDevicePixelRatio &&
                baseDevicePixelRatio !== 1) {
                zoomLevel = baseDevicePixelRatio;
            }
        }
        catch (error) {
            unsupportedAPIs.push("zoom level detection");
            zoomLevel = 1;
        }
        let colorGamut = "srgb";
        let colorScheme = "light";
        let reducedMotion = false;
        try {
            if (window.matchMedia) {
                if (safeGet(() => window.matchMedia("(color-gamut: rec2020)").matches, false)) {
                    colorGamut = "rec2020";
                }
                else if (safeGet(() => window.matchMedia("(color-gamut: p3)").matches, false)) {
                    colorGamut = "p3";
                }
                else if (safeGet(() => window.matchMedia("(color-gamut: srgb)").matches, false)) {
                    colorGamut = "srgb";
                }
                if (safeGet(() => window.matchMedia("(prefers-color-scheme: dark)").matches, false)) {
                    colorScheme = "dark";
                }
                reducedMotion = safeGet(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, false);
            }
            else {
                unsupportedAPIs.push("window.matchMedia");
            }
        }
        catch (error) {
            unsupportedAPIs.push("color profile detection");
        }
        return {
            viewport: {
                innerWidth: Number(innerWidth) || 0,
                innerHeight: Number(innerHeight) || 0,
                outerWidth: Number(outerWidth) || 0,
                outerHeight: Number(outerHeight) || 0,
                clientWidth: Number(docClientWidth) || Number(bodyClientWidth) || 0,
                clientHeight: Number(docClientHeight) || Number(bodyClientHeight) || 0,
                scrollWidth: Number(docScrollWidth) || 0,
                scrollHeight: Number(docScrollHeight) || 0,
            },
            scroll: {
                x: Number(scrollX) || 0,
                y: Number(scrollY) || 0,
            },
            device: {
                devicePixelRatio: Number(devicePixelRatio) || 1,
                screenWidth: Number(screenWidth) || 0,
                screenHeight: Number(screenHeight) || 0,
                zoomLevel: Number(zoomLevel) || 1,
                colorGamut: String(colorGamut),
                colorScheme: String(colorScheme),
                reducedMotion: Boolean(reducedMotion),
            },
            browser: {
                userAgent: String(userAgent),
                platform: String(platform),
                language: String(language),
                cores: Number(hardwareConcurrency) || 0,
                touchPoints: Number(maxTouchPoints) || 0,
            },
            capturedAt: new Date().toISOString(),
            unsupportedAPIs: unsupportedAPIs.length > 0 ? unsupportedAPIs : undefined,
        };
    });
    return renderEnv;
}
// ==================== PHASE 6: TEXT RASTERIZATION ====================
function shouldRasterizeText(node) {
    const { typography, compositing, styles, dataAttributes } = node;
    if (!typography)
        return null;
    // Explicit opt-in
    if (dataAttributes?.["data-hifidelity"] === "true") {
        return "explicit-opt-in";
    }
    // Large headings
    const fontSize = parseFloat(typography.font?.size || typography.fontSize || "0");
    if (["h1", "h2"].includes(node.tag || "") &&
        fontSize >= MIN_LARGE_HEADING_SIZE) {
        return "large-heading";
    }
    // Non-system fonts
    const fontFamily = (typography.font?.familyResolved ||
        typography.fontFamily ||
        "").toLowerCase();
    const isSystemFont = SYSTEM_FONTS.some((sf) => fontFamily.includes(sf));
    if (!isSystemFont && fontFamily && fontFamily !== "unknown") {
        return "non-system-font";
    }
    // Text effects
    const shadow = typography.effects?.shadow || typography.textShadow;
    if (shadow && shadow !== "none") {
        const blurMatch = shadow.match(/(\d+(?:\.\d+)?)px[^)]*\)/);
        if (blurMatch && parseFloat(blurMatch[1]) > TEXT_SHADOW_BLUR_THRESHOLD) {
            return "text-shadow-blur";
        }
    }
    const letterSpacing = typography.layout?.letterSpacing || typography.letterSpacing || "0";
    if (Math.abs(parseFloat(letterSpacing)) > 0.1) {
        return "letter-spacing";
    }
    if (typography.effects?.stroke || typography.effects?.strokeWidth) {
        return "text-stroke";
    }
    if (typography.effects?.gradientText ||
        typography.specialCases?.isGradientText) {
        return "gradient-text";
    }
    // Rotated text
    const transform = compositing?.transform || styles?.transform;
    if (transform && transform !== "none") {
        if (transform.includes("rotate") && !transform.includes("rotate(0")) {
            return "rotated-transform";
        }
    }
    // Blend modes
    const mixBlendMode = compositing?.mixBlendMode || styles?.mixBlendMode;
    if (mixBlendMode && mixBlendMode !== "normal") {
        return "mix-blend-mode";
    }
    return null;
}
async function rasterizeElementText(page, node, reason, renderEnv) {
    const maxAttempts = MAX_RETRY_ATTEMPTS;
    let attempts = 0;
    let lastError;
    const screenshotDPR = calculateScreenshotDPR(renderEnv);
    while (attempts < maxAttempts) {
        attempts++;
        try {
            const element = await page.$(node.selector || `#${node.id}`);
            if (!element)
                throw new Error("Element not found");
            const rect = await element.boundingBox();
            if (!rect || rect.width <= 0 || rect.height <= 0) {
                throw new Error("Invalid dimensions");
            }
            const bounds = {
                x: rect.x - RASTER_PADDING,
                y: rect.y - RASTER_PADDING,
                width: rect.width + RASTER_PADDING * 2,
                height: rect.height + RASTER_PADDING * 2,
            };
            const screenshot = await element.screenshot({
                type: "png",
                omitBackground: true,
                scale: screenshotDPR > 1 ? "device" : "css",
            });
            if (!screenshot || screenshot.length < 100) {
                throw new Error("Screenshot appears blank");
            }
            return {
                success: true,
                data: {
                    enabled: true,
                    reason,
                    image: {
                        src: `data:image/png;base64,${screenshot.toString("base64")}`,
                        format: "png",
                        width: bounds.width,
                        height: bounds.height,
                        dpr: screenshotDPR,
                        actualWidth: Math.round(bounds.width * screenshotDPR),
                        actualHeight: Math.round(bounds.height * screenshotDPR),
                        fileSize: screenshot.length,
                        quality: SCREENSHOT_QUALITY,
                    },
                    bounds,
                    verified: true,
                    attempts,
                    capturedAt: new Date().toISOString(),
                },
                attempts,
            };
        }
        catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            if (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
            }
        }
    }
    return {
        success: false,
        error: lastError || "Unknown error",
        attempts,
    };
}
async function processTextRasterization(page, nodes, renderEnv) {
    console.log("[Phase 6] 🎨 Starting text rasterization...");
    const startTime = performance.now();
    const stats = {
        totalElements: nodes.length,
        textElements: 0,
        rasterized: 0,
        reasons: {},
        totalImageSize: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
        large: [],
    };
    const candidates = [];
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.typography) {
            stats.textElements++;
            const reason = shouldRasterizeText(node);
            if (reason) {
                candidates.push({ node, reason, index: i });
            }
        }
    }
    console.log(`[Phase 6] Found ${candidates.length} elements qualifying for rasterization`);
    let toRasterize = candidates;
    if (candidates.length > MAX_RASTERIZE_COUNT) {
        toRasterize = candidates
            .sort((a, b) => {
            if (a.reason === "explicit-opt-in" && b.reason !== "explicit-opt-in")
                return -1;
            if (b.reason === "explicit-opt-in" && a.reason !== "explicit-opt-in")
                return 1;
            const aSize = parseFloat(a.node.typography?.font?.size || a.node.typography?.fontSize || "0");
            const bSize = parseFloat(b.node.typography?.font?.size || b.node.typography?.fontSize || "0");
            if (Math.abs(aSize - bSize) > 2)
                return bSize - aSize;
            return a.index - b.index;
        })
            .slice(0, MAX_RASTERIZE_COUNT);
        stats.skipped = candidates.length - MAX_RASTERIZE_COUNT;
    }
    for (const candidate of toRasterize) {
        try {
            const result = await rasterizeElementText(page, candidate.node, candidate.reason, renderEnv);
            if (result.success && result.data) {
                nodes[candidate.index].rasterFallback = result.data;
                stats.rasterized++;
                stats.totalImageSize += result.data.image.fileSize;
                stats.reasons[candidate.reason] =
                    (stats.reasons[candidate.reason] || 0) + 1;
                if (result.data.image.fileSize > 25 * 1024) {
                    stats.large.push(candidate.node.id);
                }
                if (result.attempts > 1) {
                    stats.retried++;
                }
            }
            else {
                stats.failed++;
                nodes[candidate.index].rasterFallback = {
                    enabled: false,
                    error: result.error,
                    attempts: result.attempts,
                };
            }
        }
        catch (error) {
            stats.failed++;
        }
    }
    if (stats.rasterized > 0) {
        stats.averageImageSize = Math.round(stats.totalImageSize / stats.rasterized);
    }
    const duration = performance.now() - startTime;
    console.log(`[Phase 6] ✅ Completed: ${stats.rasterized} rasterized in ${duration.toFixed(0)}ms`);
    return { nodes, stats };
}
// ==================== PHASE 7: FIGMA PRE-CONVERSION ====================
function cssColorToFigma(cssColor) {
    if (!cssColor)
        return null;
    try {
        // RGB/RGBA
        const rgbaMatch = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]) / 255,
                g: parseInt(rgbaMatch[2]) / 255,
                b: parseInt(rgbaMatch[3]) / 255,
                a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
            };
        }
        // Hex
        const hexMatch = cssColor.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex
                    .split("")
                    .map((c) => c + c)
                    .join("");
            }
            return {
                r: parseInt(hex.slice(0, 2), 16) / 255,
                g: parseInt(hex.slice(2, 4), 16) / 255,
                b: parseInt(hex.slice(4, 6), 16) / 255,
                a: 1,
            };
        }
        // Named colors
        const namedColors = {
            black: [0, 0, 0],
            white: [255, 255, 255],
            red: [255, 0, 0],
            green: [0, 128, 0],
            blue: [0, 0, 255],
            transparent: [0, 0, 0],
        };
        const named = namedColors[cssColor.toLowerCase()];
        if (named) {
            return {
                r: named[0] / 255,
                g: named[1] / 255,
                b: named[2] / 255,
                a: cssColor.toLowerCase() === "transparent" ? 0 : 1,
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
function cssShadowToFigmaEffects(boxShadow) {
    if (!boxShadow || boxShadow === "none")
        return [];
    const effects = [];
    const shadows = boxShadow.split(/,(?![^(]*\))/);
    for (const shadow of shadows) {
        try {
            const match = shadow
                .trim()
                .match(/(inset\s+)?(-?\d+(?:px)?)\s+(-?\d+(?:px)?)\s+(\d+(?:px)?)\s*(?:(\d+(?:px)?)\s+)?(.*)/);
            if (!match)
                continue;
            const isInset = !!match[1];
            const offsetX = parseInt(match[2]);
            const offsetY = parseInt(match[3]);
            const blur = parseInt(match[4]);
            const spread = match[5] ? parseInt(match[5]) : 0;
            const color = cssColorToFigma(match[6]?.trim() || "rgba(0,0,0,0.25)");
            if (color) {
                effects.push({
                    type: isInset ? "INNER_SHADOW" : "DROP_SHADOW",
                    visible: true,
                    color,
                    offset: { x: offsetX, y: offsetY },
                    radius: blur,
                    spread,
                    blendMode: "NORMAL",
                });
            }
        }
        catch {
            // Skip invalid shadow
        }
    }
    return effects;
}
function cssToFigmaAutoLayout(styles) {
    if (styles.display === "flex" || styles.display === "inline-flex") {
        return {
            layoutMode: styles.flexDirection === "column" ? "VERTICAL" : "HORIZONTAL",
            itemSpacing: parseInt(styles.gap || "0"),
            paddingLeft: parseInt(styles.paddingLeft || "0"),
            paddingRight: parseInt(styles.paddingRight || "0"),
            paddingTop: parseInt(styles.paddingTop || "0"),
            paddingBottom: parseInt(styles.paddingBottom || "0"),
            primaryAxisSizingMode: "AUTO",
            counterAxisSizingMode: "AUTO",
        };
    }
    return null;
}
function convertToFigmaProperties(node) {
    const styles = node.styles || {};
    const figmaProps = {
        type: node.type === "TEXT" ? "TEXT" : "FRAME",
        visible: !node.layout?.visibility?.isHidden,
        locked: false,
    };
    // Fills
    const fills = [];
    if (styles.backgroundColor) {
        const color = cssColorToFigma(styles.backgroundColor);
        if (color && color.a > 0) {
            fills.push({ type: "SOLID", color });
        }
    }
    if (fills.length > 0)
        figmaProps.fills = fills;
    // Strokes
    if (styles.border) {
        const match = styles.border.match(/(\d+(?:px)?)\s+(\w+)\s+(.*)/);
        if (match) {
            const thickness = parseInt(match[1]);
            const colorStr = match[3] || styles.borderColor || "black";
            const color = cssColorToFigma(colorStr);
            if (color && thickness > 0) {
                figmaProps.strokes = [
                    {
                        type: "SOLID",
                        color,
                        thickness,
                        position: "INSIDE",
                    },
                ];
            }
        }
    }
    // Effects
    const effects = cssShadowToFigmaEffects(styles.boxShadow);
    if (effects.length > 0)
        figmaProps.effects = effects;
    // Corner radius
    if (styles.borderRadius) {
        figmaProps.cornerRadius = parseInt(styles.borderRadius);
    }
    // Auto-layout
    const autoLayout = cssToFigmaAutoLayout(styles);
    if (autoLayout)
        figmaProps.autoLayout = autoLayout;
    // Constraints
    figmaProps.constraints = {
        horizontal: "LEFT",
        vertical: "TOP",
    };
    // Clips content
    if (styles.overflow === "hidden") {
        figmaProps.clipsContent = true;
    }
    // Text data
    if (node.type === "TEXT" && node.typography) {
        const typo = node.typography;
        const fontFamily = typo.font?.familyResolved || typo.fontFamily || "Inter";
        const families = fontFamily
            .split(",")
            .map((f) => f.trim().replace(/['"]/g, ""));
        const mainFamily = families.find((f) => !["serif", "sans-serif", "monospace"].includes(f.toLowerCase())) || families[0];
        const textContent = typo.text?.content || typo.content?.text || node.text || "";
        const fontSize = parseFloat(typo.font?.size || typo.fontSize || "16");
        const lineHeightPx = typo.layout?.lineHeightPx || typo.lineHeightPx || fontSize * 1.2;
        const letterSpacing = parseFloat(typo.layout?.letterSpacing || typo.letterSpacing || "0");
        const textAlign = typo.layout?.align || typo.textAlign || "left";
        const color = cssColorToFigma(typo.effects?.color || typo.color || "#000000");
        figmaProps.textData = {
            characters: textContent,
            fontName: {
                family: mainFamily,
                style: (typo.font?.style || typo.fontStyle || "normal") === "italic"
                    ? "Italic"
                    : "Regular",
            },
            fontSize,
            lineHeight: { value: lineHeightPx, unit: "PIXELS" },
            letterSpacing: { value: letterSpacing, unit: "PIXELS" },
            textAlignHorizontal: textAlign.toUpperCase(),
            textAlignVertical: "TOP",
            textAutoResize: "WIDTH_AND_HEIGHT",
            fills: color ? [{ type: "SOLID", color }] : [],
        };
    }
    return figmaProps;
}
// ==================== PHASE 8: VALIDATION & CONFIDENCE ====================
function calculateConfidenceScore(node) {
    let confidence = 1.0;
    if (node.typography) {
        if (node.typography.effects?.gradientText ||
            node.typography.specialCases?.isGradientText) {
            confidence -= 0.15;
        }
        if (node.typography.effects?.stroke ||
            node.typography.effects?.strokeWidth) {
            confidence -= 0.1;
        }
        const shadow = node.typography.effects?.shadow || node.typography.textShadow;
        if (shadow && shadow !== "none") {
            confidence -= 0.05;
        }
        const fontFamily = (node.typography.font?.familyResolved ||
            node.typography.fontFamily ||
            "").toLowerCase();
        const isSystemFont = SYSTEM_FONTS.some((sf) => fontFamily.includes(sf));
        if (!isSystemFont && fontFamily) {
            confidence -= 0.1;
        }
    }
    const compositing = node.compositing || {};
    const styles = node.styles || {};
    const transform = compositing.transform || styles.transform;
    if (transform && transform !== "none" && transform.includes("rotate")) {
        confidence -= 0.05;
    }
    const mixBlendMode = compositing.mixBlendMode || styles.mixBlendMode;
    if (mixBlendMode && mixBlendMode !== "normal") {
        confidence -= 0.05;
    }
    const backdropFilter = compositing.backdropFilter || styles.backdropFilter;
    if (backdropFilter && backdropFilter !== "none") {
        confidence -= 0.05;
    }
    if (styles.backgroundImage && styles.backgroundImage !== "none") {
        confidence -= styles.backgroundImage.includes("gradient") ? 0.05 : 0.1;
    }
    return Math.max(0, Math.min(1, confidence));
}
function validateReconstruction(node) {
    const confidence = calculateConfidenceScore(node);
    const useFallback = confidence < CONFIDENCE_THRESHOLD;
    let failureReason;
    if (useFallback) {
        const reasons = [];
        if (node.typography?.effects?.gradientText ||
            node.typography?.specialCases?.isGradientText) {
            reasons.push("gradient text");
        }
        if (node.typography?.effects?.stroke) {
            reasons.push("text stroke");
        }
        const mixBlendMode = node.compositing?.mixBlendMode || node.styles?.mixBlendMode;
        if (mixBlendMode && mixBlendMode !== "normal") {
            reasons.push("blend mode");
        }
        failureReason = reasons.length > 0 ? reasons.join(", ") : "low confidence";
    }
    return {
        confidence,
        pixelDiff: 1 - confidence,
        useFallback,
        failureReason,
        validated: true,
    };
}
// ==================== PHASE 9: OPTIMIZATION ====================
function analyzeOptimization(node, allNodes) {
    const hints = {
        canFlatten: false,
        canMerge: false,
        mergeWith: [],
        isUnnecessary: false,
        reasoning: "",
    };
    // Check if unnecessary wrapper
    if (node.children?.length === 1 && node.type === "FRAME") {
        const child = allNodes.find((n) => n.id === node.children[0]);
        if (child) {
            const styles = node.styles || {};
            const hasNoStyles = !styles.backgroundColor &&
                !styles.border &&
                !styles.boxShadow &&
                !styles.backgroundImage;
            if (hasNoStyles) {
                hints.canFlatten = true;
                hints.reasoning = "Unnecessary wrapper with single child";
            }
        }
    }
    // Check if zero-size and hidden
    const layout = node.layout || {};
    if (layout.viewport?.width === 0 && layout.viewport?.height === 0) {
        if (layout.visibility?.isHidden) {
            hints.isUnnecessary = true;
            hints.reasoning = "Zero-size and hidden";
        }
    }
    return hints;
}
// ==================== PHASE 4: STACKING CONTEXT & PAINT ORDER ====================
function isStackingContext(element, computedStyle) {
    try {
        // Root element always creates a stacking context
        if (element === document.documentElement) {
            return true;
        }
        // 1. Position fixed or sticky always creates stacking context
        const position = computedStyle.position;
        if (position === "fixed" || position === "sticky") {
            return true;
        }
        // 2. Element with position absolute/relative and z-index other than auto
        const zIndex = computedStyle.zIndex;
        if ((position === "absolute" || position === "relative") &&
            zIndex !== "auto") {
            return true;
        }
        // 3. Flex/grid items with z-index other than auto
        if (zIndex !== "auto" && element.parentElement) {
            try {
                const parentStyle = getComputedStyle(element.parentElement);
                const parentDisplay = parentStyle.display;
                if (parentDisplay === "flex" ||
                    parentDisplay === "inline-flex" ||
                    parentDisplay === "grid" ||
                    parentDisplay === "inline-grid") {
                    return true;
                }
            }
            catch (error) {
                // Parent style access failed, continue with other checks
            }
        }
        // 4. Element with opacity less than 1
        const opacity = parseFloat(computedStyle.opacity);
        if (!isNaN(opacity) && opacity < 1) {
            return true;
        }
        // 5. Element with any transform other than none
        const transform = computedStyle.transform;
        if (transform && transform !== "none") {
            return true;
        }
        // 6. Element with any filter other than none
        const filter = computedStyle.filter;
        if (filter && filter !== "none") {
            return true;
        }
        // 7. Element with clip-path other than none
        const clipPath = computedStyle.clipPath;
        if (clipPath && clipPath !== "none") {
            return true;
        }
        // 8. Element with mask other than none
        const mask = computedStyle.mask;
        const maskImage = computedStyle.maskImage;
        if ((mask && mask !== "none") || (maskImage && maskImage !== "none")) {
            return true;
        }
        // 9. Element with mix-blend-mode other than normal
        const mixBlendMode = computedStyle.mixBlendMode;
        if (mixBlendMode && mixBlendMode !== "normal") {
            return true;
        }
        // 10. Element with isolation: isolate
        const isolation = computedStyle.isolation;
        if (isolation === "isolate") {
            return true;
        }
        // 11. Element with will-change specifying any property that would create a stacking context
        const willChange = computedStyle.willChange;
        if (willChange && willChange !== "auto") {
            const willChangeValues = willChange.split(",").map((v) => v.trim());
            if (willChangeValues.includes("transform") ||
                willChangeValues.includes("opacity") ||
                willChangeValues.includes("filter") ||
                willChangeValues.includes("backdrop-filter") ||
                willChangeValues.includes("perspective") ||
                willChangeValues.includes("clip-path") ||
                willChangeValues.includes("mask") ||
                willChangeValues.includes("mask-image") ||
                willChangeValues.includes("mask-border") ||
                willChangeValues.includes("mix-blend-mode") ||
                willChangeValues.includes("isolation")) {
                return true;
            }
        }
        // 12. Element with contain: layout or paint or strict
        const contain = computedStyle.contain;
        if (contain && contain !== "none") {
            const containValues = contain.split(" ").map((v) => v.trim());
            if (containValues.includes("layout") ||
                containValues.includes("paint") ||
                containValues.includes("strict")) {
                return true;
            }
        }
        // 13. Element with backdrop-filter other than none
        const backdropFilter = computedStyle.backdropFilter;
        if (backdropFilter && backdropFilter !== "none") {
            return true;
        }
        // 14. Element with perspective other than none
        const perspective = computedStyle.perspective;
        if (perspective && perspective !== "none") {
            return true;
        }
        // 15. Element that is a multi-column container
        const columnCount = computedStyle.columnCount;
        const columnWidth = computedStyle.columnWidth;
        if ((columnCount && columnCount !== "auto") ||
            (columnWidth && columnWidth !== "auto")) {
            return true;
        }
        // 16. Element with transform-style: preserve-3d
        const transformStyle = computedStyle.transformStyle;
        if (transformStyle === "preserve-3d") {
            return true;
        }
        // 17. Canvas element with a 3d rendering context
        if (element.tagName.toLowerCase() === "canvas") {
            try {
                const canvas = element;
                const context = canvas.getContext("webgl") || canvas.getContext("webgl2");
                if (context) {
                    return true;
                }
            }
            catch (error) {
                // WebGL context check failed, continue
            }
        }
        // 18. Video element
        if (element.tagName.toLowerCase() === "video") {
            return true;
        }
        // 19. Element with -webkit-overflow-scrolling: touch (for older Safari)
        const webkitOverflowScrolling = computedStyle["-webkit-overflow-scrolling"];
        if (webkitOverflowScrolling === "touch") {
            return true;
        }
        return false;
    }
    catch (error) {
        return false;
    }
}
function captureCompositingProperties(element, computedStyle) {
    try {
        const zIndexValue = computedStyle.zIndex;
        let zIndex = "auto";
        if (zIndexValue && zIndexValue !== "auto") {
            const parsed = parseInt(zIndexValue, 10);
            if (!isNaN(parsed)) {
                zIndex = parsed;
            }
        }
        let opacity = 1;
        try {
            const opacityValue = parseFloat(computedStyle.opacity);
            if (!isNaN(opacityValue)) {
                opacity = Math.max(0, Math.min(1, opacityValue));
            }
        }
        catch (error) {
            // Keep default
        }
        const transform = computedStyle.transform || "none";
        let transformOrigin;
        if (transform !== "none") {
            try {
                transformOrigin = computedStyle.transformOrigin || "50% 50%";
            }
            catch (error) {
                // Transform origin access failed
            }
        }
        const perspective = computedStyle.perspective || "none";
        let perspectiveOrigin;
        if (perspective !== "none") {
            try {
                perspectiveOrigin = computedStyle.perspectiveOrigin || "50% 50%";
            }
            catch (error) {
                // Perspective origin access failed
            }
        }
        const stackingContext = isStackingContext(element, computedStyle);
        const properties = {
            zIndex,
            position: computedStyle.position || "static",
            opacity,
            transform,
            filter: computedStyle.filter || "none",
            clipPath: computedStyle.clipPath || "none",
            mask: computedStyle.mask || "none",
            mixBlendMode: computedStyle.mixBlendMode || "normal",
            backgroundBlendMode: computedStyle.backgroundBlendMode || "normal",
            backdropFilter: computedStyle.backdropFilter || "none",
            isolation: computedStyle.isolation || "auto",
            willChange: computedStyle.willChange || "auto",
            contain: computedStyle.contain || "none",
            perspective,
            stackingContext,
        };
        if (transformOrigin) {
            properties.transformOrigin = transformOrigin;
        }
        if (perspectiveOrigin) {
            properties.perspectiveOrigin = perspectiveOrigin;
        }
        return properties;
    }
    catch (error) {
        return {
            zIndex: "auto",
            position: "static",
            opacity: 1,
            transform: "none",
            filter: "none",
            clipPath: "none",
            mask: "none",
            mixBlendMode: "normal",
            backgroundBlendMode: "normal",
            backdropFilter: "none",
            isolation: "auto",
            willChange: "auto",
            contain: "none",
            perspective: "none",
            stackingContext: false,
        };
    }
}
function captureLayoutGeometry(element, renderEnv) {
    const roundToTwo = (num) => Math.round(num * 100) / 100;
    try {
        let bbox;
        try {
            bbox = element.getBoundingClientRect();
        }
        catch (error) {
            return {
                viewport: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                },
                document: { x: 0, y: 0 },
                client: { width: 0, height: 0, top: 0, left: 0 },
                offset: { width: 0, height: 0, top: 0, left: 0, parentId: null },
                scroll: { width: 0, height: 0, top: 0, left: 0, isScrollable: false },
                transform: { matrix: "none", hasTransform: false },
                position: {
                    type: "static",
                    isFixed: false,
                    isSticky: false,
                    isAbsolute: false,
                },
                visibility: {
                    display: "none",
                    visibility: "hidden",
                    opacity: 0,
                    isHidden: true,
                },
                error: `getBoundingClientRect failed: ${error}`,
            };
        }
        const docX = roundToTwo(bbox.x + renderEnv.scroll.x);
        const docY = roundToTwo(bbox.y + renderEnv.scroll.y);
        const computedStyle = getComputedStyle(element);
        const htmlElement = element;
        const clientWidth = htmlElement.clientWidth || 0;
        const clientHeight = htmlElement.clientHeight || 0;
        const clientTop = htmlElement.clientTop || 0;
        const clientLeft = htmlElement.clientLeft || 0;
        const offsetWidth = htmlElement.offsetWidth || 0;
        const offsetHeight = htmlElement.offsetHeight || 0;
        const offsetTop = htmlElement.offsetTop || 0;
        const offsetLeft = htmlElement.offsetLeft || 0;
        const offsetParentId = htmlElement.offsetParent?.id || null;
        const scrollWidth = htmlElement.scrollWidth || 0;
        const scrollHeight = htmlElement.scrollHeight || 0;
        const scrollTop = htmlElement.scrollTop || 0;
        const scrollLeft = htmlElement.scrollLeft || 0;
        const isScrollable = scrollHeight > clientHeight || scrollWidth > clientWidth;
        const transform = computedStyle.transform;
        const hasTransform = transform && transform !== "none";
        const position = computedStyle.position;
        const isFixed = position === "fixed";
        const isSticky = position === "sticky";
        const isAbsolute = position === "absolute";
        const display = computedStyle.display;
        const visibility = computedStyle.visibility;
        const opacity = parseFloat(computedStyle.opacity) || 1;
        const isHidden = display === "none" || visibility === "hidden" || opacity === 0;
        const compositingProperties = captureCompositingProperties(element, computedStyle);
        const layout = {
            viewport: {
                x: roundToTwo(bbox.x),
                y: roundToTwo(bbox.y),
                width: roundToTwo(bbox.width),
                height: roundToTwo(bbox.height),
                top: roundToTwo(bbox.top),
                right: roundToTwo(bbox.right),
                bottom: roundToTwo(bbox.bottom),
                left: roundToTwo(bbox.left),
            },
            document: {
                x: docX,
                y: docY,
            },
            client: {
                width: clientWidth,
                height: clientHeight,
                top: clientTop,
                left: clientLeft,
            },
            offset: {
                width: offsetWidth,
                height: offsetHeight,
                top: offsetTop,
                left: offsetLeft,
                parentId: offsetParentId,
            },
            scroll: {
                width: scrollWidth,
                height: scrollHeight,
                top: scrollTop,
                left: scrollLeft,
                isScrollable,
            },
            transform: {
                matrix: transform || "none",
                hasTransform: !!hasTransform,
            },
            position: {
                type: position,
                isFixed,
                isSticky,
                isAbsolute,
            },
            visibility: {
                display,
                visibility,
                opacity,
                isHidden,
            },
            compositing: compositingProperties,
        };
        if (element instanceof SVGElement) {
            try {
                const svgElement = element;
                if (typeof svgElement.getBBox === "function") {
                    const svgBbox = svgElement.getBBox();
                    layout.svg = {
                        x: roundToTwo(svgBbox.x),
                        y: roundToTwo(svgBbox.y),
                        width: roundToTwo(svgBbox.width),
                        height: roundToTwo(svgBbox.height),
                    };
                }
            }
            catch (error) {
                layout.svg = {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    error: `getBBox failed: ${error}`,
                };
            }
        }
        if (element.tagName === "IFRAME") {
            try {
                const iframeElement = element;
                let crossOrigin = false;
                let accessible = false;
                try {
                    const iframeSrc = iframeElement.src;
                    if (iframeSrc) {
                        try {
                            if (iframeSrc.startsWith("data:") ||
                                iframeSrc.startsWith("blob:") ||
                                iframeSrc === "about:blank" ||
                                iframeSrc === "") {
                                crossOrigin = false;
                            }
                            else if (iframeSrc.startsWith("file:")) {
                                crossOrigin = !window.location.protocol.startsWith("file:");
                            }
                            else {
                                const srcUrl = new URL(iframeSrc, window.location.href);
                                const currentOrigin = new URL(window.location.href).origin;
                                crossOrigin = srcUrl.origin !== currentOrigin;
                            }
                        }
                        catch (urlError) {
                            crossOrigin =
                                iframeSrc.startsWith("http") &&
                                    !iframeSrc.startsWith(window.location.origin);
                        }
                    }
                    try {
                        const contentWindow = iframeElement.contentWindow;
                        const contentDocument = iframeElement.contentDocument;
                        if (contentWindow && !crossOrigin) {
                            accessible = true;
                            try {
                                const testAccess = contentWindow.location.href;
                                accessible = true;
                            }
                            catch (accessError) {
                                accessible = false;
                                crossOrigin = true;
                            }
                        }
                        else if (crossOrigin) {
                            accessible = false;
                            try {
                                if (contentWindow) {
                                    const testAccess = contentWindow.location.href;
                                    crossOrigin = false;
                                    accessible = true;
                                }
                            }
                            catch (accessError) {
                                accessible = false;
                            }
                        }
                        else {
                            accessible = !!(contentDocument || contentWindow);
                        }
                    }
                    catch (error) {
                        accessible = false;
                    }
                }
                catch (error) {
                    crossOrigin = true;
                    accessible = false;
                }
                layout.iframe = {
                    crossOrigin,
                    accessible,
                };
            }
            catch (error) {
                layout.iframe = {
                    crossOrigin: true,
                    accessible: false,
                };
            }
        }
        if (htmlElement.shadowRoot) {
            try {
                const shadowRoot = htmlElement.shadowRoot;
                layout.shadow = {
                    hasHostShadow: true,
                    shadowRootMode: shadowRoot.mode,
                    childrenCount: shadowRoot.children.length,
                };
            }
            catch (error) {
                layout.shadow = {
                    hasHostShadow: true,
                    shadowRootMode: "closed",
                    childrenCount: 0,
                };
            }
        }
        return layout;
    }
    catch (error) {
        return {
            viewport: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            document: { x: 0, y: 0 },
            client: { width: 0, height: 0, top: 0, left: 0 },
            offset: { width: 0, height: 0, top: 0, left: 0, parentId: null },
            scroll: { width: 0, height: 0, top: 0, left: 0, isScrollable: false },
            transform: { matrix: "none", hasTransform: false },
            position: {
                type: "static",
                isFixed: false,
                isSticky: false,
                isAbsolute: false,
            },
            visibility: {
                display: "none",
                visibility: "hidden",
                opacity: 0,
                isHidden: true,
            },
            error: `Layout capture failed: ${error}`,
        };
    }
}
function normalizeMainAxisAlignment(value) {
    const normalized = (value || '').toLowerCase().trim();
    if (normalized === 'flex-end' || normalized === 'end' || normalized === 'self-end' || normalized === 'right') {
        return 'end';
    }
    if (normalized === 'center' ||
        normalized === 'safe center' ||
        normalized === 'unsafe center') {
        return 'center';
    }
    if (normalized === 'stretch') {
        return 'stretch';
    }
    if (normalized === 'space-between' ||
        normalized === 'space-around' ||
        normalized === 'space-evenly') {
        return normalized;
    }
    return 'start';
}
function normalizeCrossAxisAlignment(value) {
    const normalized = (value || '').toLowerCase().trim();
    if (normalized === 'flex-end' || normalized === 'end' || normalized === 'self-end' || normalized === 'right') {
        return 'end';
    }
    if (normalized === 'center' ||
        normalized === 'safe center' ||
        normalized === 'unsafe center') {
        return 'center';
    }
    if (normalized === 'stretch') {
        return 'stretch';
    }
    if (normalized.includes('baseline')) {
        return 'baseline';
    }
    return 'start';
}
function computeFlexChildAlignment(parentStyles, childStyles) {
    const direction = parentStyles.flexDirection || 'row';
    const wrapMode = parentStyles.flexWrap || 'nowrap';
    const mainAxisOrientation = direction.startsWith('column') ? 'vertical' : 'horizontal';
    const crossAxisOrientation = mainAxisOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    const parentJustify = parentStyles.justifyContent || 'flex-start';
    const parentAlignItems = parentStyles.alignItems || 'stretch';
    const childAlignSelf = childStyles.alignSelf && childStyles.alignSelf !== 'auto'
        ? childStyles.alignSelf
        : parentAlignItems;
    return {
        mainAxis: normalizeMainAxisAlignment(parentJustify),
        crossAxis: normalizeCrossAxisAlignment(childAlignSelf),
        mainAxisOrientation,
        crossAxisOrientation,
        mainAxisIsReversed: direction.endsWith('reverse') || undefined,
        crossAxisIsReversed: wrapMode === 'wrap-reverse' ? true : undefined,
        computedFromFlex: true
    };
}
function computeGridChildAlignment(parentStyles, childStyles) {
    const justifySelf = childStyles.justifySelf && childStyles.justifySelf !== 'auto'
        ? childStyles.justifySelf
        : parentStyles.justifyItems || parentStyles.justifyContent || 'stretch';
    const alignSelf = childStyles.alignSelf && childStyles.alignSelf !== 'auto'
        ? childStyles.alignSelf
        : parentStyles.alignItems || parentStyles.alignContent || 'stretch';
    return {
        mainAxis: normalizeMainAxisAlignment(justifySelf),
        crossAxis: normalizeCrossAxisAlignment(alignSelf),
        mainAxisOrientation: 'horizontal',
        crossAxisOrientation: 'vertical',
        computedFromGrid: true
    };
}
function resolveFlexLayout(el, styles) {
    const display = styles.display;
    const isFlexContainer = display === 'flex' || display === 'inline-flex';
    // Check if element is a flex item by examining parent
    let isFlexItem = false;
    let parentElement = null;
    let parentStyles = null;
    if (el.parentElement && el.parentElement instanceof HTMLElement) {
        parentElement = el.parentElement;
        parentStyles = getComputedStyle(parentElement);
        const parentDisplay = parentStyles.display;
        isFlexItem = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    }
    let containerData;
    let itemData;
    let childAlignment;
    if (parentElement && parentStyles) {
        if (parentStyles.display === 'flex' || parentStyles.display === 'inline-flex') {
            childAlignment = computeFlexChildAlignment(parentStyles, styles);
        }
        else if (parentStyles.display === 'grid' || parentStyles.display === 'inline-grid') {
            childAlignment = computeGridChildAlignment(parentStyles, styles);
        }
    }
    // Process flex container properties
    if (isFlexContainer) {
        try {
            // Parse flex-direction with fallback
            const flexDirection = styles.flexDirection || 'row';
            const direction = ['row', 'row-reverse', 'column', 'column-reverse'].includes(flexDirection)
                ? flexDirection
                : 'row';
            // Parse flex-wrap with fallback
            const flexWrap = styles.flexWrap || 'nowrap';
            const wrap = ['nowrap', 'wrap', 'wrap-reverse'].includes(flexWrap)
                ? flexWrap
                : 'nowrap';
            // Parse justify-content with validation
            const justifyContentValue = styles.justifyContent || 'flex-start';
            const validJustifyValues = [
                'flex-start', 'flex-end', 'center', 'space-between',
                'space-around', 'space-evenly', 'start', 'end', 'left', 'right', 'stretch'
            ];
            const justifyContent = validJustifyValues.includes(justifyContentValue)
                ? justifyContentValue
                : 'flex-start';
            // Parse align-items with validation
            const alignItemsValue = styles.alignItems || 'stretch';
            const validAlignItemsValues = [
                'stretch', 'flex-start', 'flex-end', 'center', 'baseline',
                'first baseline', 'last baseline', 'start', 'end',
                'self-start', 'self-end', 'safe center', 'unsafe center'
            ];
            const alignItems = validAlignItemsValues.includes(alignItemsValue)
                ? alignItemsValue
                : 'stretch';
            // Parse align-content with validation
            const alignContentValue = styles.alignContent || 'stretch';
            const validAlignContentValues = [
                'stretch', 'flex-start', 'flex-end', 'center',
                'space-between', 'space-around', 'space-evenly',
                'start', 'end', 'baseline', 'first baseline', 'last baseline'
            ];
            const alignContent = validAlignContentValues.includes(alignContentValue)
                ? alignContentValue
                : 'stretch';
            // Parse gap properties with robust unit conversion
            const rowGap = parseGapValue(styles.rowGap || styles.gap || '0');
            const columnGap = parseGapValue(styles.columnGap || styles.gap || '0');
            // Handle legacy gap simulation with margins (for older browsers)
            const legacyGap = detectLegacyFlexGap(el);
            containerData = {
                isFlexContainer: true,
                direction,
                wrap,
                justifyContent,
                alignItems,
                alignContent,
                gap: {
                    row: Math.max(rowGap, legacyGap.row),
                    column: Math.max(columnGap, legacyGap.column)
                }
            };
            // Log container analysis for debugging
            if (typeof console !== 'undefined' && console.debug) {
                console.debug(`[FlexResolver] Container analyzed:`, {
                    element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
                    direction,
                    wrap,
                    justifyContent,
                    alignItems,
                    alignContent,
                    gaps: containerData.gap,
                    childCount: el.children.length
                });
            }
        }
        catch (error) {
            console.warn('[FlexResolver] Container analysis failed:', error);
            // Provide minimal fallback
            containerData = {
                isFlexContainer: true,
                direction: 'row',
                wrap: 'nowrap',
                justifyContent: 'flex-start',
                alignItems: 'stretch',
                alignContent: 'stretch',
                gap: { row: 0, column: 0 }
            };
        }
    }
    // Process flex item properties
    if (isFlexItem && parentElement && parentStyles) {
        try {
            // Parse flex shorthand or individual properties
            const flexValue = styles.flex;
            let grow, shrink, basis;
            if (flexValue && flexValue !== 'initial' && flexValue !== 'auto' && flexValue !== 'none') {
                const parsed = parseFlexShorthand(flexValue);
                grow = parsed.grow;
                shrink = parsed.shrink;
                basis = parsed.basis;
            }
            else {
                // Handle keyword values
                if (flexValue === 'initial') {
                    grow = 0;
                    shrink = 1;
                    basis = 'auto';
                }
                else if (flexValue === 'auto') {
                    grow = 1;
                    shrink = 1;
                    basis = 'auto';
                }
                else if (flexValue === 'none') {
                    grow = 0;
                    shrink = 0;
                    basis = 'auto';
                }
                else {
                    // Parse individual properties
                    grow = parseFloat(styles.flexGrow || '0') || 0;
                    shrink = parseFloat(styles.flexShrink || '1') || 1;
                    basis = styles.flexBasis || 'auto';
                }
            }
            // Parse align-self with validation
            const alignSelfValue = styles.alignSelf || 'auto';
            const validAlignSelfValues = [
                'auto', 'stretch', 'flex-start', 'flex-end', 'center',
                'baseline', 'first baseline', 'last baseline', 'start',
                'end', 'self-start', 'self-end'
            ];
            const alignSelf = validAlignSelfValues.includes(alignSelfValue)
                ? alignSelfValue
                : 'auto';
            // Parse order
            const order = parseInt(styles.order || '0') || 0;
            // Determine if this item has explicit flex sizing
            const hasExplicitSizing = !!(styles.flex ||
                styles.flexGrow ||
                styles.flexShrink ||
                styles.flexBasis ||
                grow !== 0 ||
                shrink !== 1 ||
                basis !== 'auto');
            itemData = {
                grow,
                shrink,
                basis,
                alignSelf,
                order,
                computed: {
                    flex: flexValue || `${grow} ${shrink} ${basis}`,
                    isFlexItem: true,
                    hasExplicitSizing
                }
            };
            // Log item analysis for debugging
            if (typeof console !== 'undefined' && console.debug) {
                console.debug(`[FlexResolver] Item analyzed:`, {
                    element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
                    flex: itemData.computed?.flex,
                    grow,
                    shrink,
                    basis,
                    alignSelf,
                    order,
                    hasExplicitSizing,
                    parentContainer: parentElement.tagName
                });
            }
        }
        catch (error) {
            console.warn('[FlexResolver] Item analysis failed:', error);
            // Provide minimal fallback
            itemData = {
                grow: 0,
                shrink: 1,
                basis: 'auto',
                alignSelf: 'auto',
                order: 0,
                computed: {
                    flex: '0 1 auto',
                    isFlexItem: true,
                    hasExplicitSizing: false
                }
            };
        }
    }
    return {
        isFlexContainer,
        isFlexItem,
        containerData,
        itemData,
        childAlignment
    };
}
/**
 * Parse CSS flex shorthand into individual components
 * Handles all CSS flex shorthand formats according to W3C specification
 */
function parseFlexShorthand(flex) {
    const trimmed = flex.trim();
    // Handle keywords
    if (trimmed === 'initial')
        return { grow: 0, shrink: 1, basis: 'auto' };
    if (trimmed === 'auto')
        return { grow: 1, shrink: 1, basis: 'auto' };
    if (trimmed === 'none')
        return { grow: 0, shrink: 0, basis: 'auto' };
    // Handle single number (flex: <number>)
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        const grow = parseFloat(trimmed);
        return { grow, shrink: 1, basis: '0px' };
    }
    // Parse multi-value shorthand
    const parts = trimmed.split(/\s+/);
    let grow = 0;
    let shrink = 1;
    let basis = 'auto';
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === 0 && /^[\d.]+$/.test(part)) {
            // First number is grow
            grow = parseFloat(part) || 0;
        }
        else if (i === 1 && /^[\d.]+$/.test(part)) {
            // Second number is shrink
            shrink = parseFloat(part) || 1;
        }
        else if (part !== '0' && (part.includes('px') || part.includes('%') || part.includes('em') || part.includes('rem') || part === 'auto' || part === 'content')) {
            // Length/percentage/keyword is basis
            basis = part;
        }
    }
    return { grow, shrink, basis };
}
/**
 * Parse gap values with support for various CSS units
 * Simplified implementation - production would need comprehensive unit conversion
 */
function parseGapValue(gap) {
    if (typeof gap === 'number')
        return Math.max(0, gap);
    if (!gap || gap === 'normal' || gap === '0')
        return 0;
    const trimmed = gap.toString().trim();
    // Extract numeric value - simplified parsing
    const match = trimmed.match(/^([\d.]+)(px|em|rem|%|vh|vw|vmin|vmax)?$/);
    if (!match)
        return 0;
    const [, value, unit] = match;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0)
        return 0;
    // Simple unit conversion - would need more robust implementation for production
    switch (unit) {
        case 'px':
        case undefined:
            return numValue;
        case 'em':
        case 'rem':
            return numValue * 16; // Approximation
        case '%':
            return numValue; // Would need container context
        case 'vh':
            return numValue * (typeof window !== 'undefined' ? window.innerHeight / 100 : 0);
        case 'vw':
            return numValue * (typeof window !== 'undefined' ? window.innerWidth / 100 : 0);
        default:
            return numValue; // Fallback to numeric value
    }
}
/**
 * Detect legacy flex gap simulation using margins
 * Some older flexbox implementations used margins to simulate gaps
 */
function detectLegacyFlexGap(container) {
    if (container.children.length <= 1)
        return { row: 0, column: 0 };
    try {
        let rowGap = 0;
        let columnGap = 0;
        // Sample first few children to detect consistent margin patterns
        const sampleSize = Math.min(4, container.children.length);
        const marginData = [];
        for (let i = 0; i < sampleSize; i++) {
            const child = container.children[i];
            if (!(child instanceof HTMLElement))
                continue;
            const childStyles = getComputedStyle(child);
            marginData.push({
                top: parseFloat(childStyles.marginTop) || 0,
                right: parseFloat(childStyles.marginRight) || 0,
                bottom: parseFloat(childStyles.marginBottom) || 0,
                left: parseFloat(childStyles.marginLeft) || 0
            });
        }
        if (marginData.length >= 2) {
            // Look for consistent margin patterns that could indicate gap simulation
            const rightMargins = marginData.map(m => m.right).filter(m => m > 0);
            const bottomMargins = marginData.map(m => m.bottom).filter(m => m > 0);
            if (rightMargins.length > 0 && rightMargins.every(m => m === rightMargins[0])) {
                columnGap = rightMargins[0];
            }
            if (bottomMargins.length > 0 && bottomMargins.every(m => m === bottomMargins[0])) {
                rowGap = bottomMargins[0];
            }
        }
        return { row: rowGap, column: columnGap };
    }
    catch (error) {
        return { row: 0, column: 0 };
    }
}
/**
 * Create IRLayout from legacy LayoutGeometry and flex data
 * Converts the old layout format to the new unified IRLayout structure
 */
function createIRLayoutFromLegacy(legacyLayout, flexData, styles) {
    // Parse spacing values from CSS
    const parseSpacing = (property) => {
        const value = styles.getPropertyValue(property) || '0';
        if (!value || value === '0' || value === 'auto') {
            return { top: 0, right: 0, bottom: 0, left: 0 };
        }
        const values = value.split(' ').map(v => parseFloat(v.replace(/px$/, '')) || 0);
        switch (values.length) {
            case 1: return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
            case 2: return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
            case 3: return { top: values[0], right: values[1], bottom: values[2], left: values[1] };
            case 4: return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
            default: return { top: 0, right: 0, bottom: 0, left: 0 };
        }
    };
    const irLayout = {
        // Box model
        boxModel: {
            margin: parseSpacing('margin'),
            padding: parseSpacing('padding'),
            border: parseSpacing('border-width'),
            boxSizing: (styles.boxSizing || 'content-box')
        },
        // Position and size  
        position: {
            type: (styles.position || 'static'),
            top: styles.top || undefined,
            right: styles.right || undefined,
            bottom: styles.bottom || undefined,
            left: styles.left || undefined
        },
        // Display and overflow
        display: {
            type: styles.display || 'block',
            overflow: {
                x: (styles.overflowX || 'visible'),
                y: (styles.overflowY || 'visible')
            }
        },
        // Flexbox layout (from our comprehensive resolver)
        flex: flexData.containerData,
        flexItem: flexData.itemData,
        childAlignment: flexData.childAlignment,
        // Grid layout (basic implementation - could be expanded)
        grid: GridUtils.isGridDisplay(styles.display) ? {
            templateColumns: styles.gridTemplateColumns || 'none',
            templateRows: styles.gridTemplateRows || 'none',
            templateAreas: styles.gridTemplateAreas || 'none',
            autoFlow: styles.gridAutoFlow || 'row',
            autoColumns: styles.gridAutoColumns || 'auto',
            autoRows: styles.gridAutoRows || 'auto',
            gap: {
                row: parseGapValue(styles.gridRowGap || styles.rowGap || styles.gap || '0'),
                column: parseGapValue(styles.gridColumnGap || styles.columnGap || styles.gap || '0')
            },
            justifyContent: GridUtils.normalizeJustifyContent(styles.justifyContent),
            alignContent: GridUtils.normalizeAlignContent(styles.alignContent),
            justifyItems: GridUtils.normalizeJustifyItems(styles.justifyItems),
            alignItems: GridUtils.normalizeAlignItems(styles.alignItems),
            placeContent: styles.placeContent || 'normal',
            placeItems: styles.placeItems || 'normal',
            column: styles.gridColumn || 'auto',
            row: styles.gridRow || 'auto',
            area: styles.gridArea || 'auto',
            justifySelf: GridUtils.normalizeJustifySelf(styles.justifySelf),
            alignSelf: GridUtils.normalizeAlignSelf(styles.alignSelf),
            placeSelf: styles.placeSelf || 'auto'
        } : undefined,
        // Dimensions
        dimensions: {
            width: styles.width || 'auto',
            height: styles.height || 'auto',
            minWidth: styles.minWidth || 'auto',
            maxWidth: styles.maxWidth || 'auto',
            minHeight: styles.minHeight || 'auto',
            maxHeight: styles.maxHeight || 'auto'
        },
        // Transform
        transform: legacyLayout.transform?.hasTransform ? {
            matrix: parseTransformMatrix(styles.transform || 'none'),
            origin: styles.transformOrigin || '50% 50%',
            style: (styles.transformStyle || 'flat')
        } : undefined,
        // Stacking and compositing
        stacking: {
            zIndex: parseFloat(styles.zIndex || '0') || 'auto',
            stackingContextId: undefined, // Would be populated by stacking context analysis
            paintOrder: legacyLayout.compositing?.paintOrder || 0,
            isolate: styles.isolation === 'isolate'
        }
    };
    return irLayout;
}
/**
 * Parse transform matrix from CSS transform value
 * Simplified implementation for common transform cases
 */
function parseTransformMatrix(transform) {
    if (!transform || transform === 'none') {
        return [1, 0, 0, 0, 1, 0]; // 2D identity matrix
    }
    // Handle matrix() and matrix3d() functions
    const matrixMatch = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (matrixMatch) {
        const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()) || 0);
        if (values.length === 6) {
            // 2D matrix: [a, b, c, d, e, f]
            return values;
        }
        else if (values.length === 16) {
            // 3D matrix: extract 2D portion [a, b, c, d, e, f] from 4x4 matrix
            return [values[0], values[1], values[4], values[5], values[12], values[13]];
        }
    }
    // For other transform functions, return identity matrix
    // Full transform parsing would require more complex implementation
    return [1, 0, 0, 0, 1, 0];
}
/**
 * Computes the world-space transform matrix for an element by walking up the DOM tree
 * and multiplying all transform matrices from the element to the root.
 *
 * @param el - The DOM element to compute the world matrix for
 * @returns A flattened 3x3 matrix as a 6-element array [a, b, c, d, e, f] representing:
 *          [a c e]   [scaleX skewX translateX]
 *          [b d f] = [skewY scaleY translateY]
 *          [0 0 1]   [0     0     1         ]
 */
function buildStackingContextTree(nodes) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const stackingContexts = [];
    const stackingContextMap = new Map(); // nodeId -> contextId
    // Find root node (html element)
    let rootNode = null;
    for (const node of nodes) {
        if (node.tag === "html" || (!rootNode && !node.parent)) {
            rootNode = node;
            break;
        }
    }
    if (!rootNode) {
        return {
            stackingContexts: [],
            paintOrder: nodes.map((n) => n.id),
        };
    }
    // Build stacking contexts
    const processedContexts = new Set();
    function createStackingContext(contextRootNodeId, parentContextId) {
        if (processedContexts.has(contextRootNodeId)) {
            return contextRootNodeId;
        }
        const contextId = contextRootNodeId;
        const nodeIds = [];
        // Find all nodes that belong to this stacking context
        function collectNodesInContext(nodeId, currentContextId) {
            const node = nodeMap.get(nodeId);
            if (!node)
                return;
            const compositing = node.layout?.compositing || node.compositing || {};
            const isStackingContextRoot = compositing.stackingContext === true || nodeId === rootNode.id;
            if (isStackingContextRoot && nodeId !== currentContextId) {
                // This node creates its own stacking context
                createStackingContext(nodeId, currentContextId);
            }
            else {
                // This node belongs to the current stacking context
                nodeIds.push(nodeId);
                stackingContextMap.set(nodeId, currentContextId);
                // Process children
                if (node.children && Array.isArray(node.children)) {
                    for (const childId of node.children) {
                        collectNodesInContext(childId, currentContextId);
                    }
                }
            }
        }
        // Start collection from the context root
        collectNodesInContext(contextRootNodeId, contextId);
        // Create the stacking context
        const stackingContext = {
            id: contextId,
            parentId: parentContextId,
            nodeIds,
        };
        stackingContexts.push(stackingContext);
        processedContexts.add(contextRootNodeId);
        return contextId;
    }
    // Start with root context
    createStackingContext(rootNode.id);
    // Compute paint order using stacking contexts and z-index rules
    const paintOrder = [];
    function computePaintOrderForContext(contextId) {
        const context = stackingContexts.find(ctx => ctx.id === contextId);
        if (!context)
            return;
        // Get all nodes in this context
        const contextNodes = context.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
        // Separate into z-index groups
        const negativeZNodes = [];
        const autoZNodes = [];
        const positiveZNodes = [];
        for (const node of contextNodes) {
            const compositing = node.layout?.compositing || node.compositing || {};
            const zIndex = compositing.zIndex;
            if (typeof zIndex === 'number') {
                if (zIndex < 0) {
                    negativeZNodes.push(node);
                }
                else if (zIndex > 0) {
                    positiveZNodes.push(node);
                }
                else {
                    autoZNodes.push(node);
                }
            }
            else {
                autoZNodes.push(node);
            }
        }
        // Sort by z-index within each group
        negativeZNodes.sort((a, b) => {
            const aZ = (a.layout?.compositing || a.compositing)?.zIndex || 0;
            const bZ = (b.layout?.compositing || b.compositing)?.zIndex || 0;
            return aZ - bZ;
        });
        positiveZNodes.sort((a, b) => {
            const aZ = (a.layout?.compositing || a.compositing)?.zIndex || 0;
            const bZ = (b.layout?.compositing || b.compositing)?.zIndex || 0;
            return aZ - bZ;
        });
        // Paint order: negative z-index, auto z-index, positive z-index
        const orderedNodes = [...negativeZNodes, ...autoZNodes, ...positiveZNodes];
        for (const node of orderedNodes) {
            paintOrder.push(node.id);
            // Process child stacking contexts
            const childContexts = stackingContexts.filter(ctx => ctx.parentId === contextId);
            for (const childContext of childContexts) {
                if (childContext.nodeIds.includes(node.id)) {
                    computePaintOrderForContext(childContext.id);
                }
            }
        }
    }
    // Start paint order computation from root
    computePaintOrderForContext(rootNode.id);
    return {
        stackingContexts,
        paintOrder,
    };
}
function computePaintOrder(stackingTree, nodes) {
    const paintOrder = [];
    const errors = [];
    const specialCases = [];
    const findNode = (id) => nodes.find((n) => n.id === id);
    function traverseStackingTree(context) {
        try {
            paintOrder.push(context.elementId);
            const negativeChildren = [];
            const autoChildren = [];
            const positiveChildren = [];
            for (const child of context.children) {
                if (typeof child.zIndex === "number" && child.zIndex < 0) {
                    negativeChildren.push(child);
                }
                else if (typeof child.zIndex === "number" && child.zIndex > 0) {
                    positiveChildren.push(child);
                }
                else {
                    autoChildren.push(child);
                }
            }
            negativeChildren.sort((a, b) => {
                const aZ = typeof a.zIndex === "number" ? a.zIndex : 0;
                const bZ = typeof b.zIndex === "number" ? b.zIndex : 0;
                return aZ - bZ;
            });
            positiveChildren.sort((a, b) => {
                const aZ = typeof a.zIndex === "number" ? a.zIndex : 0;
                const bZ = typeof b.zIndex === "number" ? b.zIndex : 0;
                return aZ - bZ;
            });
            for (const child of negativeChildren) {
                traverseStackingTree(child);
            }
            for (const child of autoChildren) {
                traverseStackingTree(child);
            }
            for (const child of positiveChildren) {
                traverseStackingTree(child);
            }
        }
        catch (error) {
            errors.push({
                elementId: context.elementId,
                error: `Failed to traverse: ${error}`,
            });
        }
    }
    if (stackingTree.stackingContexts.root) {
        traverseStackingTree(stackingTree.stackingContexts.root);
    }
    return {
        paintOrder,
        errors,
        specialCases,
    };
}
// ==================== PHASE 2: FONT EXTRACTION ====================
async function extractFonts(page, baseUrl) {
    const fonts = await page.evaluate(() => {
        const fontFaces = [];
        try {
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    for (const rule of Array.from(rules)) {
                        if (rule instanceof CSSFontFaceRule) {
                            const style = rule.style;
                            let family = style.getPropertyValue("font-family");
                            family = family.replace(/['"]/g, "").trim();
                            const src = style.getPropertyValue("src");
                            const urlMatches = src.match(/url\(['"]?([^'"()]+)['"]?\)/g);
                            if (urlMatches) {
                                urlMatches.forEach((match) => {
                                    const urlMatch = match.match(/url\(['"]?([^'"()]+)['"]?\)/);
                                    const formatMatch = match.match(/format\(['"]?([^'"()]+)['"]?\)/);
                                    if (urlMatch) {
                                        fontFaces.push({
                                            family,
                                            style: style.getPropertyValue("font-style") || "normal",
                                            weight: style.getPropertyValue("font-weight") || "400",
                                            src: urlMatch[1],
                                            format: formatMatch ? formatMatch[1] : undefined,
                                        });
                                    }
                                });
                            }
                        }
                    }
                }
                catch (e) {
                    // CORS blocked
                }
            }
        }
        catch (e) {
            console.error("Font extraction error:", e);
        }
        return fontFaces;
    });
    const fontsWithData = await Promise.all(fonts.map(async (font) => {
        try {
            const fontUrl = new URL(font.src, baseUrl).href;
            const response = await fetch(fontUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                },
            });
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64 = buffer.toString("base64");
                const mimeType = response.headers.get("content-type") || "font/woff2";
                return {
                    ...font,
                    src: fontUrl,
                    data: `data:${mimeType};base64,${base64}`,
                };
            }
        }
        catch (e) {
            console.warn(`Failed to download font: ${font.src}`);
        }
        return font;
    }));
    return fontsWithData.filter((f) => f.data);
}
/**
 * Enhanced font extraction that creates IRFontAsset objects
 */
async function extractFontsAsIRAssets(page, baseUrl) {
    console.log("[Font Extraction] Starting comprehensive font extraction...");
    // Extract font faces from CSS
    const fontFaces = await page.evaluate(() => {
        const fontFaces = [];
        // Extract from CSS stylesheets
        try {
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    for (const rule of Array.from(rules)) {
                        if (rule instanceof CSSFontFaceRule) {
                            const style = rule.style;
                            let family = style.getPropertyValue("font-family");
                            family = family.replace(/['"]/g, "").trim();
                            const src = style.getPropertyValue("src");
                            const fontWeight = style.getPropertyValue("font-weight") || "400";
                            const fontStyle = style.getPropertyValue("font-style") || "normal";
                            const fontStretch = style.getPropertyValue("font-stretch") || undefined;
                            const unicodeRange = style.getPropertyValue("unicode-range") || undefined;
                            const fontDisplay = style.getPropertyValue("font-display") || undefined;
                            // Parse src declaration to get all sources
                            const sources = [];
                            // Match all url() declarations in src
                            const urlMatches = src.match(/url\(['"]?[^'"()]+['"]?\)(\s+format\(['"]?[^'"()]+['"]?\))?/g);
                            if (urlMatches) {
                                urlMatches.forEach((match) => {
                                    const urlMatch = match.match(/url\(['"]?([^'"()]+)['"]?\)/);
                                    const formatMatch = match.match(/format\(['"]?([^'"()]+)['"]?\)/);
                                    if (urlMatch) {
                                        sources.push({
                                            url: urlMatch[1],
                                            format: formatMatch ? formatMatch[1] : undefined,
                                        });
                                    }
                                });
                            }
                            if (sources.length > 0) {
                                fontFaces.push({
                                    family,
                                    style: fontStyle,
                                    weight: fontWeight,
                                    stretch: fontStretch,
                                    unicodeRange,
                                    display: fontDisplay,
                                    src: sources,
                                });
                            }
                        }
                    }
                }
                catch (e) {
                    // CORS blocked or other error, skip this stylesheet
                }
            }
        }
        catch (e) {
            console.error("Font extraction error:", e);
        }
        return fontFaces;
    });
    console.log(`[Font Extraction] Found ${fontFaces.length} @font-face declarations`);
    // Download and encode fonts
    const irFontAssets = await Promise.all(fontFaces.map(async (fontFace, index) => {
        const fontId = `font_${fontFace.family.replace(/\s+/g, '_').toLowerCase()}_${fontFace.weight}_${fontFace.style}_${index}`;
        const prioritizedSources = prioritizeFontSources(fontFace.src);
        const normalizedSources = prioritizedSources.map((source) => ({
            url: new URL(source.url, baseUrl).href,
            format: source.format,
        }));
        const skipDownload = shouldTreatAsSystemFont(fontFace.family, normalizedSources);
        try {
            // Try to download the first available source
            let fontData;
            if (skipDownload) {
                console.log(`[Font Extraction] 🔒 Skipping remote download for ${fontFace.family} (using system font)`);
            }
            else {
                for (const source of normalizedSources) {
                    try {
                        console.log(`[Font Extraction] Downloading: ${source.url}`);
                        const response = await fetch(source.url, {
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                                "Accept": "font/woff2,font/woff,font/ttf,font/opentype,application/font-woff2,application/font-woff,application/x-font-ttf,*/*",
                            },
                        });
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            fontData = buffer.toString("base64");
                            console.log(`[Font Extraction] ✅ Downloaded ${fontFace.family} (${buffer.length} bytes)`);
                            break; // Use first successful download
                        }
                        else {
                            console.warn(`[Font Extraction] ❌ Failed to download ${source.url}: ${response.status}`);
                        }
                    }
                    catch (downloadError) {
                        console.warn(`[Font Extraction] ❌ Download error for ${source.url}:`, downloadError);
                        continue; // Try next source
                    }
                }
            }
            // Create IRFontAsset
            const irFontAsset = {
                id: fontId,
                family: fontFace.family,
                style: fontFace.style,
                weight: fontFace.weight,
                stretch: fontFace.stretch,
                unicodeRange: fontFace.unicodeRange,
                src: normalizedSources,
                data: fontData,
                display: fontFace.display,
                loadStatus: skipDownload ? "unloaded" : fontData ? "loaded" : "error",
                isSystemFont: skipDownload || SYSTEM_FONTS.includes(fontFace.family.toLowerCase()),
                usedByNodes: [], // Will be populated later when processing nodes
            };
            return irFontAsset;
        }
        catch (error) {
            console.warn(`[Font Extraction] ❌ Failed to process font ${fontFace.family}:`, error);
            // Return minimal font asset without data
            const irFontAsset = {
                id: fontId,
                family: fontFace.family,
                style: fontFace.style,
                weight: fontFace.weight,
                stretch: fontFace.stretch,
                unicodeRange: fontFace.unicodeRange,
                src: normalizedSources,
                display: fontFace.display,
                loadStatus: "error",
                isSystemFont: skipDownload || SYSTEM_FONTS.includes(fontFace.family.toLowerCase()),
                usedByNodes: [],
            };
            return irFontAsset;
        }
    }));
    const loadedFonts = irFontAssets.filter(font => font.data);
    console.log(`[Font Extraction] ✅ Successfully loaded ${loadedFonts.length}/${irFontAssets.length} fonts`);
    return irFontAssets;
}
/**
 * Analyze which fonts are used by which nodes and update font assets accordingly
 */
function updateFontUsageInNodes(fontAssets, extractedData) {
    console.log("[Font Usage] Analyzing font usage across nodes...");
    const nodes = extractedData.nodes || [];
    const normalizedFontAssets = [...fontAssets];
    const fontUsageMap = new Map(); // fontId -> Set of nodeIds
    const buildFontKey = (family, weight, style) => `${family.toLowerCase()}__${weight}__${style}`;
    const fontAssetMap = new Map();
    normalizedFontAssets.forEach((font) => {
        const key = buildFontKey(font.family, font.weight, font.style);
        if (!fontAssetMap.has(key)) {
            fontAssetMap.set(key, font);
        }
        fontUsageMap.set(font.id, new Set());
    });
    // Analyze each node's font usage
    nodes.forEach((node) => {
        if (!node.id)
            return;
        let fontFamily = '';
        let fontWeight = '400';
        let fontStyle = 'normal';
        // Extract font properties from different possible sources
        if (node.textMetrics?.font) {
            fontFamily = node.textMetrics.font.family || '';
            fontWeight = node.textMetrics.font.weight || '400';
            fontStyle = node.textMetrics.font.style || 'normal';
        }
        else if (node.styles) {
            fontFamily = node.styles.fontFamily || '';
            fontWeight = node.styles.fontWeight || '400';
            fontStyle = node.styles.fontStyle || 'normal';
        }
        else if (node.typography?.font) {
            fontFamily = node.typography.font.family || '';
            fontWeight = node.typography.font.weight || '400';
            fontStyle = node.typography.font.style || 'normal';
        }
        if (!fontFamily)
            return;
        // Clean font family (remove quotes, normalize)
        const cleanedFamily = fontFamily
            .split(",")[0]
            .replace(/['"]/g, "")
            .trim();
        if (!cleanedFamily)
            return;
        const key = buildFontKey(cleanedFamily, fontWeight, fontStyle);
        let matchingFont = fontAssetMap.get(key);
        const isSystemFont = SYSTEM_FONTS.includes(cleanedFamily.toLowerCase()) ||
            cleanedFamily.toLowerCase().includes("system") ||
            cleanedFamily.toLowerCase().includes("apple") ||
            cleanedFamily.toLowerCase().includes("segoe");
        if (!matchingFont && isSystemFont) {
            matchingFont = {
                id: `system_${cleanedFamily.replace(/\s+/g, "_").toLowerCase()}_${fontWeight}_${fontStyle}`,
                family: cleanedFamily,
                style: fontStyle,
                weight: fontWeight,
                src: [],
                loadStatus: "unloaded",
                isSystemFont: true,
                usedByNodes: [],
            };
            normalizedFontAssets.push(matchingFont);
            fontAssetMap.set(key, matchingFont);
            fontUsageMap.set(matchingFont.id, new Set());
        }
        if (matchingFont) {
            const usageSet = fontUsageMap.get(matchingFont.id);
            if (usageSet) {
                usageSet.add(node.id);
            }
            console.log(`[Font Usage] Node ${node.id} uses font ${matchingFont.family} (${fontWeight} ${fontStyle})`);
        }
        else {
            if (!isSystemFont) {
                console.warn(`[Font Usage] ⚠️ Node ${node.id} uses untracked font: ${cleanedFamily} (${fontWeight} ${fontStyle})`);
            }
        }
    });
    // Update font assets with usage information
    const updatedFontAssets = normalizedFontAssets.map(font => ({
        ...font,
        usedByNodes: Array.from(fontUsageMap.get(font.id) || []),
    }));
    // Log usage statistics
    const usedFonts = updatedFontAssets.filter(font => font.usedByNodes && font.usedByNodes.length > 0);
    console.log(`[Font Usage] ✅ ${usedFonts.length}/${fontAssets.length} fonts are actively used by nodes`);
    usedFonts.forEach(font => {
        console.log(`[Font Usage] ${font.family} (${font.weight} ${font.style}): used by ${font.usedByNodes?.length} nodes`);
    });
    return updatedFontAssets;
}
// ==================== COMPREHENSIVE ASSET RESOLVER ====================
/**
 * Comprehensive asset collection for images, SVG, canvas, and video frames
 */
async function collectAllAssets(page, baseUrl) {
    console.log("[Asset Collection] Starting comprehensive asset extraction...");
    // Extract all assets from the page
    const assetsData = await page.evaluate(() => {
        const assets = {
            images: [],
            svgs: [],
            canvases: [],
            videos: []
        };
        // ==================== IMAGE COLLECTION ====================
        // Collect <img> elements
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach((img, index) => {
            if (img.src || img.srcset) {
                const rect = img.getBoundingClientRect();
                // Get the actual displayed size
                const displayWidth = rect.width || img.naturalWidth || img.width || 0;
                const displayHeight = rect.height || img.naturalHeight || img.height || 0;
                assets.images.push({
                    id: `img_${index}`,
                    type: 'img',
                    src: img.src,
                    srcset: img.srcset,
                    alt: img.alt,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    displayWidth,
                    displayHeight,
                    currentSrc: img.currentSrc,
                    loading: img.loading,
                    elementSelector: generateElementSelector(img),
                    rect: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                });
            }
        });
        // Collect CSS background images
        const elementsWithBg = document.querySelectorAll('*');
        elementsWithBg.forEach((element, index) => {
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;
            if (backgroundImage && backgroundImage !== 'none') {
                const rect = element.getBoundingClientRect();
                // Extract URL from CSS url() function
                const urlMatch = backgroundImage.match(/url\(['"]?([^'"()]+)['"]?\)/g);
                if (urlMatch) {
                    urlMatch.forEach((match, urlIndex) => {
                        const url = match.match(/url\(['"]?([^'"()]+)['"]?\)/);
                        if (url && url[1]) {
                            assets.images.push({
                                id: `bg_${index}_${urlIndex}`,
                                type: 'background',
                                src: url[1],
                                displayWidth: rect.width,
                                displayHeight: rect.height,
                                elementSelector: generateElementSelector(element),
                                backgroundSize: computedStyle.backgroundSize,
                                backgroundPosition: computedStyle.backgroundPosition,
                                backgroundRepeat: computedStyle.backgroundRepeat,
                                rect: {
                                    x: rect.left,
                                    y: rect.top,
                                    width: rect.width,
                                    height: rect.height
                                }
                            });
                        }
                    });
                }
            }
        });
        // ==================== SVG COLLECTION ====================
        // Collect inline SVG elements
        const svgElements = document.querySelectorAll('svg');
        svgElements.forEach((svg, index) => {
            const rect = svg.getBoundingClientRect();
            // Get viewBox
            const viewBoxAttr = svg.getAttribute('viewBox');
            let viewBox;
            if (viewBoxAttr) {
                const parts = viewBoxAttr.split(/\s+/).map(Number);
                if (parts.length === 4) {
                    viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
                }
            }
            assets.svgs.push({
                id: `svg_${index}`,
                type: 'inline',
                svg: svg.outerHTML,
                viewBox,
                width: svg.getAttribute('width'),
                height: svg.getAttribute('height'),
                preserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
                displayWidth: rect.width,
                displayHeight: rect.height,
                elementSelector: generateElementSelector(svg),
                rect: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            });
        });
        // ==================== CANVAS COLLECTION ====================
        // Collect canvas elements and their snapshots
        const canvasElements = document.querySelectorAll('canvas');
        canvasElements.forEach((canvas, index) => {
            const rect = canvas.getBoundingClientRect();
            try {
                // Take snapshot of canvas
                const dataURL = canvas.toDataURL('image/png');
                assets.canvases.push({
                    id: `canvas_${index}`,
                    type: 'canvas',
                    dataURL,
                    width: canvas.width,
                    height: canvas.height,
                    displayWidth: rect.width,
                    displayHeight: rect.height,
                    elementSelector: generateElementSelector(canvas),
                    rect: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                });
            }
            catch (error) {
                console.warn(`Failed to capture canvas ${index}:`, error);
                // Still add canvas info without data
                assets.canvases.push({
                    id: `canvas_${index}`,
                    type: 'canvas',
                    dataURL: null,
                    width: canvas.width,
                    height: canvas.height,
                    displayWidth: rect.width,
                    displayHeight: rect.height,
                    elementSelector: generateElementSelector(canvas),
                    error: 'Failed to capture canvas data',
                    rect: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                });
            }
        });
        // ==================== VIDEO COLLECTION ====================
        // Collect video elements and capture frames
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach((video, index) => {
            const rect = video.getBoundingClientRect();
            try {
                // Create canvas to capture video frame
                const tempCanvas = document.createElement('canvas');
                const ctx = tempCanvas.getContext('2d');
                if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                    tempCanvas.width = video.videoWidth;
                    tempCanvas.height = video.videoHeight;
                    // Draw current frame
                    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                    const frameDataURL = tempCanvas.toDataURL('image/png');
                    assets.videos.push({
                        id: `video_${index}`,
                        type: 'video',
                        frameDataURL,
                        posterSrc: video.poster,
                        src: video.src,
                        currentSrc: video.currentSrc,
                        videoWidth: video.videoWidth,
                        videoHeight: video.videoHeight,
                        displayWidth: rect.width,
                        displayHeight: rect.height,
                        currentTime: video.currentTime,
                        duration: video.duration,
                        elementSelector: generateElementSelector(video),
                        rect: {
                            x: rect.left,
                            y: rect.top,
                            width: rect.width,
                            height: rect.height
                        }
                    });
                }
                else {
                    // Video not loaded or no dimensions, use poster if available
                    assets.videos.push({
                        id: `video_${index}`,
                        type: 'video',
                        frameDataURL: null,
                        posterSrc: video.poster,
                        src: video.src,
                        currentSrc: video.currentSrc,
                        videoWidth: video.videoWidth || 0,
                        videoHeight: video.videoHeight || 0,
                        displayWidth: rect.width,
                        displayHeight: rect.height,
                        currentTime: video.currentTime,
                        duration: video.duration,
                        elementSelector: generateElementSelector(video),
                        error: 'Video not loaded or no dimensions',
                        rect: {
                            x: rect.left,
                            y: rect.top,
                            width: rect.width,
                            height: rect.height
                        }
                    });
                }
            }
            catch (error) {
                console.warn(`Failed to capture video frame ${index}:`, error);
                assets.videos.push({
                    id: `video_${index}`,
                    type: 'video',
                    frameDataURL: null,
                    posterSrc: video.poster,
                    src: video.src,
                    currentSrc: video.currentSrc,
                    videoWidth: video.videoWidth || 0,
                    videoHeight: video.videoHeight || 0,
                    displayWidth: rect.width,
                    displayHeight: rect.height,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    elementSelector: generateElementSelector(video),
                    error: 'Failed to capture video frame',
                    rect: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                });
            }
        });
        // Helper function to generate element selectors
        function generateElementSelector(element) {
            if (element.id) {
                return `#${element.id}`;
            }
            if (element.className) {
                const classes = element.className.toString().trim().split(/\s+/).slice(0, 2);
                return `.${classes.join('.')}`;
            }
            const tagName = element.tagName.toLowerCase();
            const parent = element.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
                const index = siblings.indexOf(element);
                return `${tagName}:nth-of-type(${index + 1})`;
            }
            return tagName;
        }
        return assets;
    });
    console.log(`[Asset Collection] Found ${assetsData.images.length} images, ${assetsData.svgs.length} SVGs, ${assetsData.canvases.length} canvases, ${assetsData.videos.length} videos`);
    // Process collected assets
    const imageAssets = await processImageAssets([
        ...assetsData.images,
        ...assetsData.canvases,
        ...assetsData.videos.filter(v => v.frameDataURL || v.posterSrc)
    ], baseUrl);
    const svgAssets = await processSVGAssets(assetsData.svgs);
    return { imageAssets, svgAssets };
}
class SVGCache {
    seen = new Map();
    normalize(svgString) {
        return svgString
            .replace(/\s+/g, " ")
            .replace(/id="[^"]*"/g, "")
            .replace(/clip-path="url\([^)]+\)"/g, "")
            .replace(/mask="url\([^)]+\)"/g, "")
            .replace(/filter="url\([^)]+\)"/g, "")
            .trim();
    }
    hash(svgString) {
        const normalized = this.normalize(svgString);
        return crypto.createHash("sha256").update(normalized).digest("hex");
    }
    register(svgId, svgString) {
        const hash = this.hash(svgString);
        if (this.seen.has(hash)) {
            return { isDuplicate: true, originalId: this.seen.get(hash), hash };
        }
        this.seen.set(hash, svgId);
        return { isDuplicate: false, originalId: svgId, hash };
    }
}
/**
 * Process collected image assets (images, canvas, video frames)
 */
async function processImageAssets(rawAssets, baseUrl) {
    console.log(`[Asset Processing] Processing ${rawAssets.length} image assets...`);
    const processedAssets = [];
    const hashCache = new Map(); // For deduplication
    for (const asset of rawAssets) {
        try {
            let imageUrl = '';
            let imageData = '';
            const dimensionHints = getAssetDimensionHints(asset);
            // Determine source URL or data
            if (asset.type === 'canvas') {
                if (asset.dataURL) {
                    imageData = asset.dataURL;
                }
                else {
                    console.warn(`[Asset Processing] Canvas ${asset.id} has no data`);
                    continue;
                }
            }
            else if (asset.type === 'video') {
                if (asset.frameDataURL) {
                    imageData = asset.frameDataURL;
                }
                else if (asset.posterSrc) {
                    imageUrl = asset.posterSrc;
                }
                else {
                    console.warn(`[Asset Processing] Video ${asset.id} has no frame or poster`);
                    continue;
                }
            }
            else {
                // Regular image or background image
                imageUrl = asset.src || asset.currentSrc;
                if (!imageUrl) {
                    console.warn(`[Asset Processing] Image ${asset.id} has no source`);
                    continue;
                }
            }
            // Download and process the image
            let buffer = null;
            let mimeType = '';
            let width = 0;
            let height = 0;
            if (imageData) {
                // Handle data URLs (canvas, video frames)
                const { buffer: processedBuffer, mimeType: detectedMimeType, dimensions, } = await processDataURL(imageData, dimensionHints);
                buffer = processedBuffer;
                mimeType = detectedMimeType;
                width = dimensions.width;
                height = dimensions.height;
            }
            else if (imageUrl) {
                // Handle regular URLs
                const resolvedUrl = new URL(imageUrl, baseUrl).href;
                const { buffer: processedBuffer, mimeType: detectedMimeType, dimensions, } = await downloadAndProcessImage(resolvedUrl, dimensionHints);
                buffer = processedBuffer;
                mimeType = detectedMimeType;
                width = dimensions.width;
                height = dimensions.height;
            }
            if (!buffer || !width || !height) {
                console.warn(`[Asset Processing] Failed to process asset ${asset.id}`);
                continue;
            }
            // Generate hash for deduplication
            const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
            // Check for duplicates
            if (hashCache.has(hash)) {
                console.log(`[Asset Processing] Duplicate asset found: ${asset.id} (matches ${hashCache.get(hash).id})`);
                continue;
            }
            // Determine if asset should be chunked for streaming
            const shouldChunk = buffer.length > 1024 * 1024; // 1MB threshold
            // Create IRImageAsset
            const irAsset = {
                id: `asset_${asset.id}_${hash}`,
                url: imageUrl || undefined,
                mimeType,
                hash,
                width,
                height,
                data: shouldChunk ? undefined : buffer.toString('base64'),
                chunkRef: shouldChunk ? { id: `chunk_${hash}`, length: buffer.length } : undefined,
                size: buffer.length,
                format: getFormatFromMimeType(mimeType),
                processing: {
                    originalFormat: getFormatFromMimeType(mimeType),
                    wasConverted: false,
                    originalSize: buffer.length
                }
            };
            processedAssets.push(irAsset);
            hashCache.set(hash, irAsset);
            console.log(`[Asset Processing] ✅ Processed ${asset.type} asset: ${asset.id} (${(buffer.length / 1024).toFixed(1)}KB, ${width}x${height})`);
        }
        catch (error) {
            console.error(`[Asset Processing] ❌ Failed to process asset ${asset.id}:`, error);
        }
    }
    console.log(`[Asset Processing] ✅ Successfully processed ${processedAssets.length}/${rawAssets.length} assets`);
    return processedAssets;
}
/**
 * Process SVG assets
 */
async function processSVGAssets(rawSvgs) {
    console.log(`[SVG Processing] Processing ${rawSvgs.length} SVG assets...`);
    const processedSvgs = [];
    const svgCache = new SVGCache();
    for (const svgData of rawSvgs) {
        try {
            // Clean up SVG content
            const svgContent = svgData.svg.trim();
            const registration = svgCache.register(svgData.id, svgContent);
            if (registration.isDuplicate) {
                console.log(`[SVG Processing] Duplicate SVG found: ${svgData.id} (matches ${registration.originalId})`);
                continue;
            }
            // Extract paths from SVG for vector conversion
            const paths = extractSVGPaths(svgContent);
            const irSvgAsset = {
                id: `svg_${svgData.id}_${registration.hash.substring(0, 16)}`,
                svg: svgContent,
                viewBox: svgData.viewBox,
                width: svgData.width,
                height: svgData.height,
                preserveAspectRatio: svgData.preserveAspectRatio,
                paths
            };
            processedSvgs.push(irSvgAsset);
            console.log(`[SVG Processing] ✅ Processed SVG: ${svgData.id} (${paths.length} paths)`);
        }
        catch (error) {
            console.error(`[SVG Processing] ❌ Failed to process SVG ${svgData.id}:`, error);
        }
    }
    console.log(`[SVG Processing] ✅ Successfully processed ${processedSvgs.length}/${rawSvgs.length} SVGs`);
    return processedSvgs;
}
/**
 * Process data URL and extract image information
 */
async function processDataURL(dataURL, hints) {
    const commaIndex = dataURL.indexOf(',');
    if (commaIndex === -1) {
        throw new Error('Invalid data URL format');
    }
    const header = dataURL.substring(0, commaIndex);
    const data = dataURL.substring(commaIndex + 1);
    const isBase64 = header.includes(';base64');
    // Extract MIME type
    const mimeTypeMatch = header.match(/data:([^;,]+)/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
    // Decode data
    const buffer = Buffer.from(data, isBase64 ? 'base64' : 'utf8');
    const dimensions = detectImageDimensions(buffer, mimeType, hints);
    return {
        buffer,
        mimeType,
        dimensions,
    };
}
/**
 * Download and process remote image
 */
async function downloadAndProcessImage(imageUrl, hints) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/avif,image/jxl,image/heic,image/heic-sequence,*/*;q=0.8'
                },
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            const mimeType = response.headers.get('content-type') || 'image/png';
            const dimensions = detectImageDimensions(buffer, mimeType, hints);
            return {
                buffer,
                mimeType,
                dimensions,
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    catch (error) {
        console.error(`[Asset Processing] Failed to download image ${imageUrl}:`, error);
        throw error;
    }
}
/**
 * Extract paths from SVG content for vector conversion
 */
function extractSVGPaths(svgContent) {
    const paths = [];
    // Simple regex-based path extraction (could be enhanced with proper XML parsing)
    const pathRegex = /<path[^>]*>/gi;
    const matches = svgContent.match(pathRegex);
    if (matches) {
        matches.forEach(pathMatch => {
            const dMatch = pathMatch.match(/d=["']([^"']*)["']/i);
            const fillMatch = pathMatch.match(/fill=["']([^"']*)["']/i);
            const strokeMatch = pathMatch.match(/stroke=["']([^"']*)["']/i);
            const strokeWidthMatch = pathMatch.match(/stroke-width=["']([^"']*)["']/i);
            if (dMatch) {
                paths.push({
                    d: dMatch[1],
                    fill: fillMatch ? fillMatch[1] : undefined,
                    stroke: strokeMatch ? strokeMatch[1] : undefined,
                    strokeWidth: strokeWidthMatch ? strokeWidthMatch[1] : undefined
                });
            }
        });
    }
    return paths;
}
/**
 * Get format string from MIME type
 */
function getFormatFromMimeType(mimeType) {
    if (mimeType.includes('png'))
        return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg'))
        return 'jpeg';
    if (mimeType.includes('webp'))
        return 'webp';
    if (mimeType.includes('gif'))
        return 'gif';
    if (mimeType.includes('svg'))
        return 'svg';
    return 'png'; // Default fallback
}
function getAssetDimensionHints(asset) {
    const width = normalizeDimension(asset.width) ??
        normalizeDimension(asset.naturalWidth) ??
        normalizeDimension(asset.displayWidth) ??
        normalizeDimension(asset.rect?.width);
    const height = normalizeDimension(asset.height) ??
        normalizeDimension(asset.naturalHeight) ??
        normalizeDimension(asset.displayHeight) ??
        normalizeDimension(asset.rect?.height);
    return { width, height };
}
function normalizeDimension(value) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "auto") {
            return undefined;
        }
        const parsed = parseFloat(trimmed);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return undefined;
        }
        return Math.round(parsed);
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return undefined;
    return Math.round(num);
}
function detectImageDimensions(buffer, mimeType, hints) {
    let width;
    let height;
    if (isPNG(buffer)) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
    }
    else if (isGIF(buffer)) {
        width = buffer.readUInt16LE(6);
        height = buffer.readUInt16LE(8);
    }
    else if (isJPEG(buffer)) {
        const jpegDims = parseJPEGDimensions(buffer);
        width = jpegDims?.width;
        height = jpegDims?.height;
    }
    else if (mimeType.includes('svg')) {
        width = hints?.width;
        height = hints?.height;
    }
    if (!width && hints?.width) {
        width = hints.width;
    }
    if (!height && hints?.height) {
        height = hints.height;
    }
    return {
        width: width && width > 0 ? width : 100,
        height: height && height > 0 ? height : 100,
    };
}
function isPNG(buffer) {
    return (buffer.length > 24 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47);
}
function isGIF(buffer) {
    return (buffer.length > 10 &&
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46);
}
function isJPEG(buffer) {
    return buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
}
function parseJPEGDimensions(buffer) {
    let offset = 2;
    while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xd9 || marker === 0xda) {
            break;
        }
        const length = buffer.readUInt16BE(offset + 2);
        if (length < 2) {
            break;
        }
        const isSOF = (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf);
        if (isSOF) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            if (width && height) {
                return { width, height };
            }
            break;
        }
        offset += 2 + length;
    }
    return null;
}
async function detectFontFaces(page, nodes) {
    const fontFaceData = await page.evaluate((nodeData) => {
        const normalizeFontFamily = (family) => {
            return family.replace(/['"]/g, "").trim().toLowerCase();
        };
        const parseSrcDeclaration = (src) => {
            const sources = [];
            const urlRegex = /url\(['"]?([^'"()]+)['"]?\)(?:\s+format\(['"]?([^'"()]+)['"]?\))?/g;
            let match;
            while ((match = urlRegex.exec(src)) !== null) {
                sources.push({
                    url: match[1],
                    format: match[2],
                });
            }
            return sources;
        };
        const declaredFonts = new Map();
        try {
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (!rules)
                        continue;
                    for (const rule of Array.from(rules)) {
                        if (rule instanceof CSSFontFaceRule) {
                            const style = rule.style;
                            const family = style.getPropertyValue("font-family");
                            const normalizedFamily = normalizeFontFamily(family);
                            const src = style.getPropertyValue("src");
                            const weight = style.getPropertyValue("font-weight") || "400";
                            const fontStyle = style.getPropertyValue("font-style") || "normal";
                            const unicodeRange = style.getPropertyValue("unicode-range") || undefined;
                            const display = style.getPropertyValue("font-display") || undefined;
                            if (family && src) {
                                const sources = parseSrcDeclaration(src);
                                for (const source of sources) {
                                    const key = `${normalizedFamily}-${weight}-${fontStyle}`;
                                    declaredFonts.set(key, {
                                        family: family.replace(/['"]/g, "").trim(),
                                        style: fontStyle,
                                        weight: weight,
                                        src: source.url,
                                        format: source.format,
                                        unicodeRange,
                                        display,
                                        srcList: sources.map((s) => s.url),
                                        isSystemFont: false,
                                    });
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    // CORS blocked
                }
            }
        }
        catch (e) {
            console.error("Font face extraction error:", e);
        }
        const fontLoadStatus = new Map();
        if (document.fonts) {
            try {
                document.fonts.forEach((fontFace) => {
                    const normalizedFamily = normalizeFontFamily(fontFace.family);
                    const key = `${normalizedFamily}-${fontFace.weight || "400"}-${fontFace.style || "normal"}`;
                    let status;
                    switch (fontFace.status) {
                        case "loading":
                            status = "loading";
                            break;
                        case "loaded":
                            status = "loaded";
                            break;
                        case "error":
                            status = "error";
                            break;
                        default:
                            status = "unloaded";
                    }
                    fontLoadStatus.set(key, status);
                });
            }
            catch (e) {
                console.warn("Font status check failed:", e);
            }
        }
        const fontUsage = new Map();
        const systemFontFamilies = new Set();
        const systemFonts = [
            "serif",
            "sans-serif",
            "monospace",
            "cursive",
            "fantasy",
            "system-ui",
            "-apple-system",
            "blinkmacsystemfont",
            "arial",
            "helvetica",
            "times",
            "courier",
            "georgia",
        ];
        for (const node of nodeData) {
            const fontFamily = node.styles?.fontFamily ||
                node.typography?.fontFamily ||
                node.typography?.font?.family;
            if (fontFamily) {
                const fontFamilies = fontFamily
                    .split(",")
                    .map((f) => f.trim().replace(/['"]/g, ""));
                for (const family of fontFamilies) {
                    const normalizedFamily = normalizeFontFamily(family);
                    const isSystemFont = systemFonts.some((sf) => normalizedFamily.includes(sf));
                    if (isSystemFont) {
                        systemFontFamilies.add(family);
                    }
                    const weight = node.styles?.fontWeight ||
                        node.typography?.fontWeight ||
                        node.typography?.font?.weight ||
                        "400";
                    const style = node.styles?.fontStyle ||
                        node.typography?.fontStyle ||
                        node.typography?.font?.style ||
                        "normal";
                    const key = `${normalizedFamily}-${weight}-${style}`;
                    if (!fontUsage.has(key)) {
                        fontUsage.set(key, new Set());
                    }
                    fontUsage.get(key).add(node.id);
                }
            }
        }
        const systemFontFaces = [];
        for (const [key, fontData] of declaredFonts) {
            const usedByElements = Array.from(fontUsage.get(key) || []);
            const loadStatus = fontLoadStatus.get(key) || "unloaded";
            systemFontFaces.push({
                ...fontData,
                loadStatus: loadStatus,
                usedByElements,
            });
        }
        for (const family of systemFontFamilies) {
            const normalizedFamily = normalizeFontFamily(family);
            for (const [key, elementIds] of fontUsage) {
                if (key.startsWith(normalizedFamily + "-")) {
                    const parts = key.split("-");
                    const weight = parts[parts.length - 2];
                    const style = parts[parts.length - 1];
                    if (!declaredFonts.has(key)) {
                        systemFontFaces.push({
                            family: family,
                            style: style,
                            weight: weight,
                            src: "",
                            loadStatus: "loaded",
                            usedByElements: Array.from(elementIds),
                            isSystemFont: true,
                        });
                    }
                }
            }
        }
        return systemFontFaces;
    }, nodes);
    return fontFaceData;
}
// ==================== PHASE 3: ELEMENT SCREENSHOTS ====================
const NON_VISUAL_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "META",
    "TITLE",
    "LINK",
    "NOSCRIPT",
    "SOURCE",
    "TRACK",
]);
function shouldScreenshotNodeCandidate(node) {
    if (!node)
        return false;
    if (!node.selector)
        return false;
    const tag = (node.tag || "").toUpperCase();
    if (!tag || NON_VISUAL_TAGS.has(tag)) {
        return false;
    }
    const layout = node.layout || {};
    const visibility = layout.visibility || {};
    const styles = node.styles || {};
    const display = (styles.display || "").toString();
    const visibilityValue = (styles.visibility || "").toString();
    const opacity = parseFloat(styles.opacity || "1");
    if (visibility.isHidden ||
        display === "none" ||
        visibilityValue === "hidden" ||
        opacity === 0) {
        return false;
    }
    const width = measureNodeDimension(node, "width") || 0;
    const height = measureNodeDimension(node, "height") || 0;
    if (width < 2 || height < 2) {
        return false;
    }
    const hasText = typeof node.text === "string" && node.text.trim().length > 0;
    const hasVisualAssets = Boolean(node.image || node.svg || node.primaryScreenshot);
    const childCount = Array.isArray(node.children) ? node.children.length : 0;
    const hasExplicitContent = hasText || hasVisualAssets || childCount > 0;
    if (!hasExplicitContent) {
        return false;
    }
    const isWrapperOnly = !hasText &&
        !hasVisualAssets &&
        childCount === 1 &&
        !Boolean(node.needsScreenshot);
    if (isWrapperOnly) {
        return false;
    }
    return true;
}
function prepareScreenshotCandidates(nodes) {
    const stats = {
        total: nodes.length,
        eligible: 0,
        hidden: 0,
        zeroSize: 0,
        detached: 0,
    };
    const filtered = [];
    for (const node of nodes) {
        if (!node?.selector) {
            stats.detached += 1;
            continue;
        }
        const layout = node.layout || {};
        const visibility = layout.visibility || {};
        const styles = node.styles || {};
        const display = (styles.display || "").toString();
        const visibilityValue = (styles.visibility || "").toString();
        const opacity = parseFloat(styles.opacity || "1");
        const isHidden = visibility.isHidden ||
            display === "none" ||
            visibilityValue === "hidden" ||
            opacity === 0;
        if (isHidden) {
            stats.hidden += 1;
            continue;
        }
        const approxWidth = measureNodeDimension(node, "width");
        const approxHeight = measureNodeDimension(node, "height");
        if (!approxWidth || !approxHeight || approxWidth <= 0 || approxHeight <= 0) {
            stats.zeroSize += 1;
            continue;
        }
        filtered.push(node);
    }
    stats.eligible = filtered.length;
    return { nodes: filtered, stats };
}
function measureNodeDimension(node, axis) {
    const layout = node.layout || {};
    const viewport = layout.viewport || {};
    const rect = layout.rect || {};
    const nodeRect = node.rect || {};
    const styles = node.styles || {};
    const viewportValue = axis === "width" ? viewport.width : viewport.height;
    const layoutRectValue = axis === "width" ? rect.width : rect.height;
    const nodeRectValue = axis === "width" ? nodeRect.width : nodeRect.height;
    const styleValue = axis === "width" ? styles.width : styles.height;
    return (normalizeDimension(viewportValue) ??
        normalizeDimension(layoutRectValue) ??
        normalizeDimension(nodeRectValue) ??
        normalizeDimension(styleValue));
}
async function detectOcclusion(element) {
    return element
        .evaluate((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return { occluded: true, occluderIds: [] };
        }
        const samplePoints = [
            { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            { x: rect.left + rect.width * 0.15, y: rect.top + rect.height / 2 },
            { x: rect.left + rect.width * 0.85, y: rect.top + rect.height / 2 },
            { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.15 },
            { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.85 },
        ];
        const attr = "data-w2f-occluder";
        const occluderIds = new Set();
        for (const point of samplePoints) {
            const clampedX = Math.min(Math.max(point.x, 1), window.innerWidth - 1);
            const clampedY = Math.min(Math.max(point.y, 1), window.innerHeight - 1);
            const topEl = document.elementFromPoint(clampedX, clampedY);
            if (topEl && topEl !== el && !el.contains(topEl)) {
                let id = topEl.getAttribute(attr);
                if (!id) {
                    id = `w2f-${Math.random().toString(36).slice(2)}`;
                    topEl.setAttribute(attr, id);
                }
                occluderIds.add(id);
            }
        }
        return {
            occluded: occluderIds.size > 0,
            occluderIds: Array.from(occluderIds),
        };
    })
        .catch(() => ({ occluded: false, occluderIds: [] }));
}
async function temporarilyHideOccluders(page, occluderIds) {
    if (!occluderIds || occluderIds.length === 0) {
        return null;
    }
    const handles = (await Promise.all(occluderIds.map((id) => page.$(`[data-w2f-occluder="${id}"]`)))).filter(Boolean);
    if (handles.length === 0) {
        return null;
    }
    const activeHandles = [];
    const previousStates = [];
    for (const handle of handles) {
        const prev = await handle.evaluate((node) => {
            if (node === document.body || node === document.documentElement) {
                return null;
            }
            const previous = {
                visibility: node.style.visibility,
                pointerEvents: node.style.pointerEvents,
                opacity: node.style.opacity,
                display: node.style.display,
                transition: node.style.transition,
            };
            node.setAttribute("data-w2f-occluder-hidden", "true");
            node.style.setProperty("visibility", "hidden", "important");
            node.style.setProperty("pointer-events", "none", "important");
            node.style.setProperty("opacity", "0", "important");
            node.style.setProperty("transition", "none", "important");
            return previous;
        });
        if (prev) {
            activeHandles.push(handle);
            previousStates.push(prev);
        }
    }
    if (activeHandles.length === 0) {
        return null;
    }
    await page.waitForTimeout(10);
    return async () => {
        await Promise.all(activeHandles.map((handle, index) => handle.evaluate((node, prev) => {
            if (node.getAttribute("data-w2f-occluder-hidden") === "true") {
                node.removeAttribute("data-w2f-occluder-hidden");
            }
            node.style.visibility = prev.visibility || "";
            node.style.pointerEvents = prev.pointerEvents || "";
            node.style.opacity = prev.opacity || "";
            node.style.display = prev.display || "";
            node.style.transition = prev.transition || "";
        }, previousStates[index])));
    };
}
async function captureElementScreenshotBuffer(page, element, nodeId, opts) {
    let occlusionCleanup = null;
    try {
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => resolve());
        }));
    }
    catch { }
    try {
        await element.evaluate((el) => {
            el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        });
    }
    catch { }
    await page.waitForTimeout(30);
    let box = await element.boundingBox();
    if (!box) {
        return { success: false, reason: "noBoundingBox" };
    }
    if (box.width < 1 || box.height < 1) {
        return { success: false, reason: "zeroSize" };
    }
    const visible = await element
        .evaluate((el) => {
        const st = window.getComputedStyle(el);
        const hidden = st.display === "none" || st.visibility === "hidden" || st.opacity === "0";
        const zeroSized = el.getBoundingClientRect
            ? (() => {
                const rect = el.getBoundingClientRect();
                return rect.width < 1 || rect.height < 1;
            })()
            : false;
        return !(hidden || zeroSized);
    })
        .catch(() => false);
    if (!visible) {
        return { success: false, reason: "invisibleStyle" };
    }
    const occlusionInfo = await detectOcclusion(element);
    if (occlusionInfo.occluded) {
        occlusionCleanup = await temporarilyHideOccluders(page, occlusionInfo.occluderIds);
        if (!occlusionCleanup) {
            console.warn(`⚠️  Node ${nodeId} appears occluded but no removable occluder was found; capturing anyway`);
        }
        else {
            await page.waitForTimeout(20);
            box = await element.boundingBox();
            if (!box) {
                return { success: false, reason: "noBoundingBox" };
            }
        }
    }
    const padding = opts.padding ?? 2;
    try {
        const buffer = await page.screenshot({
            type: "png",
            clip: {
                x: Math.max(box.x - padding, 0),
                y: Math.max(box.y - padding, 0),
                width: box.width + padding * 2,
                height: box.height + padding * 2,
            },
            scale: opts.dpr > 1 ? "device" : "css",
        });
        return {
            success: true,
            buffer,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
    }
    catch (error) {
        console.warn(`⚠️  Screenshot capture failed for node ${nodeId}:`, error);
        return { success: false, reason: "captureFailed" };
    }
    finally {
        if (occlusionCleanup) {
            try {
                await occlusionCleanup();
            }
            catch { }
        }
    }
}
async function captureElementScreenshots(page, nodes, renderEnv) {
    const screenshots = {};
    const batchSize = 10;
    const screenshotDPR = calculateScreenshotDPR(renderEnv);
    // CRITICAL: Limit total screenshots to prevent timeout
    const MAX_SCREENSHOTS = 100; // Hard limit
    const MAX_PHASE_TIME = 120000; // 2 minutes max for Phase 3 screenshots
    const phaseStartTime = performance.now();
    const limitedNodes = nodes.slice(0, MAX_SCREENSHOTS);
    if (nodes.length > MAX_SCREENSHOTS) {
        console.log(`[Phase 3] ⚠️  Limiting screenshots from ${nodes.length} to ${MAX_SCREENSHOTS} elements`);
    }
    console.log(`[Phase 3] 📸 Capturing screenshots for ${limitedNodes.length} elements (DPR: ${screenshotDPR})`);
    let capturedCount = 0;
    let failedCount = 0;
    const skipStats = {
        selectorMissing: 0,
        noBoundingBox: 0,
        zeroSize: 0,
        invisibleStyle: 0,
        occluded: 0,
        captureFailed: 0,
    };
    const SKIP_WARN_LIMIT = 20;
    const skipMessage = (reason, nodeId) => {
        switch (reason) {
            case "selectorMissing":
                return `⚠️  Skipping screenshot for node ${nodeId}: selector did not resolve`;
            case "noBoundingBox":
                return `⚠️  Skipping screenshot for node ${nodeId}: no bounding box`;
            case "zeroSize":
                return `⚠️  Skipping screenshot for node ${nodeId}: zero-size box`;
            case "invisibleStyle":
                return `⚠️  Skipping screenshot for node ${nodeId}: invisible due to styles`;
            case "occluded":
                return `⚠️  Skipping screenshot for node ${nodeId}: occluded by overlapping element`;
            case "captureFailed":
                return `⚠️  Skipping screenshot for node ${nodeId}: capture failed`;
        }
    };
    const logSkipWarning = (reason, nodeId) => {
        skipStats[reason] += 1;
        if (skipStats[reason] <= SKIP_WARN_LIMIT) {
            console.warn(skipMessage(reason, nodeId));
            if (skipStats[reason] === SKIP_WARN_LIMIT) {
                console.warn(`[Phase 3] ⚠️  Suppressing further '${reason}' warnings (${SKIP_WARN_LIMIT}+ hits)`);
            }
        }
    };
    for (let i = 0; i < limitedNodes.length; i += batchSize) {
        // Check phase timeout
        if (performance.now() - phaseStartTime > MAX_PHASE_TIME) {
            console.log(`[Phase 3] ⏱️  Screenshot phase timeout (${MAX_PHASE_TIME}ms), captured ${capturedCount}/${limitedNodes.length}`);
            break;
        }
        const batch = limitedNodes.slice(i, i + batchSize);
        await Promise.all(batch.map(async (node) => {
            try {
                const element = await page.$(node.selector);
                if (!element) {
                    failedCount++;
                    logSkipWarning("selectorMissing", node.id);
                    return;
                }
                const captureResult = await captureElementScreenshotBuffer(page, element, node.id, { dpr: screenshotDPR, padding: 2 });
                if (!captureResult.success) {
                    failedCount++;
                    logSkipWarning(captureResult.reason, node.id);
                    await element.dispose();
                    return;
                }
                const { buffer: screenshotBuffer, box } = captureResult;
                const width = Math.round(box.width);
                const height = Math.round(box.height);
                const actualWidth = Math.round(width * screenshotDPR);
                const actualHeight = Math.round(height * screenshotDPR);
                screenshots[node.id] = {
                    src: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
                    width,
                    height,
                    dpr: screenshotDPR,
                    actualWidth,
                    actualHeight,
                };
                capturedCount++;
                await element.dispose();
            }
            catch (e) {
                failedCount++;
                console.warn(`⚠️  Screenshot failed for node ${node.id}: ${e.message}`);
                logSkipWarning("captureFailed", node.id);
            }
        }));
        if (i + batchSize < limitedNodes.length) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    const timeElapsed = ((performance.now() - phaseStartTime) / 1000).toFixed(1);
    console.log(`[Phase 3] ⏱️  Screenshot phase completed in ${timeElapsed}s`);
    if (nodes.length > MAX_SCREENSHOTS) {
        console.log(`[Phase 3] ℹ️  Skipped ${nodes.length - MAX_SCREENSHOTS} additional screenshot candidates (over limit)`);
    }
    const skippedTotal = Object.values(skipStats).reduce((sum, value) => sum + value, 0);
    if (skippedTotal > 0) {
        console.log(`[Phase 3] ⚠️  Skipped ${skippedTotal} screenshot targets (selector: ${skipStats.selectorMissing}, bbox: ${skipStats.noBoundingBox}, zero-size: ${skipStats.zeroSize}, invisible: ${skipStats.invisibleStyle}, occluded: ${skipStats.occluded}, capture failed: ${skipStats.captureFailed})`);
    }
    console.log(`[Phase 3] ✅ Captured ${capturedCount} screenshots (${failedCount} failed)`);
    return screenshots;
}
async function applyPageScreenshotFallback(nodes, pageScreenshot, screenshots) {
    if (!pageScreenshot?.src) {
        return;
    }
    const base64Index = pageScreenshot.src.indexOf("base64,");
    if (base64Index === -1) {
        return;
    }
    const base64Data = pageScreenshot.src.slice(base64Index + "base64,".length);
    if (!base64Data) {
        return;
    }
    const imageBuffer = Buffer.from(base64Data, "base64");
    const baseImage = sharp(imageBuffer);
    const metadata = await baseImage.metadata();
    const pageDpr = pageScreenshot.dpr || 1;
    const imageWidth = metadata.width ?? Math.round((pageScreenshot.width || 0) * pageDpr);
    const imageHeight = metadata.height ?? Math.round((pageScreenshot.height || 0) * pageDpr);
    if (!imageWidth || !imageHeight) {
        return;
    }
    let generated = 0;
    let skipped = 0;
    for (const node of nodes) {
        if (!node || !node.id || screenshots[node.id]) {
            continue;
        }
        const rect = node.rect || node.layout?.rect;
        if (!rect || rect.width <= 1 || rect.height <= 1) {
            skipped += 1;
            continue;
        }
        let left = Math.max(0, Math.floor((rect.x || 0) * pageDpr));
        let top = Math.max(0, Math.floor((rect.y || 0) * pageDpr));
        let width = Math.max(1, Math.round(rect.width * pageDpr));
        let height = Math.max(1, Math.round(rect.height * pageDpr));
        if (left >= imageWidth || top >= imageHeight) {
            skipped += 1;
            continue;
        }
        if (left + width > imageWidth) {
            width = imageWidth - left;
        }
        if (top + height > imageHeight) {
            height = imageHeight - top;
        }
        if (width <= 1 || height <= 1) {
            skipped += 1;
            continue;
        }
        try {
            const cropBuffer = await baseImage
                .clone()
                .extract({ left, top, width, height })
                .png()
                .toBuffer();
            screenshots[node.id] = {
                src: `data:image/png;base64,${cropBuffer.toString("base64")}`,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                dpr: pageDpr,
                actualWidth: width,
                actualHeight: height,
            };
            generated += 1;
        }
        catch (error) {
            skipped += 1;
            console.warn(`[Phase 3] ⚠️  Fallback screenshot failed for node ${node.id}: ${error.message}`);
        }
    }
    if (generated > 0) {
        console.log(`[Phase 3] 🔁 Generated ${generated} fallback screenshots from page capture (skipped ${skipped})`);
    }
}
async function captureInteractionStates(page, nodes, renderEnv) {
    const states = {};
    const screenshotDPR = calculateScreenshotDPR(renderEnv);
    for (const node of nodes) {
        try {
            const element = await page.$(node.selector);
            if (!element)
                continue;
            const nodeStates = {};
            const createEnhancedScreenshot = async (screenshotBuffer) => {
                const rect = await element.boundingBox();
                if (rect) {
                    const width = Math.round(rect.width);
                    const height = Math.round(rect.height);
                    const actualWidth = Math.round(width * screenshotDPR);
                    const actualHeight = Math.round(height * screenshotDPR);
                    return {
                        src: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
                        width,
                        height,
                        dpr: screenshotDPR,
                        actualWidth,
                        actualHeight,
                    };
                }
                return null;
            };
            try {
                await element.hover();
                await page.waitForTimeout(100);
                const hoverScreenshot = await element.screenshot({
                    type: "png",
                    omitBackground: true,
                    scale: screenshotDPR > 1 ? "device" : "css",
                });
                const enhancedHover = await createEnhancedScreenshot(hoverScreenshot);
                if (enhancedHover) {
                    nodeStates.hover = enhancedHover;
                }
            }
            catch (e) { }
            if (node.componentHint === "button" || node.componentHint === "input") {
                try {
                    await element.focus();
                    await page.waitForTimeout(100);
                    const focusScreenshot = await element.screenshot({
                        type: "png",
                        omitBackground: true,
                        scale: screenshotDPR > 1 ? "device" : "css",
                    });
                    const enhancedFocus = await createEnhancedScreenshot(focusScreenshot);
                    if (enhancedFocus) {
                        nodeStates.focus = enhancedFocus;
                    }
                }
                catch (e) { }
            }
            if (node.componentHint === "button") {
                try {
                    await element.click({ delay: 50 });
                    const activeScreenshot = await element.screenshot({
                        type: "png",
                        omitBackground: true,
                        scale: screenshotDPR > 1 ? "device" : "css",
                    });
                    const enhancedActive = await createEnhancedScreenshot(activeScreenshot);
                    if (enhancedActive) {
                        nodeStates.active = enhancedActive;
                    }
                }
                catch (e) { }
            }
            if (Object.keys(nodeStates).length > 0) {
                states[node.id] = nodeStates;
            }
        }
        catch (e) {
            // Failed to capture states
        }
    }
    return states;
}
// ==================== AUTO SCROLL ====================
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    setTimeout(() => resolve(), 500);
                }
            }, 100);
        });
    });
}
// ==================== SEMANTIC NAMING ====================
function applySemanticNaming(nodes) {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const toCamelCase = (str) => {
        return str
            .toLowerCase()
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
            .replace(/[\s\-_\.]+/g, "");
    };
    const sanitizeName = (name) => {
        return name
            .replace(/[^a-zA-Z0-9]/g, "")
            .replace(/^\d+/, "")
            .slice(0, 50);
    };
    const componentPatterns = {
        button: /btn|button|click|submit|action/i,
        input: /input|field|text|search|email|password/i,
        card: /card|item|tile|block|panel/i,
        modal: /modal|dialog|popup|overlay/i,
        nav: /nav|menu|breadcrumb|tab/i,
        header: /head|banner|top|title/i,
        footer: /foot|bottom|copyright/i,
        sidebar: /side|aside|secondary/i,
        content: /content|main|body|article/i,
        list: /list|grid|items|collection/i,
        form: /form|signup|login|register/i,
        media: /img|image|photo|video|media/i,
    };
    const generateSemanticName = (node) => {
        const parts = [];
        if (node.ariaLabel) {
            return toCamelCase(sanitizeName(node.ariaLabel));
        }
        if (node.domId && !node.domId.match(/^[a-f0-9\-]{8,}$/)) {
            return toCamelCase(sanitizeName(node.domId));
        }
        if (node.classList) {
            const meaningfulClasses = node.classList.filter((cls) => cls.length > 2 &&
                !cls.match(/^(mt|mb|ml|mr|p|px|py|m|mx|my|w|h|bg|text|flex|grid|col|row|sm|md|lg|xl|btn|card|form)-?\d*$/) &&
                !cls.match(/^(active|hover|focus|disabled|selected|open|closed|visible|hidden)$/));
            if (meaningfulClasses.length > 0) {
                parts.push(meaningfulClasses[0]);
            }
        }
        if (node.dataAttributes) {
            for (const [attr, value] of Object.entries(node.dataAttributes)) {
                if (attr === "data-testid" ||
                    attr === "data-component" ||
                    attr === "data-name") {
                    return toCamelCase(sanitizeName(value));
                }
            }
        }
        if (node.text && node.text.length < 30) {
            const text = node.text.toLowerCase();
            for (const [type, pattern] of Object.entries(componentPatterns)) {
                if (pattern.test(text)) {
                    parts.push(type);
                    break;
                }
            }
        }
        if (node.componentHint) {
            parts.push(node.componentHint);
        }
        if (node.role) {
            parts.push(node.role);
        }
        if (parts.length === 0) {
            const tag = node.tag?.toLowerCase() || "element";
            switch (tag) {
                case "div":
                case "section":
                    parts.push("container");
                    break;
                case "span":
                case "p":
                    parts.push("text");
                    break;
                case "img":
                    parts.push("image");
                    break;
                case "a":
                    parts.push("link");
                    break;
                case "ul":
                case "ol":
                    parts.push("list");
                    break;
                case "li":
                    parts.push("listItem");
                    break;
                default:
                    parts.push(tag);
            }
        }
        if (node.type === "IMAGE") {
            parts.push("Image");
        }
        else if (node.type === "SVG") {
            parts.push("Icon");
        }
        let baseName = parts.filter(Boolean).join(" ");
        if (!baseName || baseName.length < 2) {
            baseName = (node.tag || "element") + " element";
        }
        return toCamelCase(sanitizeName(baseName));
    };
    const nameRegistry = new Map();
    return nodes.map((node) => {
        let baseName = generateSemanticName(node);
        if (nameRegistry.has(baseName)) {
            const count = nameRegistry.get(baseName) + 1;
            nameRegistry.set(baseName, count);
            baseName = `${baseName}${count}`;
        }
        else {
            nameRegistry.set(baseName, 1);
        }
        if (baseName.length < 3) {
            baseName = `${node.tag || "element"}Element${nameRegistry.get("element") || 1}`;
            nameRegistry.set("element", (nameRegistry.get("element") || 0) + 1);
        }
        return {
            ...node,
            name: baseName,
        };
    });
}
// ==================== MAIN EXTRACTION FUNCTION ====================
export async function extractComplete(url, options = {}) {
    const { captureFonts = true, captureScreenshots = false, // Default: DISABLED to prevent timeout (was true)
    screenshotComplexOnly = true, captureStates = false, capturePseudoElements = true, extractSVG = true, viewport = { width: 1440, height: 900 }, capturePhase0Screenshots = false, // Default: disabled to prevent hanging
     } = options;
    console.log("Starting extraction with options:", options);
    console.log(`🚀 Extracting: ${url}`);
    const OVERALL_TIMEOUT = 10 * 60 * 1000; // 10 minutes max
    const startTime = Date.now();
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-web-security",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });
    // Overall timeout wrapper - use abort flag instead of force-closing browser
    let isAborted = false;
    const extractionTimeout = setTimeout(() => {
        console.error('❌ EXTRACTION TIMEOUT: Exceeded 10 minutes, setting abort flag...');
        isAborted = true;
    }, OVERALL_TIMEOUT);
    try {
        const context = await browser.newContext({
            viewport,
            deviceScaleFactor: 2,
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        });
        const page = await context.newPage();
        // Ensure helper injected before any scripts run (TS emits __name helper references)
        await page.addInitScript(() => {
            const global = window;
            if (!global.__name) {
                global.__name = (target) => target;
            }
        });
        // Navigate and wait for full load
        console.log("[Phase 0] 🌐 Navigating to URL...");
        await page.goto(url, {
            waitUntil: "load",
            timeout: 60000,
        });
        console.log("[Phase 0] ✅ Page loaded");
        // ✅ PHASE 1: Wait for fully loaded (fonts, images, lazy content)
        console.log("[Phase 1] ⏳ Waiting for page to fully load...");
        let loadInfo;
        try {
            loadInfo = await waitForFullyLoaded(page);
            console.log(`[Phase 1] ✅ Loaded in ${loadInfo.stats.totalWaitMs}ms`);
        }
        catch (error) {
            console.error("❌ waitForFullyLoaded() failed, continuing:", error);
            loadInfo = {
                timestamps: {
                    documentReady: 0,
                    fontsReady: 0,
                    imagesReady: 0,
                    lazyContentReady: 0,
                    domStabilized: 0,
                    extractionStart: Date.now(),
                },
                stats: {
                    totalWaitMs: 0,
                    fontsLoaded: 0,
                    fontsFailed: 0,
                    failedFonts: [],
                    imagesLoaded: 0,
                    imagesBlocked: 0,
                    imagesFailed: 0,
                    lazyElementsActivated: 0,
                    domStable: false,
                    timedOut: true,
                },
                errors: [{ phase: "waitForFullyLoaded", message: `${error}` }],
            };
        }
        // ✅ PHASE 2: Capture rendering environment
        console.log("[Phase 2] 📐 Capturing render environment...");
        let renderEnv;
        try {
            renderEnv = await captureRenderEnvironment(page);
            console.log(`[Phase 2] ✅ DPR: ${renderEnv.device.devicePixelRatio}`);
        }
        catch (error) {
            console.error("❌ captureRenderEnvironment() failed, using fallback:", error);
            renderEnv = {
                viewport: {
                    innerWidth: viewport.width,
                    innerHeight: viewport.height,
                    outerWidth: viewport.width,
                    outerHeight: viewport.height,
                    clientWidth: viewport.width,
                    clientHeight: viewport.height,
                    scrollWidth: viewport.width,
                    scrollHeight: viewport.height,
                },
                scroll: { x: 0, y: 0 },
                device: {
                    devicePixelRatio: 1,
                    screenWidth: viewport.width,
                    screenHeight: viewport.height,
                    zoomLevel: 1,
                    colorGamut: "srgb",
                    colorScheme: "light",
                    reducedMotion: false,
                },
                browser: {
                    userAgent: "",
                    platform: "",
                    language: "",
                    cores: 0,
                    touchPoints: 0,
                },
                capturedAt: new Date().toISOString(),
                unsupportedAPIs: ["captureRenderEnvironment failed"],
            };
        }
        // Scroll to load lazy content before freezing the layout
        await autoScroll(page);
        await applyRenderingStabilityLayer(page);
        // ✅ PHASE 0.5: Screenshot everything first (Builder.io approach)
        console.log("[Phase 0.5] 📸 Screenshot-everything-first...");
        const capturePhase0Screenshots = options.capturePhase0Screenshots ?? false;
        const enablePageScreenshot = true; // Capture full page screenshot for fallback generation
        let primaryScreenshots;
        try {
            primaryScreenshots = await screenshotEverything(page, renderEnv, capturePhase0Screenshots, enablePageScreenshot);
            console.log(`[Phase 0.5] ✅ ${primaryScreenshots.elementCount} elements screenshotted`);
        }
        catch (error) {
            console.error(`❌ [Phase 0.5] screenshotEverything() failed, continuing without screenshots:`, error);
            // Create fallback with no screenshots
            primaryScreenshots = {
                page: {
                    src: '',
                    width: viewport.width,
                    height: viewport.height,
                    dpr: 1,
                    hash: '',
                },
                elementCount: 0,
            };
        }
        // Extract fonts
        let fonts = [];
        let fontAssets = [];
        if (captureFonts) {
            console.log("Extracting fonts...");
            fonts = await extractFonts(page, url);
            console.log(`Extracted ${fonts.length} fonts (legacy)`);
            // Extract enhanced font assets
            fontAssets = await extractFontsAsIRAssets(page, url);
            console.log(`✅ Extracted ${fontAssets.length} IRFontAsset objects`);
        }
        // PHASES 3-5: Extract DOM
        console.log("[Phases 3-5] 🔍 Extracting DOM...");
        // ✅ FIX: Add timeout protection to prevent infinite hangs
        const DOM_EXTRACTION_TIMEOUT = 120000; // 2 minutes max for DOM extraction
        let data;
        try {
            data = await Promise.race([
                page.evaluate((opts) => {
                    // ==================== HELPER FUNCTIONS ====================
                    console.log('[DOM Extraction] Starting DOM walk...');
                    const startTime = Date.now();
                    const generateId = () => {
                        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    };
                    // Helper function to generate element selectors
                    function generateElementSelector(element) {
                        if (element.id) {
                            return `#${element.id}`;
                        }
                        if (element.className) {
                            const classes = element.className.toString().trim().split(/\s+/).slice(0, 2);
                            return `.${classes.join('.')}`;
                        }
                        const tagName = element.tagName.toLowerCase();
                        const parent = element.parentElement;
                        if (parent) {
                            const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
                            const index = siblings.indexOf(element);
                            return `${tagName}:nth-of-type(${index + 1})`;
                        }
                        return tagName;
                    }
                    /**
                     * Detect if an element creates a stacking context according to CSS specifications
                     */
                    const detectStackingContext = (element, computedStyle) => {
                        try {
                            if (element === document.documentElement) {
                                return true;
                            }
                            const position = computedStyle.position;
                            if (position === "fixed" || position === "sticky") {
                                return true;
                            }
                            const zIndex = computedStyle.zIndex;
                            if ((position === "absolute" || position === "relative") &&
                                zIndex !== "auto") {
                                return true;
                            }
                            if (zIndex !== "auto" && element.parentElement) {
                                try {
                                    const parentStyle = getComputedStyle(element.parentElement);
                                    const parentDisplay = parentStyle.display;
                                    if (parentDisplay === "flex" ||
                                        parentDisplay === "inline-flex" ||
                                        parentDisplay === "grid" ||
                                        parentDisplay === "inline-grid") {
                                        return true;
                                    }
                                }
                                catch (error) {
                                    // Parent style access failed
                                }
                            }
                            const opacity = parseFloat(computedStyle.opacity);
                            if (!isNaN(opacity) && opacity < 1) {
                                return true;
                            }
                            const transform = computedStyle.transform;
                            if (transform && transform !== "none") {
                                return true;
                            }
                            const filter = computedStyle.filter;
                            if (filter && filter !== "none") {
                                return true;
                            }
                            const clipPath = computedStyle.clipPath;
                            if (clipPath && clipPath !== "none") {
                                return true;
                            }
                            const mask = computedStyle.mask;
                            const maskImage = computedStyle.maskImage;
                            if ((mask && mask !== "none") ||
                                (maskImage && maskImage !== "none")) {
                                return true;
                            }
                            const mixBlendMode = computedStyle.mixBlendMode;
                            if (mixBlendMode && mixBlendMode !== "normal") {
                                return true;
                            }
                            const isolation = computedStyle.isolation;
                            if (isolation === "isolate") {
                                return true;
                            }
                            const willChange = computedStyle.willChange;
                            if (willChange && willChange !== "auto") {
                                const willChangeValues = willChange.split(",").map((v) => v.trim());
                                if (willChangeValues.includes("transform") ||
                                    willChangeValues.includes("opacity") ||
                                    willChangeValues.includes("filter")) {
                                    return true;
                                }
                            }
                            const contain = computedStyle.contain;
                            if (contain && contain !== "none") {
                                const containValues = contain.split(" ").map((v) => v.trim());
                                if (containValues.includes("layout") ||
                                    containValues.includes("paint") ||
                                    containValues.includes("strict")) {
                                    return true;
                                }
                            }
                            const backdropFilter = computedStyle.backdropFilter;
                            if (backdropFilter && backdropFilter !== "none") {
                                return true;
                            }
                            const perspective = computedStyle.perspective;
                            if (perspective && perspective !== "none") {
                                return true;
                            }
                            const columnCount = computedStyle.columnCount;
                            const columnWidth = computedStyle.columnWidth;
                            if ((columnCount && columnCount !== "auto") ||
                                (columnWidth && columnWidth !== "auto")) {
                                return true;
                            }
                            return false;
                        }
                        catch (error) {
                            return false;
                        }
                    };
                    /**
                     * Capture comprehensive compositing properties for paint order analysis
                     */
                    const captureCompositingProperties = (element, computedStyle) => {
                        try {
                            const zIndexValue = computedStyle.zIndex;
                            let zIndex = "auto";
                            if (zIndexValue && zIndexValue !== "auto") {
                                const parsed = parseInt(zIndexValue, 10);
                                if (!isNaN(parsed)) {
                                    zIndex = parsed;
                                }
                            }
                            let opacity = 1;
                            try {
                                const opacityValue = parseFloat(computedStyle.opacity);
                                if (!isNaN(opacityValue)) {
                                    opacity = Math.max(0, Math.min(1, opacityValue));
                                }
                            }
                            catch (error) {
                                // Keep default
                            }
                            const transform = computedStyle.transform || "none";
                            let transformOrigin;
                            if (transform !== "none") {
                                try {
                                    transformOrigin = computedStyle.transformOrigin || "50% 50%";
                                }
                                catch (error) {
                                    // Failed
                                }
                            }
                            const perspective = computedStyle.perspective || "none";
                            let perspectiveOrigin;
                            if (perspective !== "none") {
                                try {
                                    perspectiveOrigin = computedStyle.perspectiveOrigin || "50% 50%";
                                }
                                catch (error) {
                                    // Failed
                                }
                            }
                            const stackingContext = isStackingContext(element, computedStyle);
                            const properties = {
                                zIndex,
                                position: computedStyle.position || "static",
                                opacity,
                                transform,
                                filter: computedStyle.filter || "none",
                                clipPath: computedStyle.clipPath || "none",
                                mask: computedStyle.mask || "none",
                                mixBlendMode: computedStyle.mixBlendMode || "normal",
                                backgroundBlendMode: computedStyle.backgroundBlendMode || "normal",
                                backdropFilter: computedStyle.backdropFilter || "none",
                                isolation: computedStyle.isolation || "auto",
                                willChange: computedStyle.willChange || "auto",
                                contain: computedStyle.contain || "none",
                                perspective,
                                stackingContext,
                            };
                            if (transformOrigin) {
                                properties.transformOrigin = transformOrigin;
                            }
                            if (perspectiveOrigin) {
                                properties.perspectiveOrigin = perspectiveOrigin;
                            }
                            return properties;
                        }
                        catch (error) {
                            return {
                                zIndex: "auto",
                                position: "static",
                                opacity: 1,
                                transform: "none",
                                filter: "none",
                                clipPath: "none",
                                mask: "none",
                                mixBlendMode: "normal",
                                backgroundBlendMode: "normal",
                                backdropFilter: "none",
                                isolation: "auto",
                                willChange: "auto",
                                contain: "none",
                                perspective: "none",
                                stackingContext: false,
                            };
                        }
                    };
                    /**
                     * Capture comprehensive layout geometry data for an element
                     */
                    const captureLayoutGeometry = (element, renderEnv) => {
                        const roundToTwo = (num) => Math.round(num * 100) / 100;
                        try {
                            let bbox;
                            try {
                                bbox = element.getBoundingClientRect();
                            }
                            catch (error) {
                                return {
                                    viewport: {
                                        x: 0,
                                        y: 0,
                                        width: 0,
                                        height: 0,
                                        top: 0,
                                        right: 0,
                                        bottom: 0,
                                        left: 0,
                                    },
                                    document: { x: 0, y: 0 },
                                    client: { width: 0, height: 0, top: 0, left: 0 },
                                    offset: { width: 0, height: 0, top: 0, left: 0, parentId: null },
                                    scroll: {
                                        width: 0,
                                        height: 0,
                                        top: 0,
                                        left: 0,
                                        isScrollable: false,
                                    },
                                    transform: { matrix: "none", hasTransform: false },
                                    position: {
                                        type: "static",
                                        isFixed: false,
                                        isSticky: false,
                                        isAbsolute: false,
                                    },
                                    visibility: {
                                        display: "none",
                                        visibility: "hidden",
                                        opacity: 0,
                                        isHidden: true,
                                    },
                                    error: `getBoundingClientRect failed: ${error}`,
                                };
                            }
                            const docX = roundToTwo(bbox.x + renderEnv.scroll.x);
                            const docY = roundToTwo(bbox.y + renderEnv.scroll.y);
                            const computedStyle = getComputedStyle(element);
                            const htmlElement = element;
                            const clientWidth = htmlElement.clientWidth || 0;
                            const clientHeight = htmlElement.clientHeight || 0;
                            const clientTop = htmlElement.clientTop || 0;
                            const clientLeft = htmlElement.clientLeft || 0;
                            const offsetWidth = htmlElement.offsetWidth || 0;
                            const offsetHeight = htmlElement.offsetHeight || 0;
                            const offsetTop = htmlElement.offsetTop || 0;
                            const offsetLeft = htmlElement.offsetLeft || 0;
                            const offsetParentId = htmlElement.offsetParent?.id || null;
                            const scrollWidth = htmlElement.scrollWidth || 0;
                            const scrollHeight = htmlElement.scrollHeight || 0;
                            const scrollTop = htmlElement.scrollTop || 0;
                            const scrollLeft = htmlElement.scrollLeft || 0;
                            const isScrollable = scrollHeight > clientHeight || scrollWidth > clientWidth;
                            const transform = computedStyle.transform;
                            const hasTransform = transform && transform !== "none";
                            const position = computedStyle.position;
                            const isFixed = position === "fixed";
                            const isSticky = position === "sticky";
                            const isAbsolute = position === "absolute";
                            const display = computedStyle.display;
                            const visibility = computedStyle.visibility;
                            const opacity = parseFloat(computedStyle.opacity) || 1;
                            const isHidden = display === "none" || visibility === "hidden" || opacity === 0;
                            const layout = {
                                viewport: {
                                    x: roundToTwo(bbox.x),
                                    y: roundToTwo(bbox.y),
                                    width: roundToTwo(bbox.width),
                                    height: roundToTwo(bbox.height),
                                    top: roundToTwo(bbox.top),
                                    right: roundToTwo(bbox.right),
                                    bottom: roundToTwo(bbox.bottom),
                                    left: roundToTwo(bbox.left),
                                },
                                document: {
                                    x: docX,
                                    y: docY,
                                },
                                client: {
                                    width: clientWidth,
                                    height: clientHeight,
                                    top: clientTop,
                                    left: clientLeft,
                                },
                                offset: {
                                    width: offsetWidth,
                                    height: offsetHeight,
                                    top: offsetTop,
                                    left: offsetLeft,
                                    parentId: offsetParentId,
                                },
                                scroll: {
                                    width: scrollWidth,
                                    height: scrollHeight,
                                    top: scrollTop,
                                    left: scrollLeft,
                                    isScrollable,
                                },
                                transform: {
                                    matrix: transform || "none",
                                    hasTransform: !!hasTransform,
                                },
                                position: {
                                    type: position,
                                    isFixed,
                                    isSticky,
                                    isAbsolute,
                                },
                                visibility: {
                                    display,
                                    visibility,
                                    opacity,
                                    isHidden,
                                },
                            };
                            if (element instanceof SVGElement) {
                                try {
                                    const svgElement = element;
                                    if (typeof svgElement.getBBox === "function") {
                                        const svgBbox = svgElement.getBBox();
                                        layout.svg = {
                                            x: roundToTwo(svgBbox.x),
                                            y: roundToTwo(svgBbox.y),
                                            width: roundToTwo(svgBbox.width),
                                            height: roundToTwo(svgBbox.height),
                                        };
                                    }
                                }
                                catch (error) {
                                    layout.svg = {
                                        x: 0,
                                        y: 0,
                                        width: 0,
                                        height: 0,
                                        error: `getBBox failed: ${error}`,
                                    };
                                }
                            }
                            if (element.tagName === "IFRAME") {
                                try {
                                    const iframeElement = element;
                                    let crossOrigin = false;
                                    let accessible = false;
                                    try {
                                        const iframeSrc = iframeElement.src;
                                        if (iframeSrc) {
                                            try {
                                                if (iframeSrc.startsWith("data:") ||
                                                    iframeSrc.startsWith("blob:") ||
                                                    iframeSrc === "about:blank" ||
                                                    iframeSrc === "") {
                                                    crossOrigin = false;
                                                }
                                                else if (iframeSrc.startsWith("file:")) {
                                                    crossOrigin =
                                                        !window.location.protocol.startsWith("file:");
                                                }
                                                else {
                                                    const srcUrl = new URL(iframeSrc, window.location.href);
                                                    const currentOrigin = new URL(window.location.href)
                                                        .origin;
                                                    crossOrigin = srcUrl.origin !== currentOrigin;
                                                }
                                            }
                                            catch (urlError) {
                                                crossOrigin =
                                                    iframeSrc.startsWith("http") &&
                                                        !iframeSrc.startsWith(window.location.origin);
                                            }
                                        }
                                        try {
                                            const contentWindow = iframeElement.contentWindow;
                                            const contentDocument = iframeElement.contentDocument;
                                            if (contentWindow && !crossOrigin) {
                                                accessible = true;
                                                try {
                                                    const testAccess = contentWindow.location.href;
                                                    accessible = true;
                                                }
                                                catch (accessError) {
                                                    accessible = false;
                                                    crossOrigin = true;
                                                }
                                            }
                                            else if (crossOrigin) {
                                                accessible = false;
                                                try {
                                                    if (contentWindow) {
                                                        const testAccess = contentWindow.location.href;
                                                        crossOrigin = false;
                                                        accessible = true;
                                                    }
                                                }
                                                catch (accessError) {
                                                    accessible = false;
                                                }
                                            }
                                            else {
                                                accessible = !!(contentDocument || contentWindow);
                                            }
                                        }
                                        catch (error) {
                                            accessible = false;
                                        }
                                    }
                                    catch (error) {
                                        crossOrigin = true;
                                        accessible = false;
                                    }
                                    layout.iframe = {
                                        crossOrigin,
                                        accessible,
                                    };
                                }
                                catch (error) {
                                    layout.iframe = {
                                        crossOrigin: true,
                                        accessible: false,
                                    };
                                }
                            }
                            if (htmlElement.shadowRoot) {
                                try {
                                    const shadowRoot = htmlElement.shadowRoot;
                                    layout.shadow = {
                                        hasHostShadow: true,
                                        shadowRootMode: shadowRoot.mode,
                                        childrenCount: shadowRoot.children.length,
                                    };
                                }
                                catch (error) {
                                    layout.shadow = {
                                        hasHostShadow: true,
                                        shadowRootMode: "closed",
                                        childrenCount: 0,
                                    };
                                }
                            }
                            return layout;
                        }
                        catch (error) {
                            return {
                                viewport: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                },
                                document: { x: 0, y: 0 },
                                client: { width: 0, height: 0, top: 0, left: 0 },
                                offset: { width: 0, height: 0, top: 0, left: 0, parentId: null },
                                scroll: {
                                    width: 0,
                                    height: 0,
                                    top: 0,
                                    left: 0,
                                    isScrollable: false,
                                },
                                transform: { matrix: "none", hasTransform: false },
                                position: {
                                    type: "static",
                                    isFixed: false,
                                    isSticky: false,
                                    isAbsolute: false,
                                },
                                visibility: {
                                    display: "none",
                                    visibility: "hidden",
                                    opacity: 0,
                                    isHidden: true,
                                },
                                error: `Layout capture failed: ${error}`,
                            };
                        }
                    };
                    /**
                     * Typography value extraction with fallbacks
                     */
                    const getTypographyValue = (styles, property, fallback = "") => {
                        try {
                            const value = styles.getPropertyValue(property) || styles[property];
                            return value || fallback;
                        }
                        catch (error) {
                            return fallback;
                        }
                    };
                    /**
                     * Detect typography capabilities (cached)
                     */
                    let typographyCapabilitiesCache = null;
                    const detectTypographyCapabilities = () => {
                        if (typographyCapabilitiesCache) {
                            return typographyCapabilitiesCache;
                        }
                        const testElement = document.createElement("div");
                        testElement.style.position = "absolute";
                        testElement.style.visibility = "hidden";
                        testElement.style.pointerEvents = "none";
                        document.body.appendChild(testElement);
                        const capabilities = {
                            supportsTextWrap: false,
                            supportsTextWrapMode: false,
                            supportsFontFeatureSettings: false,
                            supportsTextDecorationThickness: false,
                            supportsTextUnderlineOffset: false,
                            supportsWebkitFontSmoothing: false,
                        };
                        try {
                            testElement.style.textWrap = "wrap";
                            capabilities.supportsTextWrap = testElement.style.textWrap === "wrap";
                            testElement.style.textWrapMode = "wrap";
                            capabilities.supportsTextWrapMode =
                                testElement.style.textWrapMode === "wrap";
                            testElement.style.fontFeatureSettings = '"kern" 1';
                            capabilities.supportsFontFeatureSettings =
                                testElement.style.fontFeatureSettings.includes("kern");
                            testElement.style.textDecorationThickness = "auto";
                            capabilities.supportsTextDecorationThickness = !!testElement.style.textDecorationThickness;
                            testElement.style.textUnderlineOffset = "auto";
                            capabilities.supportsTextUnderlineOffset = !!testElement.style.textUnderlineOffset;
                            testElement.style.webkitFontSmoothing = "antialiased";
                            capabilities.supportsWebkitFontSmoothing = !!testElement.style.webkitFontSmoothing;
                        }
                        catch (error) {
                            // Keep defaults
                        }
                        document.body.removeChild(testElement);
                        typographyCapabilitiesCache = capabilities;
                        return capabilities;
                    };
                    /**
                     * Calculate precise line count
                     */
                    const calculatePreciseLineCount = (element, styles) => {
                        try {
                            const rect = element.getBoundingClientRect();
                            const lineHeightValue = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.2;
                            const basicEstimate = rect.height > 0
                                ? Math.max(1, Math.ceil(rect.height / lineHeightValue))
                                : 1;
                            if (typeof Range !== "undefined" &&
                                element.textContent &&
                                element.textContent.trim()) {
                                try {
                                    const range = document.createRange();
                                    range.selectNodeContents(element);
                                    const rangeRect = range.getBoundingClientRect();
                                    if (rangeRect.height > 0) {
                                        const preciseLines = Math.ceil(rangeRect.height / lineHeightValue);
                                        return Math.max(1, preciseLines);
                                    }
                                }
                                catch (rangeError) {
                                    // Fallback
                                }
                            }
                            return basicEstimate;
                        }
                        catch (error) {
                            return 1;
                        }
                    };
                    /**
                     * Detect gradient text
                     */
                    const detectGradientText = (styles) => {
                        try {
                            const backgroundImage = styles.backgroundImage;
                            const webkitBackgroundClip = styles.webkitBackgroundClip;
                            if (backgroundImage &&
                                backgroundImage !== "none" &&
                                webkitBackgroundClip === "text") {
                                return {
                                    isGradient: true,
                                    gradientData: {
                                        gradient: backgroundImage,
                                        clip: true,
                                    },
                                };
                            }
                            return { isGradient: false };
                        }
                        catch (error) {
                            return { isGradient: false };
                        }
                    };
                    /**
                     * Detect text directions (RTL, vertical)
                     */
                    const detectTextDirections = (styles) => {
                        try {
                            const direction = styles.direction;
                            const writingMode = styles.writingMode;
                            const isRTL = direction === "rtl";
                            const isVertical = writingMode === "vertical-rl" ||
                                writingMode === "vertical-lr" ||
                                writingMode === "tb-rl" ||
                                writingMode === "tb-lr";
                            return { isRTL, isVertical };
                        }
                        catch (error) {
                            return { isRTL: false, isVertical: false };
                        }
                    };
                    /**
                     * Extract browser-accurate text metrics using Range + canvas measurements
                     */
                    const extractTextMetrics = (el) => {
                        try {
                            const computedStyle = window.getComputedStyle(el);
                            const text = el.textContent || el.innerText || '';
                            if (!text.trim()) {
                                return null;
                            }
                            // Basic measurements from computed style
                            const fontSize = parseFloat(computedStyle.fontSize) || 16;
                            const fontFamily = computedStyle.fontFamily || 'sans-serif';
                            const fontWeight = computedStyle.fontWeight || '400';
                            const fontStyle = computedStyle.fontStyle || 'normal';
                            const lineHeightValue = computedStyle.lineHeight;
                            // Calculate actual line height in pixels
                            let lineHeightPx = fontSize * 1.2; // Default line-height
                            if (lineHeightValue && lineHeightValue !== 'normal') {
                                if (lineHeightValue.endsWith('px')) {
                                    lineHeightPx = parseFloat(lineHeightValue);
                                }
                                else if (!isNaN(parseFloat(lineHeightValue))) {
                                    lineHeightPx = fontSize * parseFloat(lineHeightValue);
                                }
                            }
                            // Get line boxes using Range API
                            const lineBoxes = [];
                            try {
                                const range = document.createRange();
                                const textNodes = Array.from(el.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
                                if (textNodes.length > 0) {
                                    // For each text node, measure line boxes
                                    textNodes.forEach(textNode => {
                                        const textContent = textNode.textContent || '';
                                        const words = textContent.split(/\s+/).filter(word => word.length > 0);
                                        let currentOffset = 0;
                                        for (const word of words) {
                                            const wordStart = textContent.indexOf(word, currentOffset);
                                            const wordEnd = wordStart + word.length;
                                            try {
                                                range.setStart(textNode, wordStart);
                                                range.setEnd(textNode, wordEnd);
                                                const rects = range.getClientRects();
                                                for (let i = 0; i < rects.length; i++) {
                                                    const rect = rects[i];
                                                    if (rect.width > 0 && rect.height > 0) {
                                                        lineBoxes.push({
                                                            x: Math.round(rect.left),
                                                            y: Math.round(rect.top),
                                                            width: Math.round(rect.width),
                                                            height: Math.round(rect.height)
                                                        });
                                                    }
                                                }
                                            }
                                            catch (e) {
                                                // Range creation failed, continue
                                            }
                                            currentOffset = wordEnd;
                                        }
                                    });
                                    // If no line boxes found, create one from element bounds
                                    if (lineBoxes.length === 0) {
                                        const elementRect = el.getBoundingClientRect();
                                        lineBoxes.push({
                                            x: Math.round(elementRect.left),
                                            y: Math.round(elementRect.top),
                                            width: Math.round(elementRect.width),
                                            height: Math.round(elementRect.height)
                                        });
                                    }
                                }
                                else {
                                    // Fallback: use element bounds for inline text
                                    const elementRect = el.getBoundingClientRect();
                                    lineBoxes.push({
                                        x: Math.round(elementRect.left),
                                        y: Math.round(elementRect.top),
                                        width: Math.round(elementRect.width),
                                        height: Math.round(elementRect.height)
                                    });
                                }
                            }
                            catch (e) {
                                // Range API failed, use element bounds
                                const elementRect = el.getBoundingClientRect();
                                lineBoxes.push({
                                    x: Math.round(elementRect.left),
                                    y: Math.round(elementRect.top),
                                    width: Math.round(elementRect.width),
                                    height: Math.round(elementRect.height)
                                });
                            }
                            // Use canvas to measure text metrics for ascent/descent/baseline
                            let ascent = fontSize * 0.8; // Fallback values
                            let descent = fontSize * 0.2;
                            let baseline = fontSize * 0.8;
                            try {
                                // Create temporary canvas for text measurements
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    // Set font properties to match element
                                    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                                    // Measure text metrics
                                    const metrics = ctx.measureText(text.substring(0, 50)); // Sample text for metrics
                                    if (metrics.actualBoundingBoxAscent !== undefined) {
                                        ascent = metrics.actualBoundingBoxAscent;
                                    }
                                    if (metrics.actualBoundingBoxDescent !== undefined) {
                                        descent = metrics.actualBoundingBoxDescent;
                                    }
                                    if (metrics.fontBoundingBoxAscent !== undefined) {
                                        baseline = metrics.fontBoundingBoxAscent;
                                    }
                                }
                                // Clean up canvas
                                canvas.remove();
                            }
                            catch (e) {
                                // Canvas measurement failed, use calculated values
                                ascent = fontSize * 0.8;
                                descent = fontSize * 0.2;
                                baseline = fontSize * 0.8;
                            }
                            // Extract text layout properties
                            const align = computedStyle.textAlign || 'left';
                            const whitespace = computedStyle.whiteSpace || 'normal';
                            const wordBreak = computedStyle.wordBreak || 'normal';
                            const overflowWrap = computedStyle.overflowWrap || 'normal';
                            // Determine wrap mode
                            let wrapMode = 'normal';
                            if (whitespace === 'nowrap') {
                                wrapMode = 'nowrap';
                            }
                            else if (wordBreak === 'break-all') {
                                wrapMode = 'break-all';
                            }
                            else if (overflowWrap === 'break-word') {
                                wrapMode = 'break-word';
                            }
                            return {
                                // New metrics as specified in prompt
                                lineBoxes: lineBoxes,
                                baseline: Math.round(baseline),
                                ascent: Math.round(ascent),
                                descent: Math.round(descent),
                                lineHeightPx: Math.round(lineHeightPx),
                                align: align,
                                whitespace: whitespace,
                                wrapMode: wrapMode,
                                // Legacy compatibility properties
                                font: {
                                    family: fontFamily,
                                    familyResolved: fontFamily,
                                    size: fontSize,
                                    weight: fontWeight,
                                    style: fontStyle,
                                    variant: computedStyle.fontVariant || 'normal',
                                    synthesis: 'auto',
                                    kerning: 'auto',
                                    featureSettings: 'normal'
                                },
                                spacing: {
                                    lineHeight: lineHeightPx,
                                    letterSpacing: parseFloat(computedStyle.letterSpacing) || 0,
                                    wordSpacing: parseFloat(computedStyle.wordSpacing) || 0,
                                    textIndent: parseFloat(computedStyle.textIndent) || 0
                                },
                                layout: {
                                    align: align,
                                    verticalAlign: computedStyle.verticalAlign || 'baseline',
                                    whiteSpace: whitespace,
                                    wordBreak: wordBreak,
                                    overflowWrap: overflowWrap,
                                    direction: (computedStyle.direction || 'ltr'),
                                    writingMode: computedStyle.writingMode || 'horizontal-tb',
                                    textOrientation: computedStyle.textOrientation || 'mixed'
                                },
                                effects: {
                                    color: computedStyle.color || '#000000',
                                    transform: computedStyle.textTransform || 'none',
                                    decoration: {
                                        line: computedStyle.textDecorationLine || 'none',
                                        style: computedStyle.textDecorationStyle || 'solid',
                                        color: computedStyle.textDecorationColor || 'currentcolor',
                                        thickness: computedStyle.textDecorationThickness || 'auto'
                                    }
                                }
                            };
                        }
                        catch (error) {
                            console.warn('Failed to extract text metrics:', error);
                            return null;
                        }
                    };
                    /**
                     * Capture input element state
                     */
                    const captureInputState = (element) => {
                        try {
                            if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
                                const inputElement = element;
                                return {
                                    placeholder: inputElement.placeholder || undefined,
                                    value: inputElement.value || undefined,
                                    type: element.type || "text",
                                    readonly: inputElement.readOnly,
                                    disabled: inputElement.disabled,
                                };
                            }
                            return undefined;
                        }
                        catch (error) {
                            return undefined;
                        }
                    };
                    /**
                     * Extract text content from element
                     */
                    const extractTextContent = (element) => {
                        try {
                            const htmlElement = element;
                            let extractedText = "";
                            const textContent = element.textContent?.trim() || "";
                            if (textContent) {
                                extractedText = textContent;
                            }
                            if (element.tagName === "INPUT") {
                                const inputElement = element;
                                const value = inputElement.value?.trim();
                                const placeholder = inputElement.placeholder?.trim();
                                if (value) {
                                    extractedText = value;
                                }
                                else if (placeholder) {
                                    extractedText = `[placeholder: ${placeholder}]`;
                                }
                            }
                            if (element.tagName === "TEXTAREA") {
                                const textareaElement = element;
                                const value = textareaElement.value?.trim();
                                const placeholder = textareaElement.placeholder?.trim();
                                if (value) {
                                    extractedText = value;
                                }
                                else if (placeholder) {
                                    extractedText = `[placeholder: ${placeholder}]`;
                                }
                            }
                            if (element.tagName === "BUTTON") {
                                const innerText = htmlElement.innerText?.trim();
                                if (innerText) {
                                    extractedText = innerText;
                                }
                            }
                            if (element.tagName === "IMG") {
                                const imgElement = element;
                                const alt = imgElement.alt?.trim();
                                if (alt) {
                                    extractedText = `[alt: ${alt}]`;
                                }
                            }
                            const ariaLabel = htmlElement.getAttribute("aria-label")?.trim();
                            const title = htmlElement.getAttribute("title")?.trim();
                            if (!extractedText && ariaLabel) {
                                extractedText = `[aria-label: ${ariaLabel}]`;
                            }
                            else if (!extractedText && title) {
                                extractedText = `[title: ${title}]`;
                            }
                            if (element.tagName === "LABEL") {
                                const labelElement = element;
                                const innerText = labelElement.innerText?.trim();
                                if (innerText) {
                                    extractedText = innerText;
                                }
                            }
                            if (extractedText && extractedText.length > 0) {
                                extractedText = extractedText.replace(/\s+/g, " ").trim();
                                if (extractedText.length === 1 &&
                                    !/[a-zA-Z0-9]/.test(extractedText)) {
                                    return undefined;
                                }
                                return extractedText;
                            }
                            return undefined;
                        }
                        catch (error) {
                            return undefined;
                        }
                    };
                    /**
                     * Determine if typography should be captured
                     */
                    const shouldCaptureTypography = (element, computedStyle) => {
                        try {
                            const textContent = element.textContent?.trim() || "";
                            if (textContent.length > 0) {
                                const display = computedStyle.display;
                                const visibility = computedStyle.visibility;
                                const opacity = parseFloat(computedStyle.opacity) || 1;
                                if (display === "none" ||
                                    visibility === "hidden" ||
                                    opacity === 0) {
                                    return false;
                                }
                                return true;
                            }
                            try {
                                const beforeContent = getComputedStyle(element, "::before").content;
                                const afterContent = getComputedStyle(element, "::after").content;
                                if ((beforeContent &&
                                    beforeContent !== "none" &&
                                    beforeContent !== '""') ||
                                    (afterContent && afterContent !== "none" && afterContent !== '""')) {
                                    return true;
                                }
                            }
                            catch (error) {
                                // Pseudo-element check failed
                            }
                            if (element.tagName) {
                                const typographyRelevantTags = [
                                    "INPUT",
                                    "TEXTAREA",
                                    "BUTTON",
                                    "LABEL",
                                    "SELECT",
                                    "OPTION",
                                ];
                                if (typographyRelevantTags.includes(element.tagName.toUpperCase())) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        catch (error) {
                            return false;
                        }
                    };
                    /**
                     * Resolve font family
                     */
                    const resolveFontFamily = (fontFamily) => {
                        try {
                            return fontFamily.split(",")[0].replace(/['"]/g, "").trim();
                        }
                        catch (error) {
                            return fontFamily;
                        }
                    };
                    /**
                     * Get first line height
                     */
                    const getFirstLineHeight = (element) => {
                        try {
                            const styles = getComputedStyle(element);
                            const lineHeight = parseFloat(styles.lineHeight);
                            if (!isNaN(lineHeight) && lineHeight > 0) {
                                return lineHeight;
                            }
                            const fontSize = parseFloat(styles.fontSize);
                            return fontSize * 1.2;
                        }
                        catch (error) {
                            return 0;
                        }
                    };
                    /**
                     * Extract all styles
                     */
                    const extractAllStyles = (styles, el) => {
                        return {
                            backgroundColor: styles.backgroundColor,
                            backgroundImage: styles.backgroundImage,
                            backgroundSize: styles.backgroundSize,
                            backgroundPosition: styles.backgroundPosition,
                            backgroundRepeat: styles.backgroundRepeat,
                            padding: styles.padding,
                            paddingTop: styles.paddingTop,
                            paddingRight: styles.paddingRight,
                            paddingBottom: styles.paddingBottom,
                            paddingLeft: styles.paddingLeft,
                            margin: styles.margin,
                            marginTop: styles.marginTop,
                            marginRight: styles.marginRight,
                            marginBottom: styles.marginBottom,
                            marginLeft: styles.marginLeft,
                            width: styles.width,
                            height: styles.height,
                            border: styles.border,
                            borderRadius: styles.borderRadius,
                            borderColor: styles.borderColor,
                            borderWidth: styles.borderWidth,
                            borderStyle: styles.borderStyle,
                            display: styles.display,
                            position: styles.position,
                            top: styles.top,
                            right: styles.right,
                            bottom: styles.bottom,
                            left: styles.left,
                            zIndex: styles.zIndex,
                            flexDirection: styles.flexDirection,
                            justifyContent: styles.justifyContent,
                            alignItems: styles.alignItems,
                            gap: styles.gap,
                            flexWrap: styles.flexWrap,
                            boxShadow: styles.boxShadow,
                            opacity: styles.opacity,
                            filter: styles.filter,
                            backdropFilter: styles.backdropFilter,
                            transform: styles.transform,
                            color: styles.color,
                            fontSize: styles.fontSize,
                            fontWeight: styles.fontWeight,
                            fontFamily: styles.fontFamily,
                            lineHeight: styles.lineHeight,
                            textAlign: styles.textAlign,
                        };
                    };
                    /**
                     * Extract pseudo-elements as full IRNode objects
                     */
                    const extractPseudoElement = (el, which) => {
                        try {
                            const pseudoStyles = window.getComputedStyle(el, which);
                            const content = pseudoStyles.getPropertyValue("content");
                            // Check if pseudo-element has visual representation
                            const hasContent = content && content !== "none" && content !== "normal";
                            const hasVisualStyles = pseudoStyles.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                                pseudoStyles.backgroundColor !== "transparent" ||
                                pseudoStyles.backgroundImage !== "none" ||
                                parseFloat(pseudoStyles.borderTopWidth || "0") > 0 ||
                                parseFloat(pseudoStyles.borderRightWidth || "0") > 0 ||
                                parseFloat(pseudoStyles.borderBottomWidth || "0") > 0 ||
                                parseFloat(pseudoStyles.borderLeftWidth || "0") > 0 ||
                                pseudoStyles.boxShadow !== "none" ||
                                pseudoStyles.filter !== "none" ||
                                pseudoStyles.backdropFilter !== "none" ||
                                pseudoStyles.clipPath !== "none" ||
                                pseudoStyles.mask !== "none" ||
                                pseudoStyles.maskImage !== "none";
                            if (!hasContent && !hasVisualStyles) {
                                return undefined;
                            }
                            // Get parent element's bounding rect for positioning
                            const parentRect = el.getBoundingClientRect();
                            // Compute pseudo-element dimensions and position
                            // Note: Browsers don't expose getBoundingClientRect for pseudo-elements
                            // We approximate based on content and styles
                            const display = pseudoStyles.display;
                            const position = pseudoStyles.position;
                            let width = 0;
                            let height = 0;
                            let x = parentRect.left;
                            let y = parentRect.top;
                            // Try to estimate dimensions
                            if (display !== "none") {
                                const specifiedWidth = pseudoStyles.width;
                                const specifiedHeight = pseudoStyles.height;
                                if (specifiedWidth !== "auto" && !specifiedWidth.includes("%")) {
                                    width = parseFloat(specifiedWidth) || 0;
                                }
                                else if (hasContent) {
                                    // Estimate width based on content for text pseudo-elements
                                    const fontSize = parseFloat(pseudoStyles.fontSize) || 16;
                                    const contentText = content.replace(/['"]/g, "");
                                    width = Math.max(contentText.length * fontSize * 0.6, 0);
                                }
                                else {
                                    // Use parent width for block elements
                                    width = parentRect.width;
                                }
                                if (specifiedHeight !== "auto" && !specifiedHeight.includes("%")) {
                                    height = parseFloat(specifiedHeight) || 0;
                                }
                                else if (hasContent) {
                                    height = parseFloat(pseudoStyles.fontSize) || 16;
                                }
                                else {
                                    height = parseFloat(pseudoStyles.fontSize) || 16;
                                }
                                // Adjust position based on positioning
                                if (position === "absolute" || position === "fixed") {
                                    const top = parseFloat(pseudoStyles.top) || 0;
                                    const left = parseFloat(pseudoStyles.left) || 0;
                                    const right = parseFloat(pseudoStyles.right) || 0;
                                    const bottom = parseFloat(pseudoStyles.bottom) || 0;
                                    if (pseudoStyles.top !== "auto") {
                                        y = parentRect.top + top;
                                    }
                                    else if (pseudoStyles.bottom !== "auto") {
                                        y = parentRect.bottom - bottom - height;
                                    }
                                    if (pseudoStyles.left !== "auto") {
                                        x = parentRect.left + left;
                                    }
                                    else if (pseudoStyles.right !== "auto") {
                                        x = parentRect.right - right - width;
                                    }
                                }
                                else {
                                    // For relative/static positioning, approximate based on element type
                                    if (which === "::before") {
                                        // ::before typically appears at the start
                                        if (display === "block" || display.includes("block")) {
                                            y = parentRect.top;
                                        }
                                        else {
                                            x = parentRect.left;
                                        }
                                    }
                                    else {
                                        // ::after typically appears at the end
                                        if (display === "block" || display.includes("block")) {
                                            y = parentRect.bottom;
                                        }
                                        else {
                                            x = parentRect.right;
                                        }
                                    }
                                }
                            }
                            // Create pseudo IRNode
                            const pseudoNode = {
                                id: generateId(),
                                tag: `pseudo-${which.replace("::", "")}`,
                                type: hasContent && !content.includes("url(") ? "TEXT" : "FRAME",
                                rect: {
                                    x: Math.round(x),
                                    y: Math.round(y),
                                    width: Math.max(0, Math.round(width)),
                                    height: Math.max(0, Math.round(height))
                                },
                                zIndex: parseFloat(pseudoStyles.zIndex) || 0,
                                worldTransform: [1, 0, 0, 0, 1, 0],
                                children: [],
                                parent: undefined, // Will be set by caller
                                selector: `${generateElementSelector(el)}${which}`,
                                classList: [],
                                dataAttributes: {},
                            };
                            // Add text content if applicable
                            if (hasContent && content !== '""') {
                                const contentText = content.replace(/['"]/g, "").replace(/\\[0-9a-fA-F]+/g, (match) => {
                                    // Handle Unicode escapes
                                    const code = parseInt(match.slice(1), 16);
                                    return String.fromCharCode(code);
                                });
                                pseudoNode.text = {
                                    text: contentText,
                                    innerText: contentText,
                                    isClipped: false,
                                    lineCount: 1,
                                    wordCount: contentText.split(/\s+/).length
                                };
                                pseudoNode.textMetrics = {
                                    font: {
                                        family: pseudoStyles.fontFamily || "sans-serif",
                                        familyResolved: pseudoStyles.fontFamily || "sans-serif",
                                        size: parseFloat(pseudoStyles.fontSize) || 16,
                                        weight: pseudoStyles.fontWeight || "400",
                                        style: pseudoStyles.fontStyle || "normal",
                                        variant: pseudoStyles.fontVariant || "normal",
                                        synthesis: "auto",
                                        kerning: "auto",
                                        featureSettings: "normal"
                                    },
                                    spacing: {
                                        lineHeight: parseFloat(pseudoStyles.lineHeight) || parseFloat(pseudoStyles.fontSize) * 1.2 || 19.2,
                                        letterSpacing: parseFloat(pseudoStyles.letterSpacing) || 0,
                                        wordSpacing: parseFloat(pseudoStyles.wordSpacing) || 0,
                                        textIndent: parseFloat(pseudoStyles.textIndent) || 0
                                    },
                                    layout: {
                                        align: (pseudoStyles.textAlign || "left"),
                                        verticalAlign: pseudoStyles.verticalAlign || "baseline",
                                        whiteSpace: pseudoStyles.whiteSpace || "normal",
                                        wordBreak: pseudoStyles.wordBreak || "normal",
                                        overflowWrap: pseudoStyles.overflowWrap || "normal",
                                        direction: (pseudoStyles.direction || "ltr"),
                                        writingMode: pseudoStyles.writingMode || "horizontal-tb",
                                        textOrientation: pseudoStyles.textOrientation || "mixed"
                                    },
                                    effects: {
                                        color: pseudoStyles.color || "#000000",
                                        transform: pseudoStyles.textTransform || "none",
                                        decoration: {
                                            line: pseudoStyles.textDecorationLine || "none",
                                            style: pseudoStyles.textDecorationStyle || "solid",
                                            color: pseudoStyles.textDecorationColor || "currentcolor",
                                            thickness: pseudoStyles.textDecorationThickness || "auto"
                                        }
                                    }
                                };
                            }
                            // Create layout object
                            const rect = el.getBoundingClientRect();
                            pseudoNode.layout = {
                                viewport: {
                                    x: rect.x,
                                    y: rect.y,
                                    width: rect.width,
                                    height: rect.height
                                }
                            };
                            // Add background if present
                            if (pseudoStyles.backgroundColor !== "rgba(0, 0, 0, 0)" && pseudoStyles.backgroundColor !== "transparent") {
                                pseudoNode.background = {
                                    layers: [{
                                            type: "color",
                                            color: {
                                                value: pseudoStyles.backgroundColor,
                                                alpha: 1
                                            }
                                        }]
                                };
                            }
                            // Add background image if present
                            if (pseudoStyles.backgroundImage && pseudoStyles.backgroundImage !== "none") {
                                if (!pseudoNode.background) {
                                    pseudoNode.background = { layers: [] };
                                }
                                pseudoNode.background.layers.push({
                                    type: "image",
                                    image: {
                                        imageRef: "pseudo-bg", // Would need proper asset processing
                                        size: pseudoStyles.backgroundSize || "auto",
                                        position: pseudoStyles.backgroundPosition || "0% 0%",
                                        repeat: pseudoStyles.backgroundRepeat || "repeat",
                                        attachment: pseudoStyles.backgroundAttachment || "scroll",
                                        origin: pseudoStyles.backgroundOrigin || "padding-box",
                                        clip: pseudoStyles.backgroundClip || "border-box"
                                    }
                                });
                            }
                            // Add borders if present
                            const borderTopWidth = parseFloat(pseudoStyles.borderTopWidth || "0");
                            const borderRightWidth = parseFloat(pseudoStyles.borderRightWidth || "0");
                            const borderBottomWidth = parseFloat(pseudoStyles.borderBottomWidth || "0");
                            const borderLeftWidth = parseFloat(pseudoStyles.borderLeftWidth || "0");
                            if (borderTopWidth > 0 || borderRightWidth > 0 || borderBottomWidth > 0 || borderLeftWidth > 0) {
                                pseudoNode.borders = {};
                                if (borderTopWidth > 0) {
                                    pseudoNode.borders.top = {
                                        width: borderTopWidth,
                                        style: pseudoStyles.borderTopStyle || "solid",
                                        color: pseudoStyles.borderTopColor || "#000000"
                                    };
                                }
                                if (borderRightWidth > 0) {
                                    pseudoNode.borders.right = {
                                        width: borderRightWidth,
                                        style: pseudoStyles.borderRightStyle || "solid",
                                        color: pseudoStyles.borderRightColor || "#000000"
                                    };
                                }
                                if (borderBottomWidth > 0) {
                                    pseudoNode.borders.bottom = {
                                        width: borderBottomWidth,
                                        style: pseudoStyles.borderBottomStyle || "solid",
                                        color: pseudoStyles.borderBottomColor || "#000000"
                                    };
                                }
                                if (borderLeftWidth > 0) {
                                    pseudoNode.borders.left = {
                                        width: borderLeftWidth,
                                        style: pseudoStyles.borderLeftStyle || "solid",
                                        color: pseudoStyles.borderLeftColor || "#000000"
                                    };
                                }
                                // Add border radius if present
                                const borderRadius = parseFloat(pseudoStyles.borderTopLeftRadius || "0");
                                if (borderRadius > 0) {
                                    pseudoNode.borders.radius = {
                                        topLeft: parseFloat(pseudoStyles.borderTopLeftRadius || "0"),
                                        topRight: parseFloat(pseudoStyles.borderTopRightRadius || "0"),
                                        bottomRight: parseFloat(pseudoStyles.borderBottomRightRadius || "0"),
                                        bottomLeft: parseFloat(pseudoStyles.borderBottomLeftRadius || "0")
                                    };
                                }
                            }
                            // Add effects using enhanced parser
                            const effects = parseEffectsToIR(pseudoStyles);
                            if (effects) {
                                pseudoNode.effects = effects;
                            }
                            // Add stacking context detection
                            pseudoNode.stackingContextId = undefined;
                            return pseudoNode;
                        }
                        catch (error) {
                            console.warn(`Failed to extract pseudo-element ${which} for element:`, error);
                            return undefined;
                        }
                    };
                    /**
                     * Extract pseudo-elements for an element
                     */
                    const extractPseudoElements = (el) => {
                        const pseudos = [];
                        if (!(el instanceof HTMLElement)) {
                            return pseudos;
                        }
                        const beforeNode = extractPseudoElement(el, "::before");
                        if (beforeNode) {
                            pseudos.push({
                                type: "before",
                                node: beforeNode
                            });
                        }
                        const afterNode = extractPseudoElement(el, "::after");
                        if (afterNode) {
                            pseudos.push({
                                type: "after",
                                node: afterNode
                            });
                        }
                        return pseudos;
                    };
                    /**
                     * Detect component pattern
                     */
                    const detectComponentPattern = (el, styles) => {
                        const tag = el.tagName.toLowerCase();
                        const role = el.getAttribute("role");
                        const classList = Array.from(el.classList).join(" ");
                        if (tag === "button" || role === "button" || classList.includes("btn"))
                            return "button";
                        if (classList.includes("card") ||
                            (styles.boxShadow !== "none" && styles.borderRadius !== "0px"))
                            return "card";
                        if (tag === "input" || tag === "textarea" || tag === "select")
                            return "input";
                        if (tag === "nav" || role === "navigation")
                            return "navigation";
                        if (tag === "header" || role === "banner")
                            return "header";
                        if (tag === "footer" || role === "contentinfo")
                            return "footer";
                        if (tag === "aside" || role === "complementary")
                            return "sidebar";
                        if (tag === "article" || role === "article")
                            return "article";
                        if (tag === "section")
                            return "section";
                        return null;
                    };
                    /**
                     * Check if element needs screenshot
                     */
                    const needsScreenshot = (styles, el, pseudoEls) => {
                        const backgroundImage = styles.backgroundImage || "";
                        const hasBackgroundImage = backgroundImage !== "none" && backgroundImage.trim().length > 0;
                        const hasGradientBackground = backgroundImage.includes("gradient");
                        const hasRasterBackground = backgroundImage.includes("url(");
                        const hasMultipleBackgrounds = hasBackgroundImage && backgroundImage.split(",").length > 1;
                        const hasBlendMode = styles.mixBlendMode && styles.mixBlendMode !== "normal";
                        const hasBackgroundBlend = styles.backgroundBlendMode && styles.backgroundBlendMode !== "normal";
                        const hasMask = (styles.mask && styles.mask !== "none") ||
                            (styles.maskImage && styles.maskImage !== "none");
                        const hasClipPath = styles.clipPath && styles.clipPath !== "none";
                        const hasFilters = (styles.filter && styles.filter !== "none") ||
                            (styles.backdropFilter && styles.backdropFilter !== "none");
                        const hasPerspective = styles.perspective && styles.perspective !== "none";
                        const hasTransform = styles.transform &&
                            styles.transform !== "none" &&
                            !styles.transform.includes("rotate(0");
                        const hasHeavyShadow = styles.boxShadow &&
                            styles.boxShadow !== "none" &&
                            styles.boxShadow.split(",").length > 1;
                        const hasOpacityStack = parseFloat(styles.opacity || "1") > 0 &&
                            parseFloat(styles.opacity || "1") < 1 &&
                            el.children.length > 0;
                        const hasPseudoContent = Array.isArray(pseudoEls) && pseudoEls.length > 0;
                        const hasComplexContent = !!el.querySelector?.("svg, canvas, video, picture, img");
                        return !!(hasGradientBackground ||
                            hasRasterBackground ||
                            hasMultipleBackgrounds ||
                            hasBlendMode ||
                            hasBackgroundBlend ||
                            hasMask ||
                            hasClipPath ||
                            hasFilters ||
                            hasTransform ||
                            hasPerspective ||
                            hasHeavyShadow ||
                            hasOpacityStack ||
                            hasPseudoContent ||
                            hasComplexContent ||
                            el.tagName === "CANVAS" ||
                            el.tagName === "VIDEO");
                    };
                    /**
                     * Generate CSS selector
                     */
                    const generateSelector = (element) => {
                        if (element.id)
                            return `#${element.id}`;
                        const classes = Array.from(element.classList).filter((c) => c && !c.includes(" "));
                        if (classes.length > 0) {
                            const selector = `.${classes[0]}`;
                            if (document.querySelectorAll(selector).length === 1) {
                                return selector;
                            }
                        }
                        const path = [];
                        let current = element;
                        while (current && current !== document.body) {
                            const tag = current.tagName.toLowerCase();
                            const parent = current.parentElement;
                            if (parent) {
                                const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
                                const index = siblings.indexOf(current) + 1;
                                path.unshift(`${tag}:nth-of-type(${index})`);
                            }
                            else {
                                path.unshift(tag);
                            }
                            current = parent;
                        }
                        return path.join(" > ");
                    };
                    /**
                     * Get CSS variables
                     */
                    const getCSSVariables = () => {
                        const vars = {};
                        const root = getComputedStyle(document.documentElement);
                        for (let i = 0; i < root.length; i++) {
                            const prop = root[i];
                            if (prop.startsWith("--")) {
                                vars[prop] = root.getPropertyValue(prop);
                            }
                        }
                        return vars;
                    };
                    /**
                     * Parse CSS flex shorthand into individual components
                     */
                    function parseFlexShorthand(flex) {
                        const trimmed = flex.trim();
                        if (trimmed === "initial")
                            return { grow: 0, shrink: 1, basis: "auto" };
                        if (trimmed === "auto")
                            return { grow: 1, shrink: 1, basis: "auto" };
                        if (trimmed === "none")
                            return { grow: 0, shrink: 0, basis: "auto" };
                        if (/^\d+(\.\d+)?$/.test(trimmed)) {
                            const grow = parseFloat(trimmed);
                            return { grow, shrink: 1, basis: "0px" };
                        }
                        const parts = trimmed.split(/\s+/);
                        let grow = 0;
                        let shrink = 1;
                        let basis = "auto";
                        for (let i = 0; i < parts.length; i++) {
                            const part = parts[i];
                            if (i === 0 && /^[\d.]+$/.test(part)) {
                                grow = parseFloat(part) || 0;
                            }
                            else if (i === 1 && /^[\d.]+$/.test(part)) {
                                shrink = parseFloat(part) || 1;
                            }
                            else if (part !== "0" &&
                                (part.includes("px") ||
                                    part.includes("%") ||
                                    part.includes("em") ||
                                    part.includes("rem") ||
                                    part === "auto" ||
                                    part === "content")) {
                                basis = part;
                            }
                        }
                        return { grow, shrink, basis };
                    }
                    /**
                     * Parse gap values with support for various CSS units
                     */
                    function parseGapValue(gap) {
                        if (typeof gap === "number")
                            return Math.max(0, gap);
                        if (!gap || gap === "normal" || gap === "0")
                            return 0;
                        const trimmed = gap.toString().trim();
                        const match = trimmed.match(/^([\d.]+)(px|em|rem|%|vh|vw|vmin|vmax)?$/);
                        if (!match)
                            return 0;
                        const [, value, unit] = match;
                        const numValue = parseFloat(value);
                        if (isNaN(numValue) || numValue < 0)
                            return 0;
                        switch (unit) {
                            case "em":
                            case "rem":
                                return numValue * 16;
                            case "%":
                                return numValue;
                            case "vh":
                                return numValue * (typeof window !== "undefined" ? window.innerHeight / 100 : 0);
                            case "vw":
                                return numValue * (typeof window !== "undefined" ? window.innerWidth / 100 : 0);
                            default:
                                return numValue;
                        }
                    }
                    /**
                     * Detect legacy flex gap simulation using margins
                     */
                    function detectLegacyFlexGap(container) {
                        if (!container || container.children.length <= 1)
                            return { row: 0, column: 0 };
                        try {
                            let rowGap = 0;
                            let columnGap = 0;
                            const sampleSize = Math.min(4, container.children.length);
                            const marginData = [];
                            for (let i = 0; i < sampleSize; i++) {
                                const child = container.children[i];
                                if (!(child instanceof HTMLElement))
                                    continue;
                                const childStyles = getComputedStyle(child);
                                marginData.push({
                                    top: parseFloat(childStyles.marginTop) || 0,
                                    right: parseFloat(childStyles.marginRight) || 0,
                                    bottom: parseFloat(childStyles.marginBottom) || 0,
                                    left: parseFloat(childStyles.marginLeft) || 0
                                });
                            }
                            if (marginData.length >= 2) {
                                const rightMargins = marginData.map(m => m.right).filter(m => m > 0);
                                const bottomMargins = marginData.map(m => m.bottom).filter(m => m > 0);
                                if (rightMargins.length > 0 && rightMargins.every(m => m === rightMargins[0])) {
                                    columnGap = rightMargins[0];
                                }
                                if (bottomMargins.length > 0 && bottomMargins.every(m => m === bottomMargins[0])) {
                                    rowGap = bottomMargins[0];
                                }
                            }
                            return { row: rowGap, column: columnGap };
                        }
                        catch (error) {
                            return { row: 0, column: 0 };
                        }
                    }
                    const GridUtils = (() => {
                        const JUSTIFY_CONTENT_VALUES = [
                            "start",
                            "end",
                            "center",
                            "stretch",
                            "space-around",
                            "space-between",
                            "space-evenly"
                        ];
                        const JUSTIFY_ITEMS_VALUES = ["start", "end", "center", "stretch"];
                        const ALIGN_ITEMS_VALUES = ["start", "end", "center", "stretch", "baseline"];
                        const JUSTIFY_SELF_VALUES = ["auto", "start", "end", "center", "stretch"];
                        const ALIGN_SELF_VALUES = ["auto", "start", "end", "center", "stretch", "baseline"];
                        const sanitizeKeyword = (value) => {
                            if (!value)
                                return "";
                            const normalized = value.trim().toLowerCase();
                            if (normalized === "flex-start" || normalized === "self-start" || normalized === "left")
                                return "start";
                            if (normalized === "flex-end" || normalized === "self-end" || normalized === "right")
                                return "end";
                            if (normalized === "safe center" || normalized === "unsafe center")
                                return "center";
                            if (normalized.includes("baseline"))
                                return "baseline";
                            return normalized;
                        };
                        const normalizeJustifyContent = (value) => {
                            const keyword = sanitizeKeyword(value);
                            return (JUSTIFY_CONTENT_VALUES.includes(keyword) ? keyword : "start");
                        };
                        const normalizeAlignContent = (value) => {
                            const keyword = sanitizeKeyword(value);
                            return (JUSTIFY_CONTENT_VALUES.includes(keyword) ? keyword : "stretch");
                        };
                        const normalizeJustifyItems = (value) => {
                            const keyword = sanitizeKeyword(value);
                            return (JUSTIFY_ITEMS_VALUES.includes(keyword) ? keyword : "stretch");
                        };
                        const normalizeAlignItems = (value) => {
                            const keyword = sanitizeKeyword(value);
                            return (ALIGN_ITEMS_VALUES.includes(keyword) ? keyword : "stretch");
                        };
                        const normalizeJustifySelf = (value) => {
                            const keyword = sanitizeKeyword(value);
                            if (JUSTIFY_SELF_VALUES.includes(keyword))
                                return keyword;
                            if (keyword === "normal")
                                return "auto";
                            return "auto";
                        };
                        const normalizeAlignSelf = (value) => {
                            const keyword = sanitizeKeyword(value);
                            if (ALIGN_SELF_VALUES.includes(keyword))
                                return keyword;
                            if (keyword === "normal")
                                return "auto";
                            return "auto";
                        };
                        const isGridDisplay = (display) => display === "grid" || display === "inline-grid";
                        return {
                            normalizeJustifyContent,
                            normalizeAlignContent,
                            normalizeJustifyItems,
                            normalizeAlignItems,
                            normalizeJustifySelf,
                            normalizeAlignSelf,
                            isGridDisplay
                        };
                    })();
                    /**
                     * Resolve flex container/item data for an element
                     */
                    function resolveFlexLayout(el, styles) {
                        const display = styles.display;
                        const isFlexContainer = display === "flex" || display === "inline-flex";
                        let isFlexItem = false;
                        let parentElement = null;
                        let parentStyles = null;
                        if (el.parentElement && el.parentElement instanceof HTMLElement) {
                            parentElement = el.parentElement;
                            parentStyles = getComputedStyle(parentElement);
                            const parentDisplay = parentStyles.display;
                            isFlexItem = parentDisplay === "flex" || parentDisplay === "inline-flex";
                        }
                        let containerData;
                        let itemData;
                        let childAlignment;
                        if (isFlexContainer) {
                            try {
                                const flexDirection = styles.flexDirection || "row";
                                const direction = ["row", "row-reverse", "column", "column-reverse"].includes(flexDirection)
                                    ? flexDirection
                                    : "row";
                                const flexWrap = styles.flexWrap || "nowrap";
                                const wrap = ["nowrap", "wrap", "wrap-reverse"].includes(flexWrap) ? flexWrap : "nowrap";
                                const justifyContentValue = styles.justifyContent || "flex-start";
                                const validJustifyValues = [
                                    "flex-start", "flex-end", "center", "space-between",
                                    "space-around", "space-evenly", "start", "end", "left", "right", "stretch"
                                ];
                                const justifyContent = validJustifyValues.includes(justifyContentValue)
                                    ? justifyContentValue
                                    : "flex-start";
                                const alignItemsValue = styles.alignItems || "stretch";
                                const validAlignItemsValues = [
                                    "stretch", "flex-start", "flex-end", "center", "baseline",
                                    "first baseline", "last baseline", "start", "end",
                                    "self-start", "self-end", "safe center", "unsafe center"
                                ];
                                const alignItems = validAlignItemsValues.includes(alignItemsValue)
                                    ? alignItemsValue
                                    : "stretch";
                                const alignContentValue = styles.alignContent || "stretch";
                                const validAlignContentValues = [
                                    "stretch", "flex-start", "flex-end", "center",
                                    "space-between", "space-around", "space-evenly",
                                    "start", "end", "baseline", "first baseline", "last baseline"
                                ];
                                const alignContent = validAlignContentValues.includes(alignContentValue)
                                    ? alignContentValue
                                    : "stretch";
                                const rowGap = parseGapValue(styles.rowGap || styles.gap || "0");
                                const columnGap = parseGapValue(styles.columnGap || styles.gap || "0");
                                const legacyGap = detectLegacyFlexGap(el);
                                containerData = {
                                    isFlexContainer: true,
                                    direction,
                                    wrap,
                                    justifyContent,
                                    alignItems,
                                    alignContent,
                                    gap: {
                                        row: Math.max(rowGap, legacyGap.row),
                                        column: Math.max(columnGap, legacyGap.column)
                                    }
                                };
                            }
                            catch (error) {
                                containerData = {
                                    isFlexContainer: true,
                                    direction: "row",
                                    wrap: "nowrap",
                                    justifyContent: "flex-start",
                                    alignItems: "stretch",
                                    alignContent: "stretch",
                                    gap: { row: 0, column: 0 }
                                };
                            }
                        }
                        if (isFlexItem && parentElement && parentStyles) {
                            try {
                                const flexValue = styles.flex;
                                let grow;
                                let shrink;
                                let basis;
                                if (flexValue && flexValue !== "initial" && flexValue !== "auto" && flexValue !== "none") {
                                    const parsed = parseFlexShorthand(flexValue);
                                    grow = parsed.grow;
                                    shrink = parsed.shrink;
                                    basis = parsed.basis;
                                }
                                else {
                                    grow = parseFloat(styles.flexGrow || "0");
                                    shrink = parseFloat(styles.flexShrink || "1");
                                    basis = styles.flexBasis || "auto";
                                }
                                const alignSelf = styles.alignSelf || "auto";
                                const order = parseFloat(styles.order || "0") || 0;
                                const hasExplicitSizing = !!(styles.flex ||
                                    styles.flexGrow ||
                                    styles.flexShrink ||
                                    styles.flexBasis ||
                                    grow !== 0 ||
                                    shrink !== 1 ||
                                    basis !== "auto");
                                itemData = {
                                    grow,
                                    shrink,
                                    basis,
                                    alignSelf,
                                    order,
                                    computed: {
                                        flex: flexValue || `${grow} ${shrink} ${basis}`,
                                        isFlexItem: true,
                                        hasExplicitSizing
                                    }
                                };
                            }
                            catch (error) {
                                itemData = {
                                    grow: 0,
                                    shrink: 1,
                                    basis: "auto",
                                    alignSelf: "auto",
                                    order: 0,
                                    computed: {
                                        flex: "0 1 auto",
                                        isFlexItem: true,
                                        hasExplicitSizing: false
                                    }
                                };
                            }
                        }
                        if (parentElement && parentStyles) {
                            if (parentStyles.display === "flex" || parentStyles.display === "inline-flex") {
                                const direction = parentStyles.flexDirection || "row";
                                const wrapMode = parentStyles.flexWrap || "nowrap";
                                const parentJustify = parentStyles.justifyContent || "flex-start";
                                const parentAlignItems = parentStyles.alignItems || "stretch";
                                const childAlignSelf = styles.alignSelf && styles.alignSelf !== "auto"
                                    ? styles.alignSelf
                                    : parentAlignItems;
                                childAlignment = {
                                    mainAxis: ["flex-end", "end", "self-end", "right"].includes(parentJustify) ? "end" :
                                        ["center", "safe center", "unsafe center"].includes(parentJustify) ? "center" :
                                            parentJustify === "stretch" ? "stretch" :
                                                ["space-between", "space-around", "space-evenly"].includes(parentJustify) ? parentJustify :
                                                    "start",
                                    crossAxis: ["flex-end", "end", "self-end", "right"].includes(childAlignSelf) ? "end" :
                                        ["center", "safe center", "unsafe center"].includes(childAlignSelf) ? "center" :
                                            childAlignSelf === "stretch" ? "stretch" :
                                                childAlignSelf.includes("baseline") ? "baseline" :
                                                    "start",
                                    mainAxisOrientation: direction.startsWith("column") ? "vertical" : "horizontal",
                                    crossAxisOrientation: direction.startsWith("column") ? "horizontal" : "vertical",
                                    mainAxisIsReversed: direction.endsWith("reverse") || undefined,
                                    crossAxisIsReversed: wrapMode === "wrap-reverse" ? true : undefined,
                                    computedFromFlex: true
                                };
                            }
                            else if (parentStyles.display === "grid" || parentStyles.display === "inline-grid") {
                                const justifySelf = styles.justifySelf && styles.justifySelf !== "auto"
                                    ? styles.justifySelf
                                    : parentStyles.justifyItems || parentStyles.justifyContent || "stretch";
                                const alignSelf = styles.alignSelf && styles.alignSelf !== "auto"
                                    ? styles.alignSelf
                                    : parentStyles.alignItems || parentStyles.alignContent || "stretch";
                                childAlignment = {
                                    mainAxis: ["flex-end", "end", "self-end", "right"].includes(justifySelf) ? "end" :
                                        ["center", "safe center", "unsafe center"].includes(justifySelf) ? "center" :
                                            justifySelf === "stretch" ? "stretch" :
                                                justifySelf.includes("baseline") ? "baseline" :
                                                    "start",
                                    crossAxis: ["flex-end", "end", "self-end", "right"].includes(alignSelf) ? "end" :
                                        ["center", "safe center", "unsafe center"].includes(alignSelf) ? "center" :
                                            alignSelf === "stretch" ? "stretch" :
                                                alignSelf.includes("baseline") ? "baseline" :
                                                    "start",
                                    mainAxisOrientation: "horizontal",
                                    crossAxisOrientation: "vertical",
                                    computedFromGrid: true
                                };
                            }
                        }
                        return {
                            isFlexContainer,
                            isFlexItem,
                            containerData,
                            itemData,
                            childAlignment
                        };
                    }
                    /**
                     * Create IRLayout object from legacy geometry + flex info
                     */
                    function createIRLayoutFromLegacy(legacyLayout, flexData, styles) {
                        const parseSpacing = (property) => {
                            const value = styles.getPropertyValue(property) || "0";
                            if (!value || value === "0" || value === "auto") {
                                return { top: 0, right: 0, bottom: 0, left: 0 };
                            }
                            const values = value.split(" ").map(v => parseFloat(v.replace(/px$/, "")) || 0);
                            switch (values.length) {
                                case 1: return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
                                case 2: return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
                                case 3: return { top: values[0], right: values[1], bottom: values[2], left: values[1] };
                                case 4: return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
                                default: return { top: 0, right: 0, bottom: 0, left: 0 };
                            }
                        };
                        return {
                            boxModel: {
                                margin: parseSpacing("margin"),
                                padding: parseSpacing("padding"),
                                border: parseSpacing("border-width"),
                                boxSizing: (styles.boxSizing || "content-box")
                            },
                            position: {
                                type: (styles.position || "static"),
                                top: styles.top || undefined,
                                right: styles.right || undefined,
                                bottom: styles.bottom || undefined,
                                left: styles.left || undefined
                            },
                            display: {
                                type: styles.display || "block",
                                overflow: {
                                    x: (styles.overflowX || "visible"),
                                    y: (styles.overflowY || "visible")
                                }
                            },
                            flex: flexData.containerData,
                            flexItem: flexData.itemData,
                            childAlignment: flexData.childAlignment,
                            grid: GridUtils.isGridDisplay(styles.display) ? {
                                templateColumns: styles.gridTemplateColumns || "none",
                                templateRows: styles.gridTemplateRows || "none",
                                templateAreas: styles.gridTemplateAreas || "none",
                                autoFlow: styles.gridAutoFlow || "row",
                                autoColumns: styles.gridAutoColumns || "auto",
                                autoRows: styles.gridAutoRows || "auto",
                                gap: {
                                    row: parseGapValue(styles.gridRowGap || styles.rowGap || styles.gap || "0"),
                                    column: parseGapValue(styles.gridColumnGap || styles.columnGap || styles.gap || "0")
                                },
                                justifyContent: GridUtils.normalizeJustifyContent(styles.justifyContent),
                                alignContent: GridUtils.normalizeAlignContent(styles.alignContent),
                                justifyItems: GridUtils.normalizeJustifyItems(styles.justifyItems),
                                alignItems: GridUtils.normalizeAlignItems(styles.alignItems),
                                placeContent: styles.placeContent || "normal",
                                placeItems: styles.placeItems || "normal",
                                column: styles.gridColumn || "auto",
                                row: styles.gridRow || "auto",
                                area: styles.gridArea || "auto",
                                justifySelf: GridUtils.normalizeJustifySelf(styles.justifySelf),
                                alignSelf: GridUtils.normalizeAlignSelf(styles.alignSelf),
                                placeSelf: styles.placeSelf || "auto"
                            } : undefined,
                            dimensions: {
                                width: styles.width || "auto",
                                height: styles.height || "auto",
                                minWidth: styles.minWidth || "auto",
                                maxWidth: styles.maxWidth || "auto",
                                minHeight: styles.minHeight || "auto",
                                maxHeight: styles.maxHeight || "auto"
                            },
                            transform: legacyLayout.transform?.hasTransform ? {
                                matrix: parseTransformMatrix(styles.transform || "none"),
                                origin: styles.transformOrigin || "50% 50%",
                                style: (styles.transformStyle || "flat")
                            } : undefined,
                            stacking: {
                                zIndex: parseFloat(styles.zIndex || "0") || "auto",
                                stackingContextId: undefined,
                                paintOrder: legacyLayout.compositing?.paintOrder || 0,
                                isolate: styles.isolation === "isolate"
                            }
                        };
                    }
                    /**
                     * Compute world-space transform matrix for an element
                     * Walks up the DOM tree combining all ancestor transforms
                     */
                    const computeWorldMatrix = (element) => {
                        const identity = [1, 0, 0, 1, 0, 0];
                        const parseMatrix = (transform) => {
                            if (!transform || transform === "none") {
                                return identity;
                            }
                            const matrixMatch = transform.match(/matrix\s*\(([^)]+)\)/);
                            if (matrixMatch) {
                                const values = matrixMatch[1]
                                    .split(/\s*,\s*/)
                                    .map((v) => parseFloat(v));
                                if (values.length === 6 && values.every((v) => !isNaN(v))) {
                                    return values;
                                }
                            }
                            const matrix3dMatch = transform.match(/matrix3d\s*\(([^)]+)\)/);
                            if (matrix3dMatch) {
                                const values = matrix3dMatch[1]
                                    .split(/\s*,\s*/)
                                    .map((v) => parseFloat(v));
                                if (values.length === 16 && values.every((v) => !isNaN(v))) {
                                    return [values[0], values[1], values[4], values[5], values[12], values[13]];
                                }
                            }
                            return identity;
                        };
                        const multiply = (a, b) => {
                            return [
                                a[0] * b[0] + a[2] * b[1],
                                a[1] * b[0] + a[3] * b[1],
                                a[0] * b[2] + a[2] * b[3],
                                a[1] * b[2] + a[3] * b[3],
                                a[0] * b[4] + a[2] * b[5] + a[4],
                                a[1] * b[4] + a[3] * b[5] + a[5]
                            ];
                        };
                        const matrices = [];
                        let current = element;
                        while (current && current !== document.documentElement) {
                            try {
                                const transform = getComputedStyle(current).transform;
                                if (transform && transform !== "none") {
                                    matrices.unshift(parseMatrix(transform));
                                }
                            }
                            catch {
                                break;
                            }
                            current = current.parentElement;
                        }
                        return matrices.reduce((acc, matrix) => multiply(acc, matrix), identity.slice());
                    };
                    /**
                     * Parse transform matrix from CSS transform value
                     */
                    function parseTransformMatrix(transform) {
                        if (!transform || transform === "none") {
                            return [1, 0, 0, 0, 1, 0];
                        }
                        const matrixMatch = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
                        if (matrixMatch) {
                            const values = matrixMatch[1].split(",").map(v => parseFloat(v.trim()) || 0);
                            if (values.length === 6) {
                                return values;
                            }
                            else if (values.length === 16) {
                                return [values[0], values[1], values[4], values[5], values[12], values[13]];
                            }
                        }
                        return [1, 0, 0, 0, 1, 0];
                    }
                    // ==================== MAIN EXTRACTION ====================
                    const nodes = [];
                    const valueFrequency = new Map();
                    const cssVars = getCSSVariables();
                    const elements = document.querySelectorAll("*");
                    const nodeMap = new Map();
                    console.log(`[DOM Extraction] Found ${elements.length} total elements`);
                    // ✅ FIX: Limit max elements to prevent hangs on massive sites
                    const MAX_ELEMENTS = 5000; // Process max 5000 elements
                    const elementsToProcess = Math.min(elements.length, MAX_ELEMENTS);
                    if (elements.length > MAX_ELEMENTS) {
                        console.warn(`[DOM Extraction] ⚠️ Limiting to ${MAX_ELEMENTS} of ${elements.length} elements to prevent timeout`);
                    }
                    // First pass: Create nodes
                    for (let i = 0; i < elementsToProcess; i++) {
                        // ✅ FIX: Progress logging every 500 elements
                        if (i > 0 && i % 500 === 0) {
                            console.log(`[DOM Extraction] Processing element ${i}/${elementsToProcess}...`);
                        }
                        const el = elements[i];
                        const rect = el.getBoundingClientRect();
                        const styles = getComputedStyle(el);
                        const isIntentionallyHidden = styles.display === "none" ||
                            styles.visibility === "hidden" ||
                            parseFloat(styles.opacity) === 0;
                        if (rect.width === 0 && rect.height === 0 && !isIntentionallyHidden) {
                            continue;
                        }
                        const nodeId = generateId();
                        nodeMap.set(el, nodeId);
                        const styleData = extractAllStyles(styles, el);
                        if (styleData.backgroundColor) {
                            valueFrequency.set(styleData.backgroundColor, (valueFrequency.get(styleData.backgroundColor) || 0) + 1);
                        }
                        if (styleData.color) {
                            valueFrequency.set(styleData.color, (valueFrequency.get(styleData.color) || 0) + 1);
                        }
                        const pattern = detectComponentPattern(el, styles);
                        let imageData = null;
                        if (el.tagName === "IMG") {
                            const img = el;
                            imageData = {
                                url: img.src,
                                alt: img.alt,
                                naturalWidth: img.naturalWidth,
                                naturalHeight: img.naturalHeight,
                                needsProxy: !img.src.startsWith("data:"),
                            };
                        }
                        let svgData = null;
                        if (el.tagName === "SVG") {
                            svgData = {
                                content: el.outerHTML,
                                viewBox: el.getAttribute("viewBox"),
                                width: el.getAttribute("width"),
                                height: el.getAttribute("height"),
                            };
                        }
                        const pseudoElements = opts.capturePseudoElements
                            ? extractPseudoElements(el)
                            : [];
                        const dataAttributes = {};
                        for (let j = 0; j < el.attributes.length; j++) {
                            const attr = el.attributes[j];
                            if (attr.name.startsWith("data-")) {
                                dataAttributes[attr.name] = attr.value;
                            }
                        }
                        const layout = captureLayoutGeometry(el, opts.renderEnv);
                        const compositing = captureCompositingProperties(el, styles);
                        // Process flexbox layout with comprehensive W3C compliance
                        const flexLayoutData = resolveFlexLayout(el, styles);
                        // Create IRLayout from legacy layout and flexbox data
                        const irLayout = createIRLayoutFromLegacy(layout, flexLayoutData, styles);
                        const hasTypography = shouldCaptureTypography(el, styles);
                        const extractedText = hasTypography
                            ? extractTextContent(el)
                            : undefined;
                        // Extract browser-accurate text metrics using the enhanced function
                        const textMetrics = hasTypography && extractedText
                            ? extractTextMetrics(el)
                            : undefined;
                        let nodeType;
                        if (el.tagName === "IMG") {
                            nodeType = "IMAGE";
                        }
                        else if (el.tagName === "SVG") {
                            nodeType = "SVG";
                        }
                        else if (el.tagName === "CANVAS") {
                            nodeType = "CANVAS";
                        }
                        else if (el.tagName === "VIDEO") {
                            nodeType = "VIDEO";
                        }
                        else if (hasTypography && extractedText && el.children.length === 0) {
                            // Only leaf nodes with text should be TEXT nodes
                            nodeType = "TEXT";
                        }
                        else if (el.children.length > 0) {
                            nodeType = "FRAME";
                        }
                        else {
                            nodeType = "FRAME";
                        }
                        // Compute world-space transform matrix
                        const worldTransform = computeWorldMatrix(el);
                        // ✅ CREATE NODE WITH TOP-LEVEL STRUCTURE
                        const node = {
                            id: nodeId,
                            type: nodeType,
                            tag: el.tagName.toLowerCase(),
                            rect: {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                            },
                            worldTransform: worldTransform,
                            zIndex: parseFloat(styles.zIndex) || 0,
                            // ✅ TOP LEVEL: layout (new IRLayout with flexbox support)
                            layout: irLayout,
                            // ✅ TOP LEVEL: compositing
                            compositing: compositing,
                            // ✅ TOP LEVEL: typography (only for text nodes)
                            typography: hasTypography
                                ? {
                                    text: {
                                        content: el.textContent || "",
                                        innerText: el.innerText || "",
                                        innerHTML: el.innerHTML.substring(0, 500),
                                        length: (el.textContent || "").length,
                                        isClipped: el.scrollWidth > el.clientWidth,
                                        lineCount: calculatePreciseLineCount(el, styles),
                                        firstLineHeight: getFirstLineHeight(el),
                                        isGradientText: detectGradientText(styles).isGradient,
                                    },
                                    font: {
                                        family: styles.fontFamily,
                                        familyResolved: resolveFontFamily(styles.fontFamily),
                                        size: styles.fontSize,
                                        weight: styles.fontWeight,
                                        style: styles.fontStyle,
                                        variant: styles.fontVariant,
                                        featureSettings: styles.fontFeatureSettings || "normal",
                                        kerning: styles.fontKerning || "auto",
                                        synthesis: styles.fontSynthesis || "weight style",
                                        smoothing: styles.webkitFontSmoothing || "auto",
                                        rendering: styles.textRendering || "auto",
                                    },
                                    layout: {
                                        lineHeight: styles.lineHeight,
                                        lineHeightPx: parseFloat(styles.lineHeight) ||
                                            parseFloat(styles.fontSize) * 1.2,
                                        letterSpacing: styles.letterSpacing,
                                        wordSpacing: styles.wordSpacing || "normal",
                                        textIndent: styles.textIndent,
                                        align: styles.textAlign,
                                        whiteSpace: styles.whiteSpace,
                                        wordBreak: styles.wordBreak,
                                        overflowWrap: styles.overflowWrap,
                                        direction: styles.direction,
                                        unicodeBidi: styles.unicodeBidi,
                                        writingMode: styles.writingMode,
                                        textOrientation: styles.textOrientation || "mixed",
                                        verticalAlign: styles.verticalAlign,
                                    },
                                    decoration: {
                                        line: styles.textDecorationLine || "none",
                                        style: styles.textDecorationStyle || "solid",
                                        color: styles.textDecorationColor || styles.color,
                                        thickness: styles.textDecorationThickness || "auto",
                                        underlineOffset: styles.textUnderlineOffset || "auto",
                                        underlinePosition: styles.textUnderlinePosition || "auto",
                                    },
                                    effects: {
                                        color: styles.color,
                                        shadow: styles.textShadow,
                                        transform: styles.textTransform,
                                        stroke: styles.webkitTextStroke || null,
                                        strokeWidth: styles.webkitTextStrokeWidth || null,
                                        strokeColor: styles.webkitTextStrokeColor || null,
                                        fillColor: styles.webkitTextFillColor || null,
                                        gradientText: detectGradientText(styles).gradientData,
                                    },
                                    wrapping: {
                                        textWrap: styles.textWrap || null,
                                        textWrapMode: styles.textWrapMode || null,
                                        textWrapStyle: styles.textWrapStyle || null,
                                    },
                                    capabilities: detectTypographyCapabilities(),
                                    specialCases: {
                                        isMultiLine: calculatePreciseLineCount(el, styles) > 1,
                                        isGradientText: detectGradientText(styles).isGradient,
                                        ...detectTextDirections(styles),
                                        inputState: captureInputState(el),
                                    },
                                }
                                : undefined,
                            // styles (without typography)
                            styles: styleData,
                            // Content - Enhanced text with rawText and html
                            text: extractedText ? {
                                rawText: extractedText,
                                html: el.innerHTML.substring(0, 1000) // Reasonable HTML snippet limit
                            } : undefined,
                            // Browser-accurate text metrics
                            textMetrics: textMetrics,
                            image: imageData,
                            svg: svgData,
                            pseudoElements: pseudoElements,
                            // Hierarchy
                            children: [],
                            parent: el.parentElement ? nodeMap.get(el.parentElement) : undefined,
                            // Metadata
                            selector: generateSelector(el),
                            componentHint: pattern,
                            domId: el.id || undefined,
                            classList: el.classList.length > 0 ? Array.from(el.classList) : undefined,
                            dataAttributes: Object.keys(dataAttributes).length > 0 ? dataAttributes : undefined,
                            ariaLabel: el.getAttribute("aria-label") || undefined,
                            role: el.getAttribute("role") || undefined,
                            // Pseudo-elements attached as IRNode children
                            pseudo: (() => {
                                const pseudo = {};
                                for (const pseudoEl of pseudoElements) {
                                    if (pseudoEl.type === "before" && pseudoEl.node) {
                                        pseudoEl.node.parent = nodeId;
                                        pseudo.before = pseudoEl.node;
                                    }
                                    else if (pseudoEl.type === "after" && pseudoEl.node) {
                                        pseudoEl.node.parent = nodeId;
                                        pseudo.after = pseudoEl.node;
                                    }
                                }
                                return Object.keys(pseudo).length > 0 ? pseudo : undefined;
                            })(),
                            // Flags
                            needsScreenshot: opts.screenshotComplexOnly
                                ? needsScreenshot(styles, el, pseudoElements)
                                : false,
                        };
                        nodes.push(node);
                    }
                    console.log(`[DOM Extraction] First pass complete - ${nodes.length} nodes created`);
                    // Second pass: Build parent-child relationships
                    console.log(`[DOM Extraction] Building parent-child relationships...`);
                    for (let i = 0; i < elementsToProcess; i++) {
                        // ✅ FIX: Progress logging for second pass
                        if (i > 0 && i % 1000 === 0) {
                            console.log(`[DOM Extraction] Linking element ${i}/${elementsToProcess}...`);
                        }
                        const el = elements[i];
                        const nodeId = nodeMap.get(el);
                        if (!nodeId)
                            continue;
                        const node = nodes.find((n) => n.id === nodeId);
                        if (!node)
                            continue;
                        const childNodes = Array.from(el.children)
                            .map((child) => nodeMap.get(child))
                            .filter((id) => id);
                        node.children = childNodes;
                    }
                    console.log(`[DOM Extraction] Hierarchy built - ${nodes.length} nodes with relationships`);
                    // Generate tokens
                    const generateImplicitTokens = (frequency) => {
                        const tokens = {};
                        let colorIndex = 0;
                        let spaceIndex = 0;
                        frequency.forEach((count, value) => {
                            if (count >= 3) {
                                if (value.includes("rgb") || value.startsWith("#")) {
                                    tokens[value] = `color-${++colorIndex}`;
                                }
                                else if (value.includes("px")) {
                                    tokens[value] = `space-${++spaceIndex}`;
                                }
                            }
                        });
                        return tokens;
                    };
                    const inferDesignSystem = (nodes) => {
                        const spacings = new Set();
                        const radii = new Set();
                        const colors = new Set();
                        const fontSizes = new Set();
                        const fontWeights = new Set();
                        nodes.forEach((node) => {
                            if (node.styles.padding) {
                                const values = node.styles.padding.match(/\d+/g);
                                if (values)
                                    values.forEach((v) => spacings.add(parseInt(v)));
                            }
                            if (node.styles.gap) {
                                const value = node.styles.gap.match(/\d+/);
                                if (value)
                                    spacings.add(parseInt(value[0]));
                            }
                            if (node.styles.borderRadius) {
                                const values = node.styles.borderRadius.match(/\d+/g);
                                if (values)
                                    values.forEach((v) => radii.add(parseInt(v)));
                            }
                            if (node.styles.backgroundColor)
                                colors.add(node.styles.backgroundColor);
                            if (node.styles.color)
                                colors.add(node.styles.color);
                            if (node.styles.fontSize) {
                                const size = parseFloat(node.styles.fontSize);
                                if (!isNaN(size))
                                    fontSizes.add(size);
                            }
                            if (node.styles.fontWeight)
                                fontWeights.add(node.styles.fontWeight);
                        });
                        return {
                            spacing: Array.from(spacings).sort((a, b) => a - b),
                            radii: Array.from(radii).sort((a, b) => a - b),
                            colors: Array.from(colors),
                            fontSizes: Array.from(fontSizes).sort((a, b) => a - b),
                            fontWeights: Array.from(fontWeights).sort(),
                        };
                    };
                    // Return final data
                    const elapsed = Date.now() - startTime;
                    console.log(`[DOM Extraction] Completed in ${elapsed}ms - ${nodes.length} nodes extracted`);
                    return {
                        nodes: nodes,
                        tokens: {
                            explicit: cssVars,
                            implicit: generateImplicitTokens(valueFrequency),
                            inferred: inferDesignSystem(nodes),
                        },
                        viewport: {
                            width: window.innerWidth,
                            height: window.innerHeight,
                        },
                    };
                }, { capturePseudoElements, screenshotComplexOnly, renderEnv }),
                // Timeout promise
                new Promise((_, reject) => setTimeout(() => reject(new Error(`DOM extraction timeout after ${DOM_EXTRACTION_TIMEOUT}ms`)), DOM_EXTRACTION_TIMEOUT))
            ]);
        }
        catch (error) {
            console.error('❌ DOM extraction failed or timed out:', error);
            // Return minimal fallback data to allow pipeline to continue
            data = {
                nodes: [],
                tokens: { explicit: {}, implicit: {}, inferred: { spacing: [], radii: [], colors: [], fontSizes: [], fontWeights: [] } },
                viewport: { width: viewport.width, height: viewport.height }
            };
        }
        console.log(`[Phases 3-5] ✅ ${data.nodes.length} nodes`);
        // Attach primary screenshots
        for (const node of data.nodes) {
            const screenshot = await page.evaluate((id) => {
                return window.__primaryScreenshots?.[id];
            }, node.domId || node.id);
            if (screenshot) {
                node.primaryScreenshot = screenshot;
            }
        }
        // ✅ PHASE 6: Text Rasterization
        console.log("[Phase 6] 🎨 Text rasterization...");
        const { nodes: nodesWithRaster, stats: rasterStats } = await processTextRasterization(page, data.nodes, renderEnv);
        console.log(`[Phase 6] ✅ ${rasterStats.rasterized} rasterized`);
        // ✅ PHASE 7: Figma Pre-Conversion
        console.log("[Phase 7] 🎯 Converting to Figma format...");
        for (const node of nodesWithRaster) {
            node.figma = convertToFigmaProperties(node);
        }
        console.log("[Phase 7] ✅ All nodes converted");
        // ✅ PHASE 8: Validation
        console.log("[Phase 8] ✅ Calculating confidence...");
        for (const node of nodesWithRaster) {
            node.validation = validateReconstruction(node);
        }
        const lowConfidence = nodesWithRaster.filter((n) => n.validation?.useFallback).length;
        console.log(`[Phase 8] ✅ ${lowConfidence} nodes flagged for fallback`);
        // ✅ PHASE 9: Optimization
        console.log("[Phase 9] 🔧 Analyzing optimization...");
        for (const node of nodesWithRaster) {
            node.optimization = analyzeOptimization(node, nodesWithRaster);
        }
        const flattenable = nodesWithRaster.filter((n) => n.optimization?.canFlatten).length;
        console.log(`[Phase 9] ✅ ${flattenable} flattenable nodes`);
        // Phase 4: Stacking & Paint Order
        const stackingResult = buildStackingContextTree(nodesWithRaster);
        // Update nodes with stacking context IDs and paint order
        for (let i = 0; i < nodesWithRaster.length; i++) {
            const node = nodesWithRaster[i];
            // Find which stacking context this node belongs to
            const context = stackingResult.stackingContexts.find(ctx => ctx.nodeIds.includes(node.id));
            if (context) {
                node.stackingContextId = context.id;
            }
            // Set paint order index
            const paintIndex = stackingResult.paintOrder.indexOf(node.id);
            if (paintIndex !== -1) {
                if (!node.layout)
                    node.layout = {};
                if (!node.layout.stacking)
                    node.layout.stacking = {};
                node.layout.stacking.paintOrder = paintIndex;
            }
        }
        // Semantic Naming
        const nodesWithNames = applySemanticNaming(nodesWithRaster);
        // Update font usage analysis after DOM extraction is complete
        if (captureFonts && fontAssets.length > 0) {
            console.log("[Font Processing] Analyzing font usage across extracted nodes...");
            fontAssets = updateFontUsageInNodes(fontAssets, { nodes: nodesWithNames });
        }
        // Comprehensive Asset Collection (Images, SVG, Canvas, Video)
        console.log("[Asset Collection] Starting comprehensive asset extraction...");
        const { imageAssets, svgAssets } = await collectAllAssets(page, url);
        console.log(`[Asset Collection] ✅ Collected ${imageAssets.length} image assets, ${svgAssets.length} SVG assets`);
        // Font Faces
        const fontFaces = await detectFontFaces(page, nodesWithNames);
        // Capture screenshots if requested
        let screenshots = {};
        let screenshotCandidates = [];
        if (captureScreenshots && !isAborted) {
            const candidatePool = (screenshotComplexOnly
                ? nodesWithNames.filter((n) => n.needsScreenshot)
                : nodesWithNames).filter(shouldScreenshotNodeCandidate);
            const { nodes: nodesToScreenshot, stats: screenshotPrefilterStats } = prepareScreenshotCandidates(candidatePool);
            screenshotCandidates = nodesToScreenshot;
            if (candidatePool.length !== nodesToScreenshot.length) {
                const skippedHidden = screenshotPrefilterStats.hidden;
                const skippedZeroSize = screenshotPrefilterStats.zeroSize;
                const skippedDetached = screenshotPrefilterStats.detached;
                const skippedTotal = screenshotPrefilterStats.total - screenshotPrefilterStats.eligible;
                console.log(`[Phase 3] ⏭️  Prefiltered ${skippedTotal} screenshot candidates (hidden: ${skippedHidden}, zero-size: ${skippedZeroSize}, detached: ${skippedDetached})`);
            }
            screenshots = await captureElementScreenshots(page, nodesToScreenshot, renderEnv);
            const missingScreenshotNodes = nodesToScreenshot.filter((node) => !screenshots[node.id]);
            if (missingScreenshotNodes.length > 0 &&
                primaryScreenshots?.page?.src) {
                await applyPageScreenshotFallback(missingScreenshotNodes, primaryScreenshots.page, screenshots);
            }
        }
        else if (isAborted) {
            console.log('[Phase 3] ⏱️  Skipping screenshots due to timeout');
        }
        // Capture states if requested
        let states = {};
        if (captureStates && !isAborted) {
            states = await captureInteractionStates(page, nodesWithNames.filter((n) => n.componentHint === "button" || n.componentHint === "input"), renderEnv);
        }
        else if (captureStates && isAborted) {
            console.log('[Phase 3] ⏱️  Skipping state capture due to timeout');
        }
        const extractionDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Extraction complete in ${extractionDuration}s`);
        // Save diagnostic sample
        try {
            const outputPath = path.join(process.cwd(), "extraction-sample.json");
            fs.writeFileSync(outputPath, JSON.stringify({
                nodes: nodesWithNames.slice(0, 5),
                meta: {
                    totalNodes: nodesWithNames.length,
                    phases: "0.5,1,2,3,4,5,6,7,8,9",
                },
            }, null, 2));
            console.log("✅ Diagnostic sample saved:", outputPath);
        }
        catch (error) {
            console.error("Failed to save diagnostic:", error);
        }
        // ✅ FINAL OUTPUT
        const legacyResult = {
            // Phase 1
            loadInfo,
            // Phase 2
            renderEnv,
            // Phase 0.5
            primaryScreenshots,
            // Phases 3-5
            nodes: nodesWithNames,
            // Phase 6
            rasterStats,
            // Phase 4
            paintOrder: stackingResult.paintOrder,
            stackingContexts: stackingResult.stackingContexts,
            // Legacy
            fonts,
            fontFaces,
            screenshots,
            states,
            tokens: data.tokens,
            viewport: data.viewport,
            assets: [...imageAssets, ...svgAssets],
            // Enhanced font assets for IR migration
            fontAssets,
            // Metadata
            meta: {
                url,
                extractedAt: new Date().toISOString(),
                version: "2.0.0-ultimate",
                phases: "0.5,1,2,3,4,5,6,7,8,9,10",
                targetAccuracy: "95-100%",
            },
        };
        // Convert to unified IR schema
        const result = legacyMigrator.migrateFromExtractedData(legacyResult);
        // Compile and normalize IR for Figma-ready output
        console.log("[Phase 10] Starting IR compilation and normalization...");
        const compiledResult = compileIR(result);
        console.log(`[Phase 10] ✅ IR compilation complete - ${compiledResult.nodes.length} nodes normalized`);
        // ✅ PHASE 11: CSS Inheritance Resolution
        console.log("[Phase 11] 🎯 Building CSS inheritance chains...");
        const inheritanceResolver = new CSSInheritanceResolver(compiledResult.nodes);
        const inheritanceChains = inheritanceResolver.resolveAll();
        // Add inheritance chains to nodes
        for (const node of compiledResult.nodes) {
            const chain = inheritanceChains.get(node.id);
            if (chain) {
                node.inheritanceChain = chain;
                node.resolvedStyles = inheritanceResolver.createResolvedStylesSnapshot(chain);
            }
        }
        const inheritedPropsCount = Array.from(inheritanceChains.values())
            .reduce((sum, chain) => sum + Object.keys(chain.inherited).length, 0);
        const explicitPropsCount = Array.from(inheritanceChains.values())
            .reduce((sum, chain) => sum + Object.keys(chain.explicit).length, 0);
        console.log(`[Phase 11] ✅ Inheritance resolution complete - ${inheritedPropsCount} inherited props, ${explicitPropsCount} explicit props`);
        return compiledResult;
    }
    catch (error) {
        console.error('❌ EXTRACTION FAILED:', error);
        throw error;
    }
    finally {
        clearTimeout(extractionTimeout);
        await browser.close();
        console.log('🔒 Browser closed');
    }
}
// ==================== PRESET EXTRACTION MODES ====================
export async function extractBasic(url) {
    return extractComplete(url, {
        captureFonts: false,
        captureScreenshots: false,
        captureStates: false,
        capturePseudoElements: false,
    });
}
export async function extractHybrid(url) {
    return extractComplete(url, {
        captureFonts: true,
        captureScreenshots: true,
        screenshotComplexOnly: true,
        captureStates: false,
        capturePseudoElements: true,
    });
}
export async function extractMaximum(url) {
    return extractComplete(url, {
        captureFonts: true,
        captureScreenshots: true,
        screenshotComplexOnly: false,
        captureStates: true,
        capturePseudoElements: true,
    });
}
// Backward compatibility
export async function extractWithTokens(url) {
    return extractBasic(url);
}
export async function extractWithFontsAndScreenshots(url, options = {}) {
    return extractComplete(url, options);
}
//# sourceMappingURL=scraper.js.map