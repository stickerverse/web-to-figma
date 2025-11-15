"use strict";
/**
 * UNIFIED INTERMEDIATE REPRESENTATION (IR) - SINGLE CANONICAL SCHEMA
 *
 * Clean, unified type definitions for web-to-Figma data exchange
 * Optimized for pixel-perfect layout, browser-accurate typography,
 * multi-layer backgrounds & effects, SVG/vector support, and asset streaming
 *
 * This is the SINGLE SOURCE OF TRUTH between:
 * - scraper/src/scraper.ts (producer)
 * - scraper/src/server.ts + stream-controller.ts (transport)
 * - plugin/src/builder/* (consumer)
 *
 * MIGRATED FROM: Legacy multi-phase IR (0.5-9) to unified schema
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyMigrator = exports.InheritanceUtils = exports.CSSInheritanceResolver = exports.INHERITABLE_PROPERTIES = exports.LegacyIRMigrator = exports.GridUtils = exports.FlexboxUtils = void 0;
exports.isTextNode = isTextNode;
exports.isImageNode = isImageNode;
exports.isSVGNode = isSVGNode;
exports.isFrameNode = isFrameNode;
exports.hasScreenshot = hasScreenshot;
exports.hasValidation = hasValidation;
exports.shouldUseFallback = shouldUseFallback;
exports.isFlexContainer = isFlexContainer;
exports.isFlexItem = isFlexItem;
exports.usesFlexboxLayout = usesFlexboxLayout;
exports.isFlexWrapEnabled = isFlexWrapEnabled;
exports.hasExplicitFlexSizing = hasExplicitFlexSizing;
exports.getFlexMainAxis = getFlexMainAxis;
exports.getFlexCrossAxis = getFlexCrossAxis;
exports.validateIRDocument = validateIRDocument;
exports.validateIRNode = validateIRNode;
exports.getNodeConfidence = getNodeConfidence;
exports.shouldRenderAsScreenshot = shouldRenderAsScreenshot;
exports.computeBoxModelBounds = computeBoxModelBounds;
// ==================== FLEXBOX UTILITY FUNCTIONS ====================
/**
 * Utility functions for working with flexbox layouts
 * These help convert between CSS values and internal representations
 */
var FlexboxUtils;
(function (FlexboxUtils) {
    /**
     * Parse CSS flex shorthand value into individual components
     * Handles: flex: grow shrink basis | initial | auto | none | <number>
     */
    function parseFlexShorthand(flex) {
        const trimmed = flex.trim();
        // Handle keywords
        switch (trimmed) {
            case "initial":
                return { grow: 0, shrink: 1, basis: "auto" };
            case "auto":
                return { grow: 1, shrink: 1, basis: "auto" };
            case "none":
                return { grow: 0, shrink: 0, basis: "auto" };
            default:
                break;
        }
        // Handle single number (flex: <number>)
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const grow = parseFloat(trimmed);
            return { grow, shrink: 1, basis: "0px" };
        }
        // Parse multi-value shorthand
        const parts = trimmed.split(/\s+/);
        let grow = 0;
        let shrink = 1;
        let basis = "auto";
        if (parts.length >= 1) {
            grow = parseFloat(parts[0]) || 0;
        }
        if (parts.length >= 2) {
            shrink = parseFloat(parts[1]) || 1;
        }
        if (parts.length >= 3) {
            basis = parts[2];
        }
        return { grow, shrink, basis };
    }
    FlexboxUtils.parseFlexShorthand = parseFlexShorthand;
    /**
     * Determine main and cross axes from flex-direction
     */
    function getAxesFromDirection(direction) {
        const isColumn = direction.startsWith("column");
        const isReversed = direction.endsWith("-reverse");
        return {
            mainAxis: isColumn ? "vertical" : "horizontal",
            crossAxis: isColumn ? "horizontal" : "vertical",
            isReversed,
            canWrap: false, // Set by caller based on flex-wrap
        };
    }
    FlexboxUtils.getAxesFromDirection = getAxesFromDirection;
    /**
     * Validate and normalize justify-content value
     */
    function normalizeJustifyContent(value) {
        const validValues = [
            "flex-start", "flex-end", "center", "space-between",
            "space-around", "space-evenly", "start", "end", "left", "right", "stretch"
        ];
        return validValues.includes(value)
            ? value
            : "flex-start";
    }
    FlexboxUtils.normalizeJustifyContent = normalizeJustifyContent;
    /**
     * Validate and normalize align-items value
     */
    function normalizeAlignItems(value) {
        const validValues = [
            "stretch", "flex-start", "flex-end", "center", "baseline",
            "first baseline", "last baseline", "start", "end",
            "self-start", "self-end", "safe center", "unsafe center"
        ];
        return validValues.includes(value)
            ? value
            : "stretch";
    }
    FlexboxUtils.normalizeAlignItems = normalizeAlignItems;
    /**
     * Validate and normalize align-content value
     */
    function normalizeAlignContent(value) {
        const validValues = [
            "stretch", "flex-start", "flex-end", "center",
            "space-between", "space-around", "space-evenly",
            "start", "end", "baseline", "first baseline", "last baseline"
        ];
        return validValues.includes(value)
            ? value
            : "stretch";
    }
    FlexboxUtils.normalizeAlignContent = normalizeAlignContent;
    /**
     * Validate and normalize align-self value
     */
    function normalizeAlignSelf(value) {
        const validValues = [
            "auto", "stretch", "flex-start", "flex-end", "center",
            "baseline", "first baseline", "last baseline", "start",
            "end", "self-start", "self-end"
        ];
        return validValues.includes(value)
            ? value
            : "auto";
    }
    FlexboxUtils.normalizeAlignSelf = normalizeAlignSelf;
    /**
     * Check if a display value creates a flex container
     */
    function isFlexDisplay(display) {
        return display === "flex" || display === "inline-flex";
    }
    FlexboxUtils.isFlexDisplay = isFlexDisplay;
    /**
     * Convert gap values from various CSS units to pixels
     * Note: This is a simplified implementation - production would need full CSS unit conversion
     */
    function parseGapValue(gap) {
        if (typeof gap === "number")
            return gap;
        if (!gap || gap === "normal" || gap === "0")
            return 0;
        // Remove units and parse as float - simplified for now
        const numValue = parseFloat(gap.toString().replace(/[a-zA-Z%]+$/, ""));
        return isNaN(numValue) ? 0 : numValue;
    }
    FlexboxUtils.parseGapValue = parseGapValue;
    /**
     * Create a complete flex container configuration with defaults
     */
    function createFlexContainer(overrides = {}) {
        return {
            isFlexContainer: true,
            direction: "row",
            wrap: "nowrap",
            justifyContent: "flex-start",
            alignItems: "stretch",
            alignContent: "stretch",
            gap: { row: 0, column: 0 },
            ...overrides,
        };
    }
    FlexboxUtils.createFlexContainer = createFlexContainer;
    /**
     * Create a complete flex item configuration with defaults
     */
    function createFlexItem(overrides = {}) {
        return {
            grow: 0,
            shrink: 1,
            basis: "auto",
            alignSelf: "auto",
            order: 0,
            computed: {
                flex: "0 1 auto",
                isFlexItem: true,
                hasExplicitSizing: false,
            },
            ...overrides,
        };
    }
    FlexboxUtils.createFlexItem = createFlexItem;
})(FlexboxUtils || (exports.FlexboxUtils = FlexboxUtils = {}));
// ==================== GRID UTILITY FUNCTIONS ====================
var GridUtils;
(function (GridUtils) {
    const JUSTIFY_CONTENT_VALUES = [
        "start",
        "end",
        "center",
        "stretch",
        "space-around",
        "space-between",
        "space-evenly",
    ];
    const JUSTIFY_ITEMS_VALUES = ["start", "end", "center", "stretch"];
    const ALIGN_ITEMS_VALUES = ["start", "end", "center", "stretch", "baseline"];
    const JUSTIFY_SELF_VALUES = ["auto", "start", "end", "center", "stretch"];
    const ALIGN_SELF_VALUES = ["auto", "start", "end", "center", "stretch", "baseline"];
    function sanitizeKeyword(value) {
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
    }
    function isGridDisplay(display) {
        return display === "grid" || display === "inline-grid";
    }
    GridUtils.isGridDisplay = isGridDisplay;
    function normalizeJustifyContent(value) {
        const keyword = sanitizeKeyword(value);
        if (JUSTIFY_CONTENT_VALUES.includes(keyword)) {
            return keyword;
        }
        return "start";
    }
    GridUtils.normalizeJustifyContent = normalizeJustifyContent;
    function normalizeAlignContent(value) {
        const keyword = sanitizeKeyword(value);
        if (JUSTIFY_CONTENT_VALUES.includes(keyword)) {
            return keyword;
        }
        return "stretch";
    }
    GridUtils.normalizeAlignContent = normalizeAlignContent;
    function normalizeJustifyItems(value) {
        const keyword = sanitizeKeyword(value);
        if (JUSTIFY_ITEMS_VALUES.includes(keyword)) {
            return keyword;
        }
        return "stretch";
    }
    GridUtils.normalizeJustifyItems = normalizeJustifyItems;
    function normalizeAlignItems(value) {
        const keyword = sanitizeKeyword(value);
        if (ALIGN_ITEMS_VALUES.includes(keyword)) {
            return keyword;
        }
        return "stretch";
    }
    GridUtils.normalizeAlignItems = normalizeAlignItems;
    function normalizeJustifySelf(value) {
        const keyword = sanitizeKeyword(value);
        if (JUSTIFY_SELF_VALUES.includes(keyword)) {
            return keyword;
        }
        if (keyword === "normal") {
            return "auto";
        }
        return "auto";
    }
    GridUtils.normalizeJustifySelf = normalizeJustifySelf;
    function normalizeAlignSelf(value) {
        const keyword = sanitizeKeyword(value);
        if (ALIGN_SELF_VALUES.includes(keyword)) {
            return keyword;
        }
        if (keyword === "normal") {
            return "auto";
        }
        return "auto";
    }
    GridUtils.normalizeAlignSelf = normalizeAlignSelf;
})(GridUtils || (exports.GridUtils = GridUtils = {}));
// ==================== TYPE GUARDS ====================
function isTextNode(node) {
    return node.type === "TEXT" && !!node.text;
}
function isImageNode(node) {
    return node.type === "IMAGE" && !!node.imageRef;
}
function isSVGNode(node) {
    return node.type === "SVG" && !!node.svgRef;
}
function isFrameNode(node) {
    return node.type === "FRAME" && node.children.length > 0;
}
function hasScreenshot(node) {
    return !!node.screenshot;
}
function hasValidation(node) {
    return !!node.validation && node.validation.confidence >= 0;
}
function shouldUseFallback(node) {
    return node.validation?.useFallback || false;
}
// ==================== FLEXBOX TYPE GUARDS ====================
/**
 * Type guard to check if a node has flex container properties
 */
