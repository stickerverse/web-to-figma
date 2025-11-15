/**
 * MULTI-LAYER BACKGROUND PAINTER
 * 
 * Comprehensive CSS background parsing that handles:
 * - Multiple background layers in correct order
 * - Background images, gradients, and solid colors
 * - Background positioning, sizing, and repeat modes
 * - Background clipping, origin, and attachment
 * - Blend modes and composite operations
 * 
 * Outputs IRBackground compatible with Figma's paint system.
 */

import type { IRBackground, IRBackgroundLayer } from "../../ir.js";

/**
 * Parse CSS background properties into IRBackground
 */
export function parseBackground(styles: any, imageAssets?: Map<string, string>): IRBackground | null {
  if (!styles) return null;
  
  const layers: IRBackgroundLayer[] = [];
  
  // Parse background shorthand or individual properties
  const backgroundImage = styles.backgroundImage;
  const backgroundColor = styles.backgroundColor;
  
  // Parse background images (including gradients)
  if (backgroundImage && backgroundImage !== 'none') {
    const imageLayers = parseBackgroundImages(backgroundImage, styles, imageAssets);
    layers.push(...imageLayers);
  }
  
  // Add background color as the bottom layer
  if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
    const colorLayer = parseBackgroundColor(backgroundColor, styles);
    if (colorLayer) {
      layers.push(colorLayer);
    }
  }
  
  return layers.length > 0 ? { layers } : null;
}

/**
 * Parse background-image property (multiple images and gradients)
 */
function parseBackgroundImages(
  backgroundImage: string, 
  styles: any, 
  imageAssets?: Map<string, string>
): IRBackgroundLayer[] {
  const layers: IRBackgroundLayer[] = [];
  
  // Split multiple background images
  const imageDeclarations = splitBackgroundImages(backgroundImage);
  
  // Parse other background properties that might be multi-value
  const backgroundSizes = parseMultiValue(styles.backgroundSize);
  const backgroundPositions = parseMultiValue(styles.backgroundPosition);
  const backgroundRepeats = parseMultiValue(styles.backgroundRepeat);
  const backgroundAttachments = parseMultiValue(styles.backgroundAttachment);
  const backgroundOrigins = parseMultiValue(styles.backgroundOrigin);
  const backgroundClips = parseMultiValue(styles.backgroundClip);
  const backgroundBlendModes = parseMultiValue(styles.backgroundBlendMode);
  
  imageDeclarations.forEach((imageDecl, index) => {
    let layer: IRBackgroundLayer | null = null;
    
    if (imageDecl.includes('gradient(')) {
      // Parse gradient
      layer = parseGradient(imageDecl);
    } else if (imageDecl.includes('url(')) {
      // Parse image
      layer = parseBackgroundImageLayer(imageDecl, imageAssets);
    }
    
    if (layer) {
      // Apply layer-specific properties
      if (layer.type === 'image' && layer.image) {
        layer.image.size = getArrayValue(backgroundSizes, index, 'auto');
        layer.image.position = getArrayValue(backgroundPositions, index, '0% 0%');
        layer.image.repeat = getArrayValue(backgroundRepeats, index, 'repeat');
        layer.image.attachment = getArrayValue(backgroundAttachments, index, 'scroll');
        layer.image.origin = getArrayValue(backgroundOrigins, index, 'padding-box');
        layer.image.clip = getArrayValue(backgroundClips, index, 'border-box');
      }
      
      // Apply blend mode
      const blendMode = getArrayValue(backgroundBlendModes, index, 'normal');
      if (blendMode && blendMode !== 'normal') {
        layer.blendMode = blendMode;
      }
      
      layers.push(layer);
    }
  });
  
  return layers;
}

/**
 * Parse background color into IRBackgroundLayer
 */
function parseBackgroundColor(backgroundColor: string, styles?: any): IRBackgroundLayer | null {
  const color = parseColor(backgroundColor);
  if (!color) return null;
  
  return {
    type: 'color',
    color: {
      value: color.value,
      alpha: color.alpha
    }
  };
}

/**
 * Parse CSS gradient into IRBackgroundLayer
 */
function parseGradient(gradientString: string): IRBackgroundLayer | null {
  const gradientMatch = gradientString.match(/(linear|radial|conic)-gradient\\(([^)]+)\\)/);
  if (!gradientMatch) return null;
  
  const [, type, content] = gradientMatch;
  
  const layer: IRBackgroundLayer = {
    type: 'gradient',
    gradient: {
      type: type as 'linear' | 'radial' | 'conic',
      stops: []
    }
  };
  
  if (type === 'linear') {
    const { angle, stops } = parseLinearGradient(content);
    layer.gradient!.angle = angle;
    layer.gradient!.stops = stops;
  } else if (type === 'radial') {
    const { position, stops } = parseRadialGradient(content);
    layer.gradient!.position = position;
    layer.gradient!.stops = stops;
  } else if (type === 'conic') {
    const { angle, position, stops } = parseConicGradient(content);
    layer.gradient!.angle = angle;
    layer.gradient!.position = position;
    layer.gradient!.stops = stops;
  }
  
  return layer;
}

