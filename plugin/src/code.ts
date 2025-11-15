/// <reference types="@figma/plugin-typings" />

/**
 * FINAL WEB-TO-FIGMA PLUGIN - ALL PHASES (1-6) + HIERARCHY FIX
 *
 * Features:
 * - Phase 1: Extended CSS application, comprehensive property mapping
 * - Phase 2: Font extraction, mapping, and loading
 * - Phase 3: Hybrid rendering with screenshots
 * - Phase 4: SVG handling and conversion
 * - Phase 5: Advanced effects (gradients, shadows, filters, transforms)
 * - Phase 6: Pseudo-elements, interaction states, optimization
 * - HIERARCHY FIX: Proper parent-child relationships in Figma layers
 *
 * Target Accuracy: 95-100%
 */

// Type definitions (inline to avoid import issues)
interface IRNode {
  id: string;
  name?: string;
  type: string;
  tag?: string;
  rect?: { x: number; y: number; width: number; height: number };
  text?: string;
  styles?: any;
  image?: any;
  svg?: any;
  imageData?: number[];
  imageChunkRef?: { isStreamed: boolean; totalChunks: number };
  componentHint?: string;
  pseudoElements?: any[];
  parent?: string;
  children?: string[];
}

interface StreamMessage {
  type: string;
  payload?: any;
}

interface ImageChunkMessage {
  type: "IMAGE_CHUNK";
  nodeId: string;
  chunkIndex: number;
  data: number[];
  totalChunks: number;
}

// Inline ImageAssembler class to avoid import issues in Figma
interface ChunkBuffer {
  nodeId: string;
  chunks: Map<number, Uint8Array>;
  totalChunks: number;
  receivedChunks: number;
  createdAt: number;
}

class ImageAssembler {
  private readonly buffers = new Map<string, ChunkBuffer>();
  private readonly TIMEOUT_MS = 30000;

  addChunk(
    nodeId: string,
    chunkIndex: number,
    data: number[],
    totalChunks: number
  ): void {
    if (!this.buffers.has(nodeId)) {
      this.buffers.set(nodeId, {
        nodeId,
        chunks: new Map(),
        totalChunks,
        receivedChunks: 0,
        createdAt: Date.now(),
      });
    }

    const buffer = this.buffers.get(nodeId)!;
    const uint8Array = new Uint8Array(data);
    if (!buffer.chunks.has(chunkIndex)) {
      buffer.chunks.set(chunkIndex, uint8Array);
      buffer.receivedChunks += 1;
    }
  }

  isComplete(nodeId: string): boolean {
    const buffer = this.buffers.get(nodeId);
    if (!buffer) return false;
    return buffer.receivedChunks === buffer.totalChunks;
  }

  assemble(nodeId: string): Uint8Array | null {
    const buffer = this.buffers.get(nodeId);
    if (!buffer || !this.isComplete(nodeId)) {
      return null;
    }

    const totalSize = Array.from(buffer.chunks.values()).reduce(
      (acc, chunk) => acc + chunk.length,
      0
    );
    const assembled = new Uint8Array(totalSize);
    let offset = 0;

    for (let index = 0; index < buffer.totalChunks; index += 1) {
      const chunk = buffer.chunks.get(index);
      if (!chunk) {
        console.error(`Missing chunk ${index} for node ${nodeId}`);
        return null;
      }
      assembled.set(chunk, offset);
      offset += chunk.length;
    }

    this.buffers.delete(nodeId);
    return assembled;
  }

  cleanupTimedOut(): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [nodeId, buffer] of this.buffers.entries()) {
      if (now - buffer.createdAt > this.TIMEOUT_MS) {
        timedOut.push(nodeId);
        this.buffers.delete(nodeId);
      }
    }

    return timedOut;
  }

  getStatus(): { nodeId: string; progress: string; age: number }[] {
    const now = Date.now();
    return Array.from(this.buffers.entries()).map(([nodeId, buffer]) => ({
      nodeId,
      progress: `${buffer.receivedChunks}/${buffer.totalChunks}`,
      age: now - buffer.createdAt,
    }));
  }
}

// ✅ HIERARCHY BUILDER - Builds proper parent-child relationships
interface BuildStats {
  nodesCreated: number;
  maxDepth: number;
  orphanedNodes: number;
  imageNodes: number;
  textNodes: number;
}

interface StackingContextNode {
  elementId: string;
  zIndex: number | "auto";
  children: StackingContextNode[];
  position?: string;
  transform?: string;
  opacity?: number;
  hasBlendMode?: boolean;
  isTransformLayer?: boolean;
  paintOrder?: number;
}

class HierarchyBuilder {
  private stats: BuildStats = {
    nodesCreated: 0,
    maxDepth: 0,
    orphanedNodes: 0,
    imageNodes: 0,
    textNodes: 0,
  };
  
  private stackingContexts: Map<string, StackingContextNode> = new Map();
  private paintOrderIndex = 0;

  async buildHierarchy(
    flatNodes: any[],
    rootParent: BaseNode & ChildrenMixin,
    createNodeFn: (
      nodeData: any,
      parent: BaseNode & ChildrenMixin
    ) => Promise<SceneNode | null>
  ): Promise<void> {
    console.log(`🔷 HierarchyBuilder.buildHierarchy START`);
    console.log(`  📊 Total nodes: ${flatNodes.length}`);
    console.log(`  📌 Root parent: ${rootParent.name} (${rootParent.type})`);
    console.log("🎨 Implementing layer-by-layer paint order rendering...");

    // Build stacking context tree first
    this.buildStackingContextTree(flatNodes);

    const nodeMap = new Map(flatNodes.map((n) => [n.id, n]));
    const createdNodesMap = new Map<string, SceneNode>();

    // Step 1: Find root nodes and create them
    const roots = flatNodes.filter((node) => {
      if (!node.parent) return true;

      const parentExists = nodeMap.has(node.parent);
      if (!parentExists) {
        console.warn(
          `Orphaned node: ${node.name || node.id} (parent ${
            node.parent
          } missing)`
        );
        this.stats.orphanedNodes++;
        return true;
      }

      return false;
    });

    console.log(`  🌳 Found ${roots.length} root nodes`);

    // Step 2: Render layers in proper paint order (top to bottom)
    console.log(`  🎬 Starting renderLayerByLayer...`);
    await this.renderLayerByLayer(flatNodes, rootParent, createNodeFn, createdNodesMap);

    console.log("✓ Layer-by-layer hierarchy build complete:", this.stats);
  }

  /**
   * Render nodes layer by layer in proper CSS paint order
   */
  private async renderLayerByLayer(
    allNodes: any[],
    rootParent: BaseNode & ChildrenMixin,
    createNodeFn: (nodeData: any, parent: BaseNode & ChildrenMixin) => Promise<SceneNode | null>,
    createdNodesMap: Map<string, SceneNode>
  ): Promise<void> {
    // Get all nodes sorted by paint order
    const sortedByPaintOrder = [...allNodes].sort((a, b) => {
      return this.calculatePaintOrder(a, b, allNodes);
    });

    console.log("🎨 Rendering layers in paint order (background to foreground):");

    // Process each layer sequentially
    for (let i = 0; i < sortedByPaintOrder.length; i++) {
      const nodeData = sortedByPaintOrder[i];
      
      // Skip if already created as part of parent hierarchy
      if (createdNodesMap.has(nodeData.id)) {
        continue;
      }

      // Determine parent for this node
      const figmaParent = this.getFigmaParent(nodeData, createdNodesMap, rootParent);
      
      // Create the node
      const figmaNode = await createNodeFn(nodeData, figmaParent);
      
      if (figmaNode) {
        createdNodesMap.set(nodeData.id, figmaNode);
        this.stats.nodesCreated++;

        // Log layer information
        const context = this.getStackingContext(nodeData);
        const zIndex = this.getZIndex(nodeData);
        console.log(`  Layer ${i + 1}/${sortedByPaintOrder.length}: ${nodeData.name || nodeData.id} (z-index: ${zIndex}, context: ${context.elementId})`);

        if (nodeData.type === "IMAGE") this.stats.imageNodes++;
        if (nodeData.type === "TEXT") this.stats.textNodes++;
      }
    }
  }

  /**
   * Get appropriate Figma parent for a node
   */
  private getFigmaParent(
    nodeData: any, 
    createdNodesMap: Map<string, SceneNode>, 
    rootParent: BaseNode & ChildrenMixin
  ): BaseNode & ChildrenMixin {
    // If no parent specified, use root
    if (!nodeData.parent) {
      return rootParent;
    }

    // Check if parent has been created
    const parentNode = createdNodesMap.get(nodeData.parent);
    if (parentNode && 'appendChild' in parentNode) {
      return parentNode as BaseNode & ChildrenMixin;
    }

    // Fallback to root parent if parent not found
    return rootParent;
  }

