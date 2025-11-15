/**
 * UNIFIED INTERMEDIATE REPRESENTATION (IR) - OPTION 2 REWRITE
 *
 * Single canonical schema for web-to-Figma conversion pipeline
 * Optimized for pixel-perfect layout, browser-accurate typography,
 * multi-layer backgrounds & effects, SVG/vector support, and asset streaming
 *
 * This is the SINGLE SOURCE OF TRUTH between:
 * - scraper/src/scraper.ts (producer)
 * - scraper/src/server.ts + stream-controller.ts (transport)
 * - plugin/src/builder/* (consumer)
 */

// ==================== ROOT DOCUMENT INTERFACE ====================

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
  // Design tokens for style consistency
  tokens?: {
    colors: string[];
    spacing: number[];
    radii: number[];
    fontSizes: number[];
    fontWeights: string[];
    lineHeights: number[];
    shadows: string[];
  };
}

// ==================== CORE NODE INTERFACE ====================

export interface IRNode {
  // Core Identity
  id: string;
  tag: string;
  role?: string;
  type: "FRAME" | "TEXT" | "IMAGE" | "SVG" | "CANVAS" | "VIDEO" | "UNKNOWN";

  // Geometry in world coordinates
  rect: { x: number; y: number; width: number; height: number };
  worldTransform: number[]; // 3x3 or 4x4 matrix flattened
  zIndex: number;
  stackingContextId?: string; // links into stacking tree

  // Layout metadata (flex, grid, box model)
  layout: IRLayout;

  // Visual appearance
  background?: IRBackground;
  borders?: IRBorder;
  effects?: IREffects;
  clip?: IRClip;

  // Typography (required for text nodes)
  text?: IRTextContent;
  textMetrics?: IRTextMetrics;

  // Asset references
  imageRef?: string;      // references IRImageAsset.id
  svgRef?: string;        // references IRSVGAsset.id

  // Pseudo-elements
  pseudo?: {
    before?: IRNode;
    after?: IRNode;
  };

  // Figma pre-mapping hints (optional optimization)
  figma?: IRFigmaHints;

  // Hierarchy
  children: string[];
  parent?: string;

  // DOM metadata
  selector?: string;
  domId?: string;
  classList?: string[];
  dataAttributes?: Record<string, string>;
  ariaLabel?: string;

  // Validation & confidence (from Phase 8)
  validation?: {
    confidence: number; // 0-1
    pixelDiff?: number; // 0-1  
    useFallback: boolean;
    failureReason?: string;
  };

  // Screenshot fallbacks (hybrid approach)
  screenshot?: {
    src: string; // base64 data URL
    width: number;
    height: number;
    dpr: number;
    capturedAt: string;
  };
}

// ==================== LAYOUT INTERFACE ====================

export interface IRLayout {
  // Box model
  boxModel: {
    margin: IRSpacing;
    padding: IRSpacing;
    border: IRSpacing;
  };

  // Position and size
  position: {
    type: "static" | "relative" | "absolute" | "fixed" | "sticky";
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };

  // Display and overflow
  display: {
    type: string;
    overflow: {
      x: "visible" | "hidden" | "scroll" | "auto";
      y: "visible" | "hidden" | "scroll" | "auto";
    };
  };

  // Flexbox layout
  flex?: {
    direction: string;
    wrap: string;
    justifyContent: string;
    alignItems: string;
    alignContent: string;
    gap: { row: number; column: number };
    // Item properties
    grow: number;
    shrink: number;
    basis: string;
    alignSelf: string;
  };

  // Grid layout
  grid?: {
    templateColumns: string;
    templateRows: string;
    templateAreas: string;
    autoFlow: string;
    autoColumns: string;
    autoRows: string;
    gap: { row: number; column: number };
    // Item properties
    column: string;
    row: string;
    area: string;
  };

  // Dimensions
  dimensions: {
    width: string;
    height: string;
    minWidth: string;
    maxWidth: string;
    minHeight: string;
    maxHeight: string;
  };

  // Transform and perspective
  transform?: {
    matrix: number[]; // 2D or 3D transform matrix
    origin: string;
    style: "flat" | "preserve-3d";
  };

  // Stacking and compositing
  stacking: {
    zIndex: number | "auto";
    stackingContextId?: string;
    paintOrder: number;
    isolate: boolean;
  };
}

// ==================== BACKGROUND INTERFACE ====================

export interface IRBackground {
  layers: IRBackgroundLayer[];
}

export interface IRBackgroundLayer {
  type: "color" | "image" | "gradient";
  
  // Color background
  color?: {
    value: string; // CSS color value
    alpha: number; // 0-1
  };
  
