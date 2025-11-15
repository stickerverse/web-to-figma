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
export interface IRStackingContext {
    id: string;
    parentId?: string;
    nodeIds: string[];
}
export interface IRDocument {
    url: string;
    title: string;
    viewport: {
        width: number;
        height: number;
        deviceScaleFactor: number;
    };
    meta: {
        capturedAt: string;
        userAgent: string;
        language: string;
        frameworkHints?: string[];
        extractionDuration?: number;
        phases: string;
        version: string;
    };
    nodes: IRNode[];
    assets: {
        images: IRImageAsset[];
        fonts: IRFontAsset[];
        svgs: IRSVGAsset[];
    };
    tokens?: {
        colors: string[];
        spacing: number[];
        radii: number[];
        fontSizes: number[];
        fontWeights: string[];
        lineHeights: number[];
        shadows: string[];
    };
    stackingContexts?: IRStackingContext[];
}
export interface IRNode {
    id: string;
    tag: string;
    role?: string;
    type: "FRAME" | "TEXT" | "IMAGE" | "SVG" | "CANVAS" | "VIDEO" | "UNKNOWN";
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    worldTransform: number[];
    zIndex: number;
    stackingContextId?: string;
    layout: IRLayout;
    background?: IRBackground;
    borders?: IRBorder;
    effects?: IREffects;
    clip?: IRClip;
    text?: IRTextContent;
    textMetrics?: IRTextMetrics;
    imageRef?: string;
    svgRef?: string;
    imageSource?: ImageSource;
    /**
     * Inline binary image payload for hybrid delivery.
     * Takes precedence over legacy base64 strings when present.
     */
    imageData?: number[];
    /**
     * Chunk metadata for streamed image delivery.
     */
    imageChunkRef?: ImageChunkReference;
    /**
     * Processing metadata containing conversion details or errors.
     */
    imageProcessing?: ImageProcessingMetadata;
    pseudo?: {
        before?: IRNode;
        after?: IRNode;
    };
    figma?: IRFigmaHints;
    children: string[];
    parent?: string;
    selector?: string;
    domId?: string;
    classList?: string[];
    dataAttributes?: Record<string, string>;
    ariaLabel?: string;
    validation?: {
        confidence: number;
        pixelDiff?: number;
        useFallback: boolean;
        failureReason?: string;
    };
    screenshot?: {
        src: string;
        width: number;
        height: number;
        dpr: number;
        capturedAt: string;
    };
    styles?: any;
    image?: any;
    svg?: any;
    primaryScreenshot?: any;
    rasterFallback?: any;
    optimization?: any;
    inheritanceChain?: IRInheritanceChain;
    resolvedStyles?: IRResolvedStyles;
    needsScreenshot?: boolean;
}
export interface ImageSource {
    originalUrl: string;
    resolvedUrl: string;
    sourceType: "img" | "background" | "svg";
    naturalWidth?: number;
    naturalHeight?: number;
    format?: "png" | "jpeg" | "webp" | "gif" | "svg";
}
export interface ImageChunkReference {
    totalSize: number;
    totalChunks: number;
    chunkSize: number;
    isStreamed: boolean;
}
export interface ImageProcessingMetadata {
    originalFormat: string;
    convertedFormat?: string;
    wasConverted: boolean;
    processingError?: string;
}
/**
 * CSS Inheritance Chain - tracks property inheritance and resolution
 * Enables debugging and maintains full style resolution context
 */
export interface IRInheritanceChain {
    /** Properties inherited from parent elements */
    inherited: Record<string, IRInheritedProperty>;
    /** Properties explicitly set on this element */
    explicit: Record<string, IRExplicitProperty>;
    /** Final computed values (result of inheritance + explicit) */
    computed: Record<string, string>;
    /** CSS cascade specificity information */
    cascade?: IRCascadeInfo;
}
/**
 * Snapshot of resolved CSS styles for a node
 */
