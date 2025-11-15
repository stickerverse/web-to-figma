/**
 * NODE MAPPING SYSTEM WITH COMPREHENSIVE FLEXBOX SUPPORT
 * 
 * Determines the optimal Figma node type for each captured element
 * Includes comprehensive flexbox → Auto Layout mapping
 * Follows the specification for 100% pixel-perfect recreation
 */

import { CapturedElement, DrawableItem } from './index';
import { IRNode, IRLayout, FlexboxTypes, FlexboxUtils, isFlexContainer, isFlexItem } from '../../../../ir';

export class NodeMapper {
  
  /**
   * Determine the best Figma node type for an element
   */
  getNodeType(element: CapturedElement): FigmaNodeType {
    // Pseudo-element handling
    if (this.isPseudoElement(element)) {
      return this.getPseudoElementNodeType(element);
    }
    
    // Text content
    if (this.isTextNode(element)) {
      return 'TEXT';
    }
    
    // SVG or complex shapes
    if (this.isVectorNode(element)) {
      return 'VECTOR';
    }
    
    // Boolean operations for masks/overlaps
    if (this.isBooleanOperation(element)) {
      return 'BOOLEAN_OPERATION';
    }
    
    // Primitive shapes
    if (this.isEllipse(element)) {
      return 'ELLIPSE';
    }
    
    if (this.isLine(element)) {
      return 'LINE';
    }
    
    if (this.isPolygon(element)) {
      return 'POLYGON';
    }
    
    if (this.isStar(element)) {
      return 'STAR';
    }
    
    // Component instances
    if (this.isComponentInstance(element)) {
      return 'INSTANCE';
    }
    
    // Components
    if (this.isComponent(element)) {
      return 'COMPONENT';
    }
    
    // Sections for major page regions
    if (this.isSection(element)) {
      return 'SECTION';
    }
    
    // Rectangles for simple boxes
    if (this.isRectangle(element)) {
      return 'RECTANGLE';
    }
    
    // Frames for containers with layout significance
    if (this.isFrame(element)) {
      return 'FRAME';
    }
    
    // Groups for non-semantic visual units (last resort)
    return 'GROUP';
  }

  /**
   * Check if element is a pseudo-element
   */
  private isPseudoElement(element: CapturedElement): boolean {
    return element.tag?.startsWith('pseudo-') || false;
  }

  /**
   * Determine node type for pseudo-elements
   */
  private getPseudoElementNodeType(element: CapturedElement): FigmaNodeType {
    // Check if pseudo-element has text content
    if (element.text && element.text.trim().length > 0) {
      return 'TEXT';
    }
    
    // Check if it has visual properties that make it a rectangle
    const hasBackground = element.styles?.backgroundColor || element.background;
    const hasBorder = element.styles?.border || element.borders;
    const isSimpleShape = !element.styles?.borderRadius || this.isSimpleBorderRadius(element.styles.borderRadius);
    
    if (hasBackground || hasBorder) {
      if (isSimpleShape) {
        return 'RECTANGLE';
      } else {
        return 'FRAME';
      }
    }
    
    // Default to frame for layout container
    return 'FRAME';
  }

  /**
   * Check if element should be a TEXT node
   */
  private isTextNode(element: CapturedElement): boolean {
    return !!(element.text && element.text.trim().length > 0);
  }

