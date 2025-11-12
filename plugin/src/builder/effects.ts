/**
 * EFFECTS PROCESSING SYSTEM
 * 
 * Handles shadows, blurs, blend modes, and filters
 * Preserves multiple effects and maps unsupported effects to closest approximation
 */

import { DrawableItem } from './index';

export class EffectsProcessor {

  /**
   * Create effects array from element styles
   */
  async createEffects(item: DrawableItem): Promise<Effect[]> {
    const effects: Effect[] = [];
    const styles = item.element.styles;
    
    // Box shadows (supports multiple shadows)
    if (styles.boxShadow && styles.boxShadow !== 'none') {
      const shadows = this.parseBoxShadow(styles.boxShadow);
      effects.push(...shadows);
    }
    
    // CSS filters
    if (styles.filter && styles.filter !== 'none') {
      const filterEffects = this.parseFilters(styles.filter);
      effects.push(...filterEffects);
    }
    
    // Backdrop filters
    if (styles.backdropFilter && styles.backdropFilter !== 'none') {
      const backdropEffects = this.parseBackdropFilters(styles.backdropFilter);
      effects.push(...backdropEffects);
    }
    
    return effects;
  }

  /**
   * Parse CSS box-shadow property (supports multiple shadows)
   */
  private parseBoxShadow(boxShadow: string): Effect[] {
    const effects: Effect[] = [];
    
    // Split multiple shadows while preserving function calls
    const shadows = this.splitShadows(boxShadow);
    
    for (const shadow of shadows) {
      const effect = this.parseSingleShadow(shadow.trim());
      if (effect) {
        effects.push(effect);
      }
    }
    
    return effects;
  }

