/**
 * ENHANCED EFFECTS PARSING FOR IR
 *
 * Comprehensive CSS effects parser for box-shadow, text-shadow, filter, backdrop-filter
 * Converts CSS effects to IR format for optimal Figma mapping
 */
/**
 * Parse CSS effects (shadows, filters, backdrop-filters) into IR format
 */
export declare function parseEffectsToIR(styles: any): any;
/**
 * Enhanced text shadow parsing that includes position and blur detection
 */
export declare function analyzeTextShadowComplexity(textShadow: string): {
    hasBlur: boolean;
    hasOffset: boolean;
    shadowCount: number;
    maxBlur: number;
};
/**
 * Detect if filters require special handling
 */
export declare function analyzeFilterComplexity(filter: string): {
    hasBlur: boolean;
    hasTransform: boolean;
    filterCount: number;
    unsupportedFilters: string[];
};
//# sourceMappingURL=effects-parser.d.ts.map