/**
 * Parse linear gradient parameters
 */
function parseLinearGradient(content: string): { angle: number; stops: Array<{color: string; position: number}> } {
  let angle = 180; // Default to bottom (180deg)
  let stopsString = content;
  
  // Check for angle or direction
  const angleMatch = content.match(/^(\\d+(?:\\.\\d+)?)(deg|grad|rad|turn)/);
  const directionMatch = content.match(/^(to\\s+(?:top|bottom|left|right)(?:\\s+(?:left|right|top|bottom))?)/);
  
  if (angleMatch) {
    const [fullMatch, value, unit] = angleMatch;
    angle = convertAngleToDegrees(parseFloat(value), unit);
    stopsString = content.substring(fullMatch.length).replace(/^\\s*,\\s*/, '');
  } else if (directionMatch) {
    angle = directionToAngle(directionMatch[1]);
    stopsString = content.substring(directionMatch[0].length).replace(/^\\s*,\\s*/, '');
  }
  
  const stops = parseColorStops(stopsString);
  
  return { angle, stops };
}

/**
 * Parse radial gradient parameters
 */
function parseRadialGradient(content: string): { position: string; stops: Array<{color: string; position: number}> } {
  let position = 'center';
  let stopsString = content;
  
  // Check for position/size specification
  const positionMatch = content.match(/^(?:(circle|ellipse)\\s+)?(?:at\\s+([^,]+))?/);
  if (positionMatch && positionMatch[0].trim()) {
    if (positionMatch[2]) {
      position = positionMatch[2].trim();
    }
    stopsString = content.substring(positionMatch[0].length).replace(/^\\s*,\\s*/, '');
  }
  
  const stops = parseColorStops(stopsString);
  
  return { position, stops };
}

/**
 * Parse conic gradient parameters
 */
function parseConicGradient(content: string): { angle: number; position: string; stops: Array<{color: string; position: number}> } {
  let angle = 0;
  let position = 'center';
  let stopsString = content;
  
  // Check for angle and position
  const paramMatch = content.match(/^(?:from\\s+(\\d+(?:\\.\\d+)?)(deg|grad|rad|turn))?(?:\\s+at\\s+([^,]+))?/);
  if (paramMatch && paramMatch[0].trim()) {
    if (paramMatch[1]) {
      angle = convertAngleToDegrees(parseFloat(paramMatch[1]), paramMatch[2]);
    }
    if (paramMatch[3]) {
      position = paramMatch[3].trim();
    }
    stopsString = content.substring(paramMatch[0].length).replace(/^\\s*,\\s*/, '');
  }
  
  const stops = parseColorStops(stopsString);
  
  return { angle, position, stops };
}

/**
 * Parse color stops from gradient string
 */
function parseColorStops(stopsString: string): Array<{color: string; position: number}> {
  const stops: Array<{color: string; position: number}> = [];
  
  // Split on commas, being careful of nested functions
  const colorStops = splitColorStops(stopsString);
  
  colorStops.forEach((stop, index) => {
    const stopMatch = stop.trim().match(/^(.+?)(?:\\s+(\\d+(?:\\.\\d+)?%?))?$/);
    if (stopMatch) {
      const colorValue = stopMatch[1].trim();
      const positionValue = stopMatch[2];
      
      let position = index / Math.max(1, colorStops.length - 1); // Even distribution by default
      if (positionValue) {
        if (positionValue.endsWith('%')) {
          position = parseFloat(positionValue) / 100;
        } else {
          position = parseFloat(positionValue);
        }
      }
      
      const color = parseColor(colorValue);
      if (color) {
        stops.push({
          color: color.value,
          position: Math.max(0, Math.min(1, position))
        });
      }
    }
  });
  
  return stops;
}

/**
 * Parse background image URL into IRBackgroundLayer
 */
function parseBackgroundImageLayer(imageDecl: string, imageAssets?: Map<string, string>): IRBackgroundLayer | null {
  const urlMatch = imageDecl.match(/url\\(['"]?([^'"()]+)['"]?\\)/);
  if (!urlMatch) return null;
  
  const imageUrl = urlMatch[1];
  const imageRef = imageAssets?.get(imageUrl) || imageUrl;
  
  return {
    type: 'image',
    image: {
      imageRef,
      size: 'auto',
      position: '0% 0%',
      repeat: 'repeat',
      attachment: 'scroll',
      origin: 'padding-box',
      clip: 'border-box'
    }
  };
}

/**
 * Parse CSS color value
 */
