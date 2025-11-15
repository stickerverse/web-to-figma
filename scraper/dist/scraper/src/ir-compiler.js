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
/**
 * Main IR Compilation Entry Point
 */
export function compileIR(document) {
    console.log("[IR Compiler] Starting IR compilation...");
    const startTime = Date.now();
    // Initialize compilation context
    const context = {
        stackingContexts: new Map(),
        paintOrder: [],
        worldTransforms: new Map(),
        pseudoNodes: [],
        processedNodes: new Set()
    };
    // Step 1: Analyze and build stacking contexts
    console.log("[IR Compiler] Step 1: Building stacking contexts...");
    buildStackingContexts(document.nodes, context);
    // Step 2: Flatten DOM tree with stable ordering
    console.log("[IR Compiler] Step 2: Flattening DOM tree...");
    const flattenedNodes = flattenDOMTree(document.nodes, context);
    // Step 3: Normalize coordinates to world space
    console.log("[IR Compiler] Step 3: Normalizing coordinates...");
    const normalizedNodes = normalizeCoordinates(flattenedNodes, context);
    // Step 4: Apply layout resolution
    console.log("[IR Compiler] Step 4: Applying layout resolution...");
    const layoutResolvedNodes = applyLayoutResolution(normalizedNodes, context);
    // Step 5: Attach pseudo nodes in correct paint order
    console.log("[IR Compiler] Step 5: Attaching pseudo nodes...");
    const nodesWithPseudos = attachPseudoNodes(layoutResolvedNodes, context);
    // Step 6: Normalize styles
    console.log("[IR Compiler] Step 6: Normalizing styles...");
    const styleNormalizedNodes = normalizeStyles(nodesWithPseudos, context);
    // Step 7: Strip internal fields for clean IR
    console.log("[IR Compiler] Step 7: Cleaning IR output...");
    const cleanNodes = stripInternalFields(styleNormalizedNodes);
    // Build compiled document with compiler metadata in phases
    const compilerInfo = `compiler-v1.0.0-${Date.now() - startTime}ms`;
    const updatedPhases = document.meta.phases + `,${compilerInfo}`;
    const compiledDocument = {
        ...document,
        nodes: cleanNodes,
        meta: {
            ...document.meta,
            phases: updatedPhases,
            extractionDuration: (document.meta.extractionDuration || 0) + (Date.now() - startTime)
        }
    };
    console.log(`[IR Compiler] ✅ Compilation complete (${Date.now() - startTime}ms)`);
    console.log(`[IR Compiler] Processed ${cleanNodes.length} nodes with ${context.stackingContexts.size} stacking contexts`);
    return compiledDocument;
}
/**
 * Step 1: Build Stacking Contexts
 */
function buildStackingContexts(nodes, context) {
    const stackingMap = new Map();
    // Identify all stacking contexts
    for (const node of nodes) {
        if (isStackingContext(node)) {
            const stackingContext = {
                id: node.id,
                nodeIds: [node.id],
                zIndex: getEffectiveZIndex(node),
                children: []
            };
            stackingMap.set(node.id, stackingContext);
        }
    }
    // Build hierarchy and collect child nodes
    for (const node of nodes) {
        const parentContext = findParentStackingContext(node, nodes, stackingMap);
        if (parentContext) {
            if (!stackingMap.has(node.id)) {
                parentContext.nodeIds.push(node.id);
            }
            else {
                const childContext = stackingMap.get(node.id);
                childContext.parentContextId = parentContext.id;
                parentContext.children.push(childContext);
            }
        }
    }
    context.stackingContexts = stackingMap;
    // Generate paint order from stacking contexts
    generatePaintOrder(stackingMap, context);
}
/**
 * Check if node creates a stacking context
 */
