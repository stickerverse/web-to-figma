/**
 * CONSTRAINTS PROCESSING SYSTEM WITH FLEXBOX SUPPORT
 * 
 * Handles responsive constraints and layout grids
 * Sets constraints to mirror DOM anchoring and creates layout grids for grid systems
 * Includes comprehensive flexbox → Auto Layout constraint mapping
 */

import { DrawableItem } from './index';
import { IRNode, IRLayout, isFlexContainer, isFlexItem } from '../../../../ir';
import { FigmaAutoLayoutConfig, FlexItemConfig, ConstraintConfig, LayoutGrid, Constraints } from './mapping';

export class ConstraintsProcessor {

  /**
   * Compute constraints for a drawable item with comprehensive flexbox support
   */
  computeConstraints(item: DrawableItem): Constraints | null {
    const element = item.element;
    
    // Check if element is in a flexbox context
    const flexConstraints = this.computeFlexboxConstraints(item);
    if (flexConstraints) {
      return flexConstraints;
    }
    
    // Fallback to standard constraint computation
    const styles = element.styles;
    
    // Determine horizontal constraints
    const horizontal = this.computeHorizontalConstraint(styles, element);
    
    // Determine vertical constraints
    const vertical = this.computeVerticalConstraint(styles, element);
    
    // Only return constraints if they differ from defaults
    if (horizontal !== 'LEFT' || vertical !== 'TOP') {
      return { horizontal, vertical };
    }
    
    return null;
  }

  /**
   * COMPREHENSIVE FLEXBOX CONSTRAINT HANDLING
   * Computes constraints for elements within flexbox containers
   */
  
  /**
   * Compute constraints for flexbox items and containers
   */
  computeFlexboxConstraints(item: DrawableItem): Constraints | null {
    const element = item.element;
    
    // Check if element is a flex item (child of flex container)
    if (this.isFlexboxChild(element)) {
      return this.computeFlexItemConstraints(item);
    }
    
    // Check if element is a flex container
    if (this.isFlexboxContainer(element)) {
      return this.computeFlexContainerConstraints(item);
    }
    
    return null;
  }

  /**
   * Compute constraints for flex items within Auto Layout frames
   */
  computeFlexItemConstraints(item: DrawableItem): Constraints | null {
    const element = item.element;
    let horizontal: Constraints['horizontal'] = 'LEFT';
    let vertical: Constraints['vertical'] = 'TOP';
    
    try {
      // Get flex item properties from IRNode
      if ('layout' in element && (element as any).layout?.flexItem) {
        const flexItem = (element as any).layout.flexItem;
        const childAlignment = (element as any).layout.childAlignment as IRLayout['childAlignment'] | undefined;
        
        horizontal = this.mapFlexItemHorizontalConstraints(flexItem, childAlignment);
        vertical = this.mapFlexItemVerticalConstraints(flexItem, childAlignment);
        
        console.log(`Flex item constraints for ${element.id}: h=${horizontal}, v=${vertical}`);
      }
      // Fallback to legacy styles
      else if (element.styles) {
        const constraints = this.mapLegacyFlexItemConstraints(element);
        if (constraints) {
          horizontal = constraints.horizontal;
          vertical = constraints.vertical;
        }
      }
    } catch (error) {
      console.warn(`Error computing flex item constraints for ${element.id}:`, error);
    }
    
    // Return constraints if they differ from defaults
    if (horizontal !== 'LEFT' || vertical !== 'TOP') {
      return { horizontal, vertical };
    }
    
    return null;
  }

  /**
   * Compute constraints for flex containers (Auto Layout frames)
   */
  computeFlexContainerConstraints(item: DrawableItem): Constraints | null {
    const element = item.element;
    
    // Flex containers typically use standard positioning constraints
    // unless they're also flex items within another flex container
    if (this.isFlexboxChild(element)) {
      return this.computeFlexItemConstraints(item);
    }
    
    // Standard container constraints
    return this.computeStandardConstraints(item);
  }