  // Image background
  image?: {
    imageRef: string; // references IRImageAsset.id
    size: string;     // background-size
    position: string; // background-position
    repeat: string;   // background-repeat
    attachment: string; // background-attachment
    origin: string;   // background-origin
    clip: string;     // background-clip
  };
  
  // Gradient background
  gradient?: {
    type: "linear" | "radial" | "conic";
    angle?: number;   // For linear gradients
    position?: string; // For radial gradients
    stops: Array<{
      color: string;
      position: number; // 0-1
    }>;
  };
  
  // Layer blending
  blendMode?: string;
}

// ==================== BORDER INTERFACE ====================

export interface IRBorder {
  // Per-side borders
  top?: IRBorderSide;
  right?: IRBorderSide;
  bottom?: IRBorderSide;
  left?: IRBorderSide;
  
  // Border radius
  radius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  
  // Border images
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

// ==================== EFFECTS INTERFACE ====================

export interface IREffects {
  // Box shadows
  shadows?: Array<{
    type: "box" | "text";
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadRadius?: number;
    color: string;
    inset?: boolean;
  }>;

  // CSS filters
  filters?: Array<{
    type: "blur" | "brightness" | "contrast" | "drop-shadow" | "grayscale" | 
          "hue-rotate" | "invert" | "opacity" | "saturate" | "sepia";
    value: string;
  }>;

  // Backdrop filters
  backdropFilters?: Array<{
    type: "blur" | "brightness" | "contrast" | "grayscale" | 
          "hue-rotate" | "invert" | "opacity" | "saturate" | "sepia";
    value: string;
  }>;

  // Blend modes
  blendMode?: string;
  
  // Opacity
  opacity: number; // 0-1
}

// ==================== CLIP INTERFACE ====================

export interface IRClip {
  // Clip path
  clipPath?: {
    type: "inset" | "circle" | "ellipse" | "polygon" | "path" | "url";
    value: string;
  };

  // CSS mask
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

// ==================== TYPOGRAPHY INTERFACES ====================

export interface IRTextContent {
  text: string;
  innerText: string;
  innerHTML?: string;
  isClipped: boolean;
  lineCount: number;
  wordCount: number;
}

export interface IRTextMetrics {
  // Font properties
  font: {
    family: string;
    familyResolved: string; // Actual rendered font
    size: number;           // Computed size in px
    weight: number | string;
    style: string;
    variant: string;
    synthesis: string;
    kerning: string;
    featureSettings: string;
  };

  // Line and letter spacing
  spacing: {
    lineHeight: number;      // Computed in px
    letterSpacing: number;   // Computed in px  
    wordSpacing: number;     // Computed in px
    textIndent: number;      // Computed in px
  };

  // Text layout
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

  // Text effects
  effects: {
    color: string;
    transform: string;       // uppercase, lowercase, etc.
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

  // Advanced typography
  advanced?: {
    hyphenation: boolean;
    textWrap: string;
    textWrapMode: string;
    hangingPunctuation: string;
    fontOpticalSizing: string;
    fontVariationSettings: string;
  };
}

// ==================== ASSET INTERFACES ====================

export interface IRImageAsset {
  id: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  format?: "png" | "jpeg" | "webp" | "gif" | "svg";
  
  // Hash for deduplication
  hash: string;
  
  // Streaming metadata
  size: number;
  chunked: boolean;
  chunkRefs?: {
    totalChunks: number;
    chunkSize: number;
  };
  
  // Processing metadata
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
  src: string;
  format?: "woff2" | "woff" | "ttf" | "otf";
  unicodeRange?: string;
  display?: "auto" | "block" | "swap" | "fallback" | "optional";
  
  // Load status
  loadStatus: "loaded" | "loading" | "unloaded" | "error";
  usedByNodes: string[]; // Node IDs that use this font
  isSystemFont: boolean;
  
  // Font data (for streaming)
  data?: string; // base64 encoded font file
  hash: string;
}

export interface IRSVGAsset {
  id: string;
  content: string; // Full SVG markup
  viewBox?: string;
  width?: string;
  height?: string;
  preserveAspectRatio?: string;
  
  // Parsed paths for vector conversion
  paths?: Array<{
    d: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: string;
  }>;
}

// ==================== FIGMA HINTS INTERFACE ====================

export interface IRFigmaHints {
  // Suggested Figma node type
  nodeType: "FRAME" | "TEXT" | "RECTANGLE" | "ELLIPSE" | "VECTOR" | "COMPONENT" | "INSTANCE";
  
  // Pre-computed fills
  fills?: Array<{
    type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
    color?: { r: number; g: number; b: number; a: number };
    gradientStops?: Array<{
      position: number;
      color: { r: number; g: number; b: number; a: number };
    }>;
    imageRef?: string;
    scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
  }>;

