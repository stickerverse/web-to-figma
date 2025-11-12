/**
 * FIGMA PLUGIN BUILDER - MASTER ORCHESTRATOR
 * 
 * Converts captured website JSON into 100% pixel-perfect Figma nodes
 * Following the builder specification for maximum fidelity and accuracy
 */

import { NodeMapper } from './mapping';
import { VectorProcessor } from './vectors';
import { TextProcessor } from './text';
import { PaintProcessor } from './paints';
import { EffectsProcessor } from './effects';
import { ConstraintsProcessor } from './constraints';
import { TransformProcessor } from './transforms';
import { FidelityValidator } from './validate';

export interface CaptureData {
  elements: CapturedElement[];
  viewport: { width: number; height: number };
  route?: string;
  assets: AssetMap;
}

export interface CapturedElement {
  id: string;
  selector: string;
  tagName: string;
  rect: { x: number; y: number; width: number; height: number };
  styles: ComputedStyles;
  zIndex: number;
  stacking: StackingContext;
  transform?: TransformMatrix;
  text?: string;
  image?: ImageData;
  svg?: SVGData;
  pseudoElements?: PseudoElement[];
  componentHints?: ComponentHints;
}

export interface ComputedStyles {
  // Layout
  position?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  padding?: string;
  margin?: string;
  
  // Visual
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  color?: string;
  opacity?: string;
  overflow?: string;
  
  // Typography
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  
  // Effects
  borderRadius?: string;
  border?: string;
  borderWidth?: string;
  borderColor?: string;
  boxShadow?: string;
  filter?: string;
  transform?: string;
  mixBlendMode?: string;
  
  // Masking & Clipping
  clipPath?: string;
  mask?: string;
}

export interface BuilderMetrics {
  summary: {
    pages: number;
    nodes_created: number;
    build_ms: number;
  };
  histogram: Record<string, number>;
  fidelity: {
    pos_err_mean_px: number;
    pos_err_p95_px: number;
    size_err_mean_px: number;
    size_err_p95_px: number;
  };
  fonts: {
    match_rate: number;
    fallbacks: Array<{
      selector: string;
      requested: string;
      actual: string;
      impact: string;
    }>;
  };
  images: {
    object_fit_mappings: Record<string, number>;
    dpr_normalized: number;
  };
  gradients: Record<string, number>;
  effects: Record<string, number>;
  constraints: {
    frames_with_constraints: number;
    frames_with_layout_grids: number;
  };
  rasterizations: Array<{
    selector: string;
    reason: string;
  }>;
  skipped: Array<{
    selector: string;
    reason: string;
  }>;
  violations: Array<{
    selector: string;
    rule: string;
    detail: string;
  }>;
}

export class FigmaBuilder {
  private nodeMapper: NodeMapper;
  private vectorProcessor: VectorProcessor;
  private textProcessor: TextProcessor;
  private paintProcessor: PaintProcessor;
  private effectsProcessor: EffectsProcessor;
  private constraintsProcessor: ConstraintsProcessor;
  private transformProcessor: TransformProcessor;
  private validator: FidelityValidator;

  constructor() {
    this.nodeMapper = new NodeMapper();
    this.vectorProcessor = new VectorProcessor();
    this.textProcessor = new TextProcessor();
    this.paintProcessor = new PaintProcessor();
    this.effectsProcessor = new EffectsProcessor();
    this.constraintsProcessor = new ConstraintsProcessor();
    this.transformProcessor = new TransformProcessor();
    this.validator = new FidelityValidator();
  }