export interface IRResolvedStyles {
    /** Flat computed values for easy consumption */
    values: Record<string, string>;
    /** Metadata for each resolved property */
    properties: Record<string, IRResolvedStyleProperty>;
    /** Summary counts for debugging */
    summary: {
        total: number;
        inherited: number;
        explicit: number;
    };
}
/**
 * Information about an inherited CSS property
 */
export interface IRInheritedProperty {
    /** Property name (e.g., "color", "font-family") */
    property: string;
    /** Inherited value */
    value: string;
    /** Source element ID where this value was defined */
    sourceId: string;
    /** Distance in inheritance chain (0 = parent, 1 = grandparent, etc.) */
    distance: number;
    /** Whether this property naturally inherits in CSS */
    naturallyInherits: boolean;
    /** CSS selector that originally defined this value */
    sourceSelector?: string;
    /** Specificity of the source rule */
    specificity?: number;
}
/**
 * Information about an explicitly set CSS property
 */
export interface IRExplicitProperty {
    /** Property name */
    property: string;
    /** Explicit value set on this element */
    value: string;
    /** Source of the value: inline style, CSS rule, etc. */
    source: "inline" | "stylesheet" | "computed" | "default";
    /** CSS selector that defined this value (if from stylesheet) */
    selector?: string;
    /** Rule specificity */
    specificity?: number;
    /** Whether this value overrides inheritance */
    overridesInheritance: boolean;
}
/**
 * Resolved property metadata summarizing inheritance status
 */
export interface IRResolvedStyleProperty {
    property: string;
    value: string;
    source: "explicit" | "inherited" | "computed";
    inheritedFrom?: string;
    distance?: number;
    naturallyInherits?: boolean;
    overridesInheritance?: boolean;
}
/**
 * CSS Cascade and specificity information
 */
