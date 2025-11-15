/**
 * CSS Style Normalizer
 * 
 * Converts CSS shorthand properties to longhand for explicit, normalized IR values.
 * Ensures no ambiguous shorthands remain in the final IR representation.
 */

// ==================== CORE NORMALIZER ====================

/**
 * Main CSS Style Normalizer class
 * Converts all CSS shorthands to explicit longhand properties
 */
export class CSSStyleNormalizer {
  private static readonly SHORTHAND_PROPERTIES = new Set([
    // Box model shorthands
    'margin', 'padding', 'border', 'border-width', 'border-style', 'border-color',
    'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left',
    
    // Typography shorthands
    'font', 'font-synthesis', 'text-decoration', 'text-emphasis',
    
    // Background shorthands
    'background', 'border-image',
    
    // Layout shorthands
    'flex', 'flex-flow', 'gap', 'place-content', 'place-items', 'place-self',
    'grid', 'grid-area', 'grid-column', 'grid-row', 'grid-template',
    
    // Animation/transition shorthands
    'animation', 'transition',
    
    // List shorthands
    'list-style',
    
    // Outline shorthands
    'outline',
    
    // Column shorthands
    'columns', 'column-rule',
    
    // Miscellaneous shorthands
    'inset', 'overflow', 'scroll-margin', 'scroll-padding',
  ]);

  /**
   * Normalize a styles object by expanding all shorthand properties
   */
  static normalize(styles: Record<string, string>): NormalizedStyles {
    const normalizer = new CSSStyleNormalizer();
    return normalizer.normalizeStyles(styles);
  }

  /**
   * Check if a property is a CSS shorthand
   */
  static isShorthand(property: string): boolean {
    return this.SHORTHAND_PROPERTIES.has(property);
  }