function isFlexContainer(node) {
    return !!(node.layout.flex?.isFlexContainer);
}
/**
 * Type guard to check if a node has flex item properties
 */
function isFlexItem(node) {
    return !!(node.layout.flexItem);
}
/**
 * Type guard to check if a node uses flexbox layout (either container or item)
 */
function usesFlexboxLayout(node) {
    return isFlexContainer(node) || isFlexItem(node);
}
/**
 * Type guard to check if flex container has wrapping enabled
 */
function isFlexWrapEnabled(node) {
    return node.layout.flex?.wrap !== "nowrap";
}
/**
 * Type guard to check if flex item has explicit sizing
 */
function hasExplicitFlexSizing(node) {
    return !!(node.layout.flexItem?.computed?.hasExplicitSizing);
}
/**
 * Get the effective flex direction (accounting for reverse)
 */
function getFlexMainAxis(node) {
    if (!isFlexContainer(node))
        return null;
    const direction = node.layout.flex?.direction || "row";
    return direction.startsWith("column") ? "vertical" : "horizontal";
}
/**
 * Get the flex cross axis (perpendicular to main axis)
 */
function getFlexCrossAxis(node) {
    const mainAxis = getFlexMainAxis(node);
    if (!mainAxis)
        return null;
    return mainAxis === "horizontal" ? "vertical" : "horizontal";
}
// ==================== VALIDATION HELPERS ====================
function validateIRDocument(doc) {
    const errors = [];
    const warnings = [];
    // Required document fields
    if (!doc.url)
        errors.push("Missing required field: url");
    if (!doc.title)
        errors.push("Missing required field: title");
    if (!doc.viewport)
        errors.push("Missing required field: viewport");
    if (!doc.meta)
        errors.push("Missing required field: meta");
    if (!Array.isArray(doc.nodes))
        errors.push("Missing required field: nodes array");
    if (!doc.assets)
        errors.push("Missing required field: assets");
    // Validate nodes
    if (doc.nodes) {
        doc.nodes.forEach((node, index) => {
            const nodeValidation = validateIRNode(node);
            nodeValidation.errors.forEach(error => errors.push(`Node ${index} (${node.id || 'unknown'}): ${error}`));
            nodeValidation.warnings.forEach(warning => warnings.push(`Node ${index} (${node.id || 'unknown'}): ${warning}`));
        });
    }
    return { valid: errors.length === 0, errors, warnings };
}
function validateIRNode(node) {
    const errors = [];
    const warnings = [];
    // Required fields
    if (!node.id)
        errors.push("Missing required field: id");
    if (!node.type)
        errors.push("Missing required field: type");
    if (!node.tag)
        errors.push("Missing required field: tag");
    if (!node.rect)
        errors.push("Missing required field: rect");
    if (!node.layout)
        errors.push("Missing required field: layout");
    // Text nodes require text content
    if (node.type === "TEXT" && !node.text) {
        errors.push("TEXT node missing text content");
    }
    // Image nodes require image reference
    if (node.type === "IMAGE" && !node.imageRef) {
        errors.push("IMAGE node missing imageRef");
    }
    // SVG nodes require SVG reference
    if (node.type === "SVG" && !node.svgRef) {
        errors.push("SVG node missing svgRef");
    }
    return { valid: errors.length === 0, errors, warnings };
}
// ==================== UTILITY FUNCTIONS ====================
function getNodeConfidence(node) {
    return node.validation?.confidence ?? 1.0;
}
function shouldRenderAsScreenshot(node) {
    return node.validation?.useFallback || getNodeConfidence(node) < 0.9;
}
// ==================== LEGACY COMPATIBILITY HELPERS ====================
// These help migrate from the old IR structure
class LegacyIRMigrator {
    // Convert old IRNode structure to new unified structure
    migrateFromLegacyIRNode(legacyNode) {
        const newNode = {
            id: legacyNode.id || crypto.randomUUID(),
            tag: legacyNode.tag || 'div',
            type: this.mapLegacyTypeToNewType(legacyNode.type),
            rect: legacyNode.rect,
            zIndex: legacyNode.zIndex || 0,
            children: legacyNode.children || [],
            parent: legacyNode.parent,
            selector: legacyNode.selector,
            domId: legacyNode.domId,
            classList: legacyNode.classList,
            dataAttributes: legacyNode.dataAttributes,
            ariaLabel: legacyNode.ariaLabel,
            role: legacyNode.role,
            worldTransform: legacyNode.worldTransform || [1, 0, 0, 0, 1, 0],
        };
        // Migrate layout from legacy structure
        newNode.layout = this.migrateLegacyLayout(legacyNode);
        // Migrate text content
        if (legacyNode.text || legacyNode.type === "TEXT") {
            const legacyText = legacyNode.text;
            const rawText = typeof legacyText === "string"
                ? legacyText
                : legacyText?.rawText ||
                    legacyText?.text ||
                    legacyText?.content ||
                    "";
            const html = typeof legacyText === "object" && legacyText !== null
                ? legacyText.html ||
                    legacyText.innerHTML ||
                    legacyNode.html ||
                    rawText
                : legacyNode.html || rawText;
            const innerText = typeof legacyText === "object" && legacyText !== null
                ? legacyText.innerText || rawText
                : rawText;
            const wordCount = rawText && typeof rawText === "string"
                ? rawText.trim().length === 0
                    ? 0
                    : rawText.trim().split(/\s+/).length
                : 0;
            newNode.text = {
                rawText,
                html,
                text: rawText,
                innerText,
                isClipped: (typeof legacyText === "object" && legacyText?.isClipped) || false,
                lineCount: (typeof legacyText === "object" && legacyText?.lineCount) || 1,
                wordCount,
            };
            newNode.textMetrics = this.migrateLegacyTypography(legacyNode);
        }
        // Migrate visual properties
        if (legacyNode.styles) {
            newNode.background = this.migrateLegacyBackground(legacyNode.styles);
            newNode.borders = this.migrateLegacyBorders(legacyNode.styles);
            newNode.effects = this.migrateLegacyEffects(legacyNode.styles);
        }
        // Migrate validation
        if (legacyNode.validation) {
            newNode.validation = {
                confidence: legacyNode.validation.confidence || 1.0,
                pixelDiff: legacyNode.validation.pixelDiff,
                useFallback: legacyNode.validation.useFallback || false,
                failureReason: legacyNode.validation.failureReason,
            };
        }
        // Migrate screenshot
        if (legacyNode.screenshot || legacyNode.primaryScreenshot) {
            const screenshot = legacyNode.screenshot || legacyNode.primaryScreenshot;
            newNode.screenshot = {
                src: screenshot.src,
                width: screenshot.width,
                height: screenshot.height,
                dpr: screenshot.dpr || 1,
                capturedAt: screenshot.capturedAt || new Date().toISOString(),
            };
        }
        // Migrate figma hints
        if (legacyNode.figma) {
            newNode.figma = {
                nodeType: legacyNode.figma.type || "FRAME",
                fills: legacyNode.figma.fills,
                strokes: legacyNode.figma.strokes,
                effects: legacyNode.figma.effects,
                autoLayout: legacyNode.figma.autoLayout,
                constraints: legacyNode.figma.constraints,
                component: legacyNode.figma.component,
            };
        }
        // Keep legacy fields for compatibility
        newNode.styles = legacyNode.styles;
        newNode.image = legacyNode.image;
        newNode.svg = legacyNode.svg;
        newNode.primaryScreenshot = legacyNode.primaryScreenshot;
        newNode.rasterFallback = legacyNode.rasterFallback;
        newNode.optimization = legacyNode.optimization;
        return newNode;
    }
    // Convert old ExtractedData to new IRDocument
    migrateFromExtractedData(extractedData) {
        const document = {
            url: extractedData.url || extractedData.meta?.url || "unknown",
            title: extractedData.title || extractedData.meta?.title || "Untitled",
            viewport: {
                width: extractedData.viewport?.width || 1024,
                height: extractedData.viewport?.height || 768,
                deviceScaleFactor: extractedData.renderEnv?.device?.devicePixelRatio || 1,
            },
            meta: {
                capturedAt: extractedData.meta?.extractedAt || new Date().toISOString(),
                userAgent: extractedData.renderEnv?.browser?.userAgent || "unknown",
                language: extractedData.renderEnv?.browser?.language || "en",
                frameworkHints: extractedData.meta?.frameworkHints,
                extractionDuration: extractedData.meta?.extractionDuration,
                phases: extractedData.meta?.phases || "legacy",
                version: extractedData.meta?.version || "2.0.0",
            },
            nodes: (extractedData.nodes || []).map((node) => this.migrateFromLegacyIRNode(node)),
            assets: {
                images: this.migrateLegacyImages(extractedData),
                fonts: this.migrateLegacyFonts(extractedData),
                svgs: this.migrateLegacySVGs(extractedData),
            },
            tokens: this.migrateLegacyTokens(extractedData.tokens),
        };
        return document;
    }
    // Convert old CaptureData to new IRDocument (for builder compatibility)
    migrateFromCaptureData(captureData) {
        const document = {
            url: captureData.route || "unknown",
            title: "Converted from CaptureData",
            viewport: {
                width: captureData.viewport?.width || 1024,
                height: captureData.viewport?.height || 768,
                deviceScaleFactor: 1,
            },
            meta: {
                capturedAt: new Date().toISOString(),
                userAgent: "unknown",
                language: "en",
                phases: "builder-migration",
                version: "2.0.0",
            },
            nodes: (captureData.elements || []).map((element) => this.migrateFromCapturedElement(element)),
            assets: {
                images: [],
                fonts: [],
                svgs: [],
            },
        };
        return document;
    }
    mapLegacyTypeToNewType(type) {
        const mapping = {
            "TEXT": "TEXT",
            "IMAGE": "IMAGE",
            "FRAME": "FRAME",
            "SVG": "SVG",
            "CANVAS": "CANVAS",
            "VIDEO": "VIDEO",
            "RECTANGLE": "FRAME",
            "ELLIPSE": "FRAME",
            "VECTOR": "SVG",
        };
        return mapping[type] || "UNKNOWN";
    }
    migrateLegacyLayout(legacyNode) {
        const styles = legacyNode.styles || {};
        const layout = legacyNode.layout || {};
        return {
            boxModel: {
                margin: this.parseSpacing(styles.margin),
                padding: this.parseSpacing(styles.padding),
                border: this.parseSpacing(styles.borderWidth),
                boxSizing: styles.boxSizing || "content-box",
            },
            position: {
                type: styles.position || "static",
                top: styles.top,
                right: styles.right,
                bottom: styles.bottom,
                left: styles.left,
            },
            display: {
                type: styles.display || "block",
                overflow: {
                    x: styles.overflowX || "visible",
                    y: styles.overflowY || "visible",
                },
            },
            flex: FlexboxUtils.isFlexDisplay(styles.display) ?
                FlexboxUtils.createFlexContainer({
                    direction: (styles.flexDirection || "row"),
                    wrap: (styles.flexWrap || "nowrap"),
                    justifyContent: FlexboxUtils.normalizeJustifyContent(styles.justifyContent || "flex-start"),
                    alignItems: FlexboxUtils.normalizeAlignItems(styles.alignItems || "stretch"),
                    alignContent: FlexboxUtils.normalizeAlignContent(styles.alignContent || "stretch"),
                    gap: {
                        row: FlexboxUtils.parseGapValue(styles.rowGap || styles.gap || 0),
                        column: FlexboxUtils.parseGapValue(styles.columnGap || styles.gap || 0),
                    },
                }) : undefined,
            flexItem: this.hasFlexItemProperties(styles) ?
                FlexboxUtils.createFlexItem({
                    grow: parseFloat(styles.flexGrow) || 0,
                    shrink: parseFloat(styles.flexShrink) || 1,
                    basis: styles.flexBasis || "auto",
                    alignSelf: FlexboxUtils.normalizeAlignSelf(styles.alignSelf || "auto"),
                    order: parseFloat(styles.order) || 0,
                    computed: {
                        flex: styles.flex || `${styles.flexGrow || 0} ${styles.flexShrink || 1} ${styles.flexBasis || "auto"}`,
                        isFlexItem: true,
                        hasExplicitSizing: !!(styles.flexGrow || styles.flexShrink || styles.flexBasis || styles.flex),
                    },
                }) : undefined,
            grid: this.createGridLayout(styles),
            dimensions: {
                width: styles.width || "auto",
                height: styles.height || "auto",
                minWidth: styles.minWidth || "auto",
                maxWidth: styles.maxWidth || "auto",
                minHeight: styles.minHeight || "auto",
                maxHeight: styles.maxHeight || "auto",
            },
            transform: styles.transform ? {
                matrix: this.parseTransformMatrix(styles.transform),
                origin: styles.transformOrigin || "50% 50%",
                style: styles.transformStyle || "flat",
            } : undefined,
            stacking: {
                zIndex: legacyNode.zIndex || 0,
                stackingContextId: legacyNode.stackingContextId,
                paintOrder: layout.paintOrder || 0,
                isolate: styles.isolation === "isolate",
            },
        };
    }
    migrateLegacyTypography(legacyNode) {
        const styles = legacyNode.styles || {};
        const typography = legacyNode.typography || legacyNode.styles?.typography || {};
        if (!legacyNode.text && legacyNode.type !== "TEXT")
            return undefined;
        return {
            // Required browser-accurate measurements with reasonable defaults
            lineBoxes: [],
            baseline: Math.round((parseFloat(typography.fontSize || styles.fontSize) || 16) * 0.8),
            ascent: Math.round((parseFloat(typography.fontSize || styles.fontSize) || 16) * 0.8),
            descent: Math.round((parseFloat(typography.fontSize || styles.fontSize) || 16) * 0.2),
            lineHeightPx: Math.round(parseFloat(typography.lineHeightPx || styles.lineHeight) || 19.2),
            align: (typography.textAlign || styles.textAlign || "left"),
            whitespace: typography.whiteSpace || styles.whiteSpace || "normal",
            wrapMode: typography.wrapMode || "normal",
            // Legacy compatibility properties
            font: {
                family: typography.fontFamily || styles.fontFamily || "sans-serif",
                familyResolved: typography.familyResolved || typography.fontFamily || styles.fontFamily || "sans-serif",
                size: parseFloat(typography.fontSize || styles.fontSize) || 16,
                weight: typography.fontWeight || styles.fontWeight || "400",
                style: typography.fontStyle || styles.fontStyle || "normal",
                variant: typography.fontVariant || "normal",
                synthesis: typography.fontSynthesis || "auto",
                kerning: typography.fontKerning || "auto",
                featureSettings: typography.fontFeatureSettings || "normal",
            },
            spacing: {
                lineHeight: parseFloat(typography.lineHeightPx || styles.lineHeight) || 1.2,
                letterSpacing: parseFloat(typography.letterSpacing || styles.letterSpacing) || 0,
                wordSpacing: parseFloat(typography.wordSpacing || styles.wordSpacing) || 0,
                textIndent: parseFloat(typography.textIndent || styles.textIndent) || 0,
            },
            layout: {
                align: (typography.textAlign || styles.textAlign || "left"),
                verticalAlign: typography.verticalAlign || styles.verticalAlign || "baseline",
                whiteSpace: typography.whiteSpace || styles.whiteSpace || "normal",
                wordBreak: typography.wordBreak || styles.wordBreak || "normal",
                overflowWrap: typography.overflowWrap || styles.overflowWrap || "normal",
                direction: (typography.direction || styles.direction || "ltr"),
                writingMode: typography.writingMode || styles.writingMode || "horizontal-tb",
                textOrientation: typography.textOrientation || styles.textOrientation || "mixed",
            },
            effects: {
                color: typography.color || styles.color || "#000000",
                transform: typography.textTransform || styles.textTransform || "none",
                decoration: {
                    line: typography.textDecorationLine || styles.textDecorationLine || "none",
                    style: typography.textDecorationStyle || styles.textDecorationStyle || "solid",
                    color: typography.textDecorationColor || styles.textDecorationColor || "currentcolor",
                    thickness: typography.textDecorationThickness || styles.textDecorationThickness || "auto",
                },
                shadow: this.parseTextShadow(typography.textShadow || styles.textShadow),
                stroke: typography.webkitTextStroke || styles.webkitTextStroke ? {
                    width: parseFloat(typography.webkitTextStrokeWidth || styles.webkitTextStrokeWidth) || 0,
                    color: typography.webkitTextStrokeColor || styles.webkitTextStrokeColor || "transparent",
                } : undefined,
                gradient: typography.webkitBackgroundClip === "text" ? {
                    value: styles.backgroundImage || "",
                    clip: true,
                } : undefined,
            },
            advanced: {
                hyphenation: (typography.hyphens || styles.hyphens) === "auto",
                textWrap: typography.textWrap || styles.textWrap || "wrap",
                textWrapMode: typography.textWrapMode || styles.textWrapMode || "normal",
                hangingPunctuation: typography.hangingPunctuation || styles.hangingPunctuation || "none",
                fontOpticalSizing: typography.fontOpticalSizing || styles.fontOpticalSizing || "auto",
                fontVariationSettings: typography.fontVariationSettings || styles.fontVariationSettings || "normal",
            },
        };
    }
    migrateLegacyBackground(styles) {
        const layers = [];
        if (styles.backgroundColor && styles.backgroundColor !== "transparent") {
            layers.push({
                type: "color",
                color: {
                    value: styles.backgroundColor,
                    alpha: parseFloat(styles.opacity) || 1,
                },
            });
        }
        if (styles.backgroundImage && styles.backgroundImage !== "none") {
            layers.push({
                type: "image",
                image: {
                    imageRef: "legacy-bg", // Would need proper asset mapping
                    size: styles.backgroundSize || "auto",
                    position: styles.backgroundPosition || "0% 0%",
                    repeat: styles.backgroundRepeat || "repeat",
                    attachment: styles.backgroundAttachment || "scroll",
                    origin: styles.backgroundOrigin || "padding-box",
                    clip: styles.backgroundClip || "border-box",
                },
            });
        }
        return layers.length > 0 ? { layers } : undefined;
    }
    migrateLegacyBorders(styles) {
        const border = {};
        if (styles.borderTopWidth) {
            border.top = {
                width: parseFloat(styles.borderTopWidth) || 0,
                style: styles.borderTopStyle || "solid",
                color: styles.borderTopColor || "transparent",
            };
        }
        if (styles.borderRadius) {
            const radius = parseFloat(styles.borderRadius) || 0;
            border.radius = {
                topLeft: radius,
                topRight: radius,
                bottomRight: radius,
                bottomLeft: radius,
            };
        }
        return Object.keys(border).length > 0 ? border : undefined;
    }
    migrateLegacyEffects(styles) {
        const effects = {
            opacity: parseFloat(styles.opacity) || 1,
        };
        if (styles.boxShadow && styles.boxShadow !== "none") {
            effects.shadows = this.parseBoxShadow(styles.boxShadow);
        }
        if (styles.filter && styles.filter !== "none") {
            effects.filters = this.parseFilters(styles.filter);
        }
        if (styles.backdropFilter && styles.backdropFilter !== "none") {
            effects.backdropFilters = this.parseBackdropFilters(styles.backdropFilter);
        }
        if (styles.mixBlendMode && styles.mixBlendMode !== "normal") {
            effects.blendMode = styles.mixBlendMode;
        }
        return effects;
    }
    migrateLegacyImages(extractedData) {
        // Check if we have new-format assets collected from the scraper
        if (extractedData.assets && Array.isArray(extractedData.assets)) {
            const imageAssets = extractedData.assets.filter((asset) => asset.mimeType || asset.type === 'image' || asset.type === 'canvas' || asset.type === 'video');
            console.log(`[Legacy Migration] Found ${imageAssets.length} image assets in new format`);
            return imageAssets;
        }
        // Fallback: try to extract from legacy structure
        return [];
    }
    migrateLegacyFonts(extractedData) {
        // Prioritize enhanced fontAssets if available
        if (extractedData.fontAssets && Array.isArray(extractedData.fontAssets)) {
            console.log(`[Legacy Migration] Using enhanced fontAssets (${extractedData.fontAssets.length} fonts)`);
            return extractedData.fontAssets; // Already in IRFontAsset format
        }
        // Fallback to legacy font formats
        const fonts = extractedData.fonts || extractedData.fontFaces || [];
        console.log(`[Legacy Migration] Using legacy font format (${fonts.length} fonts)`);
        return fonts.map((font, index) => ({
            id: font.id || `${font.family.replace(/\s+/g, '_').toLowerCase()}_${font.weight}_${font.style}_${index}`,
            family: font.family,
            style: font.style,
            weight: font.weight,
            src: Array.isArray(font.src) ? font.src : [{ url: font.src, format: font.format }],
            stretch: font.stretch,
            unicodeRange: font.unicodeRange,
            data: font.data,
            display: font.display,
            loadStatus: font.loadStatus || "loaded",
            usedByNodes: font.usedByElements || font.usedByNodes || [],
            isSystemFont: font.isSystemFont || false,
            hash: font.hash,
        }));
    }
    migrateLegacySVGs(extractedData) {
        // Check if we have new-format SVG assets collected from the scraper
        if (extractedData.assets && Array.isArray(extractedData.assets)) {
            const svgAssets = extractedData.assets.filter((asset) => asset.svg || asset.viewBox !== undefined);
            console.log(`[Legacy Migration] Found ${svgAssets.length} SVG assets in new format`);
            return svgAssets;
        }
        // Fallback: try to extract from legacy structure
        return [];
    }
    migrateLegacyTokens(tokens) {
        if (!tokens)
            return undefined;
        return {
            colors: tokens.inferred?.colors || [],
            spacing: tokens.inferred?.spacing || [],
            radii: tokens.inferred?.radii || [],
            fontSizes: tokens.inferred?.fontSizes || [],
            fontWeights: tokens.inferred?.fontWeights || [],
            lineHeights: tokens.inferred?.lineHeights || [],
            shadows: tokens.inferred?.shadows || [],
        };
    }
    migrateFromCapturedElement(element) {
        return {
            id: element.id || crypto.randomUUID(),
            tag: element.tagName || 'div',
            type: "FRAME",
            rect: element.rect,
            zIndex: element.zIndex || 0,
            worldTransform: element.transform?.matrix || [1, 0, 0, 0, 1, 0],
            layout: this.migrateCapturedElementLayout(element),
            children: [],
            selector: element.selector,
        };
    }
    migrateCapturedElementLayout(element) {
        const styles = element.styles || {};
        return {
            boxModel: {
                margin: this.parseSpacing(styles.margin),
                padding: this.parseSpacing(styles.padding),
                border: this.parseSpacing(styles.borderWidth),
                boxSizing: styles.boxSizing || "content-box",
            },
            position: {
                type: styles.position || "static",
                top: styles.top,
                right: styles.right,
                bottom: styles.bottom,
                left: styles.left,
            },
            display: {
                type: styles.display || "block",
                overflow: {
                    x: styles.overflow || "visible",
                    y: styles.overflow || "visible",
                },
            },
            dimensions: {
                width: styles.width || "auto",
                height: styles.height || "auto",
                minWidth: "auto",
                maxWidth: "auto",
                minHeight: "auto",
                maxHeight: "auto",
            },
            stacking: {
                zIndex: element.zIndex || 0,
                paintOrder: element.stacking?.paintOrder || 0,
                isolate: false,
            },
        };
    }
    parseSpacing(spacing) {
        const defaultSpacing = { top: 0, right: 0, bottom: 0, left: 0 };
        if (!spacing || spacing === "0" || spacing === "auto")
            return defaultSpacing;
        const values = spacing.split(' ').map(v => parseFloat(v) || 0);
        switch (values.length) {
            case 1: return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
            case 2: return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
            case 3: return { top: values[0], right: values[1], bottom: values[2], left: values[1] };
            case 4: return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
            default: return defaultSpacing;
        }
    }
    parseTransformMatrix(transform) {
        // Simplified matrix parsing
        return [1, 0, 0, 0, 1, 0]; // Identity matrix
    }
    parseTextShadow(textShadow) {
        if (!textShadow || textShadow === "none")
            return undefined;
        // Simplified parsing - would need full CSS parser for production
        return [{
                offsetX: 1,
                offsetY: 1,
                blurRadius: 1,
                color: "rgba(0,0,0,0.5)",
            }];
    }
    parseBoxShadow(boxShadow) {
        // Simplified parsing - would need full CSS parser for production
        return [{
                type: "box",
                offsetX: 0,
                offsetY: 2,
                blurRadius: 4,
                spreadRadius: 0,
                color: "rgba(0,0,0,0.1)",
                inset: boxShadow.includes("inset"),
            }];
    }
    parseFilters(filter) {
        // Simplified parsing - would need full CSS parser for production
        return [{
                type: "blur",
                value: "5px",
            }];
    }
    parseBackdropFilters(filter) {
        // Simplified parsing - backdrop filters don't support drop-shadow
        return [{
                type: "blur",
                value: "5px",
            }];
    }
    /**
     * Determines if an element has flex item properties that should be captured
     * Used to decide whether to include flexItem properties in the layout
     */
    hasFlexItemProperties(styles) {
        return !!(styles.flexGrow !== undefined ||
            styles.flexShrink !== undefined ||
            styles.flexBasis !== undefined ||
            styles.alignSelf !== undefined ||
            styles.order !== undefined ||
            styles.flex !== undefined);
    }
    createGridLayout(styles) {
        if (!GridUtils.isGridDisplay(styles.display)) {
            return undefined;
        }
        const rowGap = styles.gridRowGap ?? styles.rowGap ?? styles.gap ?? 0;
        const columnGap = styles.gridColumnGap ?? styles.columnGap ?? styles.gap ?? 0;
        return {
            templateColumns: styles.gridTemplateColumns || "none",
            templateRows: styles.gridTemplateRows || "none",
            templateAreas: styles.gridTemplateAreas || "none",
            autoFlow: styles.gridAutoFlow || "row",
            autoColumns: styles.gridAutoColumns || "auto",
            autoRows: styles.gridAutoRows || "auto",
            gap: {
                row: FlexboxUtils.parseGapValue(rowGap),
                column: FlexboxUtils.parseGapValue(columnGap),
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
            placeSelf: styles.placeSelf || "auto",
        };
    }
}
exports.LegacyIRMigrator = LegacyIRMigrator;
// ==================== BOX MODEL UTILITIES ====================
/**
 * Compute accurate bounds for all box model layers
 * Handles content-box vs border-box sizing correctly
 */
function computeBoxModelBounds(rect, layout) {
    const { boxModel } = layout;
    const { margin, padding, border, boxSizing } = boxModel;
    let contentRect;
    let paddingRect;
    let borderRect;
    let marginRect;
    if (boxSizing === "border-box") {
        // rect includes border and padding, need to compute content box
        borderRect = { ...rect };
        paddingRect = {
            x: borderRect.x + border.left,
            y: borderRect.y + border.top,
            width: borderRect.width - border.left - border.right,
            height: borderRect.height - border.top - border.bottom,
        };
        contentRect = {
            x: paddingRect.x + padding.left,
            y: paddingRect.y + padding.top,
            width: paddingRect.width - padding.left - padding.right,
            height: paddingRect.height - padding.top - padding.bottom,
        };
    }
    else {
        // content-box: rect is the content area, expand outward
        contentRect = { ...rect };
        paddingRect = {
            x: contentRect.x - padding.left,
            y: contentRect.y - padding.top,
            width: contentRect.width + padding.left + padding.right,
            height: contentRect.height + padding.top + padding.bottom,
        };
        borderRect = {
            x: paddingRect.x - border.left,
            y: paddingRect.y - border.top,
            width: paddingRect.width + border.left + border.right,
            height: paddingRect.height + border.top + border.bottom,
        };
    }
    marginRect = {
        x: borderRect.x - margin.left,
        y: borderRect.y - margin.top,
        width: borderRect.width + margin.left + margin.right,
        height: borderRect.height + margin.top + margin.bottom,
    };
    return {
        content: contentRect,
        padding: paddingRect,
        border: borderRect,
        margin: marginRect,
    };
}
// ==================== CSS INHERITANCE UTILITIES ====================
/**
 * CSS properties that naturally inherit from parent to child
 * Based on W3C CSS specification
 */
exports.INHERITABLE_PROPERTIES = new Set([
    // Typography
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-variant",
    "font-weight",
    "font-stretch",
    "font-size-adjust",
    "font-kerning",
    "font-feature-settings",
    "font-variation-settings",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-align",
    "text-indent",
    "text-transform",
    "text-shadow",
    "text-decoration-color",
    "text-emphasis-color",
    "text-emphasis-style",
    "text-emphasis-position",
    // Writing modes and direction
    "direction",
    "unicode-bidi",
    "writing-mode",
    "text-orientation",
    // Lists
    "list-style-image",
    "list-style-position",
    "list-style-type",
    "list-style",
    // Tables
    "border-collapse",
    "border-spacing",
    "caption-side",
    "empty-cells",
    // Generated content
    "quotes",
    // Misc
    "cursor",
    "visibility",
    "white-space",
    "word-break",
    "overflow-wrap",
    "hyphens",
    "tab-size",
    "line-break",
    "word-wrap",
]);
/**
 * CSS Inheritance Resolution Engine
 * Builds and resolves inheritance chains for CSS properties
 */
class CSSInheritanceResolver {
    nodeMap = new Map();
    inheritanceMap = new Map();
    constructor(nodes) {
        // Build node lookup map
        for (const node of nodes) {
            this.nodeMap.set(node.id, node);
        }
    }
    /**
     * Resolve inheritance chain for all nodes
     */
    resolveAll() {
        // Clear previous results
        this.inheritanceMap.clear();
        // Process nodes in DOM order to ensure parents are processed first
        const processedNodes = new Set();
        for (const [nodeId, node] of this.nodeMap) {
            if (!processedNodes.has(nodeId)) {
                this.resolveNodeRecursive(nodeId, processedNodes);
            }
        }
        return this.inheritanceMap;
    }
    /**
     * Resolve inheritance for a specific node
     */
    resolveNode(nodeId) {
        const existingChain = this.inheritanceMap.get(nodeId);
        if (existingChain) {
            return existingChain;
        }
        const processedNodes = new Set();
        return this.resolveNodeRecursive(nodeId, processedNodes);
    }
    resolveNodeRecursive(nodeId, processedNodes) {
        if (processedNodes.has(nodeId)) {
            return this.inheritanceMap.get(nodeId);
        }
        processedNodes.add(nodeId);
        const node = this.nodeMap.get(nodeId);
        if (!node) {
            return undefined;
        }
        // Ensure parent is processed first
        let parentChain;
        if (node.parent) {
            parentChain = this.resolveNodeRecursive(node.parent, processedNodes);
        }
        // Build inheritance chain for this node
        const inheritanceChain = this.buildInheritanceChain(node, parentChain);
        this.inheritanceMap.set(nodeId, inheritanceChain);
        return inheritanceChain;
    }
    buildInheritanceChain(node, parentChain) {
        const inherited = {};
        const explicit = {};
        const computed = {};
        // Get explicit styles for this node (from legacy styles field for now)
        const rawStyles = node.styles || {};
        // Normalize styles to expand shorthands to longhand
        const nodeStyles = this.normalizeStylesForInheritance(rawStyles);
        // Process inherited properties from parent
        if (parentChain) {
            for (const property of exports.INHERITABLE_PROPERTIES) {
                const parentValue = parentChain.computed[property];
                if (parentValue && !nodeStyles[property]) {
                    // Property inherits from parent
                    const parentInheritedProp = parentChain.inherited[property];
                    inherited[property] = {
                        property,
                        value: parentValue,
                        sourceId: parentInheritedProp ? parentInheritedProp.sourceId : node.parent,
                        distance: parentInheritedProp ? parentInheritedProp.distance + 1 : 1,
                        naturallyInherits: true,
                        sourceSelector: parentInheritedProp?.sourceSelector,
                        specificity: parentInheritedProp?.specificity,
                    };
                    computed[property] = parentValue;
                }
            }
        }
        // Process explicit properties on this node
        for (const [property, value] of Object.entries(nodeStyles)) {
            if (typeof value === 'string' && value !== 'inherit' && value !== 'initial') {
                explicit[property] = {
                    property,
                    value,
                    source: "stylesheet", // Would need more context to determine exact source
                    overridesInheritance: inherited[property] !== undefined,
                };
                computed[property] = value;
                // Remove from inherited if explicitly set
                if (inherited[property]) {
                    delete inherited[property];
                }
            }
        }
        // Handle 'inherit' keyword
        if (parentChain) {
            for (const [property, value] of Object.entries(nodeStyles)) {
                if (value === 'inherit') {
                    const parentValue = parentChain.computed[property];
                    if (parentValue) {
                        inherited[property] = {
                            property,
                            value: parentValue,
                            sourceId: node.parent,
                            distance: 1,
                            naturallyInherits: exports.INHERITABLE_PROPERTIES.has(property),
                            sourceSelector: parentChain.explicit[property]?.selector,
                            specificity: parentChain.explicit[property]?.specificity,
                        };
                        computed[property] = parentValue;
                    }
                }
            }
        }
        return {
            inherited,
            explicit,
            computed,
            cascade: this.analyzeCascade(node, nodeStyles),
        };
    }
    analyzeCascade(node, styles) {
        // Simplified cascade analysis - would need more DOM context for full analysis
        const important = [];
        const inline = [];
        // Check for important declarations (simplified)
        for (const [property, value] of Object.entries(styles)) {
            if (typeof value === 'string' && value.includes('!important')) {
                important.push(property);
            }
        }
        // Calculate basic specificity (simplified)
        const idCount = node.domId ? 1 : 0;
        const classCount = (node.classList?.length || 0);
        const elementCount = 1; // The element itself
        const specificity = (idCount * 100) + (classCount * 10) + elementCount;
        return {
            important,
            inline,
            idCount,
            classCount,
            elementCount,
            specificity,
        };
    }
    /**
     * Create a resolved styles snapshot for debugging/consumption
     */
    createResolvedStylesSnapshot(chain) {
        const properties = {};
        for (const [property, value] of Object.entries(chain.computed)) {
            if (chain.explicit[property]) {
                const explicit = chain.explicit[property];
                properties[property] = {
                    property,
                    value,
                    source: "explicit",
                    overridesInheritance: explicit.overridesInheritance,
                };
            }
            else if (chain.inherited[property]) {
                const inherited = chain.inherited[property];
                properties[property] = {
                    property,
                    value,
                    source: "inherited",
                    inheritedFrom: inherited.sourceId,
                    distance: inherited.distance,
                    naturallyInherits: inherited.naturallyInherits,
                };
            }
            else {
                properties[property] = {
                    property,
                    value,
                    source: "computed",
                };
            }
        }
        const summary = {
            total: Object.keys(properties).length,
            inherited: Object.values(properties).filter(p => p.source === "inherited").length,
            explicit: Object.values(properties).filter(p => p.source === "explicit").length,
        };
        return {
            values: { ...chain.computed },
            properties,
            summary,
        };
    }
    /**
     * Normalize styles by expanding CSS shorthands to longhand properties
     * Uses built-in normalization to avoid dynamic import issues
     */
    normalizeStylesForInheritance(rawStyles) {
        // Convert any non-string values to strings
        const stringStyles = {};
        for (const [key, value] of Object.entries(rawStyles)) {
            if (value != null && value !== '') {
                stringStyles[key] = String(value);
            }
        }
        try {
            // Use simplified built-in normalization for now
            return this.simplifyStylesForBrowser(stringStyles);
        }
        catch (error) {
            console.warn('Style normalization failed, using raw styles:', error);
            return stringStyles;
        }
    }
    /**
     * Simplified style normalization for browser environments
     */
    simplifyStylesForBrowser(styles) {
        const normalized = {};
        for (const [property, value] of Object.entries(styles)) {
            if (!value || value === '')
                continue;
            // Expand common shorthands
            switch (property.toLowerCase()) {
                case 'margin':
                    const marginValues = this.parseSpacingValue(value);
                    normalized['margin-top'] = marginValues[0];
                    normalized['margin-right'] = marginValues[1];
                    normalized['margin-bottom'] = marginValues[2];
                    normalized['margin-left'] = marginValues[3];
                    break;
                case 'padding':
                    const paddingValues = this.parseSpacingValue(value);
                    normalized['padding-top'] = paddingValues[0];
                    normalized['padding-right'] = paddingValues[1];
                    normalized['padding-bottom'] = paddingValues[2];
                    normalized['padding-left'] = paddingValues[3];
                    break;
                case 'border':
                    // Simplified border parsing
                    if (value.includes(' ')) {
                        const parts = value.split(/\s+/);
                        if (parts.length >= 3) {
                            normalized['border-width'] = parts[0];
                            normalized['border-style'] = parts[1];
                            normalized['border-color'] = parts[2];
                        }
                    }
                    else {
                        normalized['border-width'] = value;
                    }
                    break;
                case 'flex':
                    const flexParts = this.parseFlexShorthand(value);
                    normalized['flex-grow'] = String(flexParts.grow);
                    normalized['flex-shrink'] = String(flexParts.shrink);
                    normalized['flex-basis'] = flexParts.basis;
                    break;
                default:
                    // Not a shorthand we handle, keep as-is
                    normalized[property] = value;
                    break;
            }
        }
        return normalized;
    }
    /**
     * Parse spacing values (margin/padding shorthand)
     */
    parseSpacingValue(value) {
        const parts = value.trim().split(/\s+/);
        switch (parts.length) {
            case 1: return [parts[0], parts[0], parts[0], parts[0]];
            case 2: return [parts[0], parts[1], parts[0], parts[1]];
            case 3: return [parts[0], parts[1], parts[2], parts[1]];
            case 4: return [parts[0], parts[1], parts[2], parts[3]];
            default: return [parts[0] || '0', parts[1] || '0', parts[2] || '0', parts[3] || '0'];
        }
    }
    /**
     * Parse flex shorthand value
     */
    parseFlexShorthand(value) {
        const trimmed = value.trim();
        // Handle keywords
        if (trimmed === 'initial')
            return { grow: 0, shrink: 1, basis: 'auto' };
        if (trimmed === 'auto')
            return { grow: 1, shrink: 1, basis: 'auto' };
        if (trimmed === 'none')
            return { grow: 0, shrink: 0, basis: 'auto' };
        // Single number
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            return { grow: parseFloat(trimmed), shrink: 1, basis: '0%' };
        }
        // Multi-value
        const parts = trimmed.split(/\s+/);
        const grow = parseFloat(parts[0]) || 0;
        const shrink = parts.length > 1 && /^\d/.test(parts[1]) ? parseFloat(parts[1]) : 1;
        const basis = parts.length > 2 ? parts[2] : (parts.length === 2 && !/^\d/.test(parts[1]) ? parts[1] : 'auto');
        return { grow, shrink, basis };
    }
}
exports.CSSInheritanceResolver = CSSInheritanceResolver;
/**
 * Utility functions for working with inheritance chains
 */