  /**
   * Main build pipeline - converts captured JSON to pixel-perfect Figma nodes
   */
  async build(captureData: CaptureData): Promise<BuilderMetrics> {
    const startTime = Date.now();
    
    try {
      // Phase 1: Prepass - Build drawable items with resolved properties
      console.log('🔍 Builder Phase 1: Prepass analysis...');
      const drawableItems = await this.createDrawableItems(captureData);
      
      // Phase 2: Stacking & Ordering - Sort by paint order and partition
      console.log('📚 Builder Phase 2: Stacking analysis...');
      const stackedItems = this.computeStackingOrder(drawableItems);
      
      // Phase 3: Node Creation - Create Figma nodes with exact positioning
      console.log('🔧 Builder Phase 3: Node creation...');
      const createdNodes = await this.createFigmaNodes(stackedItems, captureData);
      
      // Phase 4: Validation - Check fidelity and measure accuracy
      console.log('✅ Builder Phase 4: Validation...');
      const metrics = await this.validator.validate(createdNodes, drawableItems);
      
      // Add summary metrics
      metrics.summary = {
        pages: 1,
        nodes_created: createdNodes.length,
        build_ms: Date.now() - startTime
      };
      
      // Log final metrics to console
      console.log('📊 BUILDER METRICS:', JSON.stringify(metrics, null, 2));
      
      // Check acceptance criteria
      this.checkAcceptanceCriteria(metrics);
      
      return metrics;
      
    } catch (error) {
      console.error('❌ Builder failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Create drawable items with resolved world coordinates
   */
  private async createDrawableItems(captureData: CaptureData): Promise<DrawableItem[]> {
    const items: DrawableItem[] = [];
    
    for (const element of captureData.elements) {
      const item: DrawableItem = {
        element,
        worldRect: this.transformProcessor.computeWorldRect(element),
        zOrder: this.computePaintOrder(element),
        resolvedStyles: await this.resolveStyles(element, captureData),
        assetRefs: this.extractAssetRefs(element, captureData.assets)
      };
      
      items.push(item);
    }
    
    return items;
  }

  /**
   * Phase 2: Compute stacking contexts and paint order
   */
  private computeStackingOrder(items: DrawableItem[]): StackedItems {
    // Sort by paint order within stacking contexts
    const sorted = items.sort((a, b) => {
      // Compare stacking context first
      const stackingDiff = a.element.stacking.level - b.element.stacking.level;
      if (stackingDiff !== 0) return stackingDiff;
      
      // Then by z-index within same stacking context
      const zDiff = a.zOrder - b.zOrder;
      if (zDiff !== 0) return zDiff;
      
      // Finally by DOM order
      return a.element.id.localeCompare(b.element.id);
    });
    
    // Partition into PAGE → SECTION → FRAME buckets
    return this.partitionIntoHierarchy(sorted);
  }

  /**
   * Phase 3: Create actual Figma nodes
   */
  private async createFigmaNodes(stackedItems: StackedItems, captureData: CaptureData): Promise<FigmaNodeResult[]> {
    const results: FigmaNodeResult[] = [];
    
    // Create page structure
    const page = this.createPageStructure(captureData);
    results.push({ type: 'PAGE', node: page, element: null });
    
    // Create sections
    for (const section of stackedItems.sections) {
      const sectionFrame = await this.createSection(section, page);
      results.push({ type: 'SECTION', node: sectionFrame, element: section.rootElement });
      
      // Create frames and primitives
      for (const item of section.items) {
        const figmaNode = await this.createNodeFromItem(item, sectionFrame);
        if (figmaNode) {
          results.push({ type: this.nodeMapper.getNodeType(item.element), node: figmaNode, element: item.element });
        }
      }
    }
    
    return results;
  }

  /**
   * Create individual Figma node from drawable item
   */
  private async createNodeFromItem(item: DrawableItem, parent: FrameNode | SectionNode): Promise<SceneNode | null> {
    const nodeType = this.nodeMapper.getNodeType(item.element);
    
    let node: SceneNode | null = null;
    
    switch (nodeType) {
      case 'TEXT':
        node = await this.textProcessor.createTextNode(item);
        break;
        
      case 'VECTOR':
        node = await this.vectorProcessor.createVectorNode(item);
        break;
        
      case 'RECTANGLE':
        node = await this.createRectangleNode(item);
        break;
        
      case 'ELLIPSE':
        node = await this.createEllipseNode(item);
        break;
        
      case 'FRAME':
        node = await this.createFrameNode(item);
        break;
        
      case 'COMPONENT':
        node = await this.createComponentNode(item);
        break;
        
      case 'BOOLEAN_OPERATION':
        node = await this.vectorProcessor.createBooleanOperation(item);
        break;
        
      default:
        console.warn(`Unsupported node type: ${nodeType} for element ${item.element.selector}`);
        return null;
    }
    
    if (!node) return null;
    
    // Apply universal properties
    await this.applyUniversalProperties(node, item);
    
    // Add to parent
    if ('appendChild' in parent) {
      parent.appendChild(node);
    }
    
    return node;
  }

  /**
   * Apply properties common to all node types
   */
  private async applyUniversalProperties(node: SceneNode, item: DrawableItem): Promise<void> {
    // Position and size
    node.x = item.worldRect.x;
    node.y = item.worldRect.y;
    
    if ('resize' in node) {
      node.resize(
        Math.max(0.1, item.worldRect.width),
        Math.max(0.1, item.worldRect.height)
      );
    }
    
    // Name
    node.name = this.generateNodeName(item.element);
    
    // Apply paints and fills
    if ('fills' in node) {
      const fills = await this.paintProcessor.createFills(item);
      if (fills.length > 0) {
        node.fills = fills;
      }
    }
    
    // Apply strokes
    if ('strokes' in node) {
      const strokes = await this.paintProcessor.createStrokes(item);
      if (strokes.length > 0) {
        node.strokes = strokes;
      }
    }
    
    // Apply effects
    if ('effects' in node) {
      const effects = await this.effectsProcessor.createEffects(item);
      if (effects.length > 0) {
        node.effects = effects;
      }
    }
    
    // Apply constraints
    if ('constraints' in node) {
      const constraints = this.constraintsProcessor.computeConstraints(item);
      if (constraints) {
        node.constraints = constraints;
      }
    }
    
    // Apply transforms
    if (item.element.transform) {
      this.transformProcessor.applyTransform(node, item.element.transform);
    }
  }

  /**
   * Check if build meets acceptance criteria
   */
  private checkAcceptanceCriteria(metrics: BuilderMetrics): void {
    const { fidelity, fonts } = metrics;
    
    const posErrorMean = fidelity.pos_err_mean_px;
    const posErrorP95 = fidelity.pos_err_p95_px;
    const sizeErrorMean = fidelity.size_err_mean_px;
    const sizeErrorP95 = fidelity.size_err_p95_px;
    
    const violations: string[] = [];
    
    if (posErrorMean > 0.5) {
      violations.push(`Position error mean ${posErrorMean.toFixed(2)}px > 0.5px threshold`);
    }
    
    if (posErrorP95 > 1.0) {
      violations.push(`Position error P95 ${posErrorP95.toFixed(2)}px > 1.0px threshold`);
    }
    
    if (sizeErrorMean > 0.5) {
      violations.push(`Size error mean ${sizeErrorMean.toFixed(2)}px > 0.5px threshold`);
    }
    
    if (sizeErrorP95 > 1.0) {
      violations.push(`Size error P95 ${sizeErrorP95.toFixed(2)}px > 1.0px threshold`);
    }
    
    if (fonts.match_rate < 0.98) {
      violations.push(`Font match rate ${(fonts.match_rate * 100).toFixed(1)}% < 98% threshold`);
    }
    
    if (violations.length > 0) {
      console.error('❌ ACCEPTANCE CRITERIA FAILED:');
      violations.forEach(v => console.error(`  - ${v}`));
      throw new Error('Build failed acceptance criteria');
    }
    
    console.log('✅ ACCEPTANCE CRITERIA PASSED - Build meets quality standards');
  }

  // Utility methods
  private computePaintOrder(element: CapturedElement): number {
    return element.stacking.paintOrder || element.zIndex || 0;
  }

  private async resolveStyles(element: CapturedElement, captureData: CaptureData): Promise<ResolvedStyles> {
    return {
      ...element.styles,
      // Add any computed/resolved properties here
    };
  }

  private extractAssetRefs(element: CapturedElement, assets: AssetMap): AssetRef[] {
    return [];
  }

  private partitionIntoHierarchy(items: DrawableItem[]): StackedItems {
    return {
      sections: [{
        rootElement: items[0]?.element,
        items: items
      }]
    };
  }

  private createPageStructure(captureData: CaptureData): PageNode {
    return figma.currentPage;
  }

  private async createSection(section: any, page: PageNode): Promise<SectionNode> {
    const sectionNode = figma.createSection();
    sectionNode.name = section.rootElement?.tagName || 'Section';
    page.appendChild(sectionNode);
    return sectionNode;
  }

  private async createRectangleNode(item: DrawableItem): Promise<RectangleNode> {
    return figma.createRectangle();
  }

  private async createEllipseNode(item: DrawableItem): Promise<EllipseNode> {
    return figma.createEllipse();
  }

  private async createFrameNode(item: DrawableItem): Promise<FrameNode> {
    return figma.createFrame();
  }

  private async createComponentNode(item: DrawableItem): Promise<ComponentNode> {
    return figma.createComponent();
  }

  private generateNodeName(element: CapturedElement): string {
    return element.componentHints?.name || 
           element.tagName || 
           element.selector.split(' ').pop() || 
           'Element';
  }
}

// Type definitions
export interface DrawableItem {
  element: CapturedElement;
  worldRect: { x: number; y: number; width: number; height: number };
  zOrder: number;
  resolvedStyles: ResolvedStyles;
  assetRefs: AssetRef[];
}

export interface StackedItems {
  sections: Array<{
    rootElement: CapturedElement | undefined;
    items: DrawableItem[];
  }>;
}

export interface FigmaNodeResult {
  type: string;
  node: SceneNode | PageNode | SectionNode;
  element: CapturedElement | null;
}

export interface ResolvedStyles extends ComputedStyles {
  [key: string]: any;
}

export interface AssetRef {
  type: 'image' | 'font' | 'icon';
  url: string;
  hash?: string;
}

export interface AssetMap {
  [key: string]: any;
}

export interface StackingContext {
  level: number;
  paintOrder: number;
}

export interface TransformMatrix {
  matrix: number[];
}

export interface ImageData {
  url: string;
  data?: string;
  width: number;
  height: number;
}

export interface SVGData {
  content: string;
  paths: SVGPath[];
}

export interface SVGPath {
  d: string;
  fill?: string;
  stroke?: string;
}

export interface PseudoElement {
  type: 'before' | 'after';
  content: string;
  styles: ComputedStyles;
}

export interface ComponentHints {
  name?: string;
  variant?: string;
  role?: string;
}