  /**
   * Calculate proper CSS paint order between two nodes
   */
  private calculatePaintOrder(nodeA: any, nodeB: any, allNodes: any[]): number {
    // Build stacking context tree first time
    if (this.stackingContexts.size === 0) {
      this.buildStackingContextTree(allNodes);
    }

    // Primary: Compare by z-index values
    const zIndexA = this.getZIndex(nodeA);
    const zIndexB = this.getZIndex(nodeB);
    
    const numA = typeof zIndexA === 'number' ? zIndexA : 0;
    const numB = typeof zIndexB === 'number' ? zIndexB : 0;
    
    if (numA !== numB) {
      return numA - numB;
    }

    // Secondary: Compare stacking context paint order
    const contextA = this.getStackingContext(nodeA);
    const contextB = this.getStackingContext(nodeB);
    
    if (contextA.paintOrder !== contextB.paintOrder) {
      return (contextA.paintOrder || 0) - (contextB.paintOrder || 0);
    }

    // Tertiary: Use DOM order as final fallback
    return this.getDOMOrder(nodeA, nodeB, allNodes);
  }

  /**
   * Build stacking context tree and assign paint order
   */
  private buildStackingContextTree(allNodes: any[]): void {
    this.stackingContexts.clear();
    this.paintOrderIndex = 0;

    // Find root stacking context (document/html)
    const rootNode = allNodes.find(n => 
      n.tagName === 'html' || 
      n.tagName === 'HTML' || 
      !n.parent
    );

    if (!rootNode) return;

    // Create root stacking context
    this.stackingContexts.set(rootNode.id, {
      elementId: rootNode.id,
      zIndex: 0,
      children: [],
      paintOrder: this.paintOrderIndex++
    });

    // Process all nodes for stacking context detection
    for (const node of allNodes) {
      if (this.createsStackingContext(node)) {
        this.addStackingContext(node, allNodes);
      }
    }

    // Calculate paint order recursively
    this.calculatePaintOrderRecursive(rootNode.id, allNodes);
  }

  /**
   * Determine if element creates a stacking context
   */
  private createsStackingContext(node: any): boolean {
    const styles = node.styles || {};
    const layout = node.layout || {};
    const compositing = layout.compositing || node.compositing || {};

    return (
      node.tagName === 'html' || 
      node.tagName === 'HTML' ||
      (styles.position !== 'static' && styles.zIndex && styles.zIndex !== 'auto') ||
      parseFloat(styles.opacity || '1') < 1 ||
      (styles.transform && styles.transform !== 'none') ||
      (styles.filter && styles.filter !== 'none') ||
      (styles.perspective && styles.perspective !== 'none') ||
      (styles.clipPath && styles.clipPath !== 'none') ||
      (styles.isolation === 'isolate') ||
      compositing.createsStackingContext === true
    );
  }

  /**
   * Add stacking context to tree
   */
  private addStackingContext(node: any, allNodes: any[]): void {
    if (this.stackingContexts.has(node.id)) return;

    // Find parent stacking context
    let parentContextId = this.findParentStackingContext(node, allNodes);
    
    const context: StackingContextNode = {
      elementId: node.id,
      zIndex: this.getZIndex(node),
      children: [],
      position: node.styles?.position,
      transform: node.styles?.transform,
      opacity: parseFloat(node.styles?.opacity || '1'),
      paintOrder: this.paintOrderIndex++
    };

    this.stackingContexts.set(node.id, context);

    // Add to parent's children
    if (parentContextId && this.stackingContexts.has(parentContextId)) {
      this.stackingContexts.get(parentContextId)!.children.push(context);
    }
  }

  /**
   * Find the nearest parent stacking context
   */
  private findParentStackingContext(node: any, allNodes: any[]): string | null {
    let currentNode = node;
    
    while (currentNode.parent) {
      const parentNode = allNodes.find(n => n.id === currentNode.parent);
      if (!parentNode) break;
      
      if (this.stackingContexts.has(parentNode.id)) {
        return parentNode.id;
      }
      
      currentNode = parentNode;
    }
    
    return null;
  }

  /**
   * Calculate paint order globally across all stacking contexts
   */
  private calculatePaintOrderRecursive(contextId: string, allNodes: any[]): void {
    const context = this.stackingContexts.get(contextId);
    if (!context) return;

    // Get all elements in this stacking context and sort them properly
    const elementsInContext = allNodes.filter(node => 
      this.getStackingContextId(node, allNodes) === contextId
    );

    // Sort by CSS paint order rules within this context
    const sortedElements = elementsInContext.sort((a, b) => {
      const zIndexA = this.getZIndex(a);
      const zIndexB = this.getZIndex(b);

      // Handle negative z-index first
      const numA = typeof zIndexA === 'number' ? zIndexA : 0;
      const numB = typeof zIndexB === 'number' ? zIndexB : 0;

      if (numA !== numB) {
        return numA - numB;
      }

      // Same z-index, use DOM order
      return a.id.localeCompare(b.id);
    });

    // Assign incremental paint order values globally
    for (const element of sortedElements) {
      if (this.stackingContexts.has(element.id)) {
        this.stackingContexts.get(element.id)!.paintOrder = this.paintOrderIndex++;
      }
    }

    // Recursively process child contexts
    for (const child of context.children) {
      this.calculatePaintOrderRecursive(child.elementId, allNodes);
    }
  }

  /**
   * Get the stacking context ID for a given node
   */
  private getStackingContextId(node: any, allNodes: any[]): string {
    if (this.stackingContexts.has(node.id)) {
      return node.id;
    }

    // Find nearest ancestor stacking context
    let currentNode = node;
    while (currentNode.parent) {
      const parentNode = allNodes.find(n => n.id === currentNode.parent);
      if (!parentNode) break;
      
      if (this.stackingContexts.has(parentNode.id)) {
        return parentNode.id;
      }
      
      currentNode = parentNode;
    }

    return 'html'; // fallback to root
  }

  /**
   * Get stacking context for a node
   */
  private getStackingContext(node: any): StackingContextNode {
    // Check if node itself creates a stacking context
    if (this.stackingContexts.has(node.id)) {
      return this.stackingContexts.get(node.id)!;
    }

    // Find nearest ancestor stacking context
    const contextId = this.findParentStackingContext(node, []);
    return this.stackingContexts.get(contextId!) || {
      elementId: 'root',
      zIndex: 0,
      children: [],
      paintOrder: 0
    };
  }

  /**
   * Get z-index value for node
   */
  private getZIndex(node: any): number | "auto" {
    const zIndex = node.styles?.zIndex;
    if (!zIndex || zIndex === 'auto') return 'auto';
    return parseInt(zIndex) || 0;
  }

  /**
   * Get DOM order comparison between two nodes
   */
  private getDOMOrder(nodeA: any, nodeB: any, _allNodes: any[]): number {
    // Simple ID comparison as fallback - in real implementation,
    // this should use document order
    return nodeA.id.localeCompare(nodeB.id);
  }

  getStats(): BuildStats {
    return { ...this.stats };
  }
}

console.log("Final plugin loaded - All Phases (1-6) + Hierarchy Fix");

// Show the plugin UI so users can interact with the converter
figma.showUI(__html__, {
  width: 420,
  height: 640,
  themeColors: true,
});

let tokenVariables: Record<string, any> = {};
let nodeBuffer: any[] = [];
let isProcessing = false;
let loadedFonts = new Set<string>();
let fontMapping: Record<string, { family: string; style: string }> = {};
const imageAssembler = new ImageAssembler();
const pendingImageNodes = new Map<string, IRNode>();
const streamScreenshots: Record<string, string> = {};
const streamStates: Record<string, any> = {};
const streamCreatedNodes = new Map<string, SceneNode>();
let totalStreamNodesProcessed = 0;
const STREAM_ASSEMBLY_TIMEOUT_MS = 10000;
let SERVER_PORT = 3000; // Default, will be updated from UI

interface StreamFullDataEnvelope {
  screenshots: Record<string, string>;
  states: Record<string, any>;
  __nodeLookup?: Map<string, any>;
}

const streamFullDataEnvelope: StreamFullDataEnvelope = {
  screenshots: streamScreenshots,
  states: streamStates,
};

type NodeLookup = Map<string, any>;