function isStackingContext(node) {
    const styles = node.styles;
    if (!styles)
        return false;
    // Root element
    if (node.tag === 'html')
        return true;
    // Position fixed/sticky
    if (styles.position === 'fixed' || styles.position === 'sticky')
        return true;
    // Positioned with z-index
    if ((styles.position === 'absolute' || styles.position === 'relative') &&
        styles.zIndex !== undefined && styles.zIndex !== 'auto') {
        return true;
    }
    // Flex/grid items with z-index
    if (styles.zIndex !== undefined && styles.zIndex !== 'auto') {
        return true; // Need to check parent's display mode
    }
    // Opacity < 1
    if (styles.opacity !== undefined && parseFloat(styles.opacity) < 1)
        return true;
    // Transform
    if (styles.transform && styles.transform !== 'none')
        return true;
    // Filter
    if (styles.filter && styles.filter !== 'none')
        return true;
    // Isolation
    if (styles.isolation === 'isolate')
        return true;
    // Mix-blend-mode
    if (styles.mixBlendMode && styles.mixBlendMode !== 'normal')
        return true;
    // Clip-path
    if (styles.clipPath && styles.clipPath !== 'none')
        return true;
    // Mask
    if (styles.mask && styles.mask !== 'none')
        return true;
    // Will-change
    if (styles.willChange && styles.willChange !== 'auto')
        return true;
    return false;
}
/**
 * Get effective z-index value
 */
function getEffectiveZIndex(node) {
    const styles = node.styles;
    if (!styles || !styles.zIndex || styles.zIndex === 'auto') {
        return 0;
    }
    const parsed = parseInt(styles.zIndex.toString());
    return isNaN(parsed) ? 0 : parsed;
}
/**
 * Find parent stacking context for a node
 */
function findParentStackingContext(node, allNodes, stackingMap) {
    // Find the nearest ancestor that creates a stacking context
    let currentNode = node;
    while (currentNode.parent) {
        const parentNode = allNodes.find(n => n.id === currentNode.parent);
        if (!parentNode)
            break;
        if (stackingMap.has(parentNode.id)) {
            return stackingMap.get(parentNode.id);
        }
        currentNode = parentNode;
    }
    // Default to root stacking context
    const rootContext = Array.from(stackingMap.values()).find(ctx => !ctx.parentContextId);
    return rootContext || null;
}
/**
 * Generate paint order from stacking contexts
 */
function generatePaintOrder(stackingMap, context) {
    const paintOrder = [];
    // Sort stacking contexts by z-index
    const sortedContexts = Array.from(stackingMap.values()).sort((a, b) => {
        if (a.zIndex !== b.zIndex) {
            return a.zIndex - b.zIndex;
        }
        return 0; // Maintain document order for same z-index
    });
    // Add nodes in stacking order
    for (const stackingContext of sortedContexts) {
        paintOrder.push(...stackingContext.nodeIds);
    }
    context.paintOrder = paintOrder;
}
/**
 * Step 2: Flatten DOM Tree
 */
function flattenDOMTree(nodes, context) {
    const flattened = [];
    const processedSet = new Set();
    // Process nodes in paint order
    for (const nodeId of context.paintOrder) {
        const node = nodes.find(n => n.id === nodeId);
        if (node && !processedSet.has(nodeId)) {
            flattened.push({ ...node });
            processedSet.add(nodeId);
        }
    }
    // Add any remaining nodes not in paint order
    for (const node of nodes) {
        if (!processedSet.has(node.id)) {
            flattened.push({ ...node });
            processedSet.add(node.id);
        }
    }
    return flattened;
}
/**
 * Step 3: Normalize Coordinates
 */
function normalizeCoordinates(nodes, context) {
    // Build world transform map
    buildWorldTransforms(nodes, context);
    return nodes.map(node => {
        const normalizedNode = { ...node };
        // Apply world transform to coordinates
        if (normalizedNode.layout?.viewport) {
            const transform = context.worldTransforms.get(node.id) || [1, 0, 0, 0, 1, 0];
            const viewport = normalizedNode.layout.viewport;
            const worldCoords = applyTransform(viewport.x, viewport.y, transform);
            viewport.x = Math.round(worldCoords.x);
            viewport.y = Math.round(worldCoords.y);
        }
        else if (normalizedNode.rect) {
            // Fallback to rect for legacy compatibility
            const transform = context.worldTransforms.get(node.id) || [1, 0, 0, 0, 1, 0];
            const worldCoords = applyTransform(normalizedNode.rect.x, normalizedNode.rect.y, transform);
            normalizedNode.rect.x = Math.round(worldCoords.x);
            normalizedNode.rect.y = Math.round(worldCoords.y);
        }
        return normalizedNode;
    });
}
/**
 * Build world transforms for all nodes
 */