var InheritanceUtils;
(function (InheritanceUtils) {
    /**
     * Get the resolved value for a property, following the inheritance chain
     */
    function getResolvedValue(chain, property) {
        return chain.computed[property];
    }
    InheritanceUtils.getResolvedValue = getResolvedValue;
    /**
     * Get the source of a property value (explicit vs inherited)
     */
    function getPropertySource(chain, property) {
        if (chain.explicit[property]) {
            return 'explicit';
        }
        if (chain.inherited[property]) {
            return 'inherited';
        }
        return 'unset';
    }
    InheritanceUtils.getPropertySource = getPropertySource;
    /**
     * Get the inheritance path for a property
     */
    function getInheritancePath(chain, property, allChains) {
        const path = [];
        const inheritedProp = chain.inherited[property];
        if (!inheritedProp) {
            return path;
        }
        let currentSourceId = inheritedProp.sourceId;
        let distance = inheritedProp.distance;
        while (currentSourceId && distance > 0) {
            path.push(currentSourceId);
            const sourceChain = allChains.get(currentSourceId);
            if (!sourceChain)
                break;
            const sourceInheritedProp = sourceChain.inherited[property];
            if (!sourceInheritedProp)
                break;
            currentSourceId = sourceInheritedProp.sourceId;
            distance = sourceInheritedProp.distance;
        }
        return path;
    }
    InheritanceUtils.getInheritancePath = getInheritancePath;
    /**
     * Check if a property naturally inherits in CSS
     */
    function naturallyInherits(property) {
        return exports.INHERITABLE_PROPERTIES.has(property);
    }
    InheritanceUtils.naturallyInherits = naturallyInherits;
    /**
     * Get all properties that inherit from parent
     */
    function getInheritedProperties(chain) {
        return Object.keys(chain.inherited);
    }
    InheritanceUtils.getInheritedProperties = getInheritedProperties;
    /**
     * Get all properties explicitly set on element
     */
    function getExplicitProperties(chain) {
        return Object.keys(chain.explicit);
    }
    InheritanceUtils.getExplicitProperties = getExplicitProperties;
    /**
     * Create a debug summary of the inheritance chain
     */
    function createDebugSummary(nodeId, chain, allChains) {
        const inheritedProperties = Object.entries(chain.inherited).map(([prop, info]) => ({
            property: prop,
            value: info.value,
            sourceId: info.sourceId,
            distance: info.distance,
            path: getInheritancePath(chain, prop, allChains),
        }));
        const explicitProperties = Object.entries(chain.explicit).map(([prop, info]) => ({
            property: prop,
            value: info.value,
            source: info.source,
            overridesInheritance: info.overridesInheritance,
        }));
        return {
            nodeId,
            totalProperties: Object.keys(chain.computed).length,
            inheritedCount: inheritedProperties.length,
            explicitCount: explicitProperties.length,
            inheritedProperties,
            explicitProperties,
        };
    }
    InheritanceUtils.createDebugSummary = createDebugSummary;
})(InheritanceUtils || (exports.InheritanceUtils = InheritanceUtils = {}));
// ==================== EXPORT COMPATIBILITY LAYER ====================
// Export migrator instance for use
exports.legacyMigrator = new LegacyIRMigrator();
// Export default for legacy imports
exports.default = {
    // Core type guards
    isTextNode,
    isImageNode,
    isSVGNode,
    isFrameNode,
    hasScreenshot,
    hasValidation,
    shouldUseFallback,
    // Flexbox type guards
    isFlexContainer,
    isFlexItem,
    usesFlexboxLayout,
    isFlexWrapEnabled,
    hasExplicitFlexSizing,
    getFlexMainAxis,
    getFlexCrossAxis,
    // Validation helpers
    validateIRDocument,
    validateIRNode,
    getNodeConfidence,
    shouldRenderAsScreenshot,
    // Flexbox utilities
    FlexboxUtils,
    // Inheritance utilities
    CSSInheritanceResolver,
    InheritanceUtils,
    INHERITABLE_PROPERTIES: exports.INHERITABLE_PROPERTIES,
    // Legacy migration
    legacyMigrator: exports.legacyMigrator,
};
//# sourceMappingURL=ir.js.map