function normalizeFontFamilyName(family?: string): string {
  if (!family) return "";
  return family.replace(/['"]/g, "").trim().toLowerCase();
}

function normalizeFontStyle(style?: string, weight?: string): string {
  const numericWeight = parseInt(weight || "", 10);
  if (!isNaN(numericWeight)) {
    if (numericWeight >= 700) return "Bold";
    if (numericWeight >= 600) return "Semi Bold";
    if (numericWeight >= 500) return "Medium";
    if (numericWeight <= 300) return "Light";
  }
  const clean = (style || "").toLowerCase();
  if (clean.includes("italic")) return "Italic";
  if (clean.includes("medium")) return "Medium";
  if (clean.includes("bold")) return "Bold";
  if (clean.includes("semi")) return "Semi Bold";
  if (clean.includes("light")) return "Light";
  return "Regular";
}

function ensureNodeLookup(fullData: any): NodeLookup {
  if (!fullData) {
    return new Map();
  }
  if (!fullData.__nodeLookup) {
    fullData.__nodeLookup = new Map();
  }
  return fullData.__nodeLookup as NodeLookup;
}

function registerNodesWithLookup(fullData: any, nodes: any[] = []): void {
  if (!fullData || !nodes || nodes.length === 0) return;
  const lookup = ensureNodeLookup(fullData);
  for (const node of nodes) {
    if (node?.id) {
      lookup.set(node.id, node);
    }
  }
}

function getAbsoluteBounds(nodeData: any) {
  const layoutDoc = nodeData?.layout?.document;
  const layoutViewport = nodeData?.layout?.viewport;
  const rect = nodeData?.rect || {};

  return {
    x:
      layoutDoc?.x ??
      layoutViewport?.x ??
      rect.x ??
      0,
    y:
      layoutDoc?.y ??
      layoutViewport?.y ??
      rect.y ??
      0,
    width:
      layoutViewport?.width ??
      rect.width ??
      0,
    height:
      layoutViewport?.height ??
      rect.height ??
      0,
  };
}

function getRelativeBounds(nodeData: any, parentData?: any) {
  const absolute = getAbsoluteBounds(nodeData);
  if (!parentData) {
    return absolute;
  }
  const parentAbsolute = getAbsoluteBounds(parentData);

  return {
    x: absolute.x - parentAbsolute.x,
    y: absolute.y - parentAbsolute.y,
    width: absolute.width,
    height: absolute.height,
  };
}

function clampSize(value: number): number {
  if (!isFinite(value) || isNaN(value)) return 1;
  return Math.max(0.5, value);
}

function sanitizeNumber(value: any, fallback = 0): number {
  const parsed = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseMatrix(transform: string): number[] | null {
  const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
  if (!matrixMatch) return null;
  const values = matrixMatch[1]
    .split(",")
    .map((v) => parseFloat(v.trim()))
    .filter((v) => !isNaN(v));
  if (values.length === 6) {
    return values;
  }
  return null;
}

const BLEND_MODE_MAP: Record<string, BlendMode> = {
  multiply: "MULTIPLY",
  screen: "SCREEN",
  overlay: "OVERLAY",
  darken: "DARKEN",
  lighten: "LIGHTEN",
  "color-dodge": "COLOR_DODGE",
  "color-burn": "COLOR_BURN",
  "hard-light": "HARD_LIGHT",
  "soft-light": "SOFT_LIGHT",
  difference: "DIFFERENCE",
  exclusion: "EXCLUSION",
  hue: "HUE",
  saturation: "SATURATION",
  color: "COLOR",
  luminosity: "LUMINOSITY",
};

function mapBlendMode(value?: string): BlendMode | null {
  if (!value) return null;
  const key = value.toLowerCase();
  return BLEND_MODE_MAP[key] || null;
}

function applyNodeTransform(node: SceneNode, nodeData: any) {
  const transformString =
    nodeData?.layout?.transform?.matrix || nodeData?.styles?.transform;
  if (!transformString || transformString === "none") return;

  try {
    const matrixValues = parseMatrix(transformString);
    if (matrixValues) {
      const [a, b] = matrixValues;

      // Guard against degenerate matrices (zero scale) which make rotation undefined
      const determinant = a * a + b * b;
      if (determinant <= Number.EPSILON) {
        throw new Error("degenerate transform matrix");
      }

      const rotationRad = Math.atan2(b, a);
      if ("rotation" in node && isFinite(rotationRad)) {
        node.rotation = (rotationRad * 180) / Math.PI;
      }
      return;
    }
  } catch (error) {
    console.warn("applyNodeTransform failed", nodeData?.id, error);
  }

  const rotateMatch = transformString.match(/rotate\(([^)]+)deg\)/);
  if (rotateMatch && "rotation" in node) {
    const parsed = parseFloat(rotateMatch[1]);
    if (isFinite(parsed)) {
      node.rotation = parsed;
    }
  }
}

function applyOpacityAndBlend(node: SceneNode, nodeData: any) {
  const explicitOpacity =
    nodeData?.styles?.opacity ?? nodeData?.layout?.visibility?.opacity;
  if (
    typeof explicitOpacity !== "undefined" &&
    "opacity" in node &&
    explicitOpacity !== null
  ) {
    const parsed = sanitizeNumber(explicitOpacity, 1);
    node.opacity = Math.max(0, Math.min(1, parsed));
  }

  const blend =
    nodeData?.compositing?.mixBlendMode || nodeData?.styles?.mixBlendMode;
  const figmaBlend = mapBlendMode(blend);
  if (figmaBlend && "blendMode" in node) {
    node.blendMode = figmaBlend;
  }
}

const ENABLE_AUTO_LAYOUT = true; // Enable comprehensive flexbox → Auto Layout mapping

function resetStreamState(): void {
  pendingImageNodes.clear();
  streamCreatedNodes.clear();
  totalStreamNodesProcessed = 0;
  if (streamFullDataEnvelope.__nodeLookup) {
    (streamFullDataEnvelope.__nodeLookup as Map<string, any>).clear();
    delete streamFullDataEnvelope.__nodeLookup;
  }
  for (const key of Object.keys(streamScreenshots)) {
    delete streamScreenshots[key];
  }
  for (const key of Object.keys(streamStates)) {
    delete streamStates[key];
  }
}

function applyVariableFill(node: GeometryMixin, variable: Variable) {
  if (!figma.variables) return;
  const fills = node.fills;
  let basePaint: SolidPaint | null = null;

  if (fills && fills !== figma.mixed) {
    basePaint =
      fills.find((paint): paint is SolidPaint => paint.type === "SOLID") ||
      null;
  }

  if (!basePaint) {
    basePaint = {
      type: "SOLID",
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
    };
  }

  const boundPaint = figma.variables.setBoundVariableForPaint(
    basePaint,
    "color",
    variable
  );
  node.fills = [boundPaint];
}

figma.ui.onmessage = async (msg: unknown) => {
  try {
    const streamTypes = new Set([
      "NODES",
      "FONTS",
      "TOKENS",
      "COMPLETE",
      "PROGRESS",
      "ERROR",
    ]);

    if (typeof msg === "object" && msg !== null) {
      const typedMsg = msg as any;

      if (typedMsg.type === "IMAGE_CHUNK") {
        handleImageChunk(typedMsg as ImageChunkMessage);
        return;
      }

      if (streamTypes.has(typedMsg.type)) {
        await handleStreamEnvelope(typedMsg as StreamMessage);
        return;
      }
    }

    const legacy = msg as any;
    switch (legacy.type) {
      case "server_config":
        SERVER_PORT = legacy.serverPort || 3000;
        console.log(`Server port updated to: ${SERVER_PORT}`);
        break;

      case "full_page":
        await processFullPage(legacy.data);
        break;

      case "tokens":
        tokenVariables = await createFigmaVariables(legacy.data);
        break;

      case "node_chunk":
        nodeBuffer.push(...legacy.data);
        if (!isProcessing) {
          isProcessing = true;
          await processBufferedNodes();
        }
        break;

      case "complete":
        figma.ui.postMessage({ type: "import_complete" });
        break;

      case "error":
        figma.notify(legacy.error, { error: true });
        break;
    }
  } catch (error) {
    console.error(error);
    figma.notify("Error processing data", { error: true });
  }
};

async function handleStreamEnvelope(msg: StreamMessage): Promise<void> {
  switch (msg.type) {
    case "TOKENS":
      resetStreamState();
      tokenVariables = await createFigmaVariables(msg.payload || {});
      break;

    case "FONTS":
      if (msg.payload) {
        await processFonts(
          msg.payload,
          Array.isArray(msg.payload?.fontFaces) ? msg.payload.fontFaces : []
        );
      }
      break;

    case "NODES":
      console.log("🎯 RECEIVED NODES MESSAGE:", {
        hasPayload: !!msg.payload,
        hasNodes: !!msg.payload?.nodes,
        nodeCount: msg.payload?.nodes?.length || 0
      });
      if (msg.payload?.nodes) {
        console.log("📦 Processing NODES batch with", msg.payload.nodes.length, "nodes");
        await handleStreamNodeBatch(msg.payload.nodes as IRNode[]);
        console.log("✅ NODES batch processing complete");
      } else {
        console.warn("⚠️ NODES message received but no nodes in payload");
      }
      break;

    case "PROGRESS":
      figma.ui.postMessage({
        type: "PROGRESS_UPDATE",
        ...msg.payload,
      });
      break;

    case "ERROR":
      figma.notify(`Error: ${msg.payload?.message || "Unknown error"}`, {
        error: true,
      });
      break;

    case "COMPLETE":
      console.log("🏁 RECEIVED COMPLETE MESSAGE:", msg.payload);
      await handleStreamComplete(msg.payload);
      console.log("✅ handleStreamComplete finished");
      break;
  }
}

// ✅ UPDATED: Use hierarchy builder for streaming
async function handleStreamNodeBatch(nodes: IRNode[]): Promise<void> {
  console.log("🔧 handleStreamNodeBatch START:", {
    totalNodes: nodes.length,
    sampleNode: nodes[0] ? { id: nodes[0].id, type: nodes[0].type, name: nodes[0].name } : null
  });

  const streamFullData = streamFullDataEnvelope;

  registerNodesWithLookup(streamFullData, nodes);

  // ✅ Use hierarchy builder for stream too
  const builder = new HierarchyBuilder();

  // Separate nodes into regular and deferred (image chunks)
  const regularNodes = nodes.filter((n) => !n.imageChunkRef?.isStreamed);
  const deferredNodes = nodes.filter((n) => n.imageChunkRef?.isStreamed);

  console.log("📊 Node categorization:", {
    regularNodes: regularNodes.length,
    deferredNodes: deferredNodes.length
  });

  // Store screenshots and states
  for (const node of nodes) {
    if ((node as any).screenshot) {
      streamScreenshots[node.id] = (node as any).screenshot;
    }
    if ((node as any).states) {
      streamStates[node.id] = (node as any).states;
    }
  }

  // Defer image nodes
  for (const node of deferredNodes) {
    pendingImageNodes.set(node.id, node);
    registerNodesWithLookup(streamFullData, [node]);
    console.log(
      `Deferring image node ${node.id} (waiting for ${
        node.imageChunkRef!.totalChunks
      } chunks)`
    );
  }

  // Build hierarchy for regular nodes
  if (regularNodes.length > 0) {
    console.log("🏗️ Building hierarchy for", regularNodes.length, "regular nodes");
    await builder.buildHierarchy(
      regularNodes,
      figma.currentPage,
      async (nodeData, parent) => {
        console.log("  🔨 Creating node:", { id: nodeData.id, type: nodeData.type, name: nodeData.name });
        const figmaNode = await createEnhancedNode(
          nodeData,
          parent,
          streamFullData,
          streamCreatedNodes
        );
        if (figmaNode) {
          streamCreatedNodes.set(nodeData.id, figmaNode);
          console.log("  ✅ Node created:", figmaNode.name);
        } else {
          console.warn("  ⚠️ Node creation returned null for:", nodeData.id);
        }
        return figmaNode;
      }
    );

    const stats = builder.getStats();
    totalStreamNodesProcessed += stats.nodesCreated;
    console.log("📈 Hierarchy build complete:", stats);
  } else {
    console.warn("⚠️ No regular nodes to build (all deferred or empty)");
  }

  figma.ui.postMessage({
    type: "PROGRESS_UPDATE",
    nodesProcessed: totalStreamNodesProcessed,
  });
}

function handleImageChunk(chunk: ImageChunkMessage): void {
  imageAssembler.addChunk(
    chunk.nodeId,
    chunk.chunkIndex,
    chunk.data,
    chunk.totalChunks
  );

  if (imageAssembler.isComplete(chunk.nodeId)) {
    void createPendingImageNode(chunk.nodeId);
  }
}

function createPlaceholderForFailedImage(node: IRNode): SceneNode {
  const placeholder = figma.createRectangle();
  placeholder.name = `Failed Image: ${node.id}`;
  placeholder.resize(
    Math.max(1, node.rect?.width || 100),
    Math.max(1, node.rect?.height || 100)
  );
  placeholder.fills = [
    {
      type: "SOLID",
      color: { r: 0.9, g: 0.9, b: 0.9 },
    },
  ];
  placeholder.x = node.rect?.x || 0;
  placeholder.y = node.rect?.y || 0;
  return placeholder;
}

async function createPendingImageNode(nodeId: string): Promise<void> {
  const node = pendingImageNodes.get(nodeId);
  if (!node) {
    console.error(`No pending node found for ${nodeId}`);
    return;
  }

  const assembled = imageAssembler.assemble(nodeId);
  if (!assembled) {
    console.error(`Failed to assemble image for node ${nodeId}`);
    return;
  }

  node.imageData = Array.from(assembled);
  delete node.imageChunkRef;

  const streamFullData = streamFullDataEnvelope;

  const figmaNode = await createEnhancedNode(
    node,
    figma.currentPage,
    streamFullData,
    streamCreatedNodes
  );
  if (figmaNode) {
    streamCreatedNodes.set(node.id, figmaNode);
    totalStreamNodesProcessed += 1;
  }

  pendingImageNodes.delete(nodeId);

  figma.ui.postMessage({
    type: "IMAGE_ASSEMBLED",
    nodeId,
    nodesProcessed: totalStreamNodesProcessed,
  });
}

async function handleStreamComplete(payload: any): Promise<void> {
  const maxWait = STREAM_ASSEMBLY_TIMEOUT_MS;
  const startTime = Date.now();

  while (pendingImageNodes.size > 0 && Date.now() - startTime < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const timedOut = imageAssembler.cleanupTimedOut();
    if (timedOut.length > 0) {
      for (const nodeId of timedOut) {
        const node = pendingImageNodes.get(nodeId);
        if (!node) continue;

        const placeholder = createPlaceholderForFailedImage(node as any);
        figma.currentPage.appendChild(placeholder);
        streamCreatedNodes.set(nodeId, placeholder);
        pendingImageNodes.delete(nodeId);
        totalStreamNodesProcessed += 1;
      }
    }
  }

  if (pendingImageNodes.size > 0) {
    const stuck = Array.from(pendingImageNodes.keys());
    console.error(`${pendingImageNodes.size} images never completed:`, stuck);
    for (const nodeId of stuck) {
      const node = pendingImageNodes.get(nodeId);
      if (!node) continue;

      const placeholder = createPlaceholderForFailedImage(node as any);
      figma.currentPage.appendChild(placeholder);
      streamCreatedNodes.set(nodeId, placeholder);
      pendingImageNodes.delete(nodeId);
      totalStreamNodesProcessed += 1;
    }
  }

  figma.notify(
    `✓ Import complete: ${totalStreamNodesProcessed} nodes created`,
    { timeout: 3000 }
  );
  console.log("Import stats:", payload);
}

// ✅ UPDATED: Use hierarchy builder for full page import
async function processFullPage(data: any) {
  const startTime = Date.now();

  // Step 1: Process fonts
  const incomingFonts = data.fonts || [];
  const incomingFontFaces = data.fontFaces || [];
  if (incomingFonts.length > 0 || incomingFontFaces.length > 0) {
    console.log(
      `Processing fonts (${incomingFonts.length} fonts, ${incomingFontFaces.length} faces)...`
    );
    await processFonts(
      { fonts: incomingFonts, fontFaces: incomingFontFaces },
      incomingFontFaces
    );
  }

  // Step 2: Create design tokens
  if (data.tokens) {
    tokenVariables = await createFigmaVariables(data.tokens);
  }

  // Step 3: Create container
  const container = figma.createFrame();
  container.name = "Imported Page";
  container.x = 0;
  container.y = 0;
  container.resize(data.viewport.width, data.viewport.height);
  container.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  container.clipsContent = false;

  // ✅ Step 4: Build hierarchy using HierarchyBuilder
  const builder = new HierarchyBuilder();
  const createdNodes = new Map<string, SceneNode>();
  registerNodesWithLookup(data, data.nodes);

  await builder.buildHierarchy(
    data.nodes,
    container,
    async (nodeData, parent) => {
      const figmaNode = await createEnhancedNode(
        nodeData,
        parent,
        data,
        createdNodes
      );
      if (figmaNode) {
        createdNodes.set(nodeData.id, figmaNode);
      }
      return figmaNode;
    }
  );

  const stats = builder.getStats();

  figma.currentPage.appendChild(container);
  figma.viewport.scrollAndZoomIntoView([container]);

  const elapsed = Date.now() - startTime;
  figma.notify(
    `✓ Import complete: ${stats.nodesCreated} nodes (${stats.maxDepth} levels) in ${elapsed}ms`,
    { timeout: 3000 }
  );
}

async function processBufferedNodes() {
  while (nodeBuffer.length > 0) {
    const batch = nodeBuffer.splice(0, 20);
    for (const node of batch) {
      await createEnhancedNode(node, figma.currentPage, {}, new Map());
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  isProcessing = false;
}

/**
 * PHASE 2: Font Processing & Mapping
 */
async function processFonts(fontPayload: any, explicitFontFaces: any[] = []) {
  const payloadIsArray = Array.isArray(fontPayload);
  const fonts: any[] = payloadIsArray
    ? fontPayload
    : fontPayload?.fonts || [];
  const payloadFaces: any[] = payloadIsArray
    ? []
    : fontPayload?.fontFaces || fontPayload?.faces || [];
  const fontFaces = [...explicitFontFaces, ...payloadFaces];

  const variants: Array<{ family: string; style?: string; weight?: string }> =
    [];
  const fontFamilies = new Set<string>();

  for (const entry of [...fonts, ...fontFaces]) {
    if (!entry?.family) continue;
    fontFamilies.add(entry.family);
    variants.push({
      family: entry.family,
      style: entry.style,
      weight: entry.weight,
    });
  }

  console.log("Detected font families:", Array.from(fontFamilies));

  for (const variant of variants) {
    const family = variant.family;
    const normalizedFamily = normalizeFontFamilyName(family);
    const style = normalizeFontStyle(variant.style, variant.weight);
    const figmaFont = { family, style };

    try {
      await figma.loadFontAsync(figmaFont);
      loadedFonts.add(`${figmaFont.family}__${figmaFont.style}`);
      fontMapping[family] = figmaFont;
      fontMapping[normalizedFamily] = figmaFont;
      console.log(`✓ Loaded font: ${figmaFont.family} (${figmaFont.style})`);
    } catch (e) {
      // Continue to fallback mapping
    }
  }

  for (const family of fontFamilies) {
    const normalizedFamily = normalizeFontFamilyName(family);
    if (fontMapping[normalizedFamily]) continue;
    const fallback = mapToFigmaFont(family);
    fontMapping[family] = fallback;
    fontMapping[normalizedFamily] = fallback;
  }
}

function mapToFigmaFont(webFont: string): { family: string; style: string } {
  const cleanFont = webFont
    .toLowerCase()
    .replace(/['"]/g, "")
    .split(",")[0]
    .trim();

  const fontMap: Record<string, string> = {
    inter: "Inter",
    roboto: "Roboto",
    "open sans": "Open Sans",
    lato: "Lato",
    montserrat: "Montserrat",
    "source sans pro": "Source Sans Pro",
    raleway: "Raleway",
    poppins: "Poppins",
    nunito: "Nunito",
    ubuntu: "Ubuntu",
    "playfair display": "Playfair Display",
    merriweather: "Merriweather",
    "work sans": "Work Sans",
    arial: "Arial",
    helvetica: "Helvetica",
    "helvetica neue": "Helvetica Neue",
    "times new roman": "Times New Roman",
    georgia: "Georgia",
    "courier new": "Courier New",
    verdana: "Verdana",
    "trebuchet ms": "Trebuchet MS",
    "sans-serif": "Inter",
    serif: "Roboto Serif",
    monospace: "Roboto Mono",
  };

  return { family: fontMap[cleanFont] || "Inter", style: "Regular" };
}

/**
 * PHASE 3-6: Enhanced Node Creation with All Features
 * NOTE: This function is called by HierarchyBuilder recursively
 */
async function createEnhancedNode(
  nodeData: any,
  parent: BaseNode & ChildrenMixin,
  fullData: any,
  createdNodes: Map<string, SceneNode>
): Promise<SceneNode | null> {
  console.log("    🎨 createEnhancedNode:", {
    id: nodeData.id,
    type: nodeData.type,
    name: nodeData.name,
    hasParent: !!nodeData.parent,
    parentName: parent?.name || 'unknown'
  });

  let node: SceneNode | null = null;

  try {
    const nodeLookup = ensureNodeLookup(fullData);
    const parentData = nodeData.parent ? nodeLookup.get(nodeData.parent) : null;

    const hasScreenshot =
      fullData.screenshots && fullData.screenshots[nodeData.id];
    const hasStates = fullData.states && fullData.states[nodeData.id];

    console.log("    📋 Node details:", {
      hasScreenshot,
      hasStates,
      hasText: nodeData.type === "TEXT" && nodeData.text,
      hasImage: nodeData.type === "IMAGE" && nodeData.image,
      hasSVG: nodeData.type === "SVG" && nodeData.svg
    });

    // Create base node based on type
    if (nodeData.type === "TEXT" && nodeData.text) {
      console.log("    📝 Creating TEXT node");
      node = await createTextNode(nodeData, hasScreenshot);
    } else if (nodeData.type === "IMAGE" && nodeData.image) {
      console.log("    🖼️ Creating IMAGE node");
      node = await createImageNode(nodeData);
    } else if (nodeData.type === "SVG" && nodeData.svg) {
      console.log("    🎭 Creating SVG node");
      node = await createSVGNode(nodeData);
    } else {
      console.log("    📦 Creating FRAME node");
      node = await createFrameNode(nodeData, hasScreenshot);
    }

    if (!node) return null;

    // Apply common properties using normalized bounds
    const bounds = getRelativeBounds(nodeData, parentData);
    node.x = Math.round(bounds.x || 0);
    node.y = Math.round(bounds.y || 0);

    if ("resize" in node) {
      const width =
        clampSize(bounds.width || nodeData.rect?.width || 100);
      const height =
        clampSize(bounds.height || nodeData.rect?.height || 100);
      node.resize(width, height);
    }

    // PHASE 3: Apply screenshot as background
    if (hasScreenshot && "appendChild" in node) {
      await applyScreenshotBackground(
        node as FrameNode,
        fullData.screenshots[nodeData.id]
      );
    }

    // PHASE 5: Apply advanced effects
    await applyAdvancedEffects(node, nodeData.styles);

    // PHASE 6: Apply pseudo-elements
    if (nodeData.pseudoElements && "appendChild" in node) {
      for (const pseudo of nodeData.pseudoElements) {
        await createPseudoElement(node as FrameNode, pseudo);
      }
    }

    // PHASE 6: Create state variants
    if (hasStates && "appendChild" in node) {
      await createStateVariants(
        node as FrameNode,
        fullData.states[nodeData.id]
      );
    }

    node.name =
      nodeData.name || nodeData.componentHint || nodeData.tag || "element";

    // ✅ Parent is now passed by HierarchyBuilder
    if (parent && "appendChild" in parent) {
      console.log("    ➕ Appending node to parent:", {
        nodeName: node.name,
        parentName: parent.name,
        parentType: parent.type
      });
      parent.appendChild(node);
      console.log("    ✓ Node appended successfully");

      // Apply flex item properties if the parent is an Auto Layout container
      if ('layoutMode' in parent && (parent as any).layoutMode !== "NONE") {
        applyFlexItemProperties(node, nodeData);
      }
    } else {
      console.warn("    ⚠️ Cannot append node - parent invalid or no appendChild:", {
        hasParent: !!parent,
        hasAppendChild: parent && "appendChild" in parent
      });
    }

    applyOpacityAndBlend(node, nodeData);
    applyNodeTransform(node, nodeData);

    console.log("    ✅ createEnhancedNode complete for:", node.name);
    return node;
  } catch (error) {
    console.error("    ❌ Error creating node:", error, nodeData);
    return null;
  }
}

/**
 * Create text node with proper typography
 */
async function createTextNode(
  nodeData: any,
  hasScreenshot: boolean
): Promise<TextNode> {
  const textNode = figma.createText();

  // Determine font
  let fontFamily = "Inter";
  let fontStyle = "Regular";

  const resolvedFontFamily =
    nodeData.typography?.font?.familyResolved || nodeData.styles.fontFamily;

  if (resolvedFontFamily) {
    const webFontFamily = resolvedFontFamily.split(",")[0].trim();
    const normalizedKey = normalizeFontFamilyName(webFontFamily);
    const mapped =
      fontMapping[normalizedKey] ||
      fontMapping[webFontFamily] ||
      mapToFigmaFont(webFontFamily);
    fontFamily = mapped.family;
    fontStyle = mapped.style;
  }

  // Determine style based on weight
  if (nodeData.styles.fontWeight) {
    const weight = parseInt(nodeData.styles.fontWeight);
    if (weight >= 700) fontStyle = "Bold";
    else if (weight >= 600) fontStyle = "Semi Bold";
    else if (weight >= 500) fontStyle = "Medium";
    else if (weight < 400) fontStyle = "Light";
  }

  await ensureFontLoaded(fontFamily, fontStyle);
  textNode.fontName = { family: fontFamily, style: fontStyle };

  // Handle both string and object formats for text
  let textContent = "";
  if (typeof nodeData.text === 'string') {
    textContent = nodeData.text;
  } else if (nodeData.text && typeof nodeData.text === 'object') {
    // If text is an object (from typography.text), extract content
    textContent = nodeData.text.content || nodeData.text.innerText || "";
  } else if (nodeData.typography?.text) {
    // Fallback: try to get from typography if main text is missing
    textContent = nodeData.typography.text.content || nodeData.typography.text.innerText || "";
  }
  textNode.characters = textContent;

  // Apply text styles
  if (nodeData.styles.fontSize) {
    textNode.fontSize = parseFloat(nodeData.styles.fontSize);
  }

  if (nodeData.styles.color && !hasScreenshot) {
    const colorToken = tokenVariables[nodeData.styles.color];
    if (colorToken) {
      applyVariableFill(textNode, colorToken);
    } else {
      const color = parseColor(nodeData.styles.color);
      if (color) {
        textNode.fills = [
          {
            type: "SOLID",
            color: { r: color.r, g: color.g, b: color.b },
            ...(color.a !== 1 ? { opacity: color.a } : {}),
          },
        ];
      }
    }
  } else if (hasScreenshot) {
    textNode.opacity = 0.01;
  }

  if (nodeData.styles.letterSpacing) {
    const value = parseFloat(nodeData.styles.letterSpacing);
    if (!isNaN(value)) {
      textNode.letterSpacing = { value, unit: "PIXELS" };
    }
  }

  if (nodeData.styles.lineHeight && nodeData.styles.lineHeight !== "normal") {
    const value = parseFloat(nodeData.styles.lineHeight);
    if (!isNaN(value)) {
      textNode.lineHeight = { value, unit: "PIXELS" };
    }
  }

  if (nodeData.styles.textAlign) {
    const align = nodeData.styles.textAlign.toUpperCase();
    if (["LEFT", "CENTER", "RIGHT", "JUSTIFIED"].includes(align)) {
      textNode.textAlignHorizontal = align as any;
    }
  }

  if (nodeData.styles.textTransform === "uppercase") {
    textNode.textCase = "UPPER";
  } else if (nodeData.styles.textTransform === "lowercase") {
    textNode.textCase = "LOWER";
  } else if (nodeData.styles.textTransform === "capitalize") {
    textNode.textCase = "TITLE";
  }

  if (nodeData.styles.textDecoration?.includes("underline")) {
    textNode.textDecoration = "UNDERLINE";
  } else if (nodeData.styles.textDecoration?.includes("line-through")) {
    textNode.textDecoration = "STRIKETHROUGH";
  }

  return textNode;
}

/**
 * Create image node with proxy support
 */
async function createImageNode(nodeData: any): Promise<RectangleNode> {
  const rect = figma.createRectangle();

  if (nodeData.imageData && nodeData.imageData.length > 0) {
    try {
      const bytes = new Uint8Array(nodeData.imageData);
      const image = figma.createImage(bytes);
      rect.fills = [
        {
          type: "IMAGE",
          imageHash: image.hash,
          scaleMode: "FILL",
        },
      ];
    } catch (error) {
      console.error("Failed to apply inline image data:", error);
      rect.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    }
  } else if (nodeData.image) {
    let imageData = nodeData.image.data;

    if (!imageData && nodeData.image.needsProxy) {
      const proxiedUrl = `http://localhost:${SERVER_PORT}/proxy-image?url=${encodeURIComponent(
        nodeData.image.url
      )}`;
      try {
        const response = await fetch(proxiedUrl);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const image = figma.createImage(bytes);
        rect.fills = [
          {
            type: "IMAGE",
            imageHash: image.hash,
            scaleMode: "FILL",
          },
        ];
      } catch (e) {
        console.error("Image proxy failed:", e);
        rect.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
      }
    } else if (imageData) {
      const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
      const bytes = figma.base64Decode(base64);
      const image = figma.createImage(bytes);
      rect.fills = [
        {
          type: "IMAGE",
          imageHash: image.hash,
          scaleMode: "FILL",
        },
      ];
    }
  }

  return rect;
}

/**
 * PHASE 4: Create SVG node
 */
async function createSVGNode(nodeData: any): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = "SVG";

  // Note: Figma Plugin API has limited SVG support
  // Best approach: Rasterize on server and import as image
  // For now, create placeholder
  frame.fills = [
    {
      type: "SOLID",
      color: { r: 0.95, g: 0.95, b: 0.95 },
    },
  ];

  return frame;
}

/**
 * Create frame node with auto-layout
 */
async function createFrameNode(
  nodeData: any,
  hasScreenshot: boolean
): Promise<FrameNode> {
  const frame = figma.createFrame();

  // Apply background
  if (!hasScreenshot) {
    if (nodeData.styles.backgroundImage?.includes("gradient")) {
      const gradient = parseGradient(nodeData.styles.backgroundImage);
      if (gradient) {
        frame.fills = [gradient];
      }
    } else if (nodeData.styles.backgroundImage?.includes("url")) {
      // Background image
      const urlMatch = nodeData.styles.backgroundImage.match(
        /url\(['"]?([^'"()]+)['"]?\)/
      );
      if (urlMatch) {
        try {
          const proxiedUrl = `http://localhost:${SERVER_PORT}/proxy-image?url=${encodeURIComponent(
            urlMatch[1]
          )}`;
          const response = await fetch(proxiedUrl);
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const image = figma.createImage(bytes);
          frame.fills = [
            {
              type: "IMAGE",
              imageHash: image.hash,
              scaleMode: "FILL",
            },
          ];
        } catch (e) {
          console.warn("Background image failed");
        }
      }
    } else if (nodeData.styles.backgroundColor) {
      const bgToken = tokenVariables[nodeData.styles.backgroundColor];
      if (bgToken) {
        applyVariableFill(frame, bgToken);
      } else {
        const color = parseColor(nodeData.styles.backgroundColor);
        if (color) {
          frame.fills = [
            {
              type: "SOLID",
              color: { r: color.r, g: color.g, b: color.b },
              ...(color.a !== 1 ? { opacity: color.a } : {}),
            },
          ];
        }
      }
    } else {
      frame.fills = [];
    }
  }

  // Apply comprehensive flexbox → Auto Layout mapping when enabled
  if (ENABLE_AUTO_LAYOUT && (nodeData.styles.display === "flex" || nodeData.styles.display === "inline-flex")) {
    try {
      console.log(`Applying comprehensive Auto Layout to frame: ${nodeData.id || 'unknown'}`);
      
      // Apply comprehensive flexbox mapping
      applyComprehensiveFlexboxLayout(frame, nodeData);
      
    } catch (error) {
      console.warn(`Failed to apply comprehensive flexbox layout, falling back to basic:`, error);
      // Fallback to basic implementation
      applyBasicFlexboxLayout(frame, nodeData);
    }
  }

  // Border radius
  if (nodeData.styles.borderRadius) {
    const values = nodeData.styles.borderRadius.match(/[\d.]+/g);
    if (values) {
      const radii = values.map((value: string) => parseFloat(value));
      frame.topLeftRadius = radii[0] || 0;
      frame.topRightRadius = radii[1] || radii[0] || 0;
      frame.bottomRightRadius = radii[2] || radii[0] || 0;
      frame.bottomLeftRadius = radii[3] || radii[1] || radii[0] || 0;
    }
  }

  // Border
  if (nodeData.styles.border || nodeData.styles.borderWidth) {
    const color = parseColor(nodeData.styles.borderColor || "#000000");
    const width = parseFloat(nodeData.styles.borderWidth || "1");

    if (color && !isNaN(width)) {
      frame.strokes = [
        {
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
        },
      ];
      frame.strokeWeight = width;
    }
  }

  // Opacity
  if (nodeData.styles.opacity) {
    frame.opacity = parseFloat(nodeData.styles.opacity);
  }

  // Transform
  if (nodeData.styles.transform) {
    const rotateMatch = nodeData.styles.transform.match(/rotate\(([^)]+)deg\)/);
    if (rotateMatch) {
      frame.rotation = parseFloat(rotateMatch[1]);
    }
  }

  // Overflow
  if (
    nodeData.styles.overflow === "hidden" ||
    nodeData.styles.overflowX === "hidden"
  ) {
    frame.clipsContent = true;
  }

  return frame;
}

/**
 * PHASE 5: Apply advanced effects
 */
async function applyAdvancedEffects(node: SceneNode, styles: any) {
  if (!("effects" in node)) return;

  const effects: Effect[] = [];

  // Box shadow (multi-layer support)
  if (styles.boxShadow && styles.boxShadow !== "none") {
    const shadows = parseBoxShadow(styles.boxShadow);
    effects.push(...shadows);
  }

  // Filters (limited Figma support)
  if (styles.filter && styles.filter !== "none") {
    const blurMatch = styles.filter.match(/blur\(([\d.]+)px\)/);
    if (blurMatch) {
      effects.push({
        type: "LAYER_BLUR",
        blurType: "NORMAL",
        radius: parseFloat(blurMatch[1]),
        visible: true,
      });
    }
  }

  if (effects.length > 0) {
    node.effects = effects;
  }
}

/**
 * PHASE 3: Apply screenshot as background
 */
async function applyScreenshotBackground(
  frame: FrameNode,
  screenshotBase64: string
) {
  try {
    console.log(`📸 Applying screenshot to frame: ${frame.name}`);
    const bytes = figma.base64Decode(screenshotBase64);
    const image = figma.createImage(bytes);

    const bg = figma.createRectangle();
    bg.name = "__screenshot-bg";
    bg.resize(frame.width, frame.height);
    bg.fills = [
      {
        type: "IMAGE",
        imageHash: image.hash,
        scaleMode: "FILL",
      },
    ];

    frame.appendChild(bg);
    frame.insertChild(0, bg);
    console.log(`✅ Screenshot applied successfully to ${frame.name}`);
  } catch (e) {
    console.error(`❌ Screenshot background failed for ${frame.name}:`, e);
  }
}

/**
 * PHASE 6: Create pseudo-element
 */
async function createPseudoElement(parent: FrameNode, pseudo: any) {
  if (!pseudo.content) return;

  const pseudoFrame = figma.createFrame();
  pseudoFrame.name = `::${pseudo.type}`;
  pseudoFrame.x = 0;
  pseudoFrame.y = 0;
  pseudoFrame.resize(20, 20);

  // Apply styles
  if (pseudo.styles.backgroundColor) {
    const color = parseColor(pseudo.styles.backgroundColor);
    if (color) {
      pseudoFrame.fills = [
        {
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
        },
      ];
    }
  }

  parent.appendChild(pseudoFrame);
  if (pseudo.type === "before") {
    parent.insertChild(0, pseudoFrame);
  }
}

/**
 * PHASE 6: Create state variants
 */
async function createStateVariants(node: FrameNode, states: any) {
  // Create component set with variants for states
  // For now, just add a note
  node.name = `${node.name} (has states: ${Object.keys(states).join(", ")})`;
}

/**
 * PHASE 5: Parse gradient
 */
function parseGradient(gradientString: string): Paint | null {
  if (!gradientString.includes("linear-gradient")) return null;

  try {
    const match = gradientString.match(/linear-gradient\(([^)]+)\)/);
    if (!match) return null;

    const content = match[1];
    let angle = 180; // Default
    let colorStops: string[] = [];

    // Check for angle
    const parts = content.split(",").map((s) => s.trim());
    if (parts[0].includes("deg") || parts[0].includes("to ")) {
      if (parts[0].includes("deg")) {
        angle = parseFloat(parts[0]);
      } else if (parts[0] === "to right") angle = 90;
      else if (parts[0] === "to left") angle = 270;
      else if (parts[0] === "to top") angle = 0;
      else if (parts[0] === "to bottom") angle = 180;

      colorStops = parts.slice(1);
    } else {
      colorStops = parts;
    }

    const stops: ColorStop[] = [];

    for (let i = 0; i < colorStops.length; i++) {
      const stop = colorStops[i];
      const match = stop.match(/^(.*?)\s+([\d.]+)%?$/);

      if (match) {
        const color = parseColor(match[1]);
        const position = parseFloat(match[2]) / 100;
        if (color) {
          stops.push({
            color: { r: color.r, g: color.g, b: color.b, a: color.a },
            position,
          });
        }
      } else {
        const color = parseColor(stop);
        if (color) {
          stops.push({
            color: { r: color.r, g: color.g, b: color.b, a: color.a },
            position: i / (colorStops.length - 1),
          });
        }
      }
    }

    if (stops.length < 2) return null;

    // Convert angle to transform matrix
    const rad = (angle * Math.PI) / 180;
    const transform: Transform = [
      [Math.cos(rad), Math.sin(rad), 0.5],
      [-Math.sin(rad), Math.cos(rad), 0.5],
    ];

    return {
      type: "GRADIENT_LINEAR",
      gradientTransform: transform,
      gradientStops: stops,
    };
  } catch (e) {
    console.warn("Gradient parsing failed:", e);
    return null;
  }
}

/**
 * PHASE 5: Parse box shadow (multi-layer)
 */
function parseBoxShadow(shadowString: string): Effect[] {
  const shadows = shadowString.split(/,(?![^(]*\))/);
  const effects: Effect[] = [];

  for (const shadow of shadows) {
    const trimmed = shadow.trim();
    const isInset = trimmed.startsWith("inset");
    const str = isInset ? trimmed.substring(5).trim() : trimmed;

    const parts = str.match(
      /(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px)?\s+(.+)/
    );

    if (parts) {
      const color = parseColor(parts[5]) || { r: 0, g: 0, b: 0, a: 0.25 };

      effects.push({
        type: isInset ? "INNER_SHADOW" : "DROP_SHADOW",
        offset: {
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
        },
        radius: parseFloat(parts[3]),
        spread: parts[4] ? parseFloat(parts[4]) : 0,
        color: { r: color.r, g: color.g, b: color.b, a: color.a },
        blendMode: "NORMAL",
        visible: true,
      } as Effect);
    }
  }

  return effects;
}

/**
 * Parse color string
 */
function parseColor(
  color: string
): { r: number; g: number; b: number; a: number } | null {
  if (!color) return null;

  try {
    color = color.trim();

    // Hex
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
      }
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
      }
      if (hex.length === 8) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = parseInt(hex.substring(6, 8), 16);
        return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
      }
    }

    // RGB/RGBA
    if (color.startsWith("rgb")) {
      const values = color.match(/[\d.]+/g);
      if (values && values.length >= 3) {
        const alpha = values.length >= 4 ? parseFloat(values[3]) : 1;
        return {
          r: parseFloat(values[0]) / 255,
          g: parseFloat(values[1]) / 255,
          b: parseFloat(values[2]) / 255,
          a: alpha > 1 ? alpha / 255 : alpha,
        };
      }
    }

    // Named colors
    const named: Record<string, string> = {
      black: "#000000",
      white: "#ffffff",
      red: "#ff0000",
      green: "#008000",
      blue: "#0000ff",
      yellow: "#ffff00",
      transparent: "rgba(0,0,0,0)",
    };
    if (named[color.toLowerCase()]) {
      return parseColor(named[color.toLowerCase()]);
    }
  } catch (e) {}

  return null;
}