  /**
   * Map flex item properties to horizontal constraints
   */
  private mapFlexItemHorizontalConstraints(
    flexItem: any,
    childAlignment?: IRLayout['childAlignment']
  ): Constraints['horizontal'] {
    const mainIsHorizontal = childAlignment?.mainAxisOrientation === 'horizontal';
    const crossIsHorizontal = childAlignment?.crossAxisOrientation === 'horizontal';
    
    if (mainIsHorizontal) {
      if (flexItem.grow > 0) {
        return 'LEFT_RIGHT';
      }
      if (flexItem.shrink > 1) {
        return 'SCALE';
      }
      const mapped = this.mapAxisAlignmentToHorizontal(childAlignment!.mainAxis, childAlignment?.mainAxisIsReversed);
      if (mapped) {
        return mapped;
      }
    }
    
    if (crossIsHorizontal && childAlignment) {
      const mapped = this.mapAxisAlignmentToHorizontal(childAlignment.crossAxis, childAlignment.crossAxisIsReversed);
      if (mapped) {
        return mapped;
      }
    }
    
    if (!childAlignment && flexItem.alignSelf === 'stretch') {
      return 'LEFT_RIGHT';
    }
    
    return 'LEFT';
  }

  /**
   * Map flex item properties to vertical constraints
   */
  private mapFlexItemVerticalConstraints(
    flexItem: any,
    childAlignment?: IRLayout['childAlignment']
  ): Constraints['vertical'] {
    const mainIsVertical = childAlignment?.mainAxisOrientation === 'vertical';
    const crossIsVertical = childAlignment?.crossAxisOrientation === 'vertical';
    
    if (mainIsVertical) {
      if (flexItem.grow > 0) {
        return 'TOP_BOTTOM';
      }
      if (flexItem.shrink > 1) {
        return 'SCALE';
      }
      const mapped = this.mapAxisAlignmentToVertical(childAlignment!.mainAxis, childAlignment?.mainAxisIsReversed);
      if (mapped) {
        return mapped;
      }
    }
    
    if (crossIsVertical && childAlignment) {
      const mapped = this.mapAxisAlignmentToVertical(childAlignment.crossAxis, childAlignment.crossAxisIsReversed);
      if (mapped) {
        return mapped;
      }
    }
    
    if (!childAlignment && (flexItem.alignSelf === 'stretch' || flexItem.alignSelf === 'baseline')) {
      return flexItem.alignSelf === 'stretch' ? 'TOP_BOTTOM' : 'TOP';
    }
    
    return 'TOP';
  }

  /**
   * Map legacy flex item styles to constraints
   */
  private mapLegacyFlexItemConstraints(element: any): Constraints | null {
    const styles = element.styles;
    
    if (!styles) return null;
    
    let horizontal: Constraints['horizontal'] = 'LEFT';
    let vertical: Constraints['vertical'] = 'TOP';
    
    // Check flex grow
    const flexGrow = parseFloat(styles.flexGrow || '0');
    if (flexGrow > 0) {
      horizontal = 'LEFT_RIGHT';
      vertical = 'TOP_BOTTOM';
    }
    
    // Check align-self
    const alignSelf = styles.alignSelf;
    if (alignSelf) {
      switch (alignSelf) {
        case 'flex-end':
        case 'end':
          vertical = 'BOTTOM';
          break;
        case 'center':
          vertical = 'CENTER';
          break;
        case 'stretch':
          vertical = 'TOP_BOTTOM';
          break;
      }
    }
    
    return { horizontal, vertical };
  }

  /**
   * Check if element is a flexbox container
   */
  private isFlexboxContainer(element: any): boolean {
    // Check IRNode format
    if ('layout' in element) {
      return isFlexContainer(element as IRNode);
    }
    
    // Check legacy styles
    if (element.styles) {
      return element.styles.display === 'flex' || element.styles.display === 'inline-flex';
    }
    
    return false;
  }

  /**
   * Check if element is a child of a flexbox container
   */
  private isFlexboxChild(element: any): boolean {
    // Check IRNode format
    if ('layout' in element) {
      return isFlexItem(element as IRNode);
    }
    
    // For legacy format, we'd need parent context to determine this
    // This is a simplified check
    if (element.styles) {
      return !!(
        element.styles.flexGrow ||
        element.styles.flexShrink ||
        element.styles.flexBasis ||
        element.styles.alignSelf ||
        element.styles.order ||
        element.styles.flex
      );
    }
    
    return false;
  }