function parseColor(colorValue: string): { value: string; alpha: number } | null {
  if (!colorValue || colorValue === 'transparent') {
    return { value: 'rgba(0, 0, 0, 0)', alpha: 0 };
  }
  
  // RGB/RGBA
  const rgbaMatch = colorValue.match(/rgba?\\((\\d+(?:\\.\\d+)?%?)\\s*,\\s*(\\d+(?:\\.\\d+)?%?)\\s*,\\s*(\\d+(?:\\.\\d+)?%?)(?:\\s*,\\s*(\\d+(?:\\.\\d+)?))?\\)/);
  if (rgbaMatch) {
    const r = parseColorComponent(rgbaMatch[1]);
    const g = parseColorComponent(rgbaMatch[2]);
    const b = parseColorComponent(rgbaMatch[3]);
    const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
    
    return {
      value: `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`,
      alpha: a
    };
  }
  
  // HSL/HSLA
  const hslaMatch = colorValue.match(/hsla?\\((\\d+(?:\\.\\d+)?)\\s*,\\s*(\\d+(?:\\.\\d+)?%?)\\s*,\\s*(\\d+(?:\\.\\d+)?%?)(?:\\s*,\\s*(\\d+(?:\\.\\d+)?))?\\)/);
  if (hslaMatch) {
    const h = parseFloat(hslaMatch[1]);
    const s = parseFloat(hslaMatch[2].replace('%', '')) / 100;
    const l = parseFloat(hslaMatch[3].replace('%', '')) / 100;
    const a = hslaMatch[4] ? parseFloat(hslaMatch[4]) : 1;
    
    const rgb = hslToRgb(h / 360, s, l);
    return {
      value: `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})`,
      alpha: a
    };
  }
  
  // Hex colors
  const hexMatch = colorValue.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { value: `rgba(${r}, ${g}, ${b}, 1)`, alpha: 1 };
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { value: `rgba(${r}, ${g}, ${b}, 1)`, alpha: 1 };
    }
  }
  
  // Named colors (simplified - just pass through for now)
  const namedColors: Record<string, string> = {
    'black': 'rgba(0, 0, 0, 1)',
    'white': 'rgba(255, 255, 255, 1)',
    'red': 'rgba(255, 0, 0, 1)',
    'green': 'rgba(0, 128, 0, 1)',
    'blue': 'rgba(0, 0, 255, 1)',
    'transparent': 'rgba(0, 0, 0, 0)'
  };
  
  const namedColor = namedColors[colorValue.toLowerCase()];
  if (namedColor) {
    return { value: namedColor, alpha: namedColor.includes('0, 0)') ? 0 : 1 };
  }
  
  return { value: colorValue, alpha: 1 };
}

// Helper functions

function splitBackgroundImages(backgroundImage: string): string[] {
  const images: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < backgroundImage.length; i++) {
    const char = backgroundImage[i];
    
    if ((char === '"' || char === "'") && backgroundImage[i - 1] !== '\\\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
    }
    
    if (!inQuotes) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    
    if (!inQuotes && char === ',' && depth === 0) {
      images.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    images.push(current.trim());
  }
  
  return images;
}

function splitColorStops(stopsString: string): string[] {
  const stops: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < stopsString.length; i++) {
    const char = stopsString[i];
    
    if ((char === '"' || char === "'") && stopsString[i - 1] !== '\\\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
    }
    
    if (!inQuotes) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    
    if (!inQuotes && char === ',' && depth === 0) {
      stops.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    stops.push(current.trim());
  }
  
  return stops;
}

function parseMultiValue(value: string | undefined): string[] {
  if (!value) return [''];
  return value.split(',').map(v => v.trim());
}

function getArrayValue(array: string[], index: number, defaultValue: string): string {
  return array[index] || array[array.length - 1] || defaultValue;
}

function convertAngleToDegrees(value: number, unit: string): number {
  switch (unit) {
    case 'grad': return value * 0.9;
    case 'rad': return value * (180 / Math.PI);
    case 'turn': return value * 360;
    default: return value; // deg
  }
}

function directionToAngle(direction: string): number {
  switch (direction.toLowerCase()) {
    case 'to top': return 0;
    case 'to top right': return 45;
    case 'to right': return 90;
    case 'to bottom right': return 135;
    case 'to bottom': return 180;
    case 'to bottom left': return 225;
    case 'to left': return 270;
    case 'to top left': return 315;
    default: return 180;
  }
}

function parseColorComponent(component: string): number {
  if (component.endsWith('%')) {
    return (parseFloat(component) / 100) * 255;
  }
  return parseFloat(component);
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 1/6) {
    [r, g, b] = [c, x, 0];
  } else if (h >= 1/6 && h < 2/6) {
    [r, g, b] = [x, c, 0];
  } else if (h >= 2/6 && h < 3/6) {
    [r, g, b] = [0, c, x];
  } else if (h >= 3/6 && h < 4/6) {
    [r, g, b] = [0, x, c];
  } else if (h >= 4/6 && h < 5/6) {
    [r, g, b] = [x, 0, c];
  } else if (h >= 5/6 && h < 1) {
    [r, g, b] = [c, 0, x];
  }
  
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255
  };
}