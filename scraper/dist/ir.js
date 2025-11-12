/**
 * FINAL INTERMEDIATE REPRESENTATION (IR) - ALL PHASES
 *
 * Complete type definitions for web-to-Figma data exchange
 */
// Type guards
export function isTextNode(node) {
    return node.type === 'TEXT' && !!node.text;
}
export function isImageNode(node) {
    return node.type === 'IMAGE' && !!node.image;
}
export function isSVGNode(node) {
    return node.type === 'SVG' && !!node.svg;
}
export function isFrameNode(node) {
    return node.type === 'FRAME' && node.children.length > 0;
}
export function hasScreenshot(node) {
    return !!node.screenshot;
}
export function hasStates(node) {
    return !!node.states && Object.keys(node.states).length > 0;
}
export function hasPseudoElements(node) {
    return !!node.pseudoElements && node.pseudoElements.length > 0;
}
//# sourceMappingURL=ir.js.map