  /**
   * Compute standard (non-flexbox) constraints
   */
  private computeStandardConstraints(item: DrawableItem): Constraints | null {
    const element = item.element;
    const styles = element.styles;
    
    // Determine horizontal constraints
    const horizontal = this.computeHorizontalConstraint(styles, element);
    
    // Determine vertical constraints
    const vertical = this.computeVerticalConstraint(styles, element);
    
    // Only return constraints if they differ from defaults
    if (horizontal !== 'LEFT' || vertical !== 'TOP') {
      return { horizontal, vertical };
    }
    
    return null;
  }

  /**
   * Create layout grids for grid/flex containers with enhanced flexbox support
   */
  createLayoutGrids(item: DrawableItem): LayoutGrid[] | null {
    const element = item.element;
    const grids: LayoutGrid[] = [];
    
    try {
      // Check IRNode format for comprehensive flex support
      if ('layout' in element && (element as any).layout?.flex) {
        const flexGrid = this.createFlexLayoutGridFromIR(element as unknown as IRNode, item);
        if (flexGrid) grids.push(flexGrid);
      }
      // CSS Grid layout grids
      else if (element.styles?.display === 'grid') {
        const gridGrids = this.createCSSGridLayouts(element.styles, item);
        grids.push(...gridGrids);
      }
      // Legacy flexbox layout grids
      else if (element.styles?.display === 'flex') {
        const flexGrid = this.createLegacyFlexLayoutGrid(element.styles, item);
        if (flexGrid) grids.push(flexGrid);
      }
      
      // Responsive breakpoint grids
      if (this.hasResponsiveBreakpoints(element)) {
        const responsiveGrid = this.createResponsiveGrid(element);
        if (responsiveGrid) grids.push(responsiveGrid);
      }
    } catch (error) {
      console.warn(`Error creating layout grids for ${element.id}:`, error);
    }
    
    return grids.length > 0 ? grids : null;
  }

  /**
   * Create layout grid from IRNode flexbox properties (comprehensive)
   */
  private createFlexLayoutGridFromIR(node: IRNode, item: DrawableItem): LayoutGrid | null {
    const flex = node.layout.flex!;
    const rect = item.element.rect;
    
    const isVertical = flex.direction.startsWith('column');
    const gap = isVertical ? flex.gap.row : flex.gap.column;
    
    // Calculate grid based on actual flex properties
    return {
      pattern: isVertical ? "ROWS" : "COLUMNS",
      alignment: this.mapFlexAlignmentToGridAlignment(flex.justifyContent),
      gutterSize: gap,
      count: this.estimateFlexItemCount(node, item),
      sectionSize: isVertical 
        ? rect.height / this.estimateFlexItemCount(node, item)
        : rect.width / this.estimateFlexItemCount(node, item),
      visible: true,
      color: { r: 0.2, g: 0.8, b: 0.2, a: 0.1 } // Green for flex grids
    };
  }

  /**
   * Create CSS Grid layout grids
   */
  private createCSSGridLayouts(styles: any, item: DrawableItem): LayoutGrid[] {
    const grids: LayoutGrid[] = [];
    
    if (styles.gridTemplateColumns) {
      const columnGrid = this.createColumnGridFromTemplate(styles.gridTemplateColumns, item);
      if (columnGrid) grids.push(columnGrid);
    }
    
    if (styles.gridTemplateRows) {
      const rowGrid = this.createRowGridFromTemplate(styles.gridTemplateRows, item);
      if (rowGrid) grids.push(rowGrid);
    }
    
    return grids;
  }

  /**
   * Map flex alignment to grid alignment
   */
  private mapFlexAlignmentToGridAlignment(justifyContent: string): LayoutGrid['alignment'] {
    switch (justifyContent) {
      case 'flex-start':
      case 'start':
        return 'MIN';
      case 'flex-end':
      case 'end':
        return 'MAX';
      case 'center':
      case 'space-around':
      case 'space-evenly':
        return 'CENTER';
      case 'space-between':
      default:
        return 'MIN';
    }
  }

  /**
   * Estimate the number of flex items for grid calculation
   */
  private estimateFlexItemCount(node: IRNode, item: DrawableItem): number {
    // Try to get actual child count if available
    if (node.children && node.children.length > 0) {
      return Math.max(1, node.children.length);
    }
    
    // Fallback to a reasonable default
    return node.layout.flex!.direction.startsWith('column') ? 8 : 12;
  }