function buildWorldTransforms(nodes, context) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const node of nodes) {
        const worldTransform = calculateWorldTransform(node, nodeMap);
        context.worldTransforms.set(node.id, worldTransform);
    }
}
/**
 * Calculate world transform for a node
 */
function calculateWorldTransform(node, nodeMap) {
    let transform = node.worldTransform || [1, 0, 0, 0, 1, 0];
    // Accumulate parent transforms
    let current = node;
    while (current.parent) {
        const parent = nodeMap.get(current.parent);
        if (!parent)
            break;
        const parentTransform = parent.worldTransform || [1, 0, 0, 0, 1, 0];
        transform = multiplyTransforms(parentTransform, transform);
        current = parent;
    }
    return transform;
}
/**
 * Apply transform to coordinates
 */
function applyTransform(x, y, transform) {
    const [a, b, c, d, e, f] = transform;
    return {
        x: a * x + c * y + e,
        y: b * x + d * y + f
    };
}
/**
 * Multiply two transform matrices
 */
function multiplyTransforms(a, b) {
    const [a1, b1, c1, d1, e1, f1] = a;
    const [a2, b2, c2, d2, e2, f2] = b;
    return [
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2,
        e1 * b2 + f1 * d2 + f2
    ];
}
/**
 * Step 4: Apply Layout Resolution
 */
function applyLayoutResolution(nodes, context) {
    return nodes.map(node => {
        const resolvedNode = { ...node };
        // Resolve flex layout
        if (resolvedNode.styles?.display?.includes('flex')) {
            resolvedNode.layout = resolveFlexLayout(resolvedNode, nodes);
        }
        // Resolve grid layout
        if (resolvedNode.styles?.display?.includes('grid')) {
            resolvedNode.layout = resolveGridLayout(resolvedNode, nodes);
        }
        // Apply box model corrections
        resolvedNode.layout = applyBoxModel(resolvedNode);
        return resolvedNode;
    });
}
/**
 * Resolve flex layout into final rect values
 */
function resolveFlexLayout(node, allNodes) {
    const layout = { ...node.layout };
    // Check for legacy viewport or rect format
    const hasViewport = layout?.viewport;
    const hasRect = node.rect;
    if (!hasViewport && !hasRect) {
        return layout;
    }
    if (!node.styles) {
        return layout;
    }
    // Apply flex container properties
    const flexDirection = node.styles.flexDirection || 'row';
    const justifyContent = node.styles.justifyContent || 'flex-start';
    const alignItems = node.styles.alignItems || 'stretch';
    const gap = parseFloat(node.styles.gap || '0');
    // Find flex children
    const children = allNodes.filter(n => n.parent === node.id);
    // Calculate flex item positions
    if (children.length > 0) {
        let currentPosition = 0;
        const isRow = flexDirection === 'row' || flexDirection === 'row-reverse';
        children.forEach((child, index) => {
            const childViewport = child.layout?.viewport;
            const childRect = child.rect;
            if (childViewport && hasViewport) {
                const parentViewport = layout.viewport;
                if (isRow) {
                    childViewport.x = parentViewport.x + currentPosition;
                    currentPosition += childViewport.width + gap;
                }
                else {
                    childViewport.y = parentViewport.y + currentPosition;
                    currentPosition += childViewport.height + gap;
                }
            }
            else if (childRect && hasRect) {
                if (isRow) {
                    childRect.x = node.rect.x + currentPosition;
                    currentPosition += childRect.width + gap;
                }
                else {
                    childRect.y = node.rect.y + currentPosition;
                    currentPosition += childRect.height + gap;
                }
            }
        });
    }
    return layout;
}
/**
 * Resolve grid layout into final rect values
 */