  /**
   * Check if element should be a VECTOR node
   */
  private isVectorNode(element: CapturedElement): boolean {
    // SVG elements
    if (element.svg) {
      return true;
    }
    
    // Elements with clip-paths
    if (element.styles.clipPath && element.styles.clipPath !== 'none') {
      return true;
    }
    
    // Custom shapes defined by CSS
    if (this.hasComplexPath(element)) {
      return true;
    }
    
    // Complex borders that can't be represented as simple strokes
    if (this.hasComplexBorder(element)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be a BOOLEAN_OPERATION
   */
  private isBooleanOperation(element: CapturedElement): boolean {
    // CSS masks with overlapping elements
    if (element.styles.mask && element.styles.mask !== 'none') {
      return true;
    }
    
    // Complex clip paths that require boolean operations
    if (element.styles.clipPath && this.requiresBooleanOp(element.styles.clipPath)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be an ELLIPSE
   */
  private isEllipse(element: CapturedElement): boolean {
    const { borderRadius } = element.styles;
    const { width, height } = element.rect;
    
    if (!borderRadius) return false;
    
    // Perfect circle
    if (width === height && borderRadius === '50%') {
      return true;
    }
    
    // Oval with border radius >= half the smaller dimension
    const radiusValue = this.parseCSSValue(borderRadius);
    if (radiusValue.unit === '%' && radiusValue.value >= 50) {
      return true;
    }
    
    if (radiusValue.unit === 'px') {
      const minDimension = Math.min(width, height);
      if (radiusValue.value >= minDimension / 2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if element should be a LINE
   */
  private isLine(element: CapturedElement): boolean {
    const { width, height } = element.rect;
    
    // Horizontal line
    if (height <= 2 && width > height * 4) {
      return true;
    }
    
    // Vertical line
    if (width <= 2 && height > width * 4) {
      return true;
    }
    
    // CSS-created lines (hr, borders, etc.)
    if (element.tagName === 'hr') {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be a POLYGON
   */
  private isPolygon(element: CapturedElement): boolean {
    // CSS polygon clip-path
    if (element.styles.clipPath?.includes('polygon')) {
      return true;
    }
    
    // SVG polygon elements
    if (element.svg?.paths.some(path => this.isPolygonPath(path.d))) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be a STAR
   */
  private isStar(element: CapturedElement): boolean {
    // CSS star shapes
    if (element.styles.clipPath?.includes('star')) {
      return true;
    }
    
    // SVG star paths
    if (element.svg?.paths.some(path => this.isStarPath(path.d))) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be a COMPONENT
   */
  private isComponent(element: CapturedElement): boolean {
    // Elements marked as components
    if (element.componentHints?.role === 'component') {
      return true;
    }
    
    // Repeated structures with unique content
    if (this.hasComponentLikeStructure(element)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be an INSTANCE
   */
  private isComponentInstance(element: CapturedElement): boolean {
    // Elements marked as component instances
    if (element.componentHints?.role === 'instance') {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be a SECTION
   */
  private isSection(element: CapturedElement): boolean {
    // Major page regions
    const sectionTags = ['header', 'main', 'footer', 'nav', 'aside', 'section'];
    if (sectionTags.includes(element.tagName.toLowerCase())) {
      return true;
    }
    
    // Large containers that serve as page regions
    if (this.isPageRegion(element)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if element should be a RECTANGLE
   */
  private isRectangle(element: CapturedElement): boolean {
    const { borderRadius, backgroundImage, background } = element.styles;
    
    // Has background or border
    const hasVisualProperties = 
      element.styles.backgroundColor ||
      element.styles.border ||
      backgroundImage ||
      background;
    
    // Simple rectangular shape
    const isSimpleRect = !borderRadius || this.isSimpleBorderRadius(borderRadius);
    
    // Not complex enough for a frame
    const isSimple = !this.hasLayoutSignificance(element);
    
    return hasVisualProperties && isSimpleRect && isSimple;
  }

  /**
   * Check if element should be a FRAME
   */
  private isFrame(element: CapturedElement): boolean {
    // Has layout significance
    if (this.hasLayoutSignificance(element)) {
      return true;
    }
    
    // Container elements
    const containerTags = ['div', 'article', 'section', 'main', 'aside'];
    if (containerTags.includes(element.tagName.toLowerCase())) {
      return true;
    }
    
    // Has multiple children or complex layout
    if (this.isLayoutContainer(element)) {
      return true;
    }
    
    return false;
  }

  /**
   * COMPREHENSIVE FLEXBOX → AUTO LAYOUT MAPPING
   * Maps CSS flexbox properties to Figma Auto Layout with full feature support
   */
  
  /**
   * Determine if a frame should use Auto Layout based on flexbox properties
   */
  shouldUseAutoLayout(item: DrawableItem): boolean {
    const element = item.element;
    
    // Check legacy styles format
    if (element.styles?.display === 'flex' || element.styles?.display === 'inline-flex') {
      return true;
    }
    
    // Check IRNode format if available
    if ('layout' in element) {
      const irNode = element as unknown as IRNode;
      return isFlexContainer(irNode);
    }
    
    return false;
  }

  /**
   * Map CSS flexbox properties to Figma Auto Layout configuration
   */
  mapFlexboxToAutoLayout(item: DrawableItem): FigmaAutoLayoutConfig {
    const element = item.element;
    
    // Default Auto Layout configuration
    const config: FigmaAutoLayoutConfig = {
      layoutMode: "HORIZONTAL",
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "AUTO",
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "MIN",
      itemSpacing: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      layoutGrow: 0,
      constraints: null,
      fallbackToAbsolute: false,
      debugLog: []
    };

    try {
      // Check if we have IRNode with comprehensive flexbox data
      if ('layout' in element && (element as any).layout?.flex) {
        return this.mapIRFlexboxToAutoLayout(element as unknown as IRNode, config);
      } 
      // Fallback to legacy styles mapping
      else if (element.styles) {
        return this.mapLegacyFlexboxToAutoLayout(element, config);
      }
    } catch (error) {
      console.warn(`Flexbox mapping error for ${element.id}:`, error);
      config.fallbackToAbsolute = true;
      config.debugLog.push(`Mapping failed: ${error.message}`);
    }

    return config;
  }

  /**
   * Map IRNode flexbox properties to Auto Layout (comprehensive)
   */
  private mapIRFlexboxToAutoLayout(node: IRNode, config: FigmaAutoLayoutConfig): FigmaAutoLayoutConfig {
    const flex = node.layout.flex!;
    
    config.debugLog.push(`Mapping flex container: ${node.id}`);

    // 1. FLEX DIRECTION → LAYOUT MODE
    config.layoutMode = this.mapFlexDirectionToLayoutMode(flex.direction);
    config.debugLog.push(`Direction: ${flex.direction} → ${config.layoutMode}`);

    // 2. FLEX WRAP HANDLING
    if (flex.wrap !== "nowrap") {
      config.debugLog.push(`Wrap detected: ${flex.wrap} - falling back to absolute positioning`);
      config.fallbackToAbsolute = true;
      return config;
    }

    // 3. JUSTIFY CONTENT → PRIMARY AXIS ALIGNMENT
    config.primaryAxisAlignItems = this.mapJustifyContentToPrimaryAxis(flex.justifyContent);
    config.debugLog.push(`Justify: ${flex.justifyContent} → ${config.primaryAxisAlignItems}`);

    // 4. ALIGN ITEMS → COUNTER AXIS ALIGNMENT  
    config.counterAxisAlignItems = this.mapAlignItemsToCounterAxis(flex.alignItems);
    config.debugLog.push(`Align: ${flex.alignItems} → ${config.counterAxisAlignItems}`);

    // 5. GAP → ITEM SPACING
    config.itemSpacing = this.calculateItemSpacing(flex.gap, flex.direction);
    config.debugLog.push(`Gap: row=${flex.gap.row}px, col=${flex.gap.column}px → ${config.itemSpacing}px`);

    // 6. PADDING
    this.applyPaddingFromBoxModel(node.layout.boxModel.padding, config);

    // 7. SIZING MODES
    this.calculateSizingModes(node, config);

    return config;
  }

  /**
   * Map legacy element styles to Auto Layout (fallback)
   */
  private mapLegacyFlexboxToAutoLayout(element: CapturedElement, config: FigmaAutoLayoutConfig): FigmaAutoLayoutConfig {
    const styles = element.styles;
    
    config.debugLog.push(`Mapping legacy flex: ${element.id}`);

    // Direction
    const direction = (styles.flexDirection || "row") as FlexboxTypes.FlexDirection;
    config.layoutMode = this.mapFlexDirectionToLayoutMode(direction);

    // Wrap detection
    if (styles.flexWrap && styles.flexWrap !== "nowrap") {
      config.fallbackToAbsolute = true;
      config.debugLog.push(`Wrap detected: ${styles.flexWrap} - falling back`);
      return config;
    }

    // Alignment
    config.primaryAxisAlignItems = this.mapJustifyContentToPrimaryAxis(
      FlexboxUtils.normalizeJustifyContent(styles.justifyContent || "flex-start")
    );
    config.counterAxisAlignItems = this.mapAlignItemsToCounterAxis(
      FlexboxUtils.normalizeAlignItems(styles.alignItems || "stretch")
    );

    // Spacing
    config.itemSpacing = FlexboxUtils.parseGapValue(styles.gap || 0);

    // Padding
    if (styles.padding) {
      this.parseLegacyPadding(styles.padding, config);
    }

    return config;
  }

  /**
   * Map flex-direction to Figma layoutMode
   */
  private mapFlexDirectionToLayoutMode(direction: FlexboxTypes.FlexDirection): "HORIZONTAL" | "VERTICAL" {
    switch (direction) {
      case "column":
      case "column-reverse":
        return "VERTICAL";
      case "row":
      case "row-reverse":
      default:
        return "HORIZONTAL";
    }
  }

  /**
   * Map justify-content to primaryAxisAlignItems
   */
  private mapJustifyContentToPrimaryAxis(justifyContent: FlexboxTypes.JustifyContent): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
    const mapping: Record<FlexboxTypes.JustifyContent, "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"> = {
      "flex-start": "MIN",
      "start": "MIN",
      "left": "MIN", // For horizontal layouts
      "center": "CENTER",
      "flex-end": "MAX",
      "end": "MAX",
      "right": "MAX", // For horizontal layouts
      "space-between": "SPACE_BETWEEN",
      "space-around": "CENTER", // Approximate with CENTER
      "space-evenly": "CENTER", // Approximate with CENTER
      "stretch": "MIN" // Not directly supported, use MIN
    };
    
    return mapping[justifyContent] || "MIN";
  }

  /**
   * Map align-items to counterAxisAlignItems
   */
  private mapAlignItemsToCounterAxis(alignItems: FlexboxTypes.AlignItems): "MIN" | "CENTER" | "MAX" | "BASELINE" {
    // Handle baseline alignment
    if (alignItems.includes("baseline")) {
      return "BASELINE";
    }
    
    const mapping: Record<string, "MIN" | "CENTER" | "MAX" | "BASELINE"> = {
      "flex-start": "MIN",
      "start": "MIN",
      "self-start": "MIN",
      "center": "CENTER",
      "flex-end": "MAX", 
      "end": "MAX",
      "self-end": "MAX",
      "stretch": "MIN", // Figma doesn't have stretch for counter axis in frames
      "safe center": "CENTER",
      "unsafe center": "CENTER"
    };
    
    return mapping[alignItems] || "MIN";
  }

  /**
   * Calculate item spacing from gap values
   */
  private calculateItemSpacing(gap: {row: number, column: number}, direction: FlexboxTypes.FlexDirection): number {
    if (direction.startsWith("column")) {
      return gap.row; // Use row gap for vertical layouts
    } else {
      return gap.column; // Use column gap for horizontal layouts  
    }
  }

  /**
   * Apply padding from IRSpacing to Auto Layout config
   */
  private applyPaddingFromBoxModel(padding: any, config: FigmaAutoLayoutConfig): void {
    if (padding) {
      config.paddingTop = padding.top || 0;
      config.paddingRight = padding.right || 0;
      config.paddingBottom = padding.bottom || 0;
      config.paddingLeft = padding.left || 0;
    }
  }

  /**
   * Parse legacy CSS padding string
   */
  private parseLegacyPadding(padding: string, config: FigmaAutoLayoutConfig): void {
    const values = padding.match(/[\d.]+/g);
    if (values) {
      const nums = values.map(v => parseFloat(v));
      config.paddingTop = nums[0] || 0;
      config.paddingRight = nums[1] || nums[0] || 0;
      config.paddingBottom = nums[2] || nums[0] || 0; 
      config.paddingLeft = nums[3] || nums[1] || nums[0] || 0;
    }
  }

  /**
   * Calculate Auto Layout sizing modes based on container properties
   */
  private calculateSizingModes(node: IRNode, config: FigmaAutoLayoutConfig): void {
    const dimensions = node.layout.dimensions;
    
    // Primary axis sizing
    if (config.layoutMode === "HORIZONTAL") {
      config.primaryAxisSizingMode = (dimensions.width === "auto" || dimensions.width.includes("%")) ? "AUTO" : "FIXED";
    } else {
      config.primaryAxisSizingMode = (dimensions.height === "auto" || dimensions.height.includes("%")) ? "AUTO" : "FIXED";
    }
    
    // Counter axis sizing  
    if (config.layoutMode === "HORIZONTAL") {
      config.counterAxisSizingMode = (dimensions.height === "auto" || dimensions.height.includes("%")) ? "AUTO" : "FIXED";
    } else {
      config.counterAxisSizingMode = (dimensions.width === "auto" || dimensions.width.includes("%")) ? "AUTO" : "FIXED";
    }
  }

  /**
   * Map flex item properties to layout grow and constraints
   */
  mapFlexItemProperties(item: DrawableItem): FlexItemConfig {
    const element = item.element;
    const config: FlexItemConfig = {
      layoutGrow: 0,
      constraints: { horizontal: "LEFT", vertical: "TOP" },
      alignSelf: null,
      order: 0,
      fallbackToAbsolute: false,
      debugLog: []
    };

    try {
      // Check IRNode format
      if ('layout' in element && (element as any).layout?.flexItem) {
        return this.mapIRFlexItemProperties(element as unknown as IRNode, config);
      }
      // Fallback to legacy styles
      else if (element.styles) {
        return this.mapLegacyFlexItemProperties(element, config);
      }
    } catch (error) {
      console.warn(`Flex item mapping error for ${element.id}:`, error);
      config.fallbackToAbsolute = true;
      config.debugLog.push(`Item mapping failed: ${error.message}`);
    }

    return config;
  }

  /**
   * Map IRNode flex item properties
   */
  private mapIRFlexItemProperties(node: IRNode, config: FlexItemConfig): FlexItemConfig {
    const flexItem = node.layout.flexItem!;
    
    config.debugLog.push(`Mapping flex item: ${node.id}`);
    
    // Flex grow → layoutGrow
    config.layoutGrow = flexItem.grow;
    config.debugLog.push(`Grow: ${flexItem.grow}`);
    
    // Align self override
    if (flexItem.alignSelf !== "auto") {
      config.alignSelf = this.mapAlignSelfToCounterAxis(flexItem.alignSelf);
      config.debugLog.push(`Align-self: ${flexItem.alignSelf} → ${config.alignSelf}`);
    }
    
    // Order for layout positioning
    config.order = flexItem.order;
    
    // Set constraints based on flex properties
    if (flexItem.grow > 0) {
      // Growing items fill available space
      config.constraints.horizontal = "LEFT_RIGHT";
      config.constraints.vertical = "TOP_BOTTOM";
    }
    
    return config;
  }

  /**
   * Map legacy flex item properties
   */
  private mapLegacyFlexItemProperties(element: CapturedElement, config: FlexItemConfig): FlexItemConfig {
    const styles = element.styles;
    
    // Parse flex grow
    const flexGrow = parseFloat(styles.flexGrow || "0");
    config.layoutGrow = flexGrow;
    
    // Parse align-self
    if (styles.alignSelf && styles.alignSelf !== "auto") {
      config.alignSelf = this.mapAlignSelfToCounterAxis(
        FlexboxUtils.normalizeAlignSelf(styles.alignSelf)
      );
    }
    
    // Parse order
    config.order = parseFloat(styles.order || "0");
    
    return config;
  }

  /**
   * Map align-self to counter axis alignment
   */
  private mapAlignSelfToCounterAxis(alignSelf: FlexboxTypes.AlignSelf): "MIN" | "CENTER" | "MAX" | "BASELINE" | null {
    if (alignSelf === "auto") return null;
    
    if (alignSelf.includes("baseline")) {
      return "BASELINE";
    }
    
    const mapping: Record<string, "MIN" | "CENTER" | "MAX" | "BASELINE"> = {
      "flex-start": "MIN",
      "start": "MIN",
      "self-start": "MIN",
      "center": "CENTER",
      "flex-end": "MAX",
      "end": "MAX", 
      "self-end": "MAX",
      "stretch": "MIN" // Approximate stretch with MIN
    };
    
    return mapping[alignSelf] || null;
  }

  /**
   * Check if flexbox layout can be represented in Figma Auto Layout
   * Returns reasons for fallback if needed
   */
  validateFlexboxSupport(item: DrawableItem): FlexboxSupportResult {
    const element = item.element;
    const issues: string[] = [];
    let canUseAutoLayout = true;

    // Check for unsupported features
    if ('layout' in element && (element as any).layout?.flex) {
      const flex = (element as any).layout.flex;
      
      // Flex wrap is not supported
      if (flex.wrap !== "nowrap") {
        issues.push(`flex-wrap: ${flex.wrap} not supported`);
        canUseAutoLayout = false;
      }
      
      // Complex alignment values
      if (flex.justifyContent === "space-around" || flex.justifyContent === "space-evenly") {
        issues.push(`justify-content: ${flex.justifyContent} approximated as center`);
      }
      
      // Baseline alignment limitations
      if (flex.alignItems.includes("baseline") && flex.direction.startsWith("column")) {
        issues.push(`baseline alignment in column direction may not render accurately`);
      }
      
      // Reverse directions
      if (flex.direction.endsWith("-reverse")) {
        issues.push(`${flex.direction} simulated with layout order`);
      }
    }
    
    // Check legacy styles
    else if (element.styles) {
      if (element.styles.flexWrap && element.styles.flexWrap !== "nowrap") {
        issues.push(`flex-wrap: ${element.styles.flexWrap} not supported`);
        canUseAutoLayout = false;
      }
    }

    return {
      canUseAutoLayout,
      issues,
      recommendedFallback: canUseAutoLayout ? null : "absolute-positioning"
    };
  }

  // Helper methods
  private hasComplexPath(element: CapturedElement): boolean {
    // Check for complex CSS properties that create non-rectangular paths
    return !!(
      element.styles.clipPath ||
      element.svg?.paths.length ||
      this.hasComplexBorder(element)
    );
  }

  private hasComplexBorder(element: CapturedElement): boolean {
    const border = element.styles.border;
    if (!border) return false;
    
    // Multi-color borders, gradient borders, or image borders
    return (
      border.includes('gradient') ||
      border.includes('url(') ||
      border.split(' ').length > 3
    );
  }

  private requiresBooleanOp(clipPath: string): boolean {
    // Complex clip-path functions that need boolean operations
    return clipPath.includes('url(') || 
           clipPath.includes('intersect') ||
           clipPath.includes('subtract') ||
           clipPath.includes('union');
  }

  private parseCSSValue(value: string): { value: number; unit: string } {
    const match = value.match(/^([\d.]+)(.*)$/);
    return {
      value: match ? parseFloat(match[1]) : 0,
      unit: match ? match[2] : ''
    };
  }

  private isPolygonPath(d: string): boolean {
    // SVG path that represents a polygon
    return d.includes('L') && !d.includes('C') && !d.includes('Q');
  }

  private isStarPath(d: string): boolean {
    // Detect star-like patterns in SVG paths
    const commands = d.match(/[MLHVCSQTAZ]/gi) || [];
    const lines = commands.filter(cmd => cmd.toUpperCase() === 'L').length;
    return lines >= 8 && lines % 2 === 0; // Star shapes typically have even number of points
  }

  private hasComponentLikeStructure(element: CapturedElement): boolean {
    // Check for common component patterns
    return !!(
      element.componentHints?.name ||
      element.componentHints?.variant ||
      this.looksLikeButton(element) ||
      this.looksLikeCard(element) ||
      this.looksLikeInput(element)
    );
  }

  private looksLikeButton(element: CapturedElement): boolean {
    return element.tagName.toLowerCase() === 'button' ||
           element.styles.cursor === 'pointer';
  }

  private looksLikeCard(element: CapturedElement): boolean {
    return !!(
      element.styles.boxShadow ||
      element.styles.border ||
      element.styles.borderRadius
    );
  }

  private looksLikeInput(element: CapturedElement): boolean {
    const inputTags = ['input', 'textarea', 'select'];
    return inputTags.includes(element.tagName.toLowerCase());
  }

  private isPageRegion(element: CapturedElement): boolean {
    const { width, height } = element.rect;
    
    // Large elements that span significant portions of the viewport
    return width > 800 || height > 400;
  }

  private isSimpleBorderRadius(borderRadius: string): boolean {
    if (!borderRadius || borderRadius === '0' || borderRadius === 'none') {
      return true;
    }
    
    // Simple uniform border radius
    const parts = borderRadius.split(' ');
    return parts.length <= 2;
  }

  private hasLayoutSignificance(element: CapturedElement): boolean {
    return !!(
      element.styles.display === 'flex' ||
      element.styles.display === 'grid' ||
      element.styles.position === 'relative' ||
      element.styles.position === 'absolute' ||
      element.styles.overflow === 'hidden' ||
      element.styles.overflow === 'scroll'
    );
  }

  private isLayoutContainer(element: CapturedElement): boolean {
    // Heuristics for detecting layout containers
    return !!(
      element.styles.display === 'flex' ||
      element.styles.display === 'grid' ||
      element.styles.padding ||
      element.styles.gap
    );
  }
}

export type FigmaNodeType = 
  | 'PAGE'
  | 'SECTION' 
  | 'FRAME'
  | 'GROUP'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'POLYGON'
  | 'STAR'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'TEXT'
  | 'COMPONENT'
  | 'INSTANCE'
  | 'COMPONENT_SET'
  | 'SLICE';

// ==================== FLEXBOX MAPPING TYPE DEFINITIONS ====================

/**
 * Comprehensive Auto Layout configuration for Figma frames
 * Maps all CSS flexbox properties to their Figma equivalents
 */
export interface FigmaAutoLayoutConfig {
  layoutMode: "HORIZONTAL" | "VERTICAL";
  primaryAxisSizingMode: "FIXED" | "AUTO";
  counterAxisSizingMode: "FIXED" | "AUTO";
  primaryAxisAlignItems: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems: "MIN" | "CENTER" | "MAX" | "BASELINE";
  itemSpacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  layoutGrow: number;
  constraints: ConstraintConfig | null;
  fallbackToAbsolute: boolean;
  debugLog: string[];
}

/**
 * Flex item configuration for children in Auto Layout containers
 */
export interface FlexItemConfig {
  layoutGrow: number;
  constraints: ConstraintConfig;
  alignSelf: "MIN" | "CENTER" | "MAX" | "BASELINE" | null;
  order: number;
  fallbackToAbsolute: boolean;
  debugLog: string[];
}

/**
 * Constraint configuration for Figma nodes
 */
export interface ConstraintConfig {
  horizontal: "LEFT" | "RIGHT" | "CENTER" | "LEFT_RIGHT" | "SCALE";
  vertical: "TOP" | "BOTTOM" | "CENTER" | "TOP_BOTTOM" | "SCALE";
}

/**
 * Result of validating flexbox support in Figma Auto Layout
 */
export interface FlexboxSupportResult {
  canUseAutoLayout: boolean;
  issues: string[];
  recommendedFallback: "absolute-positioning" | "manual-layout" | null;
}

/**
 * Layout grid configuration for responsive design
 */
export interface LayoutGrid {
  pattern: "COLUMNS" | "ROWS" | "GRID";
  alignment: "MIN" | "MAX" | "CENTER";
  gutterSize: number;
  count: number;
  sectionSize: number;
  visible: boolean;
  color: { r: number; g: number; b: number; a: number };
}

/**
 * Constraints configuration for responsive layouts
 */
export interface Constraints {
  horizontal: "LEFT" | "RIGHT" | "CENTER" | "LEFT_RIGHT" | "SCALE";
  vertical: "TOP" | "BOTTOM" | "CENTER" | "TOP_BOTTOM" | "SCALE";
}