  /**
   * Compute horizontal constraint based on CSS positioning
   */
  private computeHorizontalConstraint(styles: any, element: any): 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE' {
    // Check CSS positioning properties
    const position = styles.position;
    const left = styles.left;
    const right = styles.right;
    const width = styles.width;
    
    // Fixed positioning
    if (position === 'fixed') {
      if (left !== undefined && right !== undefined) {
        return 'LEFT_RIGHT'; // Stretch between both sides
      }
      if (right !== undefined) {
        return 'RIGHT'; // Anchor to right
      }
      return 'LEFT'; // Default to left anchor
    }
    
    // Absolute positioning
    if (position === 'absolute') {
      if (left !== undefined && right !== undefined) {
        return 'LEFT_RIGHT';
      }
      if (right !== undefined) {
        return 'RIGHT';
      }
      if (this.isCentered(styles, 'horizontal')) {
        return 'CENTER';
      }
      return 'LEFT';
    }
    
    // Flexbox child constraints
    if (this.isFlexChild(element)) {
      const flexGrow = styles.flexGrow || '0';
      const flexShrink = styles.flexShrink || '1';
      
      if (flexGrow !== '0') {
        return 'SCALE'; // Element grows/shrinks
      }
    }
    
    // Grid child constraints
    if (this.isGridChild(element)) {
      return this.computeGridChildHorizontalConstraint(styles);
    }
    
    // Check for percentage width (scale behavior)
    if (width && width.includes('%')) {
      return 'SCALE';
    }
    
    // Check for centering
    if (this.isCentered(styles, 'horizontal')) {
      return 'CENTER';
    }

    if (position !== 'absolute' && position !== 'fixed') {
      const alignmentConstraint = this.resolveHorizontalAlignmentConstraint(element);
      if (alignmentConstraint) {
        return alignmentConstraint;
      }
    }
    
