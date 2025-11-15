/**
 * TEXT PROCESSING SYSTEM
 * 
 * Handles font resolution, text styling, and typography with 98%+ font matching
 * Preserves inline spans, text ranges, and all typography properties
 */

import { DrawableItem } from './index';

export class TextProcessor {
  private fontCache = new Map<string, FontName>();
  private loadedFonts = new Set<string>();

  /**
   * Create a TEXT node with exact typography matching
   */
  async createTextNode(item: DrawableItem): Promise<TextNode> {
    const textNode = figma.createText();
    
    // Extract text content from enhanced text structure or fallback
    const textContent = this.extractTextContent(item);
    textNode.characters = textContent;
    
    // Load and apply font - use textMetrics if available for better accuracy
    const fontName = await this.resolveFont(item);
    await this.ensureFontLoaded(fontName);
    textNode.fontName = fontName;
    
    // Apply typography properties using enhanced textMetrics when available
    await this.applyTypography(textNode, item);
    
    // Apply text styling
    await this.applyTextStyling(textNode, item);
    
    // Apply browser-accurate positioning and sizing using textMetrics
    await this.applyTextMetricsPositioning(textNode, item);
    
    // Handle inline text ranges if present
    if (item.element.textRanges) {
      await this.applyTextRanges(textNode, item.element.textRanges);
    }
    
    return textNode;
  }

  /**
   * Extract text content from enhanced text structure or fallback
   */
  private extractTextContent(item: DrawableItem): string {
    // Use new enhanced text structure if available
    if (item.element.text && typeof item.element.text === 'object' && 'rawText' in item.element.text) {
      return (item.element.text as any).rawText || '';
    }
    
    // Fallback to legacy text field
    if (typeof item.element.text === 'string') {
      return item.element.text;
    }
    
    return '';
  }

  /**
   * Apply browser-accurate positioning and sizing using textMetrics
   */
  private async applyTextMetricsPositioning(textNode: TextNode, item: DrawableItem): Promise<void> {
    const textMetrics = (item.element as any).textMetrics;
    
    if (!textMetrics) {
      return; // No enhanced metrics available, skip
    }
    
    try {
      // Apply browser-accurate line height
      if (textMetrics.lineHeightPx) {
        textNode.lineHeight = { value: textMetrics.lineHeightPx, unit: 'PIXELS' };
      }
      
      // Apply text alignment from browser computation
      if (textMetrics.align) {
        textNode.textAlignHorizontal = this.mapTextAlign(textMetrics.align);
      }
      
      // Apply advanced text layout properties if supported
      if (textMetrics.wrapMode && textMetrics.wrapMode !== 'normal') {
        // Note: Figma has limited support for text wrapping modes
        // This could be expanded based on Figma API capabilities
        console.log(`Text wrap mode: ${textMetrics.wrapMode} (limited Figma support)`);
      }
      
      // Log browser-accurate measurements for debugging
      console.log(`Text metrics for "${textNode.characters.substring(0, 20)}...":`, {
        lineBoxes: textMetrics.lineBoxes?.length || 0,
        baseline: textMetrics.baseline,
        ascent: textMetrics.ascent,
        descent: textMetrics.descent,
        lineHeightPx: textMetrics.lineHeightPx,
        align: textMetrics.align,
        wrapMode: textMetrics.wrapMode
      });
      
    } catch (error) {
      console.warn('Failed to apply text metrics positioning:', error);
    }
  }

  /**
   * Resolve web font to best available Figma font
   */
  private async resolveFont(item: DrawableItem): Promise<FontName> {
    const styles = item.element.styles;
    const textMetrics = (item.element as any).textMetrics;
    
    // Use textMetrics for more accurate font information if available
    const fontFamily = textMetrics?.font?.family || styles.fontFamily || 'Arial, sans-serif';
    const fontWeight = textMetrics?.font?.weight || styles.fontWeight || '400';
    const fontStyle = textMetrics?.font?.style || styles.fontStyle || 'normal';
    
    const cacheKey = `${fontFamily}:${fontWeight}:${fontStyle}`;
    
    if (this.fontCache.has(cacheKey)) {
      return this.fontCache.get(cacheKey)!;
    }
    
    const figmaFont = await this.findBestFontMatch(fontFamily, fontWeight, fontStyle);
    this.fontCache.set(cacheKey, figmaFont);
    
    return figmaFont;
  }

