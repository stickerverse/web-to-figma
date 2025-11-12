"use strict";
/// <reference types="@figma/plugin-typings" />
class ImageAssembler {
    constructor() {
        this.buffers = new Map();
        this.TIMEOUT_MS = 30000;
    }
    addChunk(nodeId, chunkIndex, data, totalChunks) {
        if (!this.buffers.has(nodeId)) {
            this.buffers.set(nodeId, {
                nodeId,
                chunks: new Map(),
                totalChunks,
                receivedChunks: 0,
                createdAt: Date.now(),
            });
        }
        const buffer = this.buffers.get(nodeId);
        const uint8Array = new Uint8Array(data);
        if (!buffer.chunks.has(chunkIndex)) {
            buffer.chunks.set(chunkIndex, uint8Array);
            buffer.receivedChunks += 1;
        }
    }
    isComplete(nodeId) {
        const buffer = this.buffers.get(nodeId);
        if (!buffer)
            return false;
        return buffer.receivedChunks === buffer.totalChunks;
    }
    assemble(nodeId) {
        const buffer = this.buffers.get(nodeId);
        if (!buffer || !this.isComplete(nodeId)) {
            return null;
        }
        const totalSize = Array.from(buffer.chunks.values()).reduce((acc, chunk) => acc + chunk.length, 0);
        const assembled = new Uint8Array(totalSize);
        let offset = 0;
        for (let index = 0; index < buffer.totalChunks; index += 1) {
            const chunk = buffer.chunks.get(index);
            if (!chunk) {
                console.error(`Missing chunk ${index} for node ${nodeId}`);
                return null;
            }
            assembled.set(chunk, offset);
            offset += chunk.length;
        }
        this.buffers.delete(nodeId);
        return assembled;
    }
    cleanupTimedOut() {
        const now = Date.now();
        const timedOut = [];
        for (const [nodeId, buffer] of this.buffers.entries()) {
            if (now - buffer.createdAt > this.TIMEOUT_MS) {
                timedOut.push(nodeId);
                this.buffers.delete(nodeId);
            }
        }
        return timedOut;
    }
    getStatus() {
        const now = Date.now();
        return Array.from(this.buffers.entries()).map(([nodeId, buffer]) => ({
            nodeId,
            progress: `${buffer.receivedChunks}/${buffer.totalChunks}`,
            age: now - buffer.createdAt,
        }));
    }
}
class HierarchyBuilder {
    constructor() {
        this.stats = {
            nodesCreated: 0,
            maxDepth: 0,
            orphanedNodes: 0,
            imageNodes: 0,
            textNodes: 0,
        };
    }
    async buildHierarchy(flatNodes, rootParent, createNodeFn) {
        console.log(`Building hierarchy from ${flatNodes.length} nodes...`);
        const nodeMap = new Map(flatNodes.map((n) => [n.id, n]));
        const roots = flatNodes.filter((node) => {
            if (!node.parent)
                return true;
            const parentExists = nodeMap.has(node.parent);
            if (!parentExists) {
                console.warn(`Orphaned node: ${node.name || node.id} (parent ${node.parent} missing)`);
                this.stats.orphanedNodes++;
                return true;
            }
            return false;
        });
        console.log(`Found ${roots.length} root nodes`);
        for (const rootNode of roots) {
            await this.createNodeRecursive(rootNode, rootParent, flatNodes, nodeMap, createNodeFn, 0);
        }
        console.log("✓ Hierarchy build complete:", this.stats);
    }
    async createNodeRecursive(nodeData, figmaParent, allNodes, nodeMap, createNodeFn, depth) {
        this.stats.maxDepth = Math.max(this.stats.maxDepth, depth);
        try {
            const figmaNode = await createNodeFn(nodeData, figmaParent);
            if (!figmaNode) {
                console.warn(`Failed to create node: ${nodeData.name || nodeData.id}`);
                return null;
            }
            this.stats.nodesCreated++;
            if (nodeData.type === "IMAGE")
                this.stats.imageNodes++;
            if (nodeData.type === "TEXT")
                this.stats.textNodes++;
            const children = allNodes
                .filter((n) => n.parent === nodeData.id)
                .sort((a, b) => {
                var _a, _b;
                const zA = ((_a = a.styles) === null || _a === void 0 ? void 0 : _a.zIndex) ? parseInt(a.styles.zIndex) : 0;
                const zB = ((_b = b.styles) === null || _b === void 0 ? void 0 : _b.zIndex) ? parseInt(b.styles.zIndex) : 0;
                return zA - zB;
            });
            if (children.length > 0 && "appendChild" in figmaNode) {
                for (const childData of children) {
                    await this.createNodeRecursive(childData, figmaNode, allNodes, nodeMap, createNodeFn, depth + 1);
                }
            }
            return figmaNode;
        }
        catch (error) {
            console.error(`Error creating ${nodeData.name || nodeData.id}:`, error);
            return null;
        }
    }
    getStats() {
        return Object.assign({}, this.stats);
    }
}
console.log("Final plugin loaded - All Phases (1-6) + Hierarchy Fix");
// Show the plugin UI so users can interact with the converter
figma.showUI(__html__, {
    width: 420,
    height: 640,
    themeColors: true,
});
let tokenVariables = {};
let nodeBuffer = [];
let isProcessing = false;
let loadedFonts = new Set();
let fontMapping = {};
const imageAssembler = new ImageAssembler();
const pendingImageNodes = new Map();
const streamScreenshots = {};
const streamStates = {};
const streamCreatedNodes = new Map();
let totalStreamNodesProcessed = 0;
const STREAM_ASSEMBLY_TIMEOUT_MS = 10000;
let SERVER_PORT = 3000; // Default, will be updated from UI
function resetStreamState() {
    pendingImageNodes.clear();
    streamCreatedNodes.clear();
    totalStreamNodesProcessed = 0;
    for (const key of Object.keys(streamScreenshots)) {
        delete streamScreenshots[key];
    }
    for (const key of Object.keys(streamStates)) {
        delete streamStates[key];
    }
}
function applyVariableFill(node, variable) {
    if (!figma.variables)
        return;
    const fills = node.fills;
    let basePaint = null;
    if (fills && fills !== figma.mixed) {
        basePaint =
            fills.find((paint) => paint.type === "SOLID") ||
                null;
    }
    if (!basePaint) {
        basePaint = {
            type: "SOLID",
            color: { r: 0, g: 0, b: 0 },
            opacity: 1,
        };
    }
    const boundPaint = figma.variables.setBoundVariableForPaint(basePaint, "color", variable);
    node.fills = [boundPaint];
}
figma.ui.onmessage = async (msg) => {
    try {
        const streamTypes = new Set([
            "NODES",
            "FONTS",
            "TOKENS",
            "COMPLETE",
            "PROGRESS",
            "ERROR",
        ]);
        if (typeof msg === "object" && msg !== null) {
            const typedMsg = msg;
            if (typedMsg.type === "IMAGE_CHUNK") {
                handleImageChunk(typedMsg);
                return;
            }
            if (streamTypes.has(typedMsg.type)) {
                await handleStreamEnvelope(typedMsg);
                return;
            }
        }
        const legacy = msg;
        switch (legacy.type) {
            case "server_config":
                SERVER_PORT = legacy.serverPort || 3000;
                console.log(`Server port updated to: ${SERVER_PORT}`);
                break;
            case "full_page":
                await processFullPage(legacy.data);
                break;
            case "tokens":
                tokenVariables = await createFigmaVariables(legacy.data);
                break;
            case "node_chunk":
                nodeBuffer.push(...legacy.data);
                if (!isProcessing) {
                    isProcessing = true;
                    await processBufferedNodes();
                }
                break;
            case "complete":
                figma.ui.postMessage({ type: "import_complete" });
                break;
            case "error":
                figma.notify(legacy.error, { error: true });
                break;
        }
    }
    catch (error) {
        console.error(error);
        figma.notify("Error processing data", { error: true });
    }
};
async function handleStreamEnvelope(msg) {
    var _a, _b;
    switch (msg.type) {
        case "TOKENS":
            resetStreamState();
            tokenVariables = await createFigmaVariables(msg.payload || {});
            break;
        case "FONTS":
            if (Array.isArray(msg.payload)) {
                await processFonts(msg.payload);
            }
            break;
        case "NODES":
            if ((_a = msg.payload) === null || _a === void 0 ? void 0 : _a.nodes) {
                await handleStreamNodeBatch(msg.payload.nodes);
            }
            break;
        case "PROGRESS":
            figma.ui.postMessage(Object.assign({ type: "PROGRESS_UPDATE" }, msg.payload));
            break;
        case "ERROR":
            figma.notify(`Error: ${((_b = msg.payload) === null || _b === void 0 ? void 0 : _b.message) || "Unknown error"}`, {
                error: true,
            });
            break;
        case "COMPLETE":
            await handleStreamComplete(msg.payload);
            break;
    }
}
// ✅ UPDATED: Use hierarchy builder for streaming
async function handleStreamNodeBatch(nodes) {
    const streamFullData = {
        screenshots: streamScreenshots,
        states: streamStates,
    };
    // ✅ Use hierarchy builder for stream too
    const builder = new HierarchyBuilder();
    // Separate nodes into regular and deferred (image chunks)
    const regularNodes = nodes.filter((n) => { var _a; return !((_a = n.imageChunkRef) === null || _a === void 0 ? void 0 : _a.isStreamed); });
    const deferredNodes = nodes.filter((n) => { var _a; return (_a = n.imageChunkRef) === null || _a === void 0 ? void 0 : _a.isStreamed; });
    // Store screenshots and states
    for (const node of nodes) {
        if (node.screenshot) {
            streamScreenshots[node.id] = node.screenshot;
        }
        if (node.states) {
            streamStates[node.id] = node.states;
        }
    }
    // Defer image nodes
    for (const node of deferredNodes) {
        pendingImageNodes.set(node.id, node);
        console.log(`Deferring image node ${node.id} (waiting for ${node.imageChunkRef.totalChunks} chunks)`);
    }
    // Build hierarchy for regular nodes
    if (regularNodes.length > 0) {
        await builder.buildHierarchy(regularNodes, figma.currentPage, async (nodeData, parent) => {
            const figmaNode = await createEnhancedNode(nodeData, parent, streamFullData, streamCreatedNodes);
            if (figmaNode) {
                streamCreatedNodes.set(nodeData.id, figmaNode);
            }
            return figmaNode;
        });
        const stats = builder.getStats();
        totalStreamNodesProcessed += stats.nodesCreated;
    }
    figma.ui.postMessage({
        type: "PROGRESS_UPDATE",
        nodesProcessed: totalStreamNodesProcessed,
    });
}
function handleImageChunk(chunk) {
    imageAssembler.addChunk(chunk.nodeId, chunk.chunkIndex, chunk.data, chunk.totalChunks);
    if (imageAssembler.isComplete(chunk.nodeId)) {
        void createPendingImageNode(chunk.nodeId);
    }
}
function createPlaceholderForFailedImage(node) {
    var _a, _b, _c, _d;
    const placeholder = figma.createRectangle();
    placeholder.name = `Failed Image: ${node.id}`;
    placeholder.resize(Math.max(1, ((_a = node.rect) === null || _a === void 0 ? void 0 : _a.width) || 100), Math.max(1, ((_b = node.rect) === null || _b === void 0 ? void 0 : _b.height) || 100));
    placeholder.fills = [
        {
            type: "SOLID",
            color: { r: 0.9, g: 0.9, b: 0.9 },
        },
    ];
    placeholder.x = ((_c = node.rect) === null || _c === void 0 ? void 0 : _c.x) || 0;
    placeholder.y = ((_d = node.rect) === null || _d === void 0 ? void 0 : _d.y) || 0;
    return placeholder;
}
async function createPendingImageNode(nodeId) {
    const node = pendingImageNodes.get(nodeId);
    if (!node) {
        console.error(`No pending node found for ${nodeId}`);
        return;
    }
    const assembled = imageAssembler.assemble(nodeId);
    if (!assembled) {
        console.error(`Failed to assemble image for node ${nodeId}`);
        return;
    }
    node.imageData = Array.from(assembled);
    delete node.imageChunkRef;
    const streamFullData = {
        screenshots: streamScreenshots,
        states: streamStates,
    };
    const figmaNode = await createEnhancedNode(node, figma.currentPage, streamFullData, streamCreatedNodes);
    if (figmaNode) {
        streamCreatedNodes.set(node.id, figmaNode);
        totalStreamNodesProcessed += 1;
    }
    pendingImageNodes.delete(nodeId);
    figma.ui.postMessage({
        type: "IMAGE_ASSEMBLED",
        nodeId,
        nodesProcessed: totalStreamNodesProcessed,
    });
}
async function handleStreamComplete(payload) {
    const maxWait = STREAM_ASSEMBLY_TIMEOUT_MS;
    const startTime = Date.now();
    while (pendingImageNodes.size > 0 && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const timedOut = imageAssembler.cleanupTimedOut();
        if (timedOut.length > 0) {
            for (const nodeId of timedOut) {
                const node = pendingImageNodes.get(nodeId);
                if (!node)
                    continue;
                const placeholder = createPlaceholderForFailedImage(node);
                figma.currentPage.appendChild(placeholder);
                streamCreatedNodes.set(nodeId, placeholder);
                pendingImageNodes.delete(nodeId);
                totalStreamNodesProcessed += 1;
            }
        }
    }
    if (pendingImageNodes.size > 0) {
        const stuck = Array.from(pendingImageNodes.keys());
        console.error(`${pendingImageNodes.size} images never completed:`, stuck);
        for (const nodeId of stuck) {
            const node = pendingImageNodes.get(nodeId);
            if (!node)
                continue;
            const placeholder = createPlaceholderForFailedImage(node);
            figma.currentPage.appendChild(placeholder);
            streamCreatedNodes.set(nodeId, placeholder);
            pendingImageNodes.delete(nodeId);
            totalStreamNodesProcessed += 1;
        }
    }
    figma.notify(`✓ Import complete: ${totalStreamNodesProcessed} nodes created`, { timeout: 3000 });
    console.log("Import stats:", payload);
}
// ✅ UPDATED: Use hierarchy builder for full page import
async function processFullPage(data) {
    const startTime = Date.now();
    // Step 1: Process fonts
    if (data.fonts && data.fonts.length > 0) {
        console.log(`Processing ${data.fonts.length} fonts...`);
        await processFonts(data.fonts);
    }
    // Step 2: Create design tokens
    if (data.tokens) {
        tokenVariables = await createFigmaVariables(data.tokens);
    }
    // Step 3: Create container
    const container = figma.createFrame();
    container.name = "Imported Page";
    container.x = 0;
    container.y = 0;
    container.resize(data.viewport.width, data.viewport.height);
    container.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    container.clipsContent = false;
    // ✅ Step 4: Build hierarchy using HierarchyBuilder
    const builder = new HierarchyBuilder();
    const createdNodes = new Map();
    await builder.buildHierarchy(data.nodes, container, async (nodeData, parent) => {
        const figmaNode = await createEnhancedNode(nodeData, parent, data, createdNodes);
        if (figmaNode) {
            createdNodes.set(nodeData.id, figmaNode);
        }
        return figmaNode;
    });
    const stats = builder.getStats();
    figma.currentPage.appendChild(container);
    figma.viewport.scrollAndZoomIntoView([container]);
    const elapsed = Date.now() - startTime;
    figma.notify(`✓ Import complete: ${stats.nodesCreated} nodes (${stats.maxDepth} levels) in ${elapsed}ms`, { timeout: 3000 });
}
async function processBufferedNodes() {
    while (nodeBuffer.length > 0) {
        const batch = nodeBuffer.splice(0, 20);
        for (const node of batch) {
            await createEnhancedNode(node, figma.currentPage, {}, new Map());
        }
        await new Promise((r) => setTimeout(r, 10));
    }
    isProcessing = false;
}
/**
 * PHASE 2: Font Processing & Mapping
 */