    return 'LEFT'; // Default
  }

  /**
   * Compute vertical constraint based on CSS positioning
   */
  private computeVerticalConstraint(styles: any, element: any): 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE' {
    const position = styles.position;
    const top = styles.top;
    const bottom = styles.bottom;
    const height = styles.height;
    
    // Fixed positioning
    if (position === 'fixed') {
      if (top !== undefined && bottom !== undefined) {
        return 'TOP_BOTTOM';
      }
      if (bottom !== undefined) {
        return 'BOTTOM';
      }
      return 'TOP';
    }
    
    // Absolute positioning
    if (position === 'absolute') {
      if (top !== undefined && bottom !== undefined) {
        return 'TOP_BOTTOM';
      }
      if (bottom !== undefined) {
        return 'BOTTOM';
      }
      if (this.isCentered(styles, 'vertical')) {
        return 'CENTER';
      }
      return 'TOP';
    }
    
    // Flexbox child constraints
    if (this.isFlexChild(element)) {
      const alignSelf = styles.alignSelf;
      if (alignSelf === 'stretch') {
        return 'TOP_BOTTOM';
      }
      if (alignSelf === 'flex-end' || alignSelf === 'end') {
        return 'BOTTOM';
      }
      if (alignSelf === 'center') {
        return 'CENTER';
      }
    }
    
    // Grid child constraints
    if (this.isGridChild(element)) {
      return this.computeGridChildVerticalConstraint(styles);
    }
    
    // Check for percentage height
    if (height && height.includes('%')) {
      return 'SCALE';
    }
    
    // Check for centering
    if (this.isCentered(styles, 'vertical')) {
      return 'CENTER';
    }

    if (position !== 'absolute' && position !== 'fixed') {
      const alignmentConstraint = this.resolveVerticalAlignmentConstraint(element);
      if (alignmentConstraint) {
        return alignmentConstraint;
      }
    }
    
    return 'TOP'; // Default
  }

  /**
   * Create column grid from CSS grid-template-columns
   */
  private createColumnGridFromTemplate(template: string, item: DrawableItem): LayoutGrid | null {
    const columns = this.parseGridTemplate(template);
    if (columns.length === 0) return null;
    
    // Calculate column positions
    const totalWidth = item.element.rect.width;
    const gutterSize = this.parseGutter(item.element.styles.columnGap || item.element.styles.gap);
    
    return {
      pattern: 'COLUMNS',
      alignment: 'MIN',
      gutterSize,
      count: columns.length,
      sectionSize: totalWidth / columns.length,
      visible: true,
      color: { r: 0.96, g: 0.66, b: 0.82, a: 0.1 }
    };
  }

  /**
   * Create row grid from CSS grid-template-rows
   */
  private createRowGridFromTemplate(template: string, item: DrawableItem): LayoutGrid | null {
    const rows = this.parseGridTemplate(template);
    if (rows.length === 0) return null;
    
    const totalHeight = item.element.rect.height;
    const gutterSize = this.parseGutter(item.element.styles.rowGap || item.element.styles.gap);
    
    return {
      pattern: 'ROWS',
      alignment: 'MIN',
      gutterSize,
      count: rows.length,
      sectionSize: totalHeight / rows.length,
      visible: true,
      color: { r: 0.96, g: 0.66, b: 0.82, a: 0.1 }
    };
  }

  /**
   * Create layout grid for flexbox containers (legacy)
   */
  private createLegacyFlexLayoutGrid(styles: any, item: DrawableItem): LayoutGrid | null {
    const direction = styles.flexDirection || 'row';
    const gap = this.parseGutter(styles.gap);
    
    if (direction === 'row' || direction === 'row-reverse') {
      // Create column-like grid for horizontal flex
      return {
        pattern: 'COLUMNS',
        alignment: 'CENTER',
        gutterSize: gap,
        count: 12, // Standard 12-column grid
        sectionSize: item.element.rect.width / 12,
        visible: false, // Usually hidden for flex
        color: { r: 0.66, g: 0.82, b: 0.96, a: 0.1 }
      };
    } else {
      // Create row-like grid for vertical flex
      return {
        pattern: 'ROWS',
        alignment: 'CENTER',
        gutterSize: gap,
        count: 8, // Common row count
        sectionSize: item.element.rect.height / 8,
        visible: false,
        color: { r: 0.66, g: 0.82, b: 0.96, a: 0.1 }
      };
    }
  }

  /**
   * Create responsive grid for breakpoint systems
   */
  private createResponsiveGrid(element: any): LayoutGrid | null {
    // Common responsive breakpoints: 12-column grid
    return {
      pattern: 'COLUMNS',
      alignment: 'CENTER',
      gutterSize: 20, // Standard gutter
      count: 12,
      sectionSize: 80, // Approximate column width
      visible: false,
      color: { r: 0.82, g: 0.96, b: 0.66, a: 0.1 }
    };
  }

  private resolveHorizontalAlignmentConstraint(element: any): Constraints['horizontal'] | null {
    const alignment = this.getChildAlignment(element);
    if (!alignment) return null;
    
    if (alignment.mainAxisOrientation === 'horizontal') {
      return this.mapAxisAlignmentToHorizontal(alignment.mainAxis, alignment.mainAxisIsReversed);
    }
    
    if (alignment.crossAxisOrientation === 'horizontal') {
      return this.mapAxisAlignmentToHorizontal(alignment.crossAxis, alignment.crossAxisIsReversed);
    }
    
    return null;
  }

  private resolveVerticalAlignmentConstraint(element: any): Constraints['vertical'] | null {
    const alignment = this.getChildAlignment(element);
    if (!alignment) return null;
    
    if (alignment.mainAxisOrientation === 'vertical') {
      return this.mapAxisAlignmentToVertical(alignment.mainAxis, alignment.mainAxisIsReversed);
    }
    
    if (alignment.crossAxisOrientation === 'vertical') {
      return this.mapAxisAlignmentToVertical(alignment.crossAxis, alignment.crossAxisIsReversed);
    }
    
    return null;
  }

  private mapAxisAlignmentToHorizontal(value?: string, isReversed?: boolean): Constraints['horizontal'] | null {
    if (!value) return null;
    
    switch (value) {
      case 'start':
        return isReversed ? 'RIGHT' : 'LEFT';
      case 'end':
        return isReversed ? 'LEFT' : 'RIGHT';
      case 'center':
        return 'CENTER';
      case 'stretch':
        return 'LEFT_RIGHT';
      case 'space-between':
      case 'space-around':
      case 'space-evenly':
        return 'SCALE';
      case 'baseline':
        return 'LEFT';
      default:
        return null;
    }
  }

  private mapAxisAlignmentToVertical(value?: string, isReversed?: boolean): Constraints['vertical'] | null {
    if (!value) return null;
    
    switch (value) {
      case 'start':
        return isReversed ? 'BOTTOM' : 'TOP';
      case 'end':
        return isReversed ? 'TOP' : 'BOTTOM';
      case 'center':
        return 'CENTER';
      case 'stretch':
        return 'TOP_BOTTOM';
      case 'space-between':
      case 'space-around':
      case 'space-evenly':
        return 'SCALE';
      case 'baseline':
        return 'TOP';
      default:
        return null;
    }
  }

  private getChildAlignment(element: any): IRLayout['childAlignment'] | null {
    if (element && typeof element === 'object' && 'layout' in element) {
      const layout = (element as IRNode).layout;
      return layout?.childAlignment || null;
    }
    return null;
  }

  // Helper methods
  private isCentered(styles: any, direction: 'horizontal' | 'vertical'): boolean {
    if (direction === 'horizontal') {
      return !!(
        styles.marginLeft === 'auto' && styles.marginRight === 'auto' ||
        styles.left === '50%' && styles.transform?.includes('translateX(-50%)')
      );
    } else {
      return !!(
        styles.marginTop === 'auto' && styles.marginBottom === 'auto' ||
        styles.top === '50%' && styles.transform?.includes('translateY(-50%)')
      );
    }
  }

  private isFlexChild(element: any): boolean {
    // Would need parent context to determine this properly
    return false; // Simplified for now
  }

  private isGridChild(element: any): boolean {
    // Would need parent context to determine this properly
    return false; // Simplified for now
  }

  private computeGridChildHorizontalConstraint(styles: any): 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE' {
    const gridColumnStart = styles.gridColumnStart;
    const gridColumnEnd = styles.gridColumnEnd;
    
    if (gridColumnStart && gridColumnEnd) {
      const start = parseInt(gridColumnStart);
      const end = parseInt(gridColumnEnd);
      
      if (end - start > 1) {
        return 'LEFT_RIGHT'; // Spans multiple columns
      }
    }
    
    const justifySelf = styles.justifySelf;
    if (justifySelf === 'end') return 'RIGHT';
    if (justifySelf === 'center') return 'CENTER';
    if (justifySelf === 'stretch') return 'LEFT_RIGHT';
    
    return 'LEFT';
  }

  private computeGridChildVerticalConstraint(styles: any): 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE' {
    const gridRowStart = styles.gridRowStart;
    const gridRowEnd = styles.gridRowEnd;
    
    if (gridRowStart && gridRowEnd) {
      const start = parseInt(gridRowStart);
      const end = parseInt(gridRowEnd);
      
      if (end - start > 1) {
        return 'TOP_BOTTOM'; // Spans multiple rows
      }
    }
    
    const alignSelf = styles.alignSelf;
    if (alignSelf === 'end') return 'BOTTOM';
    if (alignSelf === 'center') return 'CENTER';
    if (alignSelf === 'stretch') return 'TOP_BOTTOM';
    
    return 'TOP';
  }

  private parseGridTemplate(template: string): string[] {
    // Parse CSS grid template (simplified)
    return template
      .split(' ')
      .filter(part => part.trim() && !part.includes('['));
  }

  private parseGutter(gap?: string): number {
    if (!gap) return 0;
    
    const match = gap.match(/^([\d.]+)(.*)?$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'px';
    
    // Convert to pixels (simplified)
    switch (unit) {
      case 'em': return value * 16;
      case 'rem': return value * 16;
      case '%': return value; // Context-dependent
      default: return value; // Assume pixels
    }
  }

  private hasResponsiveBreakpoints(element: any): boolean {
    // Check if element has responsive design indicators
    const classes = element.className || '';
    
    // Common responsive framework patterns
    return !!(
      classes.includes('container') ||
      classes.includes('col-') ||
      classes.includes('grid') ||
      classes.includes('row')
    );
  }
}