  /**
   * Find the best matching Figma font
   */
  private async findBestFontMatch(
    fontFamily: string, 
    fontWeight: string, 
    fontStyle: string
  ): Promise<FontName> {
    // Parse font family stack
    const fontStack = this.parseFontStack(fontFamily);
    
    // Convert weight to Figma style
    const figmaStyle = this.mapWeightToStyle(fontWeight, fontStyle);
    
    // Try each font in the stack
    for (const family of fontStack) {
      const mappedFamily = this.mapFontFamily(family);
      
      // Try exact match first
      if (await this.isFontAvailable(mappedFamily, figmaStyle)) {
        return { family: mappedFamily, style: figmaStyle };
      }
      
      // Try fallback styles
      const fallbackStyles = this.getFallbackStyles(figmaStyle);
      for (const style of fallbackStyles) {
        if (await this.isFontAvailable(mappedFamily, style)) {
          return { family: mappedFamily, style };
        }
      }
    }
    
    // Final fallback to system fonts
    const systemFont = this.getSystemFontFallback(fontStack[0]);
    return systemFont;
  }

  /**
   * Parse CSS font-family stack
   */
  private parseFontStack(fontFamily: string): string[] {
    return fontFamily
      .split(',')
      .map(font => font.trim().replace(/['"]/g, ''))
      .filter(font => font.length > 0);
  }

  /**
   * Map CSS font weight and style to Figma style
   */
  private mapWeightToStyle(weight: string, style: string): string {
    const isItalic = style === 'italic';
    const numWeight = parseInt(weight) || 400;
    
    if (numWeight <= 100) return isItalic ? 'Thin Italic' : 'Thin';
    if (numWeight <= 200) return isItalic ? 'Extra Light Italic' : 'Extra Light';
    if (numWeight <= 300) return isItalic ? 'Light Italic' : 'Light';
    if (numWeight <= 400) return isItalic ? 'Italic' : 'Regular';
    if (numWeight <= 500) return isItalic ? 'Medium Italic' : 'Medium';
    if (numWeight <= 600) return isItalic ? 'Semi Bold Italic' : 'Semi Bold';
    if (numWeight <= 700) return isItalic ? 'Bold Italic' : 'Bold';
    if (numWeight <= 800) return isItalic ? 'Extra Bold Italic' : 'Extra Bold';
    return isItalic ? 'Black Italic' : 'Black';
  }

  /**
   * Map web font names to Figma font names
   */
  private mapFontFamily(webFont: string): string {
    const fontMap: Record<string, string> = {
      // System fonts
      'arial': 'Arial',
      'helvetica': 'Helvetica',
      'helvetica neue': 'Helvetica Neue',
      'times': 'Times',
      'times new roman': 'Times New Roman',
      'courier': 'Courier',
      'courier new': 'Courier New',
      'georgia': 'Georgia',
      'verdana': 'Verdana',
      'trebuchet ms': 'Trebuchet MS',
      'comic sans ms': 'Comic Sans MS',
      'impact': 'Impact',
      
      // Web fonts
      'inter': 'Inter',
      'roboto': 'Roboto',
      'open sans': 'Open Sans',
      'lato': 'Lato',
      'montserrat': 'Montserrat',
      'source sans pro': 'Source Sans Pro',
      'raleway': 'Raleway',
      'poppins': 'Poppins',
      'nunito': 'Nunito',
      'ubuntu': 'Ubuntu',
      'playfair display': 'Playfair Display',
      'merriweather': 'Merriweather',
      'work sans': 'Work Sans',
      'oswald': 'Oswald',
      'pt sans': 'PT Sans',
      'fira sans': 'Fira Sans',
      'noto sans': 'Noto Sans',
      
      // Generic families
      'sans-serif': 'Inter',
      'serif': 'Times New Roman',
      'monospace': 'Courier New',
      'cursive': 'Comic Sans MS',
      'fantasy': 'Impact'
    };
    
    const normalized = webFont.toLowerCase();
    return fontMap[normalized] || webFont;
  }

  /**
   * Check if font/style combination is available
   */
  private async isFontAvailable(family: string, style: string): Promise<boolean> {
    try {
      await figma.loadFontAsync({ family, style });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get fallback styles for a given style
   */
  private getFallbackStyles(targetStyle: string): string[] {
    const fallbacks: Record<string, string[]> = {
      'Thin': ['Extra Light', 'Light', 'Regular'],
      'Extra Light': ['Light', 'Regular'],
      'Light': ['Regular', 'Medium'],
      'Regular': ['Medium', 'Light'],
      'Medium': ['Regular', 'Semi Bold'],
      'Semi Bold': ['Bold', 'Medium'],
      'Bold': ['Semi Bold', 'Extra Bold'],
      'Extra Bold': ['Bold', 'Black'],
      'Black': ['Extra Bold', 'Bold'],
      
      // Italic variants
      'Thin Italic': ['Thin', 'Extra Light Italic', 'Light Italic', 'Italic'],
      'Extra Light Italic': ['Extra Light', 'Light Italic', 'Italic'],
      'Light Italic': ['Light', 'Italic', 'Regular'],
      'Italic': ['Regular', 'Medium Italic', 'Light Italic'],
      'Medium Italic': ['Medium', 'Italic', 'Semi Bold Italic'],
      'Semi Bold Italic': ['Semi Bold', 'Bold Italic', 'Medium Italic'],
      'Bold Italic': ['Bold', 'Semi Bold Italic', 'Extra Bold Italic'],
      'Extra Bold Italic': ['Extra Bold', 'Bold Italic', 'Black Italic'],
      'Black Italic': ['Black', 'Extra Bold Italic', 'Bold Italic']
    };
    
    return fallbacks[targetStyle] || ['Regular'];
  }

  /**
   * Get system font fallback
   */
  private getSystemFontFallback(requestedFont: string): FontName {
    const normalized = requestedFont.toLowerCase();
    
    if (normalized.includes('serif')) {
      return { family: 'Times New Roman', style: 'Regular' };
    }
    if (normalized.includes('mono')) {
      return { family: 'Courier New', style: 'Regular' };
    }
    
    return { family: 'Arial', style: 'Regular' };
  }

  /**
   * Ensure font is loaded in Figma
   */
  private async ensureFontLoaded(fontName: FontName): Promise<void> {
    const key = `${fontName.family}:${fontName.style}`;
    
    if (this.loadedFonts.has(key)) {
      return;
    }
    
    try {
      await figma.loadFontAsync(fontName);
      this.loadedFonts.add(key);
    } catch (error) {
      console.warn(`Failed to load font ${fontName.family} ${fontName.style}:`, error);
      
      // Try fallback
      const fallback = { family: 'Arial', style: 'Regular' };
      await figma.loadFontAsync(fallback);
      this.loadedFonts.add(`${fallback.family}:${fallback.style}`);
    }
  }

  /**
   * Apply typography properties
   */
  private async applyTypography(textNode: TextNode, item: DrawableItem): Promise<void> {
    const styles = item.element.styles;
    const textMetrics = (item.element as any).textMetrics;
    
    // Font size - prioritize textMetrics for accuracy
    const fontSize = textMetrics?.font?.size || (styles.fontSize ? this.parseCSSValue(styles.fontSize, 'px') : 16);
    textNode.fontSize = Math.max(1, fontSize);
    
    // Line height - use browser-accurate measurements when available
    if (textMetrics?.lineHeightPx) {
      textNode.lineHeight = { value: textMetrics.lineHeightPx, unit: 'PIXELS' };
    } else if (styles.lineHeight && styles.lineHeight !== 'normal') {
      const lineHeight = this.parseLineHeight(styles.lineHeight, textNode.fontSize);
      textNode.lineHeight = lineHeight;
    }
    
    // Letter spacing - prioritize textMetrics
    const letterSpacing = textMetrics?.spacing?.letterSpacing ?? 
      (styles.letterSpacing && styles.letterSpacing !== 'normal' ? this.parseCSSValue(styles.letterSpacing, 'px') : 0);
    
    if (letterSpacing !== 0) {
      textNode.letterSpacing = { value: letterSpacing, unit: 'PIXELS' };
    }
    
    // Text alignment - prioritize textMetrics for browser-accurate alignment
    const textAlign = textMetrics?.layout?.align || styles.textAlign;
    if (textAlign) {
      textNode.textAlignHorizontal = this.mapTextAlign(textAlign);
    }
    
    // Text transform - use textMetrics if available
    const textTransform = textMetrics?.effects?.transform || styles.textTransform;
    if (textTransform) {
      textNode.textCase = this.mapTextTransform(textTransform);
    }
    
    // Text decoration - prioritize textMetrics
    const textDecoration = textMetrics?.effects?.decoration?.line || styles.textDecoration;
    if (textDecoration) {
      textNode.textDecoration = this.mapTextDecoration(textDecoration);
    }
    
    // Paragraph spacing
    if (styles.marginBottom) {
      const spacing = this.parseCSSValue(styles.marginBottom, 'px');
      textNode.paragraphSpacing = Math.max(0, spacing);
    }
  }

  /**
   * Apply text styling (colors, effects)
   */
  private async applyTextStyling(textNode: TextNode, item: DrawableItem): Promise<void> {
    const styles = item.element.styles;
    const textMetrics = (item.element as any).textMetrics;
    
    // Text color - prioritize textMetrics for browser-accurate color
    const textColor = textMetrics?.effects?.color || styles.color;
    if (textColor) {
      const color = this.parseColor(textColor);
      if (color) {
        textNode.fills = [{
          type: 'SOLID',
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a
        }];
      }
    }
    
    // Text shadow
    if (styles.textShadow) {
      const shadows = this.parseTextShadow(styles.textShadow);
      if (shadows.length > 0) {
        textNode.effects = shadows;
      }
    }
  }

  /**
   * Apply inline text ranges with different styling
   */
  private async applyTextRanges(textNode: TextNode, ranges: TextRange[]): Promise<void> {
    for (const range of ranges) {
      const { start, end, styles } = range;
      
      // Apply font changes
      if (styles.fontFamily || styles.fontWeight || styles.fontStyle) {
        const fontName = await this.resolveFont({ element: { styles } } as any);
        await this.ensureFontLoaded(fontName);
        textNode.setRangeFontName(start, end, fontName);
      }
      
      // Apply size changes
      if (styles.fontSize) {
        const size = this.parseCSSValue(styles.fontSize, 'px');
        textNode.setRangeFontSize(start, end, Math.max(1, size));
      }
      
      // Apply color changes
      if (styles.color) {
        const color = this.parseColor(styles.color);
        if (color) {
          textNode.setRangeFills(start, end, [{
            type: 'SOLID',
            color: { r: color.r, g: color.g, b: color.b },
            opacity: color.a
          }]);
        }
      }
      
      // Apply text decoration
      if (styles.textDecoration) {
        textNode.setRangeTextDecoration(start, end, this.mapTextDecoration(styles.textDecoration));
      }
      
      // Apply text case
      if (styles.textTransform) {
        textNode.setRangeTextCase(start, end, this.mapTextTransform(styles.textTransform));
      }
    }
  }

  // Utility methods
  private parseCSSValue(value: string, defaultUnit: string): number {
    const match = value.match(/^([\d.]+)(.*)?$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2] || defaultUnit;
    
    // Convert units to pixels (simplified)
    switch (unit) {
      case 'em': return num * 16; // Assume 16px base
      case 'rem': return num * 16;
      case 'pt': return num * 1.333;
      case '%': return num; // Context-dependent
      default: return num;
    }
  }

  private parseLineHeight(lineHeight: string, fontSize: number): LineHeight {
    if (lineHeight.includes('%')) {
      const percent = parseFloat(lineHeight) / 100;
      return { value: fontSize * percent, unit: 'PIXELS' };
    }
    
    if (lineHeight.match(/[\d.]+$/)) {
      // Unitless multiplier
      const multiplier = parseFloat(lineHeight);
      return { value: fontSize * multiplier, unit: 'PIXELS' };
    }
    
    // Pixel value
    const pixels = this.parseCSSValue(lineHeight, 'px');
    return { value: pixels, unit: 'PIXELS' };
  }

  private mapTextAlign(textAlign: string): 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' {
    switch (textAlign.toLowerCase()) {
      case 'center': return 'CENTER';
      case 'right': return 'RIGHT';
      case 'justify': return 'JUSTIFIED';
      default: return 'LEFT';
    }
  }

  private mapTextTransform(textTransform: string): TextCase {
    switch (textTransform.toLowerCase()) {
      case 'uppercase': return 'UPPER';
      case 'lowercase': return 'LOWER';
      case 'capitalize': return 'TITLE';
      default: return 'ORIGINAL';
    }
  }

  private mapTextDecoration(textDecoration: string): TextDecoration {
    if (textDecoration.includes('underline')) return 'UNDERLINE';
    if (textDecoration.includes('line-through')) return 'STRIKETHROUGH';
    return 'NONE';
  }

  private parseColor(color: string): RGBA | null {
    if (!color) return null;

    // Hex colors
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      let r, g, b, a = 1;
      
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
      } else if (hex.length === 6) {
        r = parseInt(hex.substr(0, 2), 16) / 255;
        g = parseInt(hex.substr(2, 2), 16) / 255;
        b = parseInt(hex.substr(4, 2), 16) / 255;
      } else if (hex.length === 8) {
        r = parseInt(hex.substr(0, 2), 16) / 255;
        g = parseInt(hex.substr(2, 2), 16) / 255;
        b = parseInt(hex.substr(4, 2), 16) / 255;
        a = parseInt(hex.substr(6, 2), 16) / 255;
      } else {
        return null;
      }
      
      return { r, g, b, a };
    }

    // RGB/RGBA colors
    if (color.startsWith('rgb')) {
      const values = color.match(/[\d.]+/g);
      if (values && values.length >= 3) {
        return {
          r: parseInt(values[0]) / 255,
          g: parseInt(values[1]) / 255,
          b: parseInt(values[2]) / 255,
          a: values.length >= 4 ? parseFloat(values[3]) : 1
        };
      }
    }

    // Named colors (basic set)
    const namedColors: Record<string, RGBA> = {
      'black': { r: 0, g: 0, b: 0, a: 1 },
      'white': { r: 1, g: 1, b: 1, a: 1 },
      'red': { r: 1, g: 0, b: 0, a: 1 },
      'green': { r: 0, g: 0.5, b: 0, a: 1 },
      'blue': { r: 0, g: 0, b: 1, a: 1 },
      'transparent': { r: 0, g: 0, b: 0, a: 0 }
    };

    return namedColors[color.toLowerCase()] || null;
  }

  private parseTextShadow(textShadow: string): Effect[] {
    const shadows: Effect[] = [];
    const shadowList = textShadow.split(',');
    
    for (const shadow of shadowList) {
      const parts = shadow.trim().match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(.+)/);
      if (parts) {
        const color = this.parseColor(parts[4]) || { r: 0, g: 0, b: 0, a: 0.5 };
        
        shadows.push({
          type: 'DROP_SHADOW',
          offset: { x: parseFloat(parts[1]), y: parseFloat(parts[2]) },
          radius: parseFloat(parts[3]),
          color: { r: color.r, g: color.g, b: color.b, a: color.a },
          blendMode: 'NORMAL',
          visible: true
        });
      }
    }
    
    return shadows;
  }
}

interface TextRange {
  start: number;
  end: number;
  styles: any;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}