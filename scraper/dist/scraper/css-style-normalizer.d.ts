/**
 * CSS Style Normalizer
 *
 * Converts CSS shorthand properties to longhand for explicit, normalized IR values.
 * Ensures no ambiguous shorthands remain in the final IR representation.
 */
/**
 * Main CSS Style Normalizer class
 * Converts all CSS shorthands to explicit longhand properties
 */
export declare class CSSStyleNormalizer {
    private static readonly SHORTHAND_PROPERTIES;
    /**
     * Normalize a styles object by expanding all shorthand properties
     */
    static normalize(styles: Record<string, string>): NormalizedStyles;
    /**
     * Check if a property is a CSS shorthand
     */
    static isShorthand(property: string): boolean;
    private normalizeStyles;
    private expandProperty;
    private expandBoxSpacing;
    private parseSpacingValues;
    private expandBorder;
    private parseBorderValue;
    private expandSideBorder;
    private expandBorderRadius;
    private expandFont;
    private expandTextDecoration;
    private expandBackground;
    private expandFlex;
    private expandFlexFlow;
    private expandGap;
    private expandGrid;
    private expandGridArea;
    private expandGridTrack;
    private expandGridTemplate;
    private expandInset;
    private expandOverflow;
    private expandListStyle;
    private expandAnimation;
    private expandTransition;
    private expandOutline;
    private isBorderWidth;
    private isBorderStyle;
    private isColor;
    private isNamedColor;
    private isLength;
    private isNumber;
    private isTextDecorationLine;
    private isTextDecorationStyle;
    private isFlexDirection;
    private isFlexWrap;
    private isListStyleType;
    private isListStylePosition;
}
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
/**
 * Normalize styles and provide detailed analysis
 */
export declare function analyzeStyleNormalization(styles: Record<string, string>): StyleNormalizationReport;
/**
 * Quick check if a styles object contains any shorthand properties
 */
export declare function hasShorthands(styles: Record<string, string>): boolean;
/**
 * Get list of shorthand properties in a styles object
 */
export declare function getShorthandProperties(styles: Record<string, string>): string[];
/**
 * Merge multiple normalized style objects
 */
export declare function mergeNormalizedStyles(...normalizedStyles: NormalizedStyles[]): NormalizedStyles;
//# sourceMappingURL=css-style-normalizer.d.ts.map