function resolveGridLayout(node, allNodes) {
    const layout = { ...node.layout };
    // Check for legacy viewport or rect format
    const hasViewport = layout?.viewport;
    const hasRect = node.rect;
    if (!hasViewport && !hasRect) {
        return layout;
    }
    if (!node.styles) {
        return layout;
    }
    // Extract grid properties
    const gridTemplateColumns = node.styles.gridTemplateColumns;
    const gridTemplateRows = node.styles.gridTemplateRows;
    const gap = parseFloat(node.styles.gap || '0');
    // Find grid children
    const children = allNodes.filter(n => n.parent === node.id);
    // Calculate grid item positions (simplified)
    if (children.length > 0 && gridTemplateColumns) {
        const columns = parseGridTemplate(gridTemplateColumns);
        const rows = parseGridTemplate(gridTemplateRows || 'auto');
        children.forEach((child, index) => {
            const childViewport = child.layout?.viewport;
            const childRect = child.rect;
            if (childViewport && hasViewport) {
                const parentViewport = layout.viewport;
                const col = index % columns.length;
                const row = Math.floor(index / columns.length);
                childViewport.x = parentViewport.x + (col * (parentViewport.width / columns.length));
                childViewport.y = parentViewport.y + (row * (parentViewport.height / Math.max(1, rows.length)));
            }
            else if (childRect && hasRect) {
                const col = index % columns.length;
                const row = Math.floor(index / columns.length);
                childRect.x = node.rect.x + (col * (node.rect.width / columns.length));
                childRect.y = node.rect.y + (row * (node.rect.height / Math.max(1, rows.length)));
            }
        });
    }
    return layout;
}
/**
 * Parse grid template (simplified)
 */
function parseGridTemplate(template) {
    if (!template || template === 'none')
        return [1];
    // Simple fraction parsing
    const parts = template.split(' ');
    return parts.map((part, index) => {
        if (part.includes('fr')) {
            return parseFloat(part);
        }
        return 1;
    });
}
/**
 * Apply box model corrections
 */
function applyBoxModel(node) {
    const layout = { ...node.layout };
    if (!node.styles) {
        return layout;
    }
    // Check for legacy viewport or rect format
    const hasViewport = layout?.viewport;
    const hasRect = node.rect;
    if (!hasViewport && !hasRect) {
        return layout;
    }
    // Apply padding
    const paddingTop = parseFloat(node.styles.paddingTop || '0');
    const paddingLeft = parseFloat(node.styles.paddingLeft || '0');
    const paddingBottom = parseFloat(node.styles.paddingBottom || '0');
    const paddingRight = parseFloat(node.styles.paddingRight || '0');
    // Apply border
    const borderTopWidth = parseFloat(node.styles.borderTopWidth || '0');
    const borderLeftWidth = parseFloat(node.styles.borderLeftWidth || '0');
    const borderBottomWidth = parseFloat(node.styles.borderBottomWidth || '0');
    const borderRightWidth = parseFloat(node.styles.borderRightWidth || '0');
    // Adjust content area
    if (hasViewport) {
        const viewport = layout.viewport;
        layout.contentBox = {
            x: viewport.x + paddingLeft + borderLeftWidth,
            y: viewport.y + paddingTop + borderTopWidth,
            width: viewport.width - paddingLeft - paddingRight - borderLeftWidth - borderRightWidth,
            height: viewport.height - paddingTop - paddingBottom - borderTopWidth - borderBottomWidth
        };
    }
    return layout;
}
/**
 * Step 5: Attach Pseudo Nodes
 */