/**
 * Ensure font is loaded
 */
async function ensureFontLoaded(family: string, style: string) {
  const key = `${family}__${style}`;
  if (loadedFonts.has(key)) return;

  try {
    await figma.loadFontAsync({ family, style });
    loadedFonts.add(key);
  } catch (e) {
    try {
      await figma.loadFontAsync({ family, style: "Regular" });
      loadedFonts.add(`${family}__Regular`);
    } catch (e2) {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      loadedFonts.add("Inter__Regular");
    }
  }
}

/**
 * Create Figma variables from tokens
 */
async function createFigmaVariables(tokens: any) {
  const variables: Record<string, any> = {};

  try {
    if (!figma.variables) return variables;

    const collections = {
      colors: figma.variables.createVariableCollection("Colors"),
      spacing: figma.variables.createVariableCollection("Spacing"),
      radii: figma.variables.createVariableCollection("Radii"),
    };

    // Process explicit tokens (CSS variables)
    for (const [cssVar, value] of Object.entries(tokens.explicit || {})) {
      if (typeof value !== "string") continue;

      const cleanName = String(cssVar).replace(/^--/, "").replace(/-/g, "/");

      if (value.includes("rgb") || value.includes("#")) {
        const variable = figma.variables.createVariable(
          cleanName,
          collections.colors,
          "COLOR"
        );
        const color = parseColor(value);
        if (color) {
          variable.setValueForMode(collections.colors.modes[0].modeId, {
            r: color.r,
            g: color.g,
            b: color.b,
            a: color.a,
          });
          variables[cssVar] = variable;
        }
      } else if (value.includes("px")) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          const variable = figma.variables.createVariable(
            cleanName,
            collections.spacing,
            "FLOAT"
          );
          variable.setValueForMode(
            collections.spacing.modes[0].modeId,
            numValue
          );
          variables[cssVar] = variable;
        }
      }
    }

    // Process implicit tokens
    for (const [value, name] of Object.entries(tokens.implicit || {})) {
      if (typeof name !== "string" || typeof value !== "string") continue;

      if (value.includes("rgb") || value.includes("#")) {
        const variable = figma.variables.createVariable(
          name,
          collections.colors,
          "COLOR"
        );
        const color = parseColor(value);
        if (color) {
          variable.setValueForMode(collections.colors.modes[0].modeId, {
            r: color.r,
            g: color.g,
            b: color.b,
            a: color.a,
          });
          variables[value] = variable;
        }
      }
    }
  } catch (error) {
    console.error("Variable creation failed:", error);
  }

  return variables;
}