  // Pre-computed strokes
  strokes?: Array<{
    type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL";
    color: { r: number; g: number; b: number; a: number };
    thickness: number;
    position: "INSIDE" | "OUTSIDE" | "CENTER";
  }>;

  // Pre-computed effects
  effects?: Array<{
    type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
    visible: boolean;
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius: number;
    spread?: number;
  }>;

  // Auto layout hints
  autoLayout?: {
    layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
    primaryAxisSizingMode?: "FIXED" | "AUTO";
    counterAxisSizingMode?: "FIXED" | "AUTO";
    itemSpacing?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
    primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
    counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  };

  // Constraints
  constraints?: {
    horizontal: "LEFT" | "RIGHT" | "LEFT_RIGHT" | "CENTER" | "SCALE";
    vertical: "TOP" | "BOTTOM" | "TOP_BOTTOM" | "CENTER" | "SCALE";
  };

  // Component hints
  component?: {
    isComponent: boolean;
    isInstance: boolean;
    masterComponentId?: string;
    variantProperties?: Record<string, string>;
  };
}

// ==================== UTILITY INTERFACES ====================

export interface IRSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ==================== STREAMING INTERFACES ====================
// (Maintained for compatibility with existing streaming pipeline)

export interface StreamMessage {
  type: "NODES" | "IMAGE_CHUNK" | "FONTS" | "TOKENS" | "COMPLETE" | "ERROR" | "PROGRESS";
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
  assetId: string;      // References IRImageAsset.id
  chunkIndex: number;
  totalChunks: number;
  data: number[];
  sequenceNumber: number;
  timestamp: number;
}

export interface CompleteMessage {
  type: "COMPLETE";
  document: IRDocument; // Final complete document
  sequenceNumber: number;
  summary?: {
    duration: number;
    totalNodes: number;
    totalAssets: number;
    accuracy: string;
  };
}

// ==================== TYPE GUARDS ====================

export function isTextNode(node: IRNode): boolean {
  return node.type === "TEXT" && !!node.text;
}

export function isImageNode(node: IRNode): boolean {
  return node.type === "IMAGE" && !!node.imageRef;
}

export function isSVGNode(node: IRNode): boolean {
  return node.type === "SVG" && !!node.svgRef;
}

export function isFrameNode(node: IRNode): boolean {
  return node.type === "FRAME" && node.children.length > 0;
}

export function hasScreenshot(node: IRNode): boolean {
  return !!node.screenshot;
}

export function hasValidation(node: IRNode): boolean {
  return !!node.validation && node.validation.confidence >= 0;
}

export function shouldUseFallback(node: IRNode): boolean {
  return node.validation?.useFallback || false;
}

// ==================== VALIDATION HELPERS ====================

export function validateIRDocument(doc: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required document fields
  if (!doc.url) errors.push("Missing required field: url");
  if (!doc.title) errors.push("Missing required field: title");
  if (!doc.viewport) errors.push("Missing required field: viewport");
  if (!doc.meta) errors.push("Missing required field: meta");
  if (!Array.isArray(doc.nodes)) errors.push("Missing required field: nodes array");
  if (!doc.assets) errors.push("Missing required field: assets");

  // Validate nodes
  if (doc.nodes) {
    doc.nodes.forEach((node: any, index: number) => {
      const nodeValidation = validateIRNode(node);
      nodeValidation.errors.forEach(error => 
        errors.push(`Node ${index} (${node.id || 'unknown'}): ${error}`)
      );
      nodeValidation.warnings.forEach(warning => 
        warnings.push(`Node ${index} (${node.id || 'unknown'}): ${warning}`)
      );
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateIRNode(node: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!node.id) errors.push("Missing required field: id");
  if (!node.type) errors.push("Missing required field: type");
  if (!node.tag) errors.push("Missing required field: tag");
  if (!node.rect) errors.push("Missing required field: rect");
  if (!node.layout) errors.push("Missing required field: layout");

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

export function getNodeConfidence(node: IRNode): number {
  return node.validation?.confidence ?? 1.0;
}

export function shouldRenderAsScreenshot(node: IRNode): boolean {
  return node.validation?.useFallback || getNodeConfidence(node) < 0.9;
}

// ==================== LEGACY COMPATIBILITY HELPERS ====================
// These help migrate from the old IR structure

export interface LegacyCompatibilityLayer {
  // Convert old IRNode structure to new unified structure
  migrateFromLegacyIRNode(legacyNode: any): IRNode;
  
  // Convert old ExtractedData to new IRDocument
  migrateFromExtractedData(extractedData: any): IRDocument;
  
  // Convert old CaptureData to new IRDocument (for builder compatibility)
  migrateFromCaptureData(captureData: any): IRDocument;
}