function attachPseudoNodes(nodes, context) {
    // Find all pseudo nodes
    const pseudoNodes = nodes.filter(node => node.tag?.includes('pseudo-') || node.selector?.includes('::'));
    const regularNodes = nodes.filter(node => !node.tag?.includes('pseudo-') && !node.selector?.includes('::'));
    context.pseudoNodes = pseudoNodes;
    // Insert pseudo nodes in correct paint order
    const result = [];
    for (const node of regularNodes) {
        // Add ::before pseudo elements first
        const beforePseudos = pseudoNodes.filter(p => p.parent === node.id && p.selector?.includes('::before'));
        result.push(...beforePseudos);
        // Add the main node
        result.push(node);
        // Add ::after pseudo elements last
        const afterPseudos = pseudoNodes.filter(p => p.parent === node.id && p.selector?.includes('::after'));
        result.push(...afterPseudos);
    }
    // Add any remaining pseudo nodes
    const attachedPseudoIds = new Set(result.filter(n => n.tag?.includes('pseudo-')).map(n => n.id));
    const remainingPseudos = pseudoNodes.filter(p => !attachedPseudoIds.has(p.id));
    result.push(...remainingPseudos);
    return result;
}
/**
 * Step 6: Normalize Styles
 */
function normalizeStyles(nodes, context) {
    return nodes.map(node => {
        const normalizedNode = { ...node };
        if (normalizedNode.styles) {
            normalizedNode.styles = normalizeStyleObject(normalizedNode.styles);
        }
        return normalizedNode;
    });
}
/**
 * Normalize individual style object
 */
function normalizeStyleObject(styles) {
    const normalized = { ...styles };
    // Normalize color values
    if (normalized.color) {
        normalized.color = normalizeColor(normalized.color);
    }
    if (normalized.backgroundColor) {
        normalized.backgroundColor = normalizeColor(normalized.backgroundColor);
    }
    // Normalize units
    ['width', 'height', 'top', 'left', 'right', 'bottom'].forEach(prop => {
        if (normalized[prop]) {
            normalized[prop] = normalizeUnit(normalized[prop]);
        }
    });
    // Normalize font values
    if (normalized.fontSize) {
        normalized.fontSize = normalizeUnit(normalized.fontSize);
    }
    // Normalize z-index
    if (normalized.zIndex && normalized.zIndex !== 'auto') {
        normalized.zIndex = parseInt(normalized.zIndex.toString()) || 0;
    }
    return normalized;
}
/**
 * Normalize color values
 */
function normalizeColor(color) {
    if (!color || color === 'transparent')
        return 'rgba(0, 0, 0, 0)';
    // Convert named colors, hex to rgba
    if (color.startsWith('#')) {
        return hexToRgba(color);
    }
    if (color.startsWith('rgb(') && !color.startsWith('rgba(')) {
        return color.replace('rgb(', 'rgba(').replace(')', ', 1)');
    }
    return color;
}
/**
 * Convert hex to rgba
 */
function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        return `rgba(${r}, ${g}, ${b}, 1)`;
    }
    return hex;
}
/**
 * Normalize unit values
 */
function normalizeUnit(value) {
    if (typeof value === 'number') {
        return `${value}px`;
    }
    const str = value.toString();
    if (/^\d+$/.test(str)) {
        return `${str}px`;
    }
    return str;
}
/**
 * Step 7: Strip Internal Fields
 */
function stripInternalFields(nodes) {
    return nodes.map(node => {
        const cleanNode = { ...node };
        // Remove internal compilation fields
        delete cleanNode.worldTransform;
        delete cleanNode.stackingContext;
        delete cleanNode.paintIndex;
        delete cleanNode.compilationMeta;
        // Clean up layout object
        if (cleanNode.layout) {
            const cleanLayout = { ...cleanNode.layout };
            delete cleanLayout.internal;
            delete cleanLayout.computedStyle;
            delete cleanLayout.rawBoundingRect;
            cleanNode.layout = cleanLayout;
        }
        // Clean up styles
        if (cleanNode.styles) {
            const cleanStyles = { ...cleanNode.styles };
            delete cleanStyles.internal;
            delete cleanStyles.computed;
            delete cleanStyles.raw;
            cleanNode.styles = cleanStyles;
        }
        return cleanNode;
    });
}
//# sourceMappingURL=ir-compiler.js.map