  private normalizeStyles(styles: Record<string, string>): NormalizedStyles {
    const normalized: Record<string, string> = {};
    const expansions: Record<string, string[]> = {};
    const warnings: string[] = [];

    // Process each style property
    for (const [property, value] of Object.entries(styles)) {
      if (!value || value === '' || value === 'initial' || value === 'unset' || value === 'revert') {
        // Skip empty, initial, or reset values
        continue;
      }

      try {
        const expandedProps = this.expandProperty(property, value);
        
        if (expandedProps.length > 1) {
          // Property was expanded from shorthand
          expansions[property] = expandedProps.map(p => p.property);
        }

        // Add all expanded properties to normalized styles
        for (const prop of expandedProps) {
          if (prop.value !== null && prop.value !== '') {
            normalized[prop.property] = prop.value;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Failed to normalize ${property}: ${value} - ${message}`);
        // Fall back to original property if normalization fails
        normalized[property] = value;
      }
    }

    return {
      properties: normalized,
      expansions,
      warnings,
      summary: {
        originalCount: Object.keys(styles).length,
        normalizedCount: Object.keys(normalized).length,
        shorthandsExpanded: Object.keys(expansions).length,
      }
    };
  }

  private expandProperty(property: string, value: string): Array<{ property: string; value: string }> {
    const normalizedProperty = property.toLowerCase().trim();
    const normalizedValue = value.trim();

    switch (normalizedProperty) {
      // Box model shorthands
      case 'margin':
        return this.expandBoxSpacing('margin', normalizedValue);
      case 'padding':
        return this.expandBoxSpacing('padding', normalizedValue);
      case 'border':
        return this.expandBorder(normalizedValue);
      case 'border-width':
        return this.expandBoxSpacing('border', normalizedValue, 'width');
      case 'border-style':
        return this.expandBoxSpacing('border', normalizedValue, 'style');
      case 'border-color':
        return this.expandBoxSpacing('border', normalizedValue, 'color');
      case 'border-radius':
        return this.expandBorderRadius(normalizedValue);
      case 'border-top':
      case 'border-right':
      case 'border-bottom':
      case 'border-left':
        return this.expandSideBorder(normalizedProperty, normalizedValue);

      // Typography shorthands
      case 'font':
        return this.expandFont(normalizedValue);
      case 'text-decoration':
        return this.expandTextDecoration(normalizedValue);

      // Background shorthands
      case 'background':
        return this.expandBackground(normalizedValue);

      // Flexbox shorthands
      case 'flex':
        return this.expandFlex(normalizedValue);
      case 'flex-flow':
        return this.expandFlexFlow(normalizedValue);
      case 'gap':
        return this.expandGap(normalizedValue);

      // Grid shorthands
      case 'grid':
        return this.expandGrid(normalizedValue);
      case 'grid-area':
        return this.expandGridArea(normalizedValue);
      case 'grid-column':
        return this.expandGridTrack('grid-column', normalizedValue);
      case 'grid-row':
        return this.expandGridTrack('grid-row', normalizedValue);
      case 'grid-template':
        return this.expandGridTemplate(normalizedValue);

      // Position shorthands
      case 'inset':
        return this.expandInset(normalizedValue);

      // Overflow shorthands
      case 'overflow':
        return this.expandOverflow(normalizedValue);

      // List shorthands
      case 'list-style':
        return this.expandListStyle(normalizedValue);

      // Animation/transition shorthands
      case 'animation':
        return this.expandAnimation(normalizedValue);
      case 'transition':
        return this.expandTransition(normalizedValue);

      // Outline shorthands
      case 'outline':
        return this.expandOutline(normalizedValue);

      default:
        // Not a shorthand property, return as-is
        return [{ property: normalizedProperty, value: normalizedValue }];
    }
  }

  // ==================== BOX MODEL EXPANSION ====================

  private expandBoxSpacing(
    prefix: string, 
    value: string, 
    suffix?: 'width' | 'style' | 'color'
  ): Array<{ property: string; value: string }> {
    const values = this.parseSpacingValues(value);
    const sides = ['top', 'right', 'bottom', 'left'];
    
    return sides.map((side, index) => ({
      property: suffix ? `${prefix}-${side}-${suffix}` : `${prefix}-${side}`,
      value: values[index]
    }));
  }

  private parseSpacingValues(value: string): [string, string, string, string] {
    const parts = value.split(/\s+/).filter(p => p.length > 0);
    
    switch (parts.length) {
      case 1: return [parts[0], parts[0], parts[0], parts[0]];
      case 2: return [parts[0], parts[1], parts[0], parts[1]];
      case 3: return [parts[0], parts[1], parts[2], parts[1]];
      case 4: return [parts[0], parts[1], parts[2], parts[3]];
      default: return [parts[0] || '0', parts[1] || '0', parts[2] || '0', parts[3] || '0'];
    }
  }

  private expandBorder(value: string): Array<{ property: string; value: string }> {
    const parts = this.parseBorderValue(value);
    const result: Array<{ property: string; value: string }> = [];
    
    if (parts.width) {
      result.push(...this.expandBoxSpacing('border', parts.width, 'width'));
    }
    if (parts.style) {
      result.push(...this.expandBoxSpacing('border', parts.style, 'style'));
    }
    if (parts.color) {
      result.push(...this.expandBoxSpacing('border', parts.color, 'color'));
    }
    
    return result;
  }

  private parseBorderValue(value: string): { width?: string; style?: string; color?: string } {
    const parts = value.split(/\s+/);
    const result: { width?: string; style?: string; color?: string } = {};
    
    for (const part of parts) {
      if (this.isBorderWidth(part)) {
        result.width = part;
      } else if (this.isBorderStyle(part)) {
        result.style = part;
      } else if (this.isColor(part)) {
        result.color = part;
      }
    }
    
    return result;
  }

  private expandSideBorder(side: string, value: string): Array<{ property: string; value: string }> {
    const parts = this.parseBorderValue(value);
    const result: Array<{ property: string; value: string }> = [];
    
    if (parts.width) result.push({ property: `${side}-width`, value: parts.width });
    if (parts.style) result.push({ property: `${side}-style`, value: parts.style });
    if (parts.color) result.push({ property: `${side}-color`, value: parts.color });
    
    return result;
  }

  private expandBorderRadius(value: string): Array<{ property: string; value: string }> {
    // Handle border-radius which can have horizontal/vertical values
    const [horizontal = '', vertical = ''] = value.split('/').map(s => s.trim());
    const hValues = this.parseSpacingValues(horizontal || '0');
    const vValues = vertical ? this.parseSpacingValues(vertical) : hValues;
    
    return [
      { property: 'border-top-left-radius', value: `${hValues[0]} ${vValues[0]}`.trim() },
      { property: 'border-top-right-radius', value: `${hValues[1]} ${vValues[1]}`.trim() },
      { property: 'border-bottom-right-radius', value: `${hValues[2]} ${vValues[2]}`.trim() },
      { property: 'border-bottom-left-radius', value: `${hValues[3]} ${vValues[3]}`.trim() },
    ];
  }

  // ==================== TYPOGRAPHY EXPANSION ====================

  private expandFont(value: string): Array<{ property: string; value: string }> {
    const result: Array<{ property: string; value: string }> = [];
    
    // Font shorthand: [font-style] [font-variant] [font-weight] font-size[/line-height] font-family
    const fontRegex = /^(?:(italic|oblique|normal)\s+)?(?:(small-caps|normal)\s+)?(?:(bold|bolder|lighter|[1-9]00|normal)\s+)?([^\/\s]+)(?:\/([^\s]+))?\s+(.+)$/;
    const match = value.match(fontRegex);
    
    if (match) {
      const [, style, variant, weight, size, lineHeight, family] = match;
      
      if (style) result.push({ property: 'font-style', value: style });
      if (variant) result.push({ property: 'font-variant', value: variant });
      if (weight) result.push({ property: 'font-weight', value: weight });
      if (size) result.push({ property: 'font-size', value: size });
      if (lineHeight) result.push({ property: 'line-height', value: lineHeight });
      if (family) result.push({ property: 'font-family', value: family });
    } else {
      // Fallback: treat as font-family if parsing fails
      result.push({ property: 'font-family', value });
    }
    
    return result;
  }

  private expandTextDecoration(value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s+/);
    const result: Array<{ property: string; value: string }> = [];
    
    let line = '';
    let style = '';
    let color = '';
    let thickness = '';
    
    for (const part of parts) {
      if (this.isTextDecorationLine(part)) {
        line = line ? `${line} ${part}` : part;
      } else if (this.isTextDecorationStyle(part)) {
        style = part;
      } else if (this.isColor(part)) {
        color = part;
      } else if (this.isLength(part)) {
        thickness = part;
      }
    }
    
    if (line) result.push({ property: 'text-decoration-line', value: line });
    if (style) result.push({ property: 'text-decoration-style', value: style });
    if (color) result.push({ property: 'text-decoration-color', value: color });
    if (thickness) result.push({ property: 'text-decoration-thickness', value: thickness });
    
    return result;
  }

  // ==================== BACKGROUND EXPANSION ====================

  private expandBackground(value: string): Array<{ property: string; value: string }> {
    // Simplified background expansion - full implementation would need complex parsing
    const result: Array<{ property: string; value: string }> = [];
    
    // Check for common patterns
    if (this.isColor(value)) {
      result.push({ property: 'background-color', value });
    } else if (value.startsWith('url(')) {
      result.push({ property: 'background-image', value });
    } else if (value.includes('linear-gradient') || value.includes('radial-gradient')) {
      result.push({ property: 'background-image', value });
    } else {
      // Complex background - would need full parser for production
      const parts = value.split(/\s+/);
      let foundColor = false;
      let foundImage = false;
      
      for (const part of parts) {
        if (!foundColor && this.isColor(part)) {
          result.push({ property: 'background-color', value: part });
          foundColor = true;
        } else if (!foundImage && (part.startsWith('url(') || part.includes('gradient'))) {
          result.push({ property: 'background-image', value: part });
          foundImage = true;
        }
      }
      
      // If we couldn't parse it, preserve as background-color
      if (result.length === 0) {
        result.push({ property: 'background-color', value });
      }
    }
    
    return result;
  }

  // ==================== FLEXBOX EXPANSION ====================

  private expandFlex(value: string): Array<{ property: string; value: string }> {
    const trimmed = value.trim();
    
    // Handle keywords
    if (trimmed === 'initial') {
      return [
        { property: 'flex-grow', value: '0' },
        { property: 'flex-shrink', value: '1' },
        { property: 'flex-basis', value: 'auto' }
      ];
    }
    if (trimmed === 'auto') {
      return [
        { property: 'flex-grow', value: '1' },
        { property: 'flex-shrink', value: '1' },
        { property: 'flex-basis', value: 'auto' }
      ];
    }
    if (trimmed === 'none') {
      return [
        { property: 'flex-grow', value: '0' },
        { property: 'flex-shrink', value: '0' },
        { property: 'flex-basis', value: 'auto' }
      ];
    }
    
    // Handle single number
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return [
        { property: 'flex-grow', value: trimmed },
        { property: 'flex-shrink', value: '1' },
        { property: 'flex-basis', value: '0%' }
      ];
    }
    
    // Parse multi-value
    const parts = trimmed.split(/\s+/);
    const result: Array<{ property: string; value: string }> = [];
    
    if (parts.length >= 1 && this.isNumber(parts[0])) {
      result.push({ property: 'flex-grow', value: parts[0] });
    }
    if (parts.length >= 2 && this.isNumber(parts[1])) {
      result.push({ property: 'flex-shrink', value: parts[1] });
    }
    if (parts.length >= 3) {
      result.push({ property: 'flex-basis', value: parts[2] });
    } else if (parts.length === 2 && !this.isNumber(parts[1])) {
      result.push({ property: 'flex-basis', value: parts[1] });
    }
    
    return result;
  }

  private expandFlexFlow(value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s+/);
    const result: Array<{ property: string; value: string }> = [];
    
    for (const part of parts) {
      if (this.isFlexDirection(part)) {
        result.push({ property: 'flex-direction', value: part });
      } else if (this.isFlexWrap(part)) {
        result.push({ property: 'flex-wrap', value: part });
      }
    }
    
    return result;
  }

  private expandGap(value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s+/);
    
    if (parts.length === 1) {
      return [
        { property: 'row-gap', value: parts[0] },
        { property: 'column-gap', value: parts[0] }
      ];
    } else {
      return [
        { property: 'row-gap', value: parts[0] || '0' },
        { property: 'column-gap', value: parts[1] || '0' }
      ];
    }
  }

  // ==================== GRID EXPANSION ====================

  private expandGrid(value: string): Array<{ property: string; value: string }> {
    // Simplified grid expansion - full implementation would be very complex
    return [{ property: 'grid-template', value }];
  }

  private expandGridArea(value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s*\/\s*/);
    const result: Array<{ property: string; value: string }> = [];
    
    if (parts[0]) result.push({ property: 'grid-row-start', value: parts[0] });
    if (parts[1]) result.push({ property: 'grid-column-start', value: parts[1] });
    if (parts[2]) result.push({ property: 'grid-row-end', value: parts[2] });
    if (parts[3]) result.push({ property: 'grid-column-end', value: parts[3] });
    
    return result;
  }

  private expandGridTrack(property: string, value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s*\/\s*/);
    const prefix = property;
    
    return [
      { property: `${prefix}-start`, value: parts[0] || 'auto' },
      { property: `${prefix}-end`, value: parts[1] || 'auto' }
    ];
  }

  private expandGridTemplate(value: string): Array<{ property: string; value: string }> {
    // Simplified - would need complex parsing for full support
    return [
      { property: 'grid-template-rows', value: 'none' },
      { property: 'grid-template-columns', value: 'none' },
      { property: 'grid-template-areas', value: 'none' }
    ];
  }

  // ==================== MISCELLANEOUS EXPANSION ====================

  private expandInset(value: string): Array<{ property: string; value: string }> {
    const values = this.parseSpacingValues(value);
    return [
      { property: 'top', value: values[0] },
      { property: 'right', value: values[1] },
      { property: 'bottom', value: values[2] },
      { property: 'left', value: values[3] }
    ];
  }

  private expandOverflow(value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s+/);
    return [
      { property: 'overflow-x', value: parts[0] || 'visible' },
      { property: 'overflow-y', value: parts[1] || parts[0] || 'visible' }
    ];
  }

  private expandListStyle(value: string): Array<{ property: string; value: string }> {
    const parts = value.split(/\s+/);
    const result: Array<{ property: string; value: string }> = [];
    
    for (const part of parts) {
      if (this.isListStyleType(part)) {
        result.push({ property: 'list-style-type', value: part });
      } else if (this.isListStylePosition(part)) {
        result.push({ property: 'list-style-position', value: part });
      } else if (part.startsWith('url(')) {
        result.push({ property: 'list-style-image', value: part });
      }
    }
    
    return result;
  }

  private expandAnimation(value: string): Array<{ property: string; value: string }> {
    // Simplified animation expansion
    return [{ property: 'animation-name', value }];
  }

  private expandTransition(value: string): Array<{ property: string; value: string }> {
    // Simplified transition expansion  
    return [{ property: 'transition-property', value }];
  }

  private expandOutline(value: string): Array<{ property: string; value: string }> {
    const parts = this.parseBorderValue(value);
    const result: Array<{ property: string; value: string }> = [];
    
    if (parts.width) result.push({ property: 'outline-width', value: parts.width });
    if (parts.style) result.push({ property: 'outline-style', value: parts.style });
    if (parts.color) result.push({ property: 'outline-color', value: parts.color });
    
    return result;
  }

  // ==================== VALIDATION HELPERS ====================

  private isBorderWidth(value: string): boolean {
    return /^(thin|medium|thick|\d+(\.\d+)?(px|em|rem|%))$/i.test(value);
  }

  private isBorderStyle(value: string): boolean {
    const styles = ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'];
    return styles.includes(value.toLowerCase());
  }

  private isColor(value: string): boolean {
    return /^(#[0-9a-f]{3,8}|rgb|hsl|[a-z]+)$/i.test(value) || this.isNamedColor(value);
  }

  private isNamedColor(value: string): boolean {
    const colors = ['transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta'];
    return colors.includes(value.toLowerCase());
  }

  private isLength(value: string): boolean {
    return /^\d+(\.\d+)?(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|lh|cm|mm|in|pt|pc)$/i.test(value);
  }

  private isNumber(value: string): boolean {
    return /^\d+(\.\d+)?$/.test(value);
  }

  private isTextDecorationLine(value: string): boolean {
    const lines = ['none', 'underline', 'overline', 'line-through'];
    return lines.includes(value.toLowerCase());
  }

  private isTextDecorationStyle(value: string): boolean {
    const styles = ['solid', 'double', 'dotted', 'dashed', 'wavy'];
    return styles.includes(value.toLowerCase());
  }

  private isFlexDirection(value: string): boolean {
    const directions = ['row', 'row-reverse', 'column', 'column-reverse'];
    return directions.includes(value.toLowerCase());
  }

  private isFlexWrap(value: string): boolean {
    const wraps = ['nowrap', 'wrap', 'wrap-reverse'];
    return wraps.includes(value.toLowerCase());
  }

  private isListStyleType(value: string): boolean {
    const types = ['disc', 'circle', 'square', 'decimal', 'none'];
    return types.includes(value.toLowerCase());
  }

  private isListStylePosition(value: string): boolean {
    const positions = ['inside', 'outside'];
    return positions.includes(value.toLowerCase());
  }
}

// ==================== TYPE DEFINITIONS ====================

export interface NormalizedStyles {
  /** Normalized longhand properties */
  properties: Record<string, string>;
  /** Map of shorthand properties to their expanded longhand properties */
  expansions: Record<string, string[]>;
  /** Any warnings encountered during normalization */
  warnings: string[];
  /** Summary statistics */
  summary: {
    originalCount: number;
    normalizedCount: number;
    shorthandsExpanded: number;
  };
}

export interface StyleNormalizationReport {
  /** Input styles before normalization */
  original: Record<string, string>;
  /** Normalized styles result */
  normalized: NormalizedStyles;
  /** Detailed analysis */
  analysis: {
    shorthandsFound: string[];
    expansions: Array<{
      shorthand: string;
      longhand: string[];
      example: string;
    }>;
    conversionRate: number;
    potentialIssues: string[];
  };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Normalize styles and provide detailed analysis
 */
export function analyzeStyleNormalization(styles: Record<string, string>): StyleNormalizationReport {
  const original = { ...styles };
  const normalized = CSSStyleNormalizer.normalize(styles);
  
  const shorthandsFound = Object.keys(styles).filter(prop => 
    CSSStyleNormalizer.isShorthand(prop)
  );
  
  const expansions = Object.entries(normalized.expansions).map(([shorthand, longhand]) => ({
    shorthand,
    longhand,
    example: styles[shorthand] || '',
  }));
  
  const conversionRate = shorthandsFound.length > 0 
    ? (Object.keys(normalized.expansions).length / shorthandsFound.length) * 100 
    : 100;
  
  const potentialIssues: string[] = [];
  
  // Check for properties that couldn't be normalized
  for (const shorthand of shorthandsFound) {
    if (!normalized.expansions[shorthand]) {
      potentialIssues.push(`Could not expand shorthand: ${shorthand}`);
    }
  }
  
  // Check for conflicting properties
  const propertyGroups = {
    margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    border: ['border-top', 'border-right', 'border-bottom', 'border-left'],
  };
  
  for (const [group, properties] of Object.entries(propertyGroups)) {
    const hasShorthand = group in styles;
    const hasLonghand = properties.some(prop => prop in styles);
    if (hasShorthand && hasLonghand) {
      potentialIssues.push(`Conflicting ${group} shorthand and longhand properties`);
    }
  }
  
  return {
    original,
    normalized,
    analysis: {
      shorthandsFound,
      expansions,
      conversionRate,
      potentialIssues,
    }
  };
}

/**
 * Quick check if a styles object contains any shorthand properties
 */
export function hasShorthands(styles: Record<string, string>): boolean {
  return Object.keys(styles).some(prop => CSSStyleNormalizer.isShorthand(prop));
}

/**
 * Get list of shorthand properties in a styles object
 */
export function getShorthandProperties(styles: Record<string, string>): string[] {
  return Object.keys(styles).filter(prop => CSSStyleNormalizer.isShorthand(prop));
}

/**
 * Merge multiple normalized style objects
 */
export function mergeNormalizedStyles(...normalizedStyles: NormalizedStyles[]): NormalizedStyles {
  const merged: NormalizedStyles = {
    properties: {},
    expansions: {},
    warnings: [],
    summary: {
      originalCount: 0,
      normalizedCount: 0,
      shorthandsExpanded: 0,
    }
  };
  
  for (const styles of normalizedStyles) {
    Object.assign(merged.properties, styles.properties);
    Object.assign(merged.expansions, styles.expansions);
    merged.warnings.push(...styles.warnings);
    merged.summary.originalCount += styles.summary.originalCount;
    merged.summary.normalizedCount = Object.keys(merged.properties).length;
    merged.summary.shorthandsExpanded += styles.summary.shorthandsExpanded;
  }
  
  return merged;
}