export interface IRCascadeInfo {
    /** Important declarations that won the cascade */
    important: string[];
    /** Inline styles present */
    inline: string[];
    /** ID selector count for specificity */
    idCount: number;
    /** Class/attribute selector count */
    classCount: number;
    /** Element selector count */
    elementCount: number;
    /** Final specificity score */
    specificity: number;
}
export interface IRLayout {
    boxModel: {
        margin: IRSpacing;
        padding: IRSpacing;
        border: IRSpacing;
        boxSizing: "content-box" | "border-box";
    };
    bounds?: {
        content: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        padding: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        border: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        margin: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    };
    position: {
        type: "static" | "relative" | "absolute" | "fixed" | "sticky";
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
    display: {
        type: string;
        overflow: {
            x: "visible" | "hidden" | "scroll" | "auto";
            y: "visible" | "hidden" | "scroll" | "auto";
        };
    };
    flex?: {
        /**
         * Indicates whether this element is a flex container (display: flex or inline-flex)
         * When true, the element establishes a flex formatting context for its children
         */
        isFlexContainer: boolean;
        /**
         * Sets the main axis direction for flex items (flex-direction property)
         * - "row": left to right in ltr; right to left in rtl
         * - "row-reverse": right to left in ltr; left to right in rtl
         * - "column": top to bottom
         * - "column-reverse": bottom to top
         */
        direction: "row" | "row-reverse" | "column" | "column-reverse";
        /**
         * Controls whether flex items wrap to new lines (flex-wrap property)
         * - "nowrap": single line, may overflow
         * - "wrap": wrap items to new lines as needed
         * - "wrap-reverse": wrap items to new lines in reverse order
         */
        wrap: "nowrap" | "wrap" | "wrap-reverse";
        /**
         * Aligns items along the main axis (justify-content property)
         * Supports all CSS justify-content values including CSS Box Alignment Level 3
         */
        justifyContent: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly" | "start" | "end" | "left" | "right" | "stretch";
        /**
         * Aligns items along the cross axis (align-items property)
         * Supports all CSS align-items values including baseline variants
         */
        alignItems: "stretch" | "flex-start" | "flex-end" | "center" | "baseline" | "first baseline" | "last baseline" | "start" | "end" | "self-start" | "self-end" | "safe center" | "unsafe center";
        /**
         * Aligns wrapped lines along the cross axis (align-content property)
         * Only applies when wrap is not "nowrap"
         */
        alignContent: "stretch" | "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly" | "start" | "end" | "baseline" | "first baseline" | "last baseline";
        /**
         * Gap between flex items (gap property)
         * Shorthand for row-gap and column-gap
         */
        gap: {
            /** Gap between rows (row-gap property) in pixels */
            row: number;
            /** Gap between columns (column-gap property) in pixels */
            column: number;
        };
    };
    /**
     * Flex item properties - applied to children of flex containers
     * These properties control how flex items behave within their flex container parent
     */
    flexItem?: {
        /**
         * Flex grow factor (flex-grow property)
         * Defines how much the item should grow relative to other items
         * Default: 0 (don't grow)
         */
        grow: number;
        /**
         * Flex shrink factor (flex-shrink property)
         * Defines how much the item should shrink relative to other items
         * Default: 1 (can shrink)
         */
        shrink: number;
        /**
         * Flex basis (flex-basis property)
         * Defines the initial main size of the item before free space is distributed
         * Can be: "auto", "content", length values (px, %, em, etc.), or "0"
         */
        basis: string;
        /**
         * Individual item alignment (align-self property)
         * Overrides the flex container's align-items value for this item
         */
        alignSelf: "auto" | "stretch" | "flex-start" | "flex-end" | "center" | "baseline" | "first baseline" | "last baseline" | "start" | "end" | "self-start" | "self-end";
        /**
         * Visual order of the item (order property)
         * Items with lower order values appear first
         * Default: 0
         */
        order: number;
        /**
         * Computed flex shorthand values for debugging/validation
         * Represents the resolved values from flex: grow shrink basis
         */
        computed?: {
            /** Resolved flex shorthand (e.g., "1 1 auto", "0 1 200px") */
            flex: string;
            /** Whether this item participates in flex layout */
            isFlexItem: boolean;
            /** Whether this item has explicit flex sizing */
            hasExplicitSizing: boolean;
        };
    };
    grid?: {
        templateColumns: string;
        templateRows: string;
        templateAreas: string;
        autoFlow: string;
        autoColumns: string;
        autoRows: string;
        gap: {
            row: number;
            column: number;
        };
        justifyContent: "start" | "end" | "center" | "stretch" | "space-around" | "space-between" | "space-evenly";
        alignContent: "start" | "end" | "center" | "stretch" | "space-around" | "space-between" | "space-evenly";
        justifyItems: "start" | "end" | "center" | "stretch";
        alignItems: "start" | "end" | "center" | "stretch" | "baseline";
        placeContent: string;
        placeItems: string;
        column: string;
        row: string;
        area: string;
        justifySelf: "auto" | "start" | "end" | "center" | "stretch";
        alignSelf: "auto" | "start" | "end" | "center" | "stretch" | "baseline";
        placeSelf: string;
    };
    childAlignment?: {
        mainAxis: "start" | "end" | "center" | "stretch" | "space-between" | "space-around" | "space-evenly";
        crossAxis: "start" | "end" | "center" | "stretch" | "baseline";
        mainAxisOrientation: "horizontal" | "vertical";
        crossAxisOrientation: "horizontal" | "vertical";
        mainAxisIsReversed?: boolean;
        crossAxisIsReversed?: boolean;
        computedFromFlex?: boolean;
        computedFromGrid?: boolean;
    };
    dimensions: {
        width: string;
        height: string;
        minWidth: string;
        maxWidth: string;
        minHeight: string;
        maxHeight: string;
    };
    transform?: {
        matrix: number[];
        origin: string;
        style: "flat" | "preserve-3d";
    };
    stacking: {
        zIndex: number | "auto";
        stackingContextId?: string;
        paintOrder: number;
        isolate: boolean;
    };
}
/**
 * Comprehensive type definitions for CSS Flexbox properties
 * Aligned with W3C CSS Flexible Box Layout Module Level 1
 */
export declare namespace FlexboxTypes {
    /** All valid flex-direction values */
    type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";
    /** All valid flex-wrap values */
    type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
    /** All valid justify-content values (CSS Box Alignment Level 3) */
    type JustifyContent = "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly" | "start" | "end" | "left" | "right" | "stretch";
    /** All valid align-items values */
    type AlignItems = "stretch" | "flex-start" | "flex-end" | "center" | "baseline" | "first baseline" | "last baseline" | "start" | "end" | "self-start" | "self-end" | "safe center" | "unsafe center";
    /** All valid align-content values */
    type AlignContent = "stretch" | "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly" | "start" | "end" | "baseline" | "first baseline" | "last baseline";
    /** All valid align-self values */
    type AlignSelf = "auto" | "stretch" | "flex-start" | "flex-end" | "center" | "baseline" | "first baseline" | "last baseline" | "start" | "end" | "self-start" | "self-end";
    /** Flex shorthand parsing result */
    interface FlexShorthand {
        grow: number;
        shrink: number;
        basis: string;
    }
    /** Flex container computed values for layout calculations */
    interface FlexContainerComputed {
        /** Main axis (horizontal for row, vertical for column) */
        mainAxis: "horizontal" | "vertical";
        /** Cross axis (opposite of main axis) */
        crossAxis: "horizontal" | "vertical";
        /** Writing direction affects row layouts */
        isReversed: boolean;
        /** Whether items can wrap */
        canWrap: boolean;
    }
}
/**
 * Utility functions for working with flexbox layouts
 * These help convert between CSS values and internal representations
 */
export declare namespace FlexboxUtils {
    /**
     * Parse CSS flex shorthand value into individual components
     * Handles: flex: grow shrink basis | initial | auto | none | <number>
     */
    function parseFlexShorthand(flex: string): FlexboxTypes.FlexShorthand;
    /**
     * Determine main and cross axes from flex-direction
     */
    function getAxesFromDirection(direction: FlexboxTypes.FlexDirection): FlexboxTypes.FlexContainerComputed;
    /**
     * Validate and normalize justify-content value
     */
    function normalizeJustifyContent(value: string): FlexboxTypes.JustifyContent;
    /**
     * Validate and normalize align-items value
     */
    function normalizeAlignItems(value: string): FlexboxTypes.AlignItems;
    /**
     * Validate and normalize align-content value
     */
    function normalizeAlignContent(value: string): FlexboxTypes.AlignContent;
    /**
     * Validate and normalize align-self value
     */
    function normalizeAlignSelf(value: string): FlexboxTypes.AlignSelf;
    /**
     * Check if a display value creates a flex container
     */
    function isFlexDisplay(display: string): boolean;
    /**
     * Convert gap values from various CSS units to pixels
     * Note: This is a simplified implementation - production would need full CSS unit conversion
     */
    function parseGapValue(gap: string | number): number;
    /**
     * Create a complete flex container configuration with defaults
     */
    function createFlexContainer(overrides?: Partial<NonNullable<IRLayout["flex"]>>): NonNullable<IRLayout["flex"]>;
    /**
     * Create a complete flex item configuration with defaults
     */
    function createFlexItem(overrides?: Partial<NonNullable<IRLayout["flexItem"]>>): NonNullable<IRLayout["flexItem"]>;
}
export declare namespace GridUtils {
    type GridLayout = NonNullable<IRLayout["grid"]>;
    export function isGridDisplay(display?: string): boolean;
    export function normalizeJustifyContent(value?: string): GridLayout["justifyContent"];
    export function normalizeAlignContent(value?: string): GridLayout["alignContent"];
    export function normalizeJustifyItems(value?: string): GridLayout["justifyItems"];
    export function normalizeAlignItems(value?: string): GridLayout["alignItems"];
    export function normalizeJustifySelf(value?: string): GridLayout["justifySelf"];
    export function normalizeAlignSelf(value?: string): GridLayout["alignSelf"];
    export {};
}
export interface IRBackground {
    layers: IRBackgroundLayer[];
}
export interface IRBackgroundLayer {
    type: "color" | "image" | "gradient";
    color?: {
        value: string;
        alpha: number;
    };
    image?: {
        imageRef: string;
        size: string;
        position: string;
        repeat: string;
        attachment: string;
        origin: string;
        clip: string;
    };
    gradient?: {
        type: "linear" | "radial" | "conic";
        angle?: number;
        position?: string;
        stops: Array<{
            color: string;
            position: number;
        }>;
    };
    blendMode?: string;
}
export interface IRBorder {
    top?: IRBorderSide;
    right?: IRBorderSide;
    bottom?: IRBorderSide;
    left?: IRBorderSide;
    radius?: {
        topLeft: number;
        topRight: number;
        bottomRight: number;
        bottomLeft: number;
    };
    image?: {
        source: string;
        slice: string;
        width: string;
        outset: string;
        repeat: string;
    };
}
export interface IRBorderSide {
    width: number;
    style: string;
    color: string;
}
export interface IREffects {
    shadows?: Array<{
        type: "box" | "text";
        offsetX: number;
        offsetY: number;
        blurRadius: number;
        spreadRadius?: number;
        color: string;
        inset?: boolean;
    }>;
    filters?: Array<{
        type: "blur" | "brightness" | "contrast" | "drop-shadow" | "grayscale" | "hue-rotate" | "invert" | "opacity" | "saturate" | "sepia";
        value: string;
    }>;
    backdropFilters?: Array<{
        type: "blur" | "brightness" | "contrast" | "grayscale" | "hue-rotate" | "invert" | "opacity" | "saturate" | "sepia";
        value: string;
    }>;
    blendMode?: string;
    opacity: number;
}
export interface IRClip {
    clipPath?: {
        type: "inset" | "circle" | "ellipse" | "polygon" | "path" | "url";
        value: string;
    };
    mask?: {
        image: string;
        mode: string;
        repeat: string;
        position: string;
        clip: string;
        origin: string;
        size: string;
        composite: string;
    };
}
export interface IRTextContent {
    rawText: string;
    text: string;
    innerText: string;
    html?: string;
    innerHTML?: string;
    isClipped: boolean;
    lineCount: number;
    wordCount: number;
}
export interface IRTextMetrics {
    lineBoxes: {
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
    baseline: number;
    ascent: number;
    descent: number;
    lineHeightPx: number;
    align: string;
    whitespace: string;
    wrapMode: string;
    font: {
        family: string;
        familyResolved: string;
        size: number;
        weight: number | string;
        style: string;
        variant: string;
        synthesis: string;
        kerning: string;
        featureSettings: string;
    };
    spacing: {
        lineHeight: number;
        letterSpacing: number;
        wordSpacing: number;
        textIndent: number;
    };
    layout: {
        align: "left" | "right" | "center" | "justify";
        verticalAlign: string;
        whiteSpace: string;
        wordBreak: string;
        overflowWrap: string;
        direction: "ltr" | "rtl";
        writingMode: string;
        textOrientation: string;
    };
    effects: {
        color: string;
        transform: string;
        decoration: {
            line: string;
            style: string;
            color: string;
            thickness: string;
        };
        shadow?: Array<{
            offsetX: number;
            offsetY: number;
            blurRadius: number;
            color: string;
        }>;
        stroke?: {
            width: number;
            color: string;
        };
        gradient?: {
            value: string;
            clip: boolean;
        };
    };
    advanced?: {
        hyphenation: boolean;
        textWrap: string;
        textWrapMode: string;
        hangingPunctuation: string;
        fontOpticalSizing: string;
        fontVariationSettings: string;
    };
}
export interface IRImageAsset {
    id: string;
    url?: string;
    mimeType: string;
    hash: string;
    width: number;
    height: number;
    data?: string;
    chunkRef?: {
        id: string;
        length: number;
    };
    size?: number;
    format?: "png" | "jpeg" | "webp" | "gif" | "svg";
    processing?: {
        originalFormat: string;
        wasConverted: boolean;
        originalSize?: number;
        compressedSize?: number;
        error?: string;
    };
}
export interface IRFontAsset {
    id: string;
    family: string;
    style: string;
    weight: string;
    stretch?: string;
    unicodeRange?: string;
    src: {
        url: string;
        format?: string;
    }[];
    data?: string;
    display?: "auto" | "block" | "swap" | "fallback" | "optional";
    loadStatus?: "loaded" | "loading" | "unloaded" | "error";
    usedByNodes?: string[];
    isSystemFont?: boolean;
    hash?: string;
}
export interface IRSVGAsset {
    id: string;
    svg: string;
    viewBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    width?: string;
    height?: string;
    preserveAspectRatio?: string;
    paths?: Array<{
        d: string;
        fill?: string;
        stroke?: string;
        strokeWidth?: string;
    }>;
}
export interface IRFigmaHints {
    nodeType: "FRAME" | "TEXT" | "RECTANGLE" | "ELLIPSE" | "VECTOR" | "COMPONENT" | "INSTANCE";
    fills?: Array<{
        type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
        color?: {
            r: number;
            g: number;
            b: number;
            a: number;
        };
        gradientStops?: Array<{
            position: number;
            color: {
                r: number;
                g: number;
                b: number;
                a: number;
            };
        }>;
        imageRef?: string;
        scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
    }>;
    strokes?: Array<{
        type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL";
        color: {
            r: number;
            g: number;
            b: number;
            a: number;
        };
        thickness: number;
        position: "INSIDE" | "OUTSIDE" | "CENTER";
    }>;
    effects?: Array<{
        type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
        visible: boolean;
        color?: {
            r: number;
            g: number;
            b: number;
            a: number;
        };
        offset?: {
            x: number;
            y: number;
        };
        radius: number;
        spread?: number;
    }>;
    autoLayout?: {
        layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
        primaryAxisSizingMode?: "FIXED" | "AUTO";
        counterAxisSizingMode?: "FIXED" | "AUTO";
        itemSpacing?: number;
        padding?: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        };
        primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
        counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
    };
    constraints?: {
        horizontal: "LEFT" | "RIGHT" | "LEFT_RIGHT" | "CENTER" | "SCALE";
        vertical: "TOP" | "BOTTOM" | "TOP_BOTTOM" | "CENTER" | "SCALE";
    };
    component?: {
        isComponent: boolean;
        isInstance: boolean;
        masterComponentId?: string;
        variantProperties?: Record<string, string>;
    };
}
export interface IRSpacing {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export interface StreamMessage {
    type: "NODES" | "IMAGE_CHUNK" | "FONTS" | "TOKENS" | "STACKING_CONTEXTS" | "PAINT_ORDER" | "COMPLETE" | "ERROR" | "PROGRESS";
    payload?: any;
    sequenceNumber: number;
    timestamp?: number;
}
export interface NodeBatchMessage {
    type: "NODES";
    nodes: IRNode[];
    sequenceNumber: number;
    batchIndex: number;
    totalBatches: number;
}
export interface ImageChunkMessage {
    type: "IMAGE_CHUNK";
    nodeId?: string;
    assetId?: string;
    chunkIndex: number;
    totalChunks: number;
    totalSize?: number;
    chunkSize?: number;
    data: number[];
    sequenceNumber: number;
    timestamp: number;
}
export interface CompleteMessage {
    type: "COMPLETE";
    document?: IRDocument;
    sequenceNumber: number;
    totalNodes?: number;
    totalImages?: number;
    inlineImages?: number;
    streamedImages?: number;
    summary?: {
        duration?: number;
        totalNodes?: number;
        totalAssets?: number;
        accuracy?: string;
    };
}
export interface ProgressMessage {
    type: "PROGRESS";
    phase: string;
    current: number;
    total: number;
    message: string;
    sequenceNumber: number;
}
export interface ErrorMessage {
    type: "ERROR";
    error: string;
    phase?: string;
    recoverable: boolean;
    sequenceNumber: number;
}
export declare function isTextNode(node: IRNode): boolean;
export declare function isImageNode(node: IRNode): boolean;
export declare function isSVGNode(node: IRNode): boolean;
export declare function isFrameNode(node: IRNode): boolean;
export declare function hasScreenshot(node: IRNode): boolean;
export declare function hasValidation(node: IRNode): boolean;
export declare function shouldUseFallback(node: IRNode): boolean;
/**
 * Type guard to check if a node has flex container properties
 */
export declare function isFlexContainer(node: IRNode): boolean;
/**
 * Type guard to check if a node has flex item properties
 */
export declare function isFlexItem(node: IRNode): boolean;
/**
 * Type guard to check if a node uses flexbox layout (either container or item)
 */
export declare function usesFlexboxLayout(node: IRNode): boolean;
/**
 * Type guard to check if flex container has wrapping enabled
 */
export declare function isFlexWrapEnabled(node: IRNode): boolean;
/**
 * Type guard to check if flex item has explicit sizing
 */
export declare function hasExplicitFlexSizing(node: IRNode): boolean;
/**
 * Get the effective flex direction (accounting for reverse)
 */
export declare function getFlexMainAxis(node: IRNode): "horizontal" | "vertical" | null;
/**
 * Get the flex cross axis (perpendicular to main axis)
 */
export declare function getFlexCrossAxis(node: IRNode): "horizontal" | "vertical" | null;
export declare function validateIRDocument(doc: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
export declare function validateIRNode(node: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
export declare function getNodeConfidence(node: IRNode): number;
export declare function shouldRenderAsScreenshot(node: IRNode): boolean;
export declare class LegacyIRMigrator {
    migrateFromLegacyIRNode(legacyNode: any): IRNode;
    migrateFromExtractedData(extractedData: any): IRDocument;
    migrateFromCaptureData(captureData: any): IRDocument;
    private mapLegacyTypeToNewType;
    private migrateLegacyLayout;
    private migrateLegacyTypography;
    private migrateLegacyBackground;
    private migrateLegacyBorders;
    private migrateLegacyEffects;
    private migrateLegacyImages;
    private migrateLegacyFonts;
    private migrateLegacySVGs;
    private migrateLegacyTokens;
    private migrateFromCapturedElement;
    private migrateCapturedElementLayout;
    private parseSpacing;
    private parseTransformMatrix;
    private parseTextShadow;
    private parseBoxShadow;
    private parseFilters;
    private parseBackdropFilters;
    /**
     * Determines if an element has flex item properties that should be captured
     * Used to decide whether to include flexItem properties in the layout
     */
    private hasFlexItemProperties;
    private createGridLayout;
}
/**
 * Compute accurate bounds for all box model layers
 * Handles content-box vs border-box sizing correctly
 */
export declare function computeBoxModelBounds(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
}, layout: IRLayout): NonNullable<IRLayout["bounds"]>;
/**
 * CSS properties that naturally inherit from parent to child
 * Based on W3C CSS specification
 */
export declare const INHERITABLE_PROPERTIES: Set<string>;
/**
 * CSS Inheritance Resolution Engine
 * Builds and resolves inheritance chains for CSS properties
 */
export declare class CSSInheritanceResolver {
    private nodeMap;
    private inheritanceMap;
    constructor(nodes: IRNode[]);
    /**
     * Resolve inheritance chain for all nodes
     */
    resolveAll(): Map<string, IRInheritanceChain>;
    /**
     * Resolve inheritance for a specific node
     */
    resolveNode(nodeId: string): IRInheritanceChain | undefined;
    private resolveNodeRecursive;
    private buildInheritanceChain;
    private analyzeCascade;
    /**
     * Create a resolved styles snapshot for debugging/consumption
     */
    createResolvedStylesSnapshot(chain: IRInheritanceChain): IRResolvedStyles;
    /**
     * Normalize styles by expanding CSS shorthands to longhand properties
     * Uses built-in normalization to avoid dynamic import issues
     */
    private normalizeStylesForInheritance;
    /**
     * Simplified style normalization for browser environments
     */
    private simplifyStylesForBrowser;
    /**
     * Parse spacing values (margin/padding shorthand)
     */
    private parseSpacingValue;
    /**
     * Parse flex shorthand value
     */
    private parseFlexShorthand;
}
/**
 * Utility functions for working with inheritance chains
 */
export declare namespace InheritanceUtils {
    /**
     * Get the resolved value for a property, following the inheritance chain
     */
    function getResolvedValue(chain: IRInheritanceChain, property: string): string | undefined;
    /**
     * Get the source of a property value (explicit vs inherited)
     */
    function getPropertySource(chain: IRInheritanceChain, property: string): 'explicit' | 'inherited' | 'unset';
    /**
     * Get the inheritance path for a property
     */
    function getInheritancePath(chain: IRInheritanceChain, property: string, allChains: Map<string, IRInheritanceChain>): string[];
    /**
     * Check if a property naturally inherits in CSS
     */
    function naturallyInherits(property: string): boolean;
    /**
     * Get all properties that inherit from parent
     */
    function getInheritedProperties(chain: IRInheritanceChain): string[];
    /**
     * Get all properties explicitly set on element
     */
    function getExplicitProperties(chain: IRInheritanceChain): string[];
    /**
     * Create a debug summary of the inheritance chain
     */
    function createDebugSummary(nodeId: string, chain: IRInheritanceChain, allChains: Map<string, IRInheritanceChain>): {
        nodeId: string;
        totalProperties: number;
        inheritedCount: number;
        explicitCount: number;
        inheritedProperties: Array<{
            property: string;
            value: string;
            sourceId: string;
            distance: number;
            path: string[];
        }>;
        explicitProperties: Array<{
            property: string;
            value: string;
            source: string;
            overridesInheritance: boolean;
        }>;
    };
}
export declare const legacyMigrator: LegacyIRMigrator;
export type ExtractedFont = IRFontAsset;
export type ExtractedData = {
    nodes: IRNode[];
    fonts: IRFontAsset[];
    viewport: {
        width: number;
        height: number;
    };
};
export type EnhancedExtractedData = IRDocument;
declare const _default: {
    isTextNode: typeof isTextNode;
    isImageNode: typeof isImageNode;
    isSVGNode: typeof isSVGNode;
    isFrameNode: typeof isFrameNode;
    hasScreenshot: typeof hasScreenshot;
    hasValidation: typeof hasValidation;
    shouldUseFallback: typeof shouldUseFallback;
    isFlexContainer: typeof isFlexContainer;
    isFlexItem: typeof isFlexItem;
    usesFlexboxLayout: typeof usesFlexboxLayout;
    isFlexWrapEnabled: typeof isFlexWrapEnabled;
    hasExplicitFlexSizing: typeof hasExplicitFlexSizing;
    getFlexMainAxis: typeof getFlexMainAxis;
    getFlexCrossAxis: typeof getFlexCrossAxis;
    validateIRDocument: typeof validateIRDocument;
    validateIRNode: typeof validateIRNode;
    getNodeConfidence: typeof getNodeConfidence;
    shouldRenderAsScreenshot: typeof shouldRenderAsScreenshot;
    FlexboxUtils: typeof FlexboxUtils;
    CSSInheritanceResolver: typeof CSSInheritanceResolver;
    InheritanceUtils: typeof InheritanceUtils;
    INHERITABLE_PROPERTIES: Set<string>;
    legacyMigrator: LegacyIRMigrator;
};
export default _default;