  /**
   * Parse a single shadow definition
   */
  private parseSingleShadow(shadow: string): Effect | null {
    const isInset = shadow.startsWith('inset');
    const shadowStr = isInset ? shadow.substring(5).trim() : shadow;
    
    // Parse shadow components: offset-x offset-y blur-radius [spread-radius] color
    const parts = shadowStr.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px)?\s+(.+)/);
    
    if (!parts) return null;
    
    const offsetX = parseFloat(parts[1]);
    const offsetY = parseFloat(parts[2]);
    const blurRadius = parseFloat(parts[3]);
    const spreadRadius = parts[4] ? parseFloat(parts[4]) : 0;
    const color = this.parseColor(parts[5]);
    
    if (!color) return null;
    
    return {
      type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      offset: { x: offsetX, y: offsetY },
      radius: blurRadius,
      spread: spreadRadius,
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      blendMode: 'NORMAL',
      visible: true
    };
  }

  /**
   * Parse CSS filter property
   */
  private parseFilters(filter: string): Effect[] {
    const effects: Effect[] = [];
    const filterFunctions = this.parseFilterFunctions(filter);
    
    for (const func of filterFunctions) {
      const effect = this.mapFilterToEffect(func);
      if (effect) {
        effects.push(effect);
      }
    }
    
    return effects;
  }

  /**
   * Parse CSS backdrop-filter property
   */
  private parseBackdropFilters(backdropFilter: string): Effect[] {
    const effects: Effect[] = [];
    const filterFunctions = this.parseFilterFunctions(backdropFilter);
    
    for (const func of filterFunctions) {
      // Map backdrop filters to background blur when possible
      if (func.name === 'blur') {
        const radius = this.parseFilterValue(func.value, 'px');
        effects.push({
          type: 'BACKGROUND_BLUR',
          radius,
          visible: true
        });
      }
      // Other backdrop filters are not directly supported
    }
    
    return effects;
  }

  /**
   * Parse filter functions from filter string
   */
  private parseFilterFunctions(filter: string): FilterFunction[] {
    const functions: FilterFunction[] = [];
    const regex = /(\w+)\(([^)]+)\)/g;
    let match;
    
    while ((match = regex.exec(filter)) !== null) {
      functions.push({
        name: match[1],
        value: match[2]
      });
    }
    
    return functions;
  }

  /**
   * Map CSS filter function to Figma effect
   */
  private mapFilterToEffect(func: FilterFunction): Effect | null {
    switch (func.name) {
      case 'blur':
        return this.createBlurEffect(func.value);
        
      case 'drop-shadow':
        return this.createDropShadowFromFilter(func.value);
        
      case 'brightness':
      case 'contrast':
      case 'saturate':
      case 'hue-rotate':
      case 'sepia':
      case 'grayscale':
      case 'invert':
        // These are not directly supported in Figma
        // Log as approximation needed
        console.warn(`Filter ${func.name} not directly supported, approximation needed`);
        return null;
        
      default:
        console.warn(`Unknown filter function: ${func.name}`);
        return null;
    }
  }

  /**
   * Create blur effect from CSS blur() function
   */
  private createBlurEffect(value: string): Effect {
    const radius = this.parseFilterValue(value, 'px');
    
    return {
      type: 'LAYER_BLUR',
      radius,
      visible: true
    };
  }

  /**
   * Create drop shadow from CSS drop-shadow() function
   */
  private createDropShadowFromFilter(value: string): Effect | null {
    // Parse drop-shadow(offset-x offset-y blur-radius color)
    const parts = value.trim().match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(.+)/);
    
    if (!parts) return null;
    
    const offsetX = parseFloat(parts[1]);
    const offsetY = parseFloat(parts[2]);
    const blurRadius = parseFloat(parts[3]);
    const color = this.parseColor(parts[4]);
    
    if (!color) return null;
    
    return {
      type: 'DROP_SHADOW',
      offset: { x: offsetX, y: offsetY },
      radius: blurRadius,
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      blendMode: 'NORMAL',
      visible: true
    };
  }

  /**
   * Apply blend mode to node if supported
   */
  applyBlendMode(node: BlendMixin, blendMode?: string): void {
    if (!blendMode) return;
    
    const mappedBlendMode = this.mapCSSBlendModeToFigma(blendMode);
    if (mappedBlendMode) {
      node.blendMode = mappedBlendMode;
    }
  }

  /**
   * Map CSS blend modes to Figma blend modes
   */
  private mapCSSBlendModeToFigma(cssBlendMode: string): BlendMode | null {
    const blendModeMap: Record<string, BlendMode> = {
      'normal': 'NORMAL',
      'multiply': 'MULTIPLY',
      'screen': 'SCREEN',
      'overlay': 'OVERLAY',
      'darken': 'DARKEN',
      'lighten': 'LIGHTEN',
      'color-dodge': 'COLOR_DODGE',
      'color-burn': 'COLOR_BURN',
      'hard-light': 'HARD_LIGHT',
      'soft-light': 'SOFT_LIGHT',
      'difference': 'DIFFERENCE',
      'exclusion': 'EXCLUSION',
      'hue': 'HUE',
      'saturation': 'SATURATION',
      'color': 'COLOR',
      'luminosity': 'LUMINOSITY'
    };
    
    const mapped = blendModeMap[cssBlendMode];
    if (!mapped) {
      console.warn(`Blend mode ${cssBlendMode} not supported, using normal`);
      return 'NORMAL';
    }
    
    return mapped;
  }

  // Utility methods
  private splitShadows(boxShadow: string): string[] {
    const shadows: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inQuotes = false;
    
    for (let i = 0; i < boxShadow.length; i++) {
      const char = boxShadow[i];
      const prevChar = i > 0 ? boxShadow[i - 1] : '';
      
      if (char === '"' || char === "'") {
        if (prevChar !== '\\') {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes) {
        if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
        } else if (char === ',' && parenDepth === 0) {
          if (current.trim()) {
            shadows.push(current.trim());
          }
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      shadows.push(current.trim());
    }
    
    return shadows;
  }

  private parseFilterValue(value: string, defaultUnit: string): number {
    const match = value.match(/^([\d.]+)(.*)?$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2] || defaultUnit;
    
    // Convert units to pixels
    switch (unit) {
      case 'em': return num * 16; // Assume 16px base
      case 'rem': return num * 16;
      case '%': return num; // Context-dependent
      default: return num; // Assume pixels
    }
  }

  private parseColor(color: string): RGBA | null {
    if (!color) return null;

    const trimmed = color.trim();

    // Hex colors
    if (trimmed.startsWith('#')) {
      return this.parseHexColor(trimmed);
    }

    // RGB/RGBA colors
    if (trimmed.startsWith('rgb')) {
      return this.parseRGBColor(trimmed);
    }

    // HSL colors
    if (trimmed.startsWith('hsl')) {
      return this.parseHSLColor(trimmed);
    }

    // Named colors
    return this.parseNamedColor(trimmed);
  }

  private parseHexColor(hex: string): RGBA | null {
    const clean = hex.replace('#', '');
    
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) / 255;
      const g = parseInt(clean[1] + clean[1], 16) / 255;
      const b = parseInt(clean[2] + clean[2], 16) / 255;
      return { r, g, b, a: 1 };
    }
    
    if (clean.length === 6) {
      const r = parseInt(clean.substr(0, 2), 16) / 255;
      const g = parseInt(clean.substr(2, 2), 16) / 255;
      const b = parseInt(clean.substr(4, 2), 16) / 255;
      return { r, g, b, a: 1 };
    }
    
    if (clean.length === 8) {
      const r = parseInt(clean.substr(0, 2), 16) / 255;
      const g = parseInt(clean.substr(2, 2), 16) / 255;
      const b = parseInt(clean.substr(4, 2), 16) / 255;
      const a = parseInt(clean.substr(6, 2), 16) / 255;
      return { r, g, b, a };
    }
    
    return null;
  }

  private parseRGBColor(rgb: string): RGBA | null {
    const values = rgb.match(/[\d.]+/g);
    if (!values || values.length < 3) return null;
    
    const r = parseFloat(values[0]) / 255;
    const g = parseFloat(values[1]) / 255;
    const b = parseFloat(values[2]) / 255;
    const a = values.length >= 4 ? parseFloat(values[3]) : 1;
    
    return { r, g, b, a: a > 1 ? a / 255 : a };
  }

  private parseHSLColor(hsl: string): RGBA | null {
    const values = hsl.match(/[\d.]+/g);
    if (!values || values.length < 3) return null;
    
    const h = parseFloat(values[0]) / 360;
    const s = parseFloat(values[1]) / 100;
    const l = parseFloat(values[2]) / 100;
    const a = values.length >= 4 ? parseFloat(values[3]) : 1;
    
    return this.hslToRgb(h, s, l, a);
  }

  private parseNamedColor(name: string): RGBA | null {
    const namedColors: Record<string, string> = {
      'transparent': '#00000000',
      'black': '#000000',
      'white': '#ffffff',
      'red': '#ff0000',
      'green': '#008000',
      'blue': '#0000ff',
      'yellow': '#ffff00',
      'cyan': '#00ffff',
      'magenta': '#ff00ff',
      'silver': '#c0c0c0',
      'gray': '#808080'
    };
    
    const hex = namedColors[name.toLowerCase()];
    return hex ? this.parseHexColor(hex) : null;
  }

  private hslToRgb(h: number, s: number, l: number, a: number): RGBA {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return { r, g, b, a };
  }
}

interface FilterFunction {
  name: string;
  value: string;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}