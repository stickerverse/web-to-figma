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

// ==================== ROOT DOCUMENT INTERFACE ====================

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
  stackingContexts?: IRStackingContext[];
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

  // Legacy compatibility fields (deprecated, use new structure)
  styles?: any;
  image?: any;
  svg?: any;
  primaryScreenshot?: any;
  rasterFallback?: any;
  optimization?: any;
  // CSS Inheritance Chain (NEW)
  inheritanceChain?: IRInheritanceChain;
  // Resolved CSS styles with inheritance metadata
  resolvedStyles?: IRResolvedStyles;
  // Whether this node still needs a screenshot fallback captured
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

// ==================== CSS INHERITANCE INTERFACES ====================

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

// ==================== LAYOUT INTERFACE ====================

export interface IRLayout {
  // Box model
  boxModel: {
    margin: IRSpacing;
    padding: IRSpacing;
    border: IRSpacing;
    boxSizing: "content-box" | "border-box";
  };

  // Computed bounds for accurate positioning
  bounds?: {
    content: { x: number; y: number; width: number; height: number };
    padding: { x: number; y: number; width: number; height: number };
    border: { x: number; y: number; width: number; height: number };
    margin: { x: number; y: number; width: number; height: number };
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

  // Flexbox layout (W3C Flexbox Level 1 specification compliant)
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
    justifyContent: "flex-start" | "flex-end" | "center" | "space-between" | 
                   "space-around" | "space-evenly" | "start" | "end" | 
                   "left" | "right" | "stretch";
    
    /**
     * Aligns items along the cross axis (align-items property)
     * Supports all CSS align-items values including baseline variants
     */
    alignItems: "stretch" | "flex-start" | "flex-end" | "center" | "baseline" |
               "first baseline" | "last baseline" | "start" | "end" | "self-start" |
               "self-end" | "safe center" | "unsafe center";
    
    /**
     * Aligns wrapped lines along the cross axis (align-content property)
     * Only applies when wrap is not "nowrap"
     */
    alignContent: "stretch" | "flex-start" | "flex-end" | "center" | 
                 "space-between" | "space-around" | "space-evenly" |
                 "start" | "end" | "baseline" | "first baseline" | "last baseline";
    
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
    alignSelf: "auto" | "stretch" | "flex-start" | "flex-end" | "center" | 
              "baseline" | "first baseline" | "last baseline" | "start" | 
              "end" | "self-start" | "self-end";
    
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

  // Grid layout
  grid?: {
    templateColumns: string;
    templateRows: string;
    templateAreas: string;
    autoFlow: string;
    autoColumns: string;
    autoRows: string;
    gap: { row: number; column: number };
    // Container alignment
    justifyContent: "start" | "end" | "center" | "stretch" | "space-around" | "space-between" | "space-evenly";
    alignContent: "start" | "end" | "center" | "stretch" | "space-around" | "space-between" | "space-evenly";
    justifyItems: "start" | "end" | "center" | "stretch";
    alignItems: "start" | "end" | "center" | "stretch" | "baseline";
    placeContent: string;
    placeItems: string;
    // Item properties
    column: string;
    row: string;
    area: string;
    justifySelf: "auto" | "start" | "end" | "center" | "stretch";
    alignSelf: "auto" | "start" | "end" | "center" | "stretch" | "baseline";
    placeSelf: string;
  };

  // Resolved alignment context for this node within its parent container
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

// ==================== FLEXBOX TYPE DEFINITIONS ====================

/**
 * Comprehensive type definitions for CSS Flexbox properties
 * Aligned with W3C CSS Flexible Box Layout Module Level 1
 */
export namespace FlexboxTypes {
  /** All valid flex-direction values */
  export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";
  
  /** All valid flex-wrap values */
  export type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
  
  /** All valid justify-content values (CSS Box Alignment Level 3) */
  export type JustifyContent = 
    | "flex-start" | "flex-end" | "center" 
    | "space-between" | "space-around" | "space-evenly"
    | "start" | "end" | "left" | "right" | "stretch";
  
  /** All valid align-items values */
  export type AlignItems = 
    | "stretch" | "flex-start" | "flex-end" | "center" | "baseline"
    | "first baseline" | "last baseline" | "start" | "end" 
    | "self-start" | "self-end" | "safe center" | "unsafe center";
  
  /** All valid align-content values */
  export type AlignContent = 
    | "stretch" | "flex-start" | "flex-end" | "center"
    | "space-between" | "space-around" | "space-evenly"
    | "start" | "end" | "baseline" | "first baseline" | "last baseline";
  
  /** All valid align-self values */
  export type AlignSelf = 
    | "auto" | "stretch" | "flex-start" | "flex-end" | "center"
    | "baseline" | "first baseline" | "last baseline" | "start"
    | "end" | "self-start" | "self-end";
  
  /** Flex shorthand parsing result */
  export interface FlexShorthand {
    grow: number;
    shrink: number;
    basis: string;
  }
  
  /** Flex container computed values for layout calculations */
  export interface FlexContainerComputed {
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

// ==================== FLEXBOX UTILITY FUNCTIONS ====================

/**
 * Utility functions for working with flexbox layouts
 * These help convert between CSS values and internal representations
 */
export namespace FlexboxUtils {
  /**
   * Parse CSS flex shorthand value into individual components
   * Handles: flex: grow shrink basis | initial | auto | none | <number>
   */
  export function parseFlexShorthand(flex: string): FlexboxTypes.FlexShorthand {
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
  
  /**
   * Determine main and cross axes from flex-direction
   */
  export function getAxesFromDirection(direction: FlexboxTypes.FlexDirection): FlexboxTypes.FlexContainerComputed {
    const isColumn = direction.startsWith("column");
    const isReversed = direction.endsWith("-reverse");
    
    return {
      mainAxis: isColumn ? "vertical" : "horizontal",
      crossAxis: isColumn ? "horizontal" : "vertical",
      isReversed,
      canWrap: false, // Set by caller based on flex-wrap
    };
  }
  
  /**
   * Validate and normalize justify-content value
   */
  export function normalizeJustifyContent(value: string): FlexboxTypes.JustifyContent {
    const validValues: FlexboxTypes.JustifyContent[] = [
      "flex-start", "flex-end", "center", "space-between", 
      "space-around", "space-evenly", "start", "end", "left", "right", "stretch"
    ];
    
    return validValues.includes(value as FlexboxTypes.JustifyContent) 
      ? value as FlexboxTypes.JustifyContent 
      : "flex-start";
  }
  
  /**
   * Validate and normalize align-items value
   */
  export function normalizeAlignItems(value: string): FlexboxTypes.AlignItems {
    const validValues: FlexboxTypes.AlignItems[] = [
      "stretch", "flex-start", "flex-end", "center", "baseline",
      "first baseline", "last baseline", "start", "end", 
      "self-start", "self-end", "safe center", "unsafe center"
    ];
    
    return validValues.includes(value as FlexboxTypes.AlignItems)
      ? value as FlexboxTypes.AlignItems
      : "stretch";
  }
  
  /**
   * Validate and normalize align-content value
   */
  export function normalizeAlignContent(value: string): FlexboxTypes.AlignContent {
    const validValues: FlexboxTypes.AlignContent[] = [
      "stretch", "flex-start", "flex-end", "center",
      "space-between", "space-around", "space-evenly",
      "start", "end", "baseline", "first baseline", "last baseline"
    ];
    
    return validValues.includes(value as FlexboxTypes.AlignContent)
      ? value as FlexboxTypes.AlignContent
      : "stretch";
  }
  
  /**
   * Validate and normalize align-self value
   */
  export function normalizeAlignSelf(value: string): FlexboxTypes.AlignSelf {
    const validValues: FlexboxTypes.AlignSelf[] = [
      "auto", "stretch", "flex-start", "flex-end", "center",
      "baseline", "first baseline", "last baseline", "start",
      "end", "self-start", "self-end"
    ];
    
    return validValues.includes(value as FlexboxTypes.AlignSelf)
      ? value as FlexboxTypes.AlignSelf
      : "auto";
  }
  
  /**
   * Check if a display value creates a flex container
   */
  export function isFlexDisplay(display: string): boolean {
    return display === "flex" || display === "inline-flex";
  }
  
  /**
   * Convert gap values from various CSS units to pixels
   * Note: This is a simplified implementation - production would need full CSS unit conversion
   */
  export function parseGapValue(gap: string | number): number {
    if (typeof gap === "number") return gap;
    if (!gap || gap === "normal" || gap === "0") return 0;
    
    // Remove units and parse as float - simplified for now
    const numValue = parseFloat(gap.toString().replace(/[a-zA-Z%]+$/, ""));
    return isNaN(numValue) ? 0 : numValue;
  }
  
  /**
   * Create a complete flex container configuration with defaults
   */
  export function createFlexContainer(
    overrides: Partial<NonNullable<IRLayout["flex"]>> = {}
  ): NonNullable<IRLayout["flex"]> {
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
  
  /**
   * Create a complete flex item configuration with defaults
   */
  export function createFlexItem(
    overrides: Partial<NonNullable<IRLayout["flexItem"]>> = {}
  ): NonNullable<IRLayout["flexItem"]> {
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
}

// ==================== GRID UTILITY FUNCTIONS ====================

export namespace GridUtils {
  type GridLayout = NonNullable<IRLayout["grid"]>;
  const JUSTIFY_CONTENT_VALUES: GridLayout["justifyContent"][] = [
    "start",
    "end",
    "center",
    "stretch",
    "space-around",
    "space-between",
    "space-evenly",
  ];
  const JUSTIFY_ITEMS_VALUES: GridLayout["justifyItems"][] = ["start", "end", "center", "stretch"];
  const ALIGN_ITEMS_VALUES: GridLayout["alignItems"][] = ["start", "end", "center", "stretch", "baseline"];
  const JUSTIFY_SELF_VALUES: GridLayout["justifySelf"][] = ["auto", "start", "end", "center", "stretch"];
  const ALIGN_SELF_VALUES: GridLayout["alignSelf"][] = ["auto", "start", "end", "center", "stretch", "baseline"];

  function sanitizeKeyword(value?: string): string {
    if (!value) return "";
    const normalized = value.trim().toLowerCase();
    if (normalized === "flex-start" || normalized === "self-start" || normalized === "left") return "start";
    if (normalized === "flex-end" || normalized === "self-end" || normalized === "right") return "end";
    if (normalized === "safe center" || normalized === "unsafe center") return "center";
    if (normalized.includes("baseline")) return "baseline";
    return normalized;
  }

  export function isGridDisplay(display?: string): boolean {
    return display === "grid" || display === "inline-grid";
  }

  export function normalizeJustifyContent(value?: string): GridLayout["justifyContent"] {
    const keyword = sanitizeKeyword(value);
    if (JUSTIFY_CONTENT_VALUES.includes(keyword as GridLayout["justifyContent"])) {
      return keyword as GridLayout["justifyContent"];
    }
    return "start";
  }

  export function normalizeAlignContent(value?: string): GridLayout["alignContent"] {
    const keyword = sanitizeKeyword(value);
    if (JUSTIFY_CONTENT_VALUES.includes(keyword as GridLayout["justifyContent"])) {
      return keyword as GridLayout["alignContent"];
    }
    return "stretch";
  }

  export function normalizeJustifyItems(value?: string): GridLayout["justifyItems"] {
    const keyword = sanitizeKeyword(value);
    if (JUSTIFY_ITEMS_VALUES.includes(keyword as GridLayout["justifyItems"])) {
      return keyword as GridLayout["justifyItems"];
    }
    return "stretch";
  }

  export function normalizeAlignItems(value?: string): GridLayout["alignItems"] {
    const keyword = sanitizeKeyword(value);
    if (ALIGN_ITEMS_VALUES.includes(keyword as GridLayout["alignItems"])) {
      return keyword as GridLayout["alignItems"];
    }
    return "stretch";
  }

  export function normalizeJustifySelf(value?: string): GridLayout["justifySelf"] {
    const keyword = sanitizeKeyword(value);
    if (JUSTIFY_SELF_VALUES.includes(keyword as GridLayout["justifySelf"])) {
      return keyword as GridLayout["justifySelf"];
    }
    if (keyword === "normal") {
      return "auto";
    }
    return "auto";
  }

  export function normalizeAlignSelf(value?: string): GridLayout["alignSelf"] {
    const keyword = sanitizeKeyword(value);
    if (ALIGN_SELF_VALUES.includes(keyword as GridLayout["alignSelf"])) {
      return keyword as GridLayout["alignSelf"];
    }
    if (keyword === "normal") {
      return "auto";
    }
    return "auto";
  }
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
  rawText: string;        // Raw text content as specified in prompt
  text: string;           // Legacy compatibility
  innerText: string;      // Legacy compatibility
  html?: string;          // HTML content as specified in prompt
  innerHTML?: string;     // Legacy compatibility
  isClipped: boolean;
  lineCount: number;
  wordCount: number;
}

export interface IRTextMetrics {
  // Browser-accurate text metrics as specified in prompt
  lineBoxes: { x: number; y: number; width: number; height: number }[];
  baseline: number;
  ascent: number;
  descent: number;
  lineHeightPx: number;
  align: string;
  whitespace: string;
  wrapMode: string;

  // Font properties (legacy compatibility)
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

  // Line and letter spacing (legacy compatibility)
  spacing: {
    lineHeight: number;      // Computed in px
    letterSpacing: number;   // Computed in px  
    wordSpacing: number;     // Computed in px
    textIndent: number;      // Computed in px
  };

  // Text layout (legacy compatibility)
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
  url?: string;
  mimeType: string;
  hash: string;
  width: number;
  height: number;
  data?: string; // base64 if inlined
  chunkRef?: { id: string; length: number }; // for streamed chunks
  
  // Additional metadata
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
  src: { url: string; format?: string }[];
  data?: string; // base64
  
  // Additional metadata
  display?: "auto" | "block" | "swap" | "fallback" | "optional";
  loadStatus?: "loaded" | "loading" | "unloaded" | "error";
  usedByNodes?: string[]; // Node IDs that use this font
  isSystemFont?: boolean;
  hash?: string;
}

export interface IRSVGAsset {
  id: string;
  svg: string;
  viewBox?: { x: number; y: number; width: number; height: number };
  
  // Additional metadata for compatibility
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
  nodeId?: string;      // Node that owns this chunk (preferred)
  assetId?: string;     // Legacy reference to IRImageAsset.id
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
  document?: IRDocument; // Final complete document (optional in streaming)
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

// ==================== FLEXBOX TYPE GUARDS ====================

/**
 * Type guard to check if a node has flex container properties
 */
export function isFlexContainer(node: IRNode): boolean {
  return !!(node.layout.flex?.isFlexContainer);
}

/**
 * Type guard to check if a node has flex item properties
 */
export function isFlexItem(node: IRNode): boolean {
  return !!(node.layout.flexItem);
}

/**
 * Type guard to check if a node uses flexbox layout (either container or item)
 */
export function usesFlexboxLayout(node: IRNode): boolean {
  return isFlexContainer(node) || isFlexItem(node);
}

/**
 * Type guard to check if flex container has wrapping enabled
 */
export function isFlexWrapEnabled(node: IRNode): boolean {
  return node.layout.flex?.wrap !== "nowrap";
}

/**
 * Type guard to check if flex item has explicit sizing
 */
export function hasExplicitFlexSizing(node: IRNode): boolean {
  return !!(node.layout.flexItem?.computed?.hasExplicitSizing);
}

/**
 * Get the effective flex direction (accounting for reverse)
 */
export function getFlexMainAxis(node: IRNode): "horizontal" | "vertical" | null {
  if (!isFlexContainer(node)) return null;
  const direction = node.layout.flex?.direction || "row";
  return direction.startsWith("column") ? "vertical" : "horizontal";
}

/**
 * Get the flex cross axis (perpendicular to main axis)
 */
export function getFlexCrossAxis(node: IRNode): "horizontal" | "vertical" | null {
  const mainAxis = getFlexMainAxis(node);
  if (!mainAxis) return null;
  return mainAxis === "horizontal" ? "vertical" : "horizontal";
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

export class LegacyIRMigrator {
  // Convert old IRNode structure to new unified structure
  migrateFromLegacyIRNode(legacyNode: any): IRNode {
    const newNode: Partial<IRNode> = {
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
      const rawText =
        typeof legacyText === "string"
          ? legacyText
          : legacyText?.rawText ||
            legacyText?.text ||
            legacyText?.content ||
            "";
      const html =
        typeof legacyText === "object" && legacyText !== null
          ? legacyText.html ||
            legacyText.innerHTML ||
            legacyNode.html ||
            rawText
          : legacyNode.html || rawText;
      const innerText =
        typeof legacyText === "object" && legacyText !== null
          ? legacyText.innerText || rawText
          : rawText;
      const wordCount =
        rawText && typeof rawText === "string"
          ? rawText.trim().length === 0
            ? 0
            : rawText.trim().split(/\s+/).length
          : 0;

      newNode.text = {
        rawText,
        html,
        text: rawText,
        innerText,
        isClipped:
          (typeof legacyText === "object" && legacyText?.isClipped) || false,
        lineCount:
          (typeof legacyText === "object" && legacyText?.lineCount) || 1,
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

    return newNode as IRNode;
  }

  // Convert old ExtractedData to new IRDocument
  migrateFromExtractedData(extractedData: any): IRDocument {
    const document: IRDocument = {
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
      nodes: (extractedData.nodes || []).map((node: any) => 
        this.migrateFromLegacyIRNode(node)
      ),
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
  migrateFromCaptureData(captureData: any): IRDocument {
    const document: IRDocument = {
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
      nodes: (captureData.elements || []).map((element: any) => 
        this.migrateFromCapturedElement(element)
      ),
      assets: {
        images: [],
        fonts: [],
        svgs: [],
      },
    };

    return document;
  }

  private mapLegacyTypeToNewType(type: string): IRNode['type'] {
    const mapping: Record<string, IRNode['type']> = {
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

  private migrateLegacyLayout(legacyNode: any): IRLayout {
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
          direction: (styles.flexDirection || "row") as FlexboxTypes.FlexDirection,
          wrap: (styles.flexWrap || "nowrap") as FlexboxTypes.FlexWrap,
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

  private migrateLegacyTypography(legacyNode: any): IRTextMetrics | undefined {
    const styles = legacyNode.styles || {};
    const typography = legacyNode.typography || legacyNode.styles?.typography || {};
    
    if (!legacyNode.text && legacyNode.type !== "TEXT") return undefined;

    return {
      // Required browser-accurate measurements with reasonable defaults
      lineBoxes: [],
      baseline: Math.round((parseFloat(typography.fontSize || styles.fontSize) || 16) * 0.8),
      ascent: Math.round((parseFloat(typography.fontSize || styles.fontSize) || 16) * 0.8),
      descent: Math.round((parseFloat(typography.fontSize || styles.fontSize) || 16) * 0.2),
      lineHeightPx: Math.round(parseFloat(typography.lineHeightPx || styles.lineHeight) || 19.2),
      align: (typography.textAlign || styles.textAlign || "left") as "left" | "right" | "center" | "justify",
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
        align: (typography.textAlign || styles.textAlign || "left") as "left" | "right" | "center" | "justify",
        verticalAlign: typography.verticalAlign || styles.verticalAlign || "baseline",
        whiteSpace: typography.whiteSpace || styles.whiteSpace || "normal",
        wordBreak: typography.wordBreak || styles.wordBreak || "normal",
        overflowWrap: typography.overflowWrap || styles.overflowWrap || "normal",
        direction: (typography.direction || styles.direction || "ltr") as "ltr" | "rtl",
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

  private migrateLegacyBackground(styles: any): IRBackground | undefined {
    const layers: IRBackgroundLayer[] = [];
    
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

  private migrateLegacyBorders(styles: any): IRBorder | undefined {
    const border: IRBorder = {};
    
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

  private migrateLegacyEffects(styles: any): IREffects | undefined {
    const effects: IREffects = {
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

  private migrateLegacyImages(extractedData: any): IRImageAsset[] {
    // Check if we have new-format assets collected from the scraper
    if (extractedData.assets && Array.isArray(extractedData.assets)) {
      const imageAssets = extractedData.assets.filter((asset: any) => 
        asset.mimeType || asset.type === 'image' || asset.type === 'canvas' || asset.type === 'video'
      );
      console.log(`[Legacy Migration] Found ${imageAssets.length} image assets in new format`);
      return imageAssets;
    }
    
    // Fallback: try to extract from legacy structure
    return [];
  }

  private migrateLegacyFonts(extractedData: any): IRFontAsset[] {
    // Prioritize enhanced fontAssets if available
    if (extractedData.fontAssets && Array.isArray(extractedData.fontAssets)) {
      console.log(`[Legacy Migration] Using enhanced fontAssets (${extractedData.fontAssets.length} fonts)`);
      return extractedData.fontAssets; // Already in IRFontAsset format
    }
    
    // Fallback to legacy font formats
    const fonts = extractedData.fonts || extractedData.fontFaces || [];
    console.log(`[Legacy Migration] Using legacy font format (${fonts.length} fonts)`);
    
    return fonts.map((font: any, index: number) => ({
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

  private migrateLegacySVGs(extractedData: any): IRSVGAsset[] {
    // Check if we have new-format SVG assets collected from the scraper
    if (extractedData.assets && Array.isArray(extractedData.assets)) {
      const svgAssets = extractedData.assets.filter((asset: any) => 
        asset.svg || asset.viewBox !== undefined
      );
      console.log(`[Legacy Migration] Found ${svgAssets.length} SVG assets in new format`);
      return svgAssets;
    }
    
    // Fallback: try to extract from legacy structure
    return [];
  }

  private migrateLegacyTokens(tokens: any): IRDocument['tokens'] {
    if (!tokens) return undefined;
    
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

  private migrateFromCapturedElement(element: any): IRNode {
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
    } as IRNode;
  }

  private migrateCapturedElementLayout(element: any): IRLayout {
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

  private parseSpacing(spacing: string): IRSpacing {
    const defaultSpacing = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!spacing || spacing === "0" || spacing === "auto") return defaultSpacing;
    
    const values = spacing.split(' ').map(v => parseFloat(v) || 0);
    switch (values.length) {
      case 1: return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
      case 2: return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
      case 3: return { top: values[0], right: values[1], bottom: values[2], left: values[1] };
      case 4: return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
      default: return defaultSpacing;
    }
  }

  private parseTransformMatrix(transform: string): number[] {
    // Simplified matrix parsing
    return [1, 0, 0, 0, 1, 0]; // Identity matrix
  }

  private parseTextShadow(textShadow: string): Array<{offsetX: number; offsetY: number; blurRadius: number; color: string}> | undefined {
    if (!textShadow || textShadow === "none") return undefined;
    // Simplified parsing - would need full CSS parser for production
    return [{
      offsetX: 1,
      offsetY: 1,
      blurRadius: 1,
      color: "rgba(0,0,0,0.5)",
    }];
  }

  private parseBoxShadow(boxShadow: string): Array<{type: "box"; offsetX: number; offsetY: number; blurRadius: number; spreadRadius?: number; color: string; inset?: boolean}> {
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

  private parseFilters(filter: string): Array<{type: "blur" | "brightness" | "contrast" | "drop-shadow" | "grayscale" | "hue-rotate" | "invert" | "opacity" | "saturate" | "sepia"; value: string}> {
    // Simplified parsing - would need full CSS parser for production
    return [{
      type: "blur",
      value: "5px",
    }];
  }

  private parseBackdropFilters(filter: string): Array<{type: "blur" | "brightness" | "contrast" | "grayscale" | "hue-rotate" | "invert" | "opacity" | "saturate" | "sepia"; value: string}> {
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
  private hasFlexItemProperties(styles: any): boolean {
    return !!(
      styles.flexGrow !== undefined || 
      styles.flexShrink !== undefined || 
      styles.flexBasis !== undefined ||
      styles.alignSelf !== undefined ||
      styles.order !== undefined ||
      styles.flex !== undefined
    );
  }

  private createGridLayout(styles: any): IRLayout["grid"] | undefined {
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

// ==================== BOX MODEL UTILITIES ====================

/**
 * Compute accurate bounds for all box model layers
 * Handles content-box vs border-box sizing correctly
 */
export function computeBoxModelBounds(
  rect: { x: number; y: number; width: number; height: number },
  layout: IRLayout
): NonNullable<IRLayout["bounds"]> {
  const { boxModel } = layout;
  const { margin, padding, border, boxSizing } = boxModel;

  let contentRect: { x: number; y: number; width: number; height: number };
  let paddingRect: { x: number; y: number; width: number; height: number };
  let borderRect: { x: number; y: number; width: number; height: number };
  let marginRect: { x: number; y: number; width: number; height: number };

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
  } else {
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
export const INHERITABLE_PROPERTIES = new Set([
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
export class CSSInheritanceResolver {
  private nodeMap: Map<string, IRNode> = new Map();
  private inheritanceMap: Map<string, IRInheritanceChain> = new Map();
  
  constructor(nodes: IRNode[]) {
    // Build node lookup map
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
    }
  }
  
  /**
   * Resolve inheritance chain for all nodes
   */
  resolveAll(): Map<string, IRInheritanceChain> {
    // Clear previous results
    this.inheritanceMap.clear();
    
    // Process nodes in DOM order to ensure parents are processed first
    const processedNodes = new Set<string>();
    
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
  resolveNode(nodeId: string): IRInheritanceChain | undefined {
    const existingChain = this.inheritanceMap.get(nodeId);
    if (existingChain) {
      return existingChain;
    }
    
    const processedNodes = new Set<string>();
    return this.resolveNodeRecursive(nodeId, processedNodes);
  }
  
  private resolveNodeRecursive(
    nodeId: string, 
    processedNodes: Set<string>
  ): IRInheritanceChain | undefined {
    if (processedNodes.has(nodeId)) {
      return this.inheritanceMap.get(nodeId);
    }
    
    processedNodes.add(nodeId);
    const node = this.nodeMap.get(nodeId);
    
    if (!node) {
      return undefined;
    }
    
    // Ensure parent is processed first
    let parentChain: IRInheritanceChain | undefined;
    if (node.parent) {
      parentChain = this.resolveNodeRecursive(node.parent, processedNodes);
    }
    
    // Build inheritance chain for this node
    const inheritanceChain = this.buildInheritanceChain(node, parentChain);
    this.inheritanceMap.set(nodeId, inheritanceChain);
    
    return inheritanceChain;
  }
  
  private buildInheritanceChain(
    node: IRNode, 
    parentChain?: IRInheritanceChain
  ): IRInheritanceChain {
    const inherited: Record<string, IRInheritedProperty> = {};
    const explicit: Record<string, IRExplicitProperty> = {};
    const computed: Record<string, string> = {};
    
    // Get explicit styles for this node (from legacy styles field for now)
    const rawStyles = node.styles || {};
    
    // Normalize styles to expand shorthands to longhand
    const nodeStyles = this.normalizeStylesForInheritance(rawStyles);
    
    // Process inherited properties from parent
    if (parentChain) {
      for (const property of INHERITABLE_PROPERTIES) {
        const parentValue = parentChain.computed[property];
        if (parentValue && !nodeStyles[property]) {
          // Property inherits from parent
          const parentInheritedProp = parentChain.inherited[property];
          inherited[property] = {
            property,
            value: parentValue,
            sourceId: parentInheritedProp ? parentInheritedProp.sourceId : node.parent!,
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
              sourceId: node.parent!,
              distance: 1,
              naturallyInherits: INHERITABLE_PROPERTIES.has(property),
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
  
  private analyzeCascade(node: IRNode, styles: Record<string, any>): IRCascadeInfo {
    // Simplified cascade analysis - would need more DOM context for full analysis
    const important: string[] = [];
    const inline: string[] = [];
    
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
  createResolvedStylesSnapshot(chain: IRInheritanceChain): IRResolvedStyles {
    const properties: Record<string, IRResolvedStyleProperty> = {};
    
    for (const [property, value] of Object.entries(chain.computed)) {
      if (chain.explicit[property]) {
        const explicit = chain.explicit[property];
        properties[property] = {
          property,
          value,
          source: "explicit",
          overridesInheritance: explicit.overridesInheritance,
        };
      } else if (chain.inherited[property]) {
        const inherited = chain.inherited[property];
        properties[property] = {
          property,
          value,
          source: "inherited",
          inheritedFrom: inherited.sourceId,
          distance: inherited.distance,
          naturallyInherits: inherited.naturallyInherits,
        };
      } else {
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
  private normalizeStylesForInheritance(rawStyles: Record<string, any>): Record<string, string> {
    // Convert any non-string values to strings
    const stringStyles: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawStyles)) {
      if (value != null && value !== '') {
        stringStyles[key] = String(value);
      }
    }
    
    try {
      // Use simplified built-in normalization for now
      return this.simplifyStylesForBrowser(stringStyles);
    } catch (error) {
      console.warn('Style normalization failed, using raw styles:', error);
      return stringStyles;
    }
  }
  
  /**
   * Simplified style normalization for browser environments
   */
  private simplifyStylesForBrowser(styles: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    
    for (const [property, value] of Object.entries(styles)) {
      if (!value || value === '') continue;
      
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
          } else {
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
  private parseSpacingValue(value: string): [string, string, string, string] {
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
  private parseFlexShorthand(value: string): { grow: number; shrink: number; basis: string } {
    const trimmed = value.trim();
    
    // Handle keywords
    if (trimmed === 'initial') return { grow: 0, shrink: 1, basis: 'auto' };
    if (trimmed === 'auto') return { grow: 1, shrink: 1, basis: 'auto' };
    if (trimmed === 'none') return { grow: 0, shrink: 0, basis: 'auto' };
    
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

/**
 * Utility functions for working with inheritance chains
 */
export namespace InheritanceUtils {
  /**
   * Get the resolved value for a property, following the inheritance chain
   */
  export function getResolvedValue(
    chain: IRInheritanceChain, 
    property: string
  ): string | undefined {
    return chain.computed[property];
  }
  
  /**
   * Get the source of a property value (explicit vs inherited)
   */
  export function getPropertySource(
    chain: IRInheritanceChain,
    property: string
  ): 'explicit' | 'inherited' | 'unset' {
    if (chain.explicit[property]) {
      return 'explicit';
    }
    if (chain.inherited[property]) {
      return 'inherited';
    }
    return 'unset';
  }
  
  /**
   * Get the inheritance path for a property
   */
  export function getInheritancePath(
    chain: IRInheritanceChain,
    property: string,
    allChains: Map<string, IRInheritanceChain>
  ): string[] {
    const path: string[] = [];
    const inheritedProp = chain.inherited[property];
    
    if (!inheritedProp) {
      return path;
    }
    
    let currentSourceId = inheritedProp.sourceId;
    let distance = inheritedProp.distance;
    
    while (currentSourceId && distance > 0) {
      path.push(currentSourceId);
      
      const sourceChain = allChains.get(currentSourceId);
      if (!sourceChain) break;
      
      const sourceInheritedProp = sourceChain.inherited[property];
      if (!sourceInheritedProp) break;
      
      currentSourceId = sourceInheritedProp.sourceId;
      distance = sourceInheritedProp.distance;
    }
    
    return path;
  }
  
  /**
   * Check if a property naturally inherits in CSS
   */
  export function naturallyInherits(property: string): boolean {
    return INHERITABLE_PROPERTIES.has(property);
  }
  
  /**
   * Get all properties that inherit from parent
   */
  export function getInheritedProperties(chain: IRInheritanceChain): string[] {
    return Object.keys(chain.inherited);
  }
  
  /**
   * Get all properties explicitly set on element
   */
  export function getExplicitProperties(chain: IRInheritanceChain): string[] {
    return Object.keys(chain.explicit);
  }
  
  /**
   * Create a debug summary of the inheritance chain
   */
  export function createDebugSummary(
    nodeId: string,
    chain: IRInheritanceChain,
    allChains: Map<string, IRInheritanceChain>
  ): {
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
  } {
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
}

// ==================== EXPORT COMPATIBILITY LAYER ====================

// Export migrator instance for use
export const legacyMigrator = new LegacyIRMigrator();

// Export legacy types for backward compatibility (deprecated)
export type ExtractedFont = IRFontAsset;
export type ExtractedData = { nodes: IRNode[]; fonts: IRFontAsset[]; viewport: { width: number; height: number } };
export type EnhancedExtractedData = IRDocument;

// Export default for legacy imports
export default {
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
  INHERITABLE_PROPERTIES,
  
  // Legacy migration
  legacyMigrator,
};
