/**
 * CONSTRAINTS PROCESSING SYSTEM
 * 
 * Handles responsive constraints and layout grids
 * Sets constraints to mirror DOM anchoring and creates layout grids for grid systems
 */

import { DrawableItem } from './index';

export class ConstraintsProcessor {

  /**
   * Compute constraints for a drawable item
   */
  computeConstraints(item: DrawableItem): Constraints | null {
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
   * Create layout grids for grid/flex containers
   */
  createLayoutGrids(item: DrawableItem): LayoutGrid[] | null {
    const element = item.element;
    const styles = element.styles;
    const grids: LayoutGrid[] = [];
    
    // CSS Grid layout grids
    if (styles.display === 'grid') {
      const gridTemplateColumns = styles.gridTemplateColumns;
      const gridTemplateRows = styles.gridTemplateRows;
      
      if (gridTemplateColumns) {
        const columnGrid = this.createColumnGridFromTemplate(gridTemplateColumns, item);
        if (columnGrid) grids.push(columnGrid);
      }
      
      if (gridTemplateRows) {
        const rowGrid = this.createRowGridFromTemplate(gridTemplateRows, item);
        if (rowGrid) grids.push(rowGrid);
      }
    }
    
    // Flexbox layout grids
    else if (styles.display === 'flex') {
      const flexGrid = this.createFlexLayoutGrid(styles, item);
      if (flexGrid) grids.push(flexGrid);
    }
    
    // Responsive breakpoint grids
    if (this.hasResponsiveBreakpoints(element)) {
      const responsiveGrid = this.createResponsiveGrid(element);
      if (responsiveGrid) grids.push(responsiveGrid);
    }
    
    return grids.length > 0 ? grids : null;
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
   * Create layout grid for flexbox containers
   */
  private createFlexLayoutGrid(styles: any, item: DrawableItem): LayoutGrid | null {
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