async function processFonts(fonts) {
    const fontFamilies = new Set();
    fonts.forEach((font) => {
        fontFamilies.add(font.family);
    });
    console.log("Detected font families:", Array.from(fontFamilies));
    for (const family of fontFamilies) {
        const figmaFont = mapToFigmaFont(family);
        fontMapping[family] = figmaFont;
        // Pre-load common weights
        const weights = ["Regular", "Medium", "Semi Bold", "Bold", "Light"];
        for (const weight of weights) {
            try {
                await figma.loadFontAsync({ family: figmaFont.family, style: weight });
                loadedFonts.add(`${figmaFont.family}__${weight}`);
            }
            catch (e) {
                // Weight not available
            }
        }
        console.log(`✓ Loaded font: ${figmaFont.family}`);
    }
}
function mapToFigmaFont(webFont) {
    const cleanFont = webFont
        .toLowerCase()
        .replace(/['"]/g, "")
        .split(",")[0]
        .trim();
    const fontMap = {
        inter: "Inter",
        roboto: "Roboto",
        "open sans": "Open Sans",
        lato: "Lato",
        montserrat: "Montserrat",
        "source sans pro": "Source Sans Pro",
        raleway: "Raleway",
        poppins: "Poppins",
        nunito: "Nunito",
        ubuntu: "Ubuntu",
        "playfair display": "Playfair Display",
        merriweather: "Merriweather",
        "work sans": "Work Sans",
        arial: "Arial",
        helvetica: "Helvetica",
        "helvetica neue": "Helvetica Neue",
        "times new roman": "Times New Roman",
        georgia: "Georgia",
        "courier new": "Courier New",
        verdana: "Verdana",
        "trebuchet ms": "Trebuchet MS",
        "sans-serif": "Inter",
        serif: "Roboto Serif",
        monospace: "Roboto Mono",
    };
    return { family: fontMap[cleanFont] || "Inter", style: "Regular" };
}
/**
 * PHASE 3-6: Enhanced Node Creation with All Features
 * NOTE: This function is called by HierarchyBuilder recursively
 */
async function createEnhancedNode(nodeData, parent, fullData, createdNodes) {
    let node = null;
    try {
        const hasScreenshot = fullData.screenshots && fullData.screenshots[nodeData.id];
        const hasStates = fullData.states && fullData.states[nodeData.id];
        // Create base node based on type
        if (nodeData.type === "TEXT" && nodeData.text) {
            node = await createTextNode(nodeData, hasScreenshot);
        }
        else if (nodeData.type === "IMAGE" && nodeData.image) {
            node = await createImageNode(nodeData);
        }
        else if (nodeData.type === "SVG" && nodeData.svg) {
            node = await createSVGNode(nodeData);
        }
        else {
            node = await createFrameNode(nodeData, hasScreenshot);
        }
        if (!node)
            return null;
        // Apply common properties
        node.x = nodeData.rect.x;
        node.y = nodeData.rect.y;
        if ("resize" in node) {
            node.resize(Math.max(1, nodeData.rect.width), Math.max(1, nodeData.rect.height));
        }
        // PHASE 3: Apply screenshot as background
        if (hasScreenshot && "appendChild" in node) {
            await applyScreenshotBackground(node, fullData.screenshots[nodeData.id]);
        }
        // PHASE 5: Apply advanced effects
        await applyAdvancedEffects(node, nodeData.styles);
        // PHASE 6: Apply pseudo-elements
        if (nodeData.pseudoElements && "appendChild" in node) {
            for (const pseudo of nodeData.pseudoElements) {
                await createPseudoElement(node, pseudo);
            }
        }
        // PHASE 6: Create state variants
        if (hasStates && "appendChild" in node) {
            await createStateVariants(node, fullData.states[nodeData.id]);
        }
        node.name =
            nodeData.name || nodeData.componentHint || nodeData.tag || "element";
        // ✅ Parent is now passed by HierarchyBuilder
        if (parent && "appendChild" in parent) {
            parent.appendChild(node);
        }
        return node;
    }
    catch (error) {
        console.error("Error creating node:", error, nodeData);
        return null;
    }
}
/**
 * Create text node with proper typography
 */
async function createTextNode(nodeData, hasScreenshot) {
    var _a, _b;
    const textNode = figma.createText();
    // Determine font
    let fontFamily = "Inter";
    let fontStyle = "Regular";
    if (nodeData.styles.fontFamily) {
        const webFontFamily = nodeData.styles.fontFamily
            .split(",")[0]
            .replace(/['"]/g, "")
            .trim();
        const mapped = fontMapping[webFontFamily] || mapToFigmaFont(webFontFamily);
        fontFamily = mapped.family;
        fontStyle = mapped.style;
    }
    // Determine style based on weight
    if (nodeData.styles.fontWeight) {
        const weight = parseInt(nodeData.styles.fontWeight);
        if (weight >= 700)
            fontStyle = "Bold";
        else if (weight >= 600)
            fontStyle = "Semi Bold";
        else if (weight >= 500)
            fontStyle = "Medium";
        else if (weight < 400)
            fontStyle = "Light";
    }
    await ensureFontLoaded(fontFamily, fontStyle);
    textNode.fontName = { family: fontFamily, style: fontStyle };
    textNode.characters = nodeData.text || "";
    // Apply text styles
    if (nodeData.styles.fontSize) {
        textNode.fontSize = parseFloat(nodeData.styles.fontSize);
    }
    if (nodeData.styles.color && !hasScreenshot) {
        const colorToken = tokenVariables[nodeData.styles.color];
        if (colorToken) {
            applyVariableFill(textNode, colorToken);
        }
        else {
            const color = parseColor(nodeData.styles.color);
            if (color) {
                textNode.fills = [
                    Object.assign({ type: "SOLID", color: { r: color.r, g: color.g, b: color.b } }, (color.a !== 1 ? { opacity: color.a } : {})),
                ];
            }
        }
    }
    else if (hasScreenshot) {
        textNode.opacity = 0.01;
    }
    if (nodeData.styles.letterSpacing) {
        const value = parseFloat(nodeData.styles.letterSpacing);
        if (!isNaN(value)) {
            textNode.letterSpacing = { value, unit: "PIXELS" };
        }
    }
    if (nodeData.styles.lineHeight && nodeData.styles.lineHeight !== "normal") {
        const value = parseFloat(nodeData.styles.lineHeight);
        if (!isNaN(value)) {
            textNode.lineHeight = { value, unit: "PIXELS" };
        }
    }
    if (nodeData.styles.textAlign) {
        const align = nodeData.styles.textAlign.toUpperCase();
        if (["LEFT", "CENTER", "RIGHT", "JUSTIFIED"].includes(align)) {
            textNode.textAlignHorizontal = align;
        }
    }
    if (nodeData.styles.textTransform === "uppercase") {
        textNode.textCase = "UPPER";
    }
    else if (nodeData.styles.textTransform === "lowercase") {
        textNode.textCase = "LOWER";
    }
    else if (nodeData.styles.textTransform === "capitalize") {
        textNode.textCase = "TITLE";
    }
    if ((_a = nodeData.styles.textDecoration) === null || _a === void 0 ? void 0 : _a.includes("underline")) {
        textNode.textDecoration = "UNDERLINE";
    }
    else if ((_b = nodeData.styles.textDecoration) === null || _b === void 0 ? void 0 : _b.includes("line-through")) {
        textNode.textDecoration = "STRIKETHROUGH";
    }
    return textNode;
}
/**
 * Create image node with proxy support
 */
async function createImageNode(nodeData) {
    const rect = figma.createRectangle();
    if (nodeData.imageData && nodeData.imageData.length > 0) {
        try {
            const bytes = new Uint8Array(nodeData.imageData);
            const image = figma.createImage(bytes);
            rect.fills = [
                {
                    type: "IMAGE",
                    imageHash: image.hash,
                    scaleMode: "FILL",
                },
            ];
        }
        catch (error) {
            console.error("Failed to apply inline image data:", error);
            rect.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
        }
    }
    else if (nodeData.image) {
        let imageData = nodeData.image.data;
        if (!imageData && nodeData.image.needsProxy) {
            const proxiedUrl = `http://localhost:${SERVER_PORT}/proxy-image?url=${encodeURIComponent(nodeData.image.url)}`;
            try {
                const response = await fetch(proxiedUrl);
                const buffer = await response.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                const image = figma.createImage(bytes);
                rect.fills = [
                    {
                        type: "IMAGE",
                        imageHash: image.hash,
                        scaleMode: "FILL",
                    },
                ];
            }
            catch (e) {
                console.error("Image proxy failed:", e);
                rect.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
            }
        }
        else if (imageData) {
            const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
            const bytes = figma.base64Decode(base64);
            const image = figma.createImage(bytes);
            rect.fills = [
                {
                    type: "IMAGE",
                    imageHash: image.hash,
                    scaleMode: "FILL",
                },
            ];
        }
    }
    return rect;
}
/**
 * PHASE 4: Create SVG node
 */
async function createSVGNode(nodeData) {
    const frame = figma.createFrame();
    frame.name = "SVG";
    // Note: Figma Plugin API has limited SVG support
    // Best approach: Rasterize on server and import as image
    // For now, create placeholder
    frame.fills = [
        {
            type: "SOLID",
            color: { r: 0.95, g: 0.95, b: 0.95 },
        },
    ];
    return frame;
}
/**
 * Create frame node with auto-layout
 */
async function createFrameNode(nodeData, hasScreenshot) {
    var _a, _b;
    const frame = figma.createFrame();
    // Apply background
    if (!hasScreenshot) {
        if ((_a = nodeData.styles.backgroundImage) === null || _a === void 0 ? void 0 : _a.includes("gradient")) {
            const gradient = parseGradient(nodeData.styles.backgroundImage);
            if (gradient) {
                frame.fills = [gradient];
            }
        }
        else if ((_b = nodeData.styles.backgroundImage) === null || _b === void 0 ? void 0 : _b.includes("url")) {
            // Background image
            const urlMatch = nodeData.styles.backgroundImage.match(/url\(['"]?([^'"()]+)['"]?\)/);
            if (urlMatch) {
                try {
                    const proxiedUrl = `http://localhost:${SERVER_PORT}/proxy-image?url=${encodeURIComponent(urlMatch[1])}`;
                    const response = await fetch(proxiedUrl);
                    const buffer = await response.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    const image = figma.createImage(bytes);
                    frame.fills = [
                        {
                            type: "IMAGE",
                            imageHash: image.hash,
                            scaleMode: "FILL",
                        },
                    ];
                }
                catch (e) {
                    console.warn("Background image failed");
                }
            }
        }
        else if (nodeData.styles.backgroundColor) {
            const bgToken = tokenVariables[nodeData.styles.backgroundColor];
            if (bgToken) {
                applyVariableFill(frame, bgToken);
            }
            else {
                const color = parseColor(nodeData.styles.backgroundColor);
                if (color) {
                    frame.fills = [
                        Object.assign({ type: "SOLID", color: { r: color.r, g: color.g, b: color.b } }, (color.a !== 1 ? { opacity: color.a } : {})),
                    ];
                }
            }
        }
        else {
            frame.fills = [];
        }
    }
    // Apply auto-layout
    if (nodeData.styles.display === "flex") {
        frame.layoutMode =
            nodeData.styles.flexDirection === "column" ? "VERTICAL" : "HORIZONTAL";
        if (nodeData.styles.gap) {
            const gap = parseFloat(nodeData.styles.gap);
            if (!isNaN(gap))
                frame.itemSpacing = gap;
        }
        if (nodeData.styles.padding) {
            const values = nodeData.styles.padding.match(/[\d.]+/g);
            if (values) {
                const [top, right, bottom, left] = values.map((value) => parseFloat(value));
                frame.paddingTop = top || 0;
                frame.paddingRight = right || top || 0;
                frame.paddingBottom = bottom || top || 0;
                frame.paddingLeft = left || right || top || 0;
            }
        }
        if (nodeData.styles.justifyContent) {
            const map = {
                "flex-start": "MIN",
                center: "CENTER",
                "flex-end": "MAX",
                "space-between": "SPACE_BETWEEN",
            };
            if (map[nodeData.styles.justifyContent]) {
                frame.primaryAxisAlignItems = map[nodeData.styles.justifyContent];
            }
        }
        if (nodeData.styles.alignItems) {
            const map = {
                "flex-start": "MIN",
                center: "CENTER",
                "flex-end": "MAX",
                stretch: "STRETCH",
            };
            if (map[nodeData.styles.alignItems]) {
                frame.counterAxisAlignItems = map[nodeData.styles.alignItems];
            }
        }
    }
    // Border radius
    if (nodeData.styles.borderRadius) {
        const values = nodeData.styles.borderRadius.match(/[\d.]+/g);
        if (values) {
            const radii = values.map((value) => parseFloat(value));
            frame.topLeftRadius = radii[0] || 0;
            frame.topRightRadius = radii[1] || radii[0] || 0;
            frame.bottomRightRadius = radii[2] || radii[0] || 0;
            frame.bottomLeftRadius = radii[3] || radii[1] || radii[0] || 0;
        }
    }
    // Border
    if (nodeData.styles.border || nodeData.styles.borderWidth) {
        const color = parseColor(nodeData.styles.borderColor || "#000000");
        const width = parseFloat(nodeData.styles.borderWidth || "1");
        if (color && !isNaN(width)) {
            frame.strokes = [
                {
                    type: "SOLID",
                    color: { r: color.r, g: color.g, b: color.b },
                },
            ];
            frame.strokeWeight = width;
        }
    }
    // Opacity
    if (nodeData.styles.opacity) {
        frame.opacity = parseFloat(nodeData.styles.opacity);
    }
    // Transform
    if (nodeData.styles.transform) {
        const rotateMatch = nodeData.styles.transform.match(/rotate\(([^)]+)deg\)/);
        if (rotateMatch) {
            frame.rotation = parseFloat(rotateMatch[1]);
        }
    }
    // Overflow
    if (nodeData.styles.overflow === "hidden" ||
        nodeData.styles.overflowX === "hidden") {
        frame.clipsContent = true;
    }
    return frame;
}
/**
 * PHASE 5: Apply advanced effects
 */
async function applyAdvancedEffects(node, styles) {
    if (!("effects" in node))
        return;
    const effects = [];
    // Box shadow (multi-layer support)
    if (styles.boxShadow && styles.boxShadow !== "none") {
        const shadows = parseBoxShadow(styles.boxShadow);
        effects.push(...shadows);
    }
    // Filters (limited Figma support)
    if (styles.filter && styles.filter !== "none") {
        const blurMatch = styles.filter.match(/blur\(([\d.]+)px\)/);
        if (blurMatch) {
            effects.push({
                type: "LAYER_BLUR",
                blurType: "NORMAL",
                radius: parseFloat(blurMatch[1]),
                visible: true,
            });
        }
    }
    if (effects.length > 0) {
        node.effects = effects;
    }
}
/**
 * PHASE 3: Apply screenshot as background
 */
async function applyScreenshotBackground(frame, screenshotBase64) {
    try {
        const bytes = figma.base64Decode(screenshotBase64);
        const image = figma.createImage(bytes);
        const bg = figma.createRectangle();
        bg.name = "__screenshot-bg";
        bg.resize(frame.width, frame.height);
        bg.fills = [
            {
                type: "IMAGE",
                imageHash: image.hash,
                scaleMode: "FILL",
            },
        ];
        frame.appendChild(bg);
        frame.insertChild(0, bg);
    }
    catch (e) {
        console.error("Screenshot background failed:", e);
    }
}
/**
 * PHASE 6: Create pseudo-element
 */
async function createPseudoElement(parent, pseudo) {
    if (!pseudo.content)
        return;
    const pseudoFrame = figma.createFrame();
    pseudoFrame.name = `::${pseudo.type}`;
    pseudoFrame.x = 0;
    pseudoFrame.y = 0;
    pseudoFrame.resize(20, 20);
    // Apply styles
    if (pseudo.styles.backgroundColor) {
        const color = parseColor(pseudo.styles.backgroundColor);
        if (color) {
            pseudoFrame.fills = [
                {
                    type: "SOLID",
                    color: { r: color.r, g: color.g, b: color.b },
                },
            ];
        }
    }
    parent.appendChild(pseudoFrame);
    if (pseudo.type === "before") {
        parent.insertChild(0, pseudoFrame);
    }
}
/**
 * PHASE 6: Create state variants
 */
async function createStateVariants(node, states) {
    // Create component set with variants for states
    // For now, just add a note
    node.name = `${node.name} (has states: ${Object.keys(states).join(", ")})`;
}
/**
 * PHASE 5: Parse gradient
 */
function parseGradient(gradientString) {
    if (!gradientString.includes("linear-gradient"))
        return null;
    try {
        const match = gradientString.match(/linear-gradient\(([^)]+)\)/);
        if (!match)
            return null;
        const content = match[1];
        let angle = 180; // Default
        let colorStops = [];
        // Check for angle
        const parts = content.split(",").map((s) => s.trim());
        if (parts[0].includes("deg") || parts[0].includes("to ")) {
            if (parts[0].includes("deg")) {
                angle = parseFloat(parts[0]);
            }
            else if (parts[0] === "to right")
                angle = 90;
            else if (parts[0] === "to left")
                angle = 270;
            else if (parts[0] === "to top")
                angle = 0;
            else if (parts[0] === "to bottom")
                angle = 180;
            colorStops = parts.slice(1);
        }
        else {
            colorStops = parts;
        }
        const stops = [];
        for (let i = 0; i < colorStops.length; i++) {
            const stop = colorStops[i];
            const match = stop.match(/^(.*?)\s+([\d.]+)%?$/);
            if (match) {
                const color = parseColor(match[1]);
                const position = parseFloat(match[2]) / 100;
                if (color) {
                    stops.push({
                        color: { r: color.r, g: color.g, b: color.b, a: color.a },
                        position,
                    });
                }
            }
            else {
                const color = parseColor(stop);
                if (color) {
                    stops.push({
                        color: { r: color.r, g: color.g, b: color.b, a: color.a },
                        position: i / (colorStops.length - 1),
                    });
                }
            }
        }
        if (stops.length < 2)
            return null;
        // Convert angle to transform matrix
        const rad = (angle * Math.PI) / 180;
        const transform = [
            [Math.cos(rad), Math.sin(rad), 0.5],
            [-Math.sin(rad), Math.cos(rad), 0.5],
        ];
        return {
            type: "GRADIENT_LINEAR",
            gradientTransform: transform,
            gradientStops: stops,
        };
    }
    catch (e) {
        console.warn("Gradient parsing failed:", e);
        return null;
    }
}
/**
 * PHASE 5: Parse box shadow (multi-layer)
 */
function parseBoxShadow(shadowString) {
    const shadows = shadowString.split(/,(?![^(]*\))/);
    const effects = [];
    for (const shadow of shadows) {
        const trimmed = shadow.trim();
        const isInset = trimmed.startsWith("inset");
        const str = isInset ? trimmed.substring(5).trim() : trimmed;
        const parts = str.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px)?\s+(.+)/);
        if (parts) {
            const color = parseColor(parts[5]) || { r: 0, g: 0, b: 0, a: 0.25 };
            effects.push({
                type: isInset ? "INNER_SHADOW" : "DROP_SHADOW",
                offset: {
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2]),
                },
                radius: parseFloat(parts[3]),
                spread: parts[4] ? parseFloat(parts[4]) : 0,
                color: { r: color.r, g: color.g, b: color.b, a: color.a },
                blendMode: "NORMAL",
                visible: true,
            });
        }
    }
    return effects;
}
/**
 * Parse color string
 */