// ==================== COMPREHENSIVE FLEXBOX → AUTO LAYOUT MAPPING ====================

/**
 * Apply comprehensive flexbox → Auto Layout mapping with full CSS feature support
 */
function applyComprehensiveFlexboxLayout(frame: FrameNode, nodeData: any): void {
  const styles = nodeData.styles;
  
  console.log(`Comprehensive flexbox mapping for: ${nodeData.id}`, {
    display: styles.display,
    flexDirection: styles.flexDirection,
    justifyContent: styles.justifyContent,
    alignItems: styles.alignItems,
    flexWrap: styles.flexWrap,
    gap: styles.gap
  });

  // 1. FLEX DIRECTION → LAYOUT MODE
  const direction = styles.flexDirection || "row";
  frame.layoutMode = mapFlexDirectionToLayoutMode(direction);

  // 2. FLEX WRAP DETECTION (unsupported in Figma - warn and continue)
  if (styles.flexWrap && styles.flexWrap !== "nowrap") {
    console.warn(`flex-wrap: ${styles.flexWrap} is not supported in Figma Auto Layout, ignoring`);
  }

  // 3. JUSTIFY CONTENT → PRIMARY AXIS ALIGNMENT
  if (styles.justifyContent) {
    frame.primaryAxisAlignItems = mapJustifyContentToPrimaryAxis(styles.justifyContent);
  }

  // 4. ALIGN ITEMS → COUNTER AXIS ALIGNMENT
  if (styles.alignItems) {
    frame.counterAxisAlignItems = mapAlignItemsToCounterAxis(styles.alignItems);
  }

  // 5. GAP → ITEM SPACING
  if (styles.gap) {
    const gap = parseGapValue(styles.gap);
    if (gap > 0) {
      frame.itemSpacing = gap;
    }
  }

  // 6. PADDING
  if (styles.padding) {
    applyPaddingFromString(frame, styles.padding);
  }

  // 7. AUTO SIZING MODES
  // Set intelligent sizing based on dimensions
  if (styles.width && !styles.width.includes('%') && !styles.width.includes('auto')) {
    frame.primaryAxisSizingMode = frame.layoutMode === "HORIZONTAL" ? "FIXED" : "AUTO";
  } else {
    frame.primaryAxisSizingMode = "AUTO";
  }

  if (styles.height && !styles.height.includes('%') && !styles.height.includes('auto')) {
    frame.counterAxisSizingMode = frame.layoutMode === "VERTICAL" ? "FIXED" : "AUTO";
  } else {
    frame.counterAxisSizingMode = "AUTO";
  }

  console.log(`Applied Auto Layout:`, {
    layoutMode: frame.layoutMode,
    primaryAxisAlignItems: frame.primaryAxisAlignItems,
    counterAxisAlignItems: frame.counterAxisAlignItems,
    itemSpacing: frame.itemSpacing,
    primaryAxisSizingMode: frame.primaryAxisSizingMode,
    counterAxisSizingMode: frame.counterAxisSizingMode
  });
}

