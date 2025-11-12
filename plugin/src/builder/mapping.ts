/**
 * NODE MAPPING SYSTEM
 * 
 * Determines the optimal Figma node type for each captured element
 * Follows the specification for 100% pixel-perfect recreation
 */

import { CapturedElement } from './index';

export class NodeMapper {
  
  /**
   * Determine the best Figma node type for an element
   */
  getNodeType(element: CapturedElement): FigmaNodeType {
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