function parseColor(color) {
    if (!color)
        return null;
    try {
        color = color.trim();
        // Hex
        if (color.startsWith("#")) {
            const hex = color.replace("#", "");
            if (hex.length === 3) {
                const r = parseInt(hex[0] + hex[0], 16);
                const g = parseInt(hex[1] + hex[1], 16);
                const b = parseInt(hex[2] + hex[2], 16);
                return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
            }
            if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
            }
            if (hex.length === 8) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                const a = parseInt(hex.substring(6, 8), 16);
                return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
            }
        }
        // RGB/RGBA
        if (color.startsWith("rgb")) {
            const values = color.match(/[\d.]+/g);
            if (values && values.length >= 3) {
                const alpha = values.length >= 4 ? parseFloat(values[3]) : 1;
                return {
                    r: parseFloat(values[0]) / 255,
                    g: parseFloat(values[1]) / 255,
                    b: parseFloat(values[2]) / 255,
                    a: alpha > 1 ? alpha / 255 : alpha,
                };
            }
        }
        // Named colors
        const named = {
            black: "#000000",
            white: "#ffffff",
            red: "#ff0000",
            green: "#008000",
            blue: "#0000ff",
            yellow: "#ffff00",
            transparent: "rgba(0,0,0,0)",
        };
        if (named[color.toLowerCase()]) {
            return parseColor(named[color.toLowerCase()]);
        }
    }
    catch (e) { }
    return null;
}
/**
 * Ensure font is loaded
 */