/**
 * Map flex-direction to Figma layoutMode
 */
function mapFlexDirectionToLayoutMode(direction: string): "HORIZONTAL" | "VERTICAL" {
  switch (direction) {
    case "column":
    case "column-reverse":
      return "VERTICAL";
    case "row":
    case "row-reverse":
    default:
      return "HORIZONTAL";
  }
}

/**
 * Map justify-content to primaryAxisAlignItems with comprehensive support
 */
function mapJustifyContentToPrimaryAxis(justifyContent: string): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  const mapping: Record<string, "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"> = {
    "flex-start": "MIN",
    "start": "MIN",
    "left": "MIN",
    "center": "CENTER",
    "flex-end": "MAX",
    "end": "MAX",
    "right": "MAX",
    "space-between": "SPACE_BETWEEN",
    "space-around": "CENTER", // Approximate with CENTER
    "space-evenly": "CENTER", // Approximate with CENTER
    "stretch": "MIN" // Not directly supported, use MIN
  };
  
  const result = mapping[justifyContent] || "MIN";
  
  if (justifyContent === "space-around" || justifyContent === "space-evenly") {
    console.warn(`justify-content: ${justifyContent} approximated as CENTER in Figma`);
  }
  
  return result;
}

/**
 * Map align-items to counterAxisAlignItems with comprehensive support
 */
