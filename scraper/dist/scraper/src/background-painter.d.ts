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
import type { IRBackground } from "../../ir.js";
/**
 * Parse CSS background properties into IRBackground
 */
export declare function parseBackground(styles: any, imageAssets?: Map<string, string>): IRBackground | null;
//# sourceMappingURL=background-painter.d.ts.map