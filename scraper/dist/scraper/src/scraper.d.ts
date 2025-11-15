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
import type { IRDocument } from "../../ir.js";
export interface ExtractedFont {
    family: string;
    style: string;
    weight: string;
    src: string;
    data?: string;
    format?: string;
}
export interface ExtractedPseudoElement {
    type: "before" | "after";
    content: string;
    styles: Record<string, any>;
}
export interface EnhancedScreenshot {
    src: string;
    width: number;
    height: number;
    dpr: number;
    actualWidth: number;
    actualHeight: number;
}
export interface IRTypography {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    fontStyle: string;
    lineHeight: string;
    lineHeightPx: number;
    color: string;
    textAlign: string;
    whiteSpace: string;
    overflowWrap: string;
    wordBreak: string;
    textDecorationLine: string;
    textDecorationStyle: string;
    textDecorationColor: string;
    textDecorationThickness: string;
    textUnderlineOffset: string;
    textUnderlinePosition: string;
    textShadow: string;
    textTransform: string;
    letterSpacing: string;
    wordSpacing: string;
    textIndent: string;
    fontVariant: string;
    fontFeatureSettings: string;
    fontKerning: string;
    fontVariantLigatures: string;
    fontVariantNumeric: string;
    fontVariantCaps: string;
    fontSynthesis: string;
    textRendering: string;
    webkitFontSmoothing: string;
    mozOsxFontSmoothing: string;
    direction: string;
    unicodeBidi: string;
    writingMode: string;
    textOrientation: string;
    verticalAlign: string;
    webkitTextStroke: string;
    webkitTextStrokeWidth: string;
    webkitTextStrokeColor: string;
    webkitTextFillColor: string;
    webkitBackgroundClip: string;
    textWrap: string;
    textWrapMode: string;
    textWrapStyle: string;
    wordWrap: string;
    content?: IRTextContent;
    capabilities?: IRTypographyCapabilities;
    specialCases?: IRTypographySpecialCases;
    unsupported?: string[];
}
export interface IRTextContent {
    text: string;
    innerText: string;
    innerHTML: string;
    length: number;
    isClipped: boolean;
    lineCount: number;
    isGradientText: boolean;
}
export interface IRTypographySpecialCases {
    isMultiLine: boolean;
    isGradientText: boolean;
    isRTL: boolean;
    isVertical: boolean;
    inputState?: {
        placeholder?: string;
        value?: string;
        type: string;
        readonly: boolean;
        disabled: boolean;
    };
    gradientText?: {
        gradient: string;
        clip: boolean;
    };
}
export interface IRTypographyCapabilities {
    supportsTextWrap: boolean;
    supportsTextWrapMode: boolean;
    supportsFontFeatureSettings: boolean;
    supportsTextDecorationThickness: boolean;
    supportsTextUnderlineOffset: boolean;
    supportsWebkitFontSmoothing: boolean;
}
export interface LoadInfo {
    timestamps: {
        documentReady: number;
        fontsReady: number;
        imagesReady: number;
        lazyContentReady: number;
        domStabilized: number;
        extractionStart: number;
    };
    stats: {
        totalWaitMs: number;
        fontsLoaded: number;
        fontsFailed: number;
        failedFonts: string[];
        imagesLoaded: number;
        imagesBlocked: number;
        imagesFailed: number;
        lazyElementsActivated: number;
        domStable: boolean;
        timedOut: boolean;
    };
    errors: Array<{
        phase: string;
        message: string;
    }>;
}
export interface LayoutGeometry {
    viewport: {
        x: number;
        y: number;
        width: number;
        height: number;
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    document: {
        x: number;
        y: number;
    };
    client: {
        width: number;
        height: number;
        top: number;
        left: number;
    };
    offset: {
        width: number;
        height: number;
        top: number;
        left: number;
        parentId: string | null;
    };
    scroll: {
        width: number;
        height: number;
        top: number;
        left: number;
        isScrollable: boolean;
    };
    transform: {
        matrix: string;
        hasTransform: boolean;
    };
    position: {
        type: string;
        isFixed: boolean;
        isSticky: boolean;
        isAbsolute: boolean;
    };
    visibility: {
        display: string;
        visibility: string;
        opacity: number;
        isHidden: boolean;
    };
    compositing?: {
        zIndex: number | "auto";
        position: string;
        opacity: number;
        transform: string;
        filter: string;
        clipPath: string;
        mask: string;
        mixBlendMode: string;
        backgroundBlendMode: string;
        backdropFilter: string;
        isolation: string;
        willChange: string;
        contain: string;
        perspective: string;
        stackingContext: boolean;
        transformOrigin?: string;
        perspectiveOrigin?: string;
    };
    svg?: {
        x: number;
        y: number;
        width: number;
        height: number;
        error?: string;
    };
    iframe?: {
        crossOrigin: boolean;
        accessible: boolean;
    };
    shadow?: {
        hasHostShadow: boolean;
        shadowRootMode: "open" | "closed";
        childrenCount: number;
    };
    error?: string;
}
export interface RenderEnv {
    viewport: {
        innerWidth: number;
        innerHeight: number;
        outerWidth: number;
        outerHeight: number;
        clientWidth: number;
        clientHeight: number;
        scrollWidth: number;
        scrollHeight: number;
    };
    scroll: {
        x: number;
        y: number;
    };
    device: {
        devicePixelRatio: number;
        screenWidth: number;
        screenHeight: number;
        zoomLevel: number;
        colorGamut: string;
        colorScheme: string;
        reducedMotion: boolean;
    };
    browser: {
        userAgent: string;
        platform: string;
        language: string;
        cores: number;
        touchPoints: number;
    };
    capturedAt: string;
    unsupportedAPIs?: string[];
}
export interface ExtractionOptions {
    captureFonts?: boolean;
    captureScreenshots?: boolean;
    screenshotComplexOnly?: boolean;
    captureStates?: boolean;
    capturePseudoElements?: boolean;
    extractSVG?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
    capturePhase0Screenshots?: boolean;
}
export interface PrimaryScreenshot {
    src: string;
    width: number;
    height: number;
    dpr: number;
    hash: string;
}
export interface PrimaryScreenshots {
    page: PrimaryScreenshot;
    elementCount: number;
}
export interface RasterFallback {
    enabled: boolean;
    reason?: string;
    image?: {
        src: string;
        format: "png";
        width: number;
        height: number;
        dpr: number;
        actualWidth: number;
        actualHeight: number;
        fileSize: number;
        quality: number;
    };
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    verified?: boolean;
    attempts?: number;
    capturedAt?: string;
    error?: string;
}
export interface RasterStats {
    totalElements: number;
    textElements: number;
    rasterized: number;
    reasons: Record<string, number>;
    totalImageSize: number;
    averageImageSize?: number;
    failed: number;
    retried: number;
    skipped: number;
    large: string[];
}
export interface FigmaFill {
    type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
    color?: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    opacity?: number;
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
}
export interface FigmaStroke {
    type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL";
    color: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    thickness: number;
    position: "INSIDE" | "OUTSIDE" | "CENTER";
}
export interface FigmaEffect {
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
    blendMode?: string;
}
export interface FigmaConstraints {
    horizontal: "LEFT" | "RIGHT" | "LEFT_RIGHT" | "CENTER" | "SCALE";
    vertical: "TOP" | "BOTTOM" | "TOP_BOTTOM" | "CENTER" | "SCALE";
}
export interface FigmaAutoLayout {
    layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
    counterAxisSizingMode?: "FIXED" | "AUTO";
    primaryAxisSizingMode?: "FIXED" | "AUTO";
    itemSpacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    layoutAlign?: "MIN" | "CENTER" | "MAX" | "STRETCH";
}
export interface FigmaTextData {
    characters: string;
    fontName: {
        family: string;
        style: string;
    };
    fontSize: number;
    lineHeight: {
        value: number;
        unit: "PIXELS" | "PERCENT" | "AUTO";
    };
    letterSpacing: {
        value: number;
        unit: "PIXELS" | "PERCENT";
    };
    textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    textAlignVertical: "TOP" | "CENTER" | "BOTTOM";
    textAutoResize: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT";
    fills: FigmaFill[];
    textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
    textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
}
export interface FigmaProperties {
    type: "FRAME" | "TEXT" | "RECTANGLE" | "ELLIPSE" | "VECTOR" | "GROUP" | "COMPONENT";
    fills?: FigmaFill[];
    strokes?: FigmaStroke[];
    effects?: FigmaEffect[];
    constraints?: FigmaConstraints;
    autoLayout?: FigmaAutoLayout;
    textData?: FigmaTextData;
    cornerRadius?: number;
    clipsContent?: boolean;
    visible?: boolean;
    locked?: boolean;
}
export interface ValidationResult {
    confidence: number;
    pixelDiff: number;
    useFallback: boolean;
    failureReason?: string;
    validated: boolean;
}
export interface OptimizationHints {
    canFlatten: boolean;
    canMerge: boolean;
    mergeWith: string[];
    isUnnecessary: boolean;
    reasoning: string;
}
export declare function extractComplete(url: string, options?: ExtractionOptions): Promise<IRDocument>;
export declare function extractBasic(url: string): Promise<IRDocument>;
export declare function extractHybrid(url: string): Promise<IRDocument>;
export declare function extractMaximum(url: string): Promise<IRDocument>;
export declare function extractWithTokens(url: string): Promise<IRDocument>;
export declare function extractWithFontsAndScreenshots(url: string, options?: any): Promise<IRDocument>;
//# sourceMappingURL=scraper.d.ts.map