function mapAlignItemsToCounterAxis(alignItems: string): "MIN" | "CENTER" | "MAX" | "BASELINE" {
  // Handle baseline alignment
  if (alignItems.includes("baseline")) {
    return "BASELINE";
  }
  
  const mapping: Record<string, "MIN" | "CENTER" | "MAX" | "BASELINE"> = {
    "flex-start": "MIN",
    "start": "MIN",
    "self-start": "MIN",
    "center": "CENTER",
    "flex-end": "MAX", 
    "end": "MAX",
    "self-end": "MAX",
    "stretch": "MIN", // Figma doesn't have stretch for counter axis, use MIN
    "safe center": "CENTER",
    "unsafe center": "CENTER"
  };
  
  const result = mapping[alignItems] || "MIN";
  
  if (alignItems === "stretch") {
    console.warn(`align-items: stretch mapped to MIN in Figma (stretch not supported for counter axis)`);
  }
  
  return result;
}

/**
 * Parse gap value from CSS string
 */
function parseGapValue(gap: string | number): number {
  if (typeof gap === "number") return gap;
  if (!gap || gap === "normal" || gap === "0") return 0;
  
  // Handle multiple gap values (row column)
  const parts = gap.toString().trim().split(/\s+/);
  const firstValue = parts[0];
  
  // Remove units and parse as float
  const numValue = parseFloat(firstValue.replace(/[a-zA-Z%]+$/, ""));
  return isNaN(numValue) ? 0 : numValue;
}

