/**
 * ENHANCED EFFECTS PARSING FOR IR
 * 
 * Comprehensive CSS effects parser for box-shadow, text-shadow, filter, backdrop-filter
 * Converts CSS effects to IR format for optimal Figma mapping
 */

/**
 * Parse CSS effects (shadows, filters, backdrop-filters) into IR format
 */
export function parseEffectsToIR(styles: any): any {
  const effects: any = {
    opacity: parseFloat(styles.opacity) || 1,
  };

  // Parse box shadows
  if (styles.boxShadow && styles.boxShadow !== "none") {
    effects.shadows = parseBoxShadowToIR(styles.boxShadow);
  }

  // Parse text shadows (for text nodes)
  if (styles.textShadow && styles.textShadow !== "none") {
    const textShadows = parseTextShadowToIR(styles.textShadow);
    if (!effects.shadows) effects.shadows = [];
    effects.shadows.push(...textShadows);
  }

  // Parse CSS filters
  if (styles.filter && styles.filter !== "none") {
    effects.filters = parseFiltersToIR(styles.filter);
  }

  // Parse backdrop filters
  if (styles.backdropFilter && styles.backdropFilter !== "none") {
    effects.backdropFilters = parseBackdropFiltersToIR(styles.backdropFilter);
  }

  // Parse blend mode
  if (styles.mixBlendMode && styles.mixBlendMode !== "normal") {
    effects.blendMode = styles.mixBlendMode;
  }

  return Object.keys(effects).length > 1 ? effects : undefined;
}

/**
 * Parse CSS box-shadow into IR shadow format
 */
function parseBoxShadowToIR(boxShadow: string): any[] {
  const shadows: any[] = [];
  const shadowStrings = splitCSSValue(boxShadow);

  for (const shadowStr of shadowStrings) {
    const shadow = parseSingleShadow(shadowStr.trim(), "box");
    if (shadow) shadows.push(shadow);
  }

  return shadows;
}

/**
 * Parse CSS text-shadow into IR shadow format
 */
function parseTextShadowToIR(textShadow: string): any[] {
  const shadows: any[] = [];
  const shadowStrings = splitCSSValue(textShadow);

  for (const shadowStr of shadowStrings) {
    const shadow = parseSingleShadow(shadowStr.trim(), "text");
    if (shadow) shadows.push(shadow);
  }

  return shadows;
}

/**
 * Parse a single shadow (box or text) into IR format
 */
function parseSingleShadow(shadowStr: string, type: "box" | "text"): any | null {
  try {
    const isInset = shadowStr.startsWith("inset");
    const cleanShadow = isInset ? shadowStr.substring(5).trim() : shadowStr;

    // Parse: offset-x offset-y blur-radius [spread-radius] color
    // More robust regex that handles various formats
    const match = cleanShadow.match(
      /(-?[\d.]+(?:px|em|rem|%)?)\s+(-?[\d.]+(?:px|em|rem|%)?)\s+([\d.]+(?:px|em|rem|%)?)\s*(?:([\d.]+(?:px|em|rem|%)?)\s+)?(.+)/
    );

    if (!match) return null;

    const offsetX = parseFloat(match[1]);
    const offsetY = parseFloat(match[2]);
    const blurRadius = parseFloat(match[3]);
    const spreadRadius = match[4] ? parseFloat(match[4]) : (type === "text" ? undefined : 0);
    const colorStr = match[5].trim();

    return {
      type,
      offsetX,
      offsetY,
      blurRadius,
      spreadRadius,
      color: colorStr,
      inset: isInset
    };
  } catch (error) {
    console.warn(`Failed to parse shadow: ${shadowStr}`, error);
    return null;
  }
}

/**
 * Parse CSS filter functions into IR format
 */
function parseFiltersToIR(filter: string): any[] {
  const filters: any[] = [];
  const filterFunctions = parseFilterFunctions(filter);

  for (const func of filterFunctions) {
    filters.push({
      type: func.name,
      value: func.value
    });
  }

  return filters;
}

/**
 * Parse CSS backdrop-filter functions into IR format
 */
function parseBackdropFiltersToIR(backdropFilter: string): any[] {
  const filters: any[] = [];
  const filterFunctions = parseFilterFunctions(backdropFilter);

  for (const func of filterFunctions) {
    filters.push({
      type: func.name,
      value: func.value
    });
  }

  return filters;
}

/**
 * Extract filter functions from a CSS filter string
 */
function parseFilterFunctions(filterStr: string): Array<{name: string; value: string}> {
  const functions: Array<{name: string; value: string}> = [];
  const regex = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(filterStr)) !== null) {
    functions.push({
      name: match[1],
      value: match[2]
    });
  }

  return functions;
}

/**
 * Split CSS value by commas, respecting parentheses and quotes
 */
function splitCSSValue(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const prevChar = i > 0 ? value[i - 1] : '';

    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
    } else if (!inQuotes) {
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      } else if (char === ',' && parenDepth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Enhanced text shadow parsing that includes position and blur detection
 */
export function analyzeTextShadowComplexity(textShadow: string): {
  hasBlur: boolean;
  hasOffset: boolean;
  shadowCount: number;
  maxBlur: number;
} {
  if (!textShadow || textShadow === "none") {
    return { hasBlur: false, hasOffset: false, shadowCount: 0, maxBlur: 0 };
  }

  const shadows = splitCSSValue(textShadow);
  let maxBlur = 0;
  let hasBlur = false;
  let hasOffset = false;

  for (const shadowStr of shadows) {
    const shadow = parseSingleShadow(shadowStr.trim(), "text");
    if (shadow) {
      if (shadow.blurRadius > 0) {
        hasBlur = true;
        maxBlur = Math.max(maxBlur, shadow.blurRadius);
      }
      if (shadow.offsetX !== 0 || shadow.offsetY !== 0) {
        hasOffset = true;
      }
    }
  }

  return {
    hasBlur,
    hasOffset,
    shadowCount: shadows.length,
    maxBlur
  };
}

/**
 * Detect if filters require special handling
 */
export function analyzeFilterComplexity(filter: string): {
  hasBlur: boolean;
  hasTransform: boolean;
  filterCount: number;
  unsupportedFilters: string[];
} {
  if (!filter || filter === "none") {
    return { hasBlur: false, hasTransform: false, filterCount: 0, unsupportedFilters: [] };
  }

  const functions = parseFilterFunctions(filter);
  const supportedFilters = ['blur', 'brightness', 'contrast', 'drop-shadow', 'grayscale', 
                           'hue-rotate', 'invert', 'opacity', 'saturate', 'sepia'];
  
  let hasBlur = false;
  let hasTransform = false;
  const unsupportedFilters: string[] = [];

  for (const func of functions) {
    if (func.name === 'blur') {
      hasBlur = true;
    }
    if (['hue-rotate', 'saturate', 'brightness', 'contrast'].includes(func.name)) {
      hasTransform = true;
    }
    if (!supportedFilters.includes(func.name)) {
      unsupportedFilters.push(func.name);
    }
  }

  return {
    hasBlur,
    hasTransform,
    filterCount: functions.length,
    unsupportedFilters
  };
}