async function ensureFontLoaded(family, style) {
    const key = `${family}__${style}`;
    if (loadedFonts.has(key))
        return;
    try {
        await figma.loadFontAsync({ family, style });
        loadedFonts.add(key);
    }
    catch (e) {
        try {
            await figma.loadFontAsync({ family, style: "Regular" });
            loadedFonts.add(`${family}__Regular`);
        }
        catch (e2) {
            await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            loadedFonts.add("Inter__Regular");
        }
    }
}
/**
 * Create Figma variables from tokens
 */
async function createFigmaVariables(tokens) {
    const variables = {};
    try {
        if (!figma.variables)
            return variables;
        const collections = {
            colors: figma.variables.createVariableCollection("Colors"),
            spacing: figma.variables.createVariableCollection("Spacing"),
            radii: figma.variables.createVariableCollection("Radii"),
        };
        // Process explicit tokens (CSS variables)
        for (const [cssVar, value] of Object.entries(tokens.explicit || {})) {
            if (typeof value !== "string")
                continue;
            const cleanName = String(cssVar).replace(/^--/, "").replace(/-/g, "/");
            if (value.includes("rgb") || value.includes("#")) {
                const variable = figma.variables.createVariable(cleanName, collections.colors, "COLOR");
                const color = parseColor(value);
                if (color) {
                    variable.setValueForMode(collections.colors.modes[0].modeId, {
                        r: color.r,
                        g: color.g,
                        b: color.b,
                        a: color.a,
                    });
                    variables[cssVar] = variable;
                }
            }
            else if (value.includes("px")) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    const variable = figma.variables.createVariable(cleanName, collections.spacing, "FLOAT");
                    variable.setValueForMode(collections.spacing.modes[0].modeId, numValue);
                    variables[cssVar] = variable;
                }
            }
        }
        // Process implicit tokens
        for (const [value, name] of Object.entries(tokens.implicit || {})) {
            if (typeof name !== "string" || typeof value !== "string")
                continue;
            if (value.includes("rgb") || value.includes("#")) {
                const variable = figma.variables.createVariable(name, collections.colors, "COLOR");
                const color = parseColor(value);
                if (color) {
                    variable.setValueForMode(collections.colors.modes[0].modeId, {
                        r: color.r,
                        g: color.g,
                        b: color.b,
                        a: color.a,
                    });
                    variables[value] = variable;
                }
            }
        }
    }
    catch (error) {
        console.error("Variable creation failed:", error);
    }
    return variables;
}