/**
 * Apply padding from CSS string to Auto Layout frame
 */
function applyPaddingFromString(frame: FrameNode, padding: string): void {
  const values = padding.match(/[\d.]+/g);
  if (values) {
    const nums = values.map(v => parseFloat(v));
    frame.paddingTop = nums[0] || 0;
    frame.paddingRight = nums[1] || nums[0] || 0;
    frame.paddingBottom = nums[2] || nums[0] || 0;
    frame.paddingLeft = nums[3] || nums[1] || nums[0] || 0;
  }
}

/**
 * Apply basic flexbox layout (fallback)
 */
function applyBasicFlexboxLayout(frame: FrameNode, nodeData: any): void {
  const styles = nodeData.styles;
  
  console.log(`Applying basic flexbox layout for: ${nodeData.id}`);
  
  // Basic direction mapping
  frame.layoutMode = (styles.flexDirection === "column") ? "VERTICAL" : "HORIZONTAL";

  // Basic gap
  if (styles.gap) {
    const gap = parseFloat(styles.gap);
    if (!isNaN(gap)) frame.itemSpacing = gap;
  }

  // Basic padding
  if (styles.padding) {
    applyPaddingFromString(frame, styles.padding);
  }

  // Basic alignment
  const justifyMap: Record<string, any> = {
    "flex-start": "MIN",
    center: "CENTER", 
    "flex-end": "MAX",
    "space-between": "SPACE_BETWEEN",
  };
  if (styles.justifyContent && justifyMap[styles.justifyContent]) {
    frame.primaryAxisAlignItems = justifyMap[styles.justifyContent];
  }

  const alignMap: Record<string, any> = {
    "flex-start": "MIN",
    center: "CENTER",
    "flex-end": "MAX",
    stretch: "STRETCH",
  };
  if (styles.alignItems && alignMap[styles.alignItems]) {
    frame.counterAxisAlignItems = alignMap[styles.alignItems];
  }
}

/**
 * Apply flex item properties to individual nodes within Auto Layout containers
 */
function applyFlexItemProperties(node: SceneNode, nodeData: any): void {
  const styles = nodeData.styles;
  
  if (!styles) return;
  
  // Apply layoutGrow for flex-grow behavior
  if ('layoutGrow' in node && styles.flexGrow) {
    const flexGrow = parseFloat(styles.flexGrow);
    if (flexGrow > 0) {
      (node as any).layoutGrow = flexGrow;
      console.log(`Applied layoutGrow ${flexGrow} to ${nodeData.id}`);
    }
  }
  
  // Apply layoutAlign for align-self behavior
  if ('layoutAlign' in node && styles.alignSelf && styles.alignSelf !== 'auto') {
    const alignSelf = mapAlignItemsToCounterAxis(styles.alignSelf);
    (node as any).layoutAlign = alignSelf;
    console.log(`Applied alignSelf ${alignSelf} to ${nodeData.id}`);
  }
  
  // Note: flex order is handled through layer ordering in Figma
  if (styles.order && parseInt(styles.order) !== 0) {
    console.log(`Flex order ${styles.order} noted for ${nodeData.id} (handled via layer order)`);
  }
}
