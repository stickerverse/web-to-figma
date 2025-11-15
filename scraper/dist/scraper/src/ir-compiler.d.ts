/**
 * RENDERING TREE COMPILER - IR Normalization & Flattening
 *
 * Transforms raw DOM-walk IR into normalized, Figma-ready IR with:
 * - Stable stacking context ordering
 * - World-space coordinate normalization
 * - Layout resolution (flex/grid/box model)
 * - Correct pseudo-element paint order
 * - Style normalization
 * - Clean IR output (stripped internal fields)
 */
import type { IRDocument } from "../../ir.js";
/**
 * Main IR Compilation Entry Point
 */
export declare function compileIR(document: IRDocument): IRDocument;
//# sourceMappingURL=ir-compiler.d.ts.map