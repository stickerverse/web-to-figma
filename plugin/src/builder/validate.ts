/**
 * FIDELITY VALIDATION SYSTEM
 * 
 * Validates pixel-perfect accuracy and generates comprehensive metrics
 * Ensures the build meets acceptance criteria
 */

import { DrawableItem, FigmaNodeResult, BuilderMetrics } from './index';

export class FidelityValidator {
  
  /**
   * Validate all created nodes against original capture data
   */
  async validate(nodes: FigmaNodeResult[], originalItems: DrawableItem[]): Promise<BuilderMetrics> {
    const startTime = Date.now();
    
    console.log(`🔍 Validating ${nodes.length} nodes against ${originalItems.length} captured elements...`);
    
    const metrics: BuilderMetrics = {
      summary: { pages: 0, nodes_created: 0, build_ms: 0 },
      histogram: this.calculateNodeHistogram(nodes),
      fidelity: await this.calculateFidelityMetrics(nodes, originalItems),
      fonts: await this.calculateFontMetrics(nodes, originalItems),
      images: await this.calculateImageMetrics(nodes, originalItems),
      gradients: this.calculateGradientMetrics(nodes),
      effects: this.calculateEffectsMetrics(nodes),
      constraints: this.calculateConstraintsMetrics(nodes),
      rasterizations: this.findRasterizations(nodes, originalItems),
      skipped: this.findSkippedElements(nodes, originalItems),
      violations: this.findViolations(nodes, originalItems)
    };
    
    console.log(`✅ Validation completed in ${Date.now() - startTime}ms`);
    
    return metrics;
  }

  /**
   * Calculate node type distribution
   */
  private calculateNodeHistogram(nodes: FigmaNodeResult[]): Record<string, number> {
    const histogram: Record<string, number> = {
      'FRAME': 0,
      'SECTION': 0,
      'RECTANGLE': 0,
      'ELLIPSE': 0,
      'LINE': 0,
      'POLYGON': 0,
      'STAR': 0,
      'VECTOR': 0,
      'BOOLEAN_OPERATION': 0,
      'SLICE': 0,
      'TEXT': 0,
      'COMPONENT': 0,
      'INSTANCE': 0,
      'COMPONENT_SET': 0,
      'GROUP': 0
    };
    
    for (const nodeResult of nodes) {
      const type = nodeResult.type;
      if (type in histogram) {
        histogram[type]++;
      }
    }
    
    return histogram;
  }

  /**
   * Calculate position and size accuracy metrics
   */
  private async calculateFidelityMetrics(
    nodes: FigmaNodeResult[], 
    originalItems: DrawableItem[]
  ): Promise<BuilderMetrics['fidelity']> {
    const posErrors: number[] = [];
    const sizeErrors: number[] = [];
    
    for (const nodeResult of nodes) {
      if (!nodeResult.element) continue;
      
      const originalItem = originalItems.find(item => item.element.id === nodeResult.element!.id);
      if (!originalItem) continue;
      
      const node = nodeResult.node as SceneNode;
      const original = originalItem.worldRect;
      
      // Position error
      const posErrorX = Math.abs(node.x - original.x);
      const posErrorY = Math.abs(node.y - original.y);
      const posError = Math.sqrt(posErrorX * posErrorX + posErrorY * posErrorY);
      posErrors.push(posError);
      
      // Size error
      if ('width' in node && 'height' in node) {
        const sizeErrorW = Math.abs(node.width - original.width);
        const sizeErrorH = Math.abs(node.height - original.height);
        const sizeError = Math.sqrt(sizeErrorW * sizeErrorW + sizeErrorH * sizeErrorH);
        sizeErrors.push(sizeError);
      }
    }
    
    return {
      pos_err_mean_px: this.calculateMean(posErrors),
      pos_err_p95_px: this.calculatePercentile(posErrors, 95),
      size_err_mean_px: this.calculateMean(sizeErrors),
      size_err_p95_px: this.calculatePercentile(sizeErrors, 95)
    };
  }

  /**
   * Calculate font matching accuracy
   */
  private async calculateFontMetrics(
    nodes: FigmaNodeResult[], 
    originalItems: DrawableItem[]
  ): Promise<BuilderMetrics['fonts']> {
    const fontMatches: boolean[] = [];
    const fallbacks: Array<{ selector: string; requested: string; actual: string; impact: string }> = [];
    
    for (const nodeResult of nodes) {
      if (nodeResult.type !== 'TEXT' || !nodeResult.element) continue;
      
      const textNode = nodeResult.node as TextNode;
      const originalItem = originalItems.find(item => item.element.id === nodeResult.element!.id);
      if (!originalItem) continue;
      
      const requestedFont = originalItem.element.styles.fontFamily;
      const actualFont = textNode.fontName;
      
      if (requestedFont && typeof actualFont === 'object') {
        const requested = this.cleanFontName(requestedFont);
        const actual = actualFont.family;
        
        const isMatch = this.isFontMatch(requested, actual);
        fontMatches.push(isMatch);
        
        if (!isMatch) {
          fallbacks.push({
            selector: originalItem.element.selector,
            requested: requested,
            actual: actual,
            impact: this.calculateFontImpact(originalItem, textNode)
          });
        }
      }
    }
    
    return {
      match_rate: fontMatches.length > 0 ? fontMatches.filter(Boolean).length / fontMatches.length : 1,
      fallbacks
    };
  }

  /**
   * Calculate image mapping statistics
   */
  private async calculateImageMetrics(
    nodes: FigmaNodeResult[], 
    originalItems: DrawableItem[]
  ): Promise<BuilderMetrics['images']> {
    const objectFitMappings: Record<string, number> = {
      'FILL': 0,
      'FIT': 0,
      'TILE': 0,
      'CROP': 0
    };
    
    let dprNormalized = 0;
    
    for (const nodeResult of nodes) {
      if (!nodeResult.element) continue;
      
      const node = nodeResult.node as SceneNode;
      if (!('fills' in node)) continue;
      
      const fills = node.fills as Paint[];
      for (const fill of fills) {
        if (fill.type === 'IMAGE') {
          const scaleMode = fill.scaleMode || 'FILL';
          if (scaleMode in objectFitMappings) {
            objectFitMappings[scaleMode]++;
          }
          
          // Check if DPR was normalized
          if (this.isDPRNormalized(fill, nodeResult.element.image)) {
            dprNormalized++;
          }
        }
      }
    }
    
    return {
      object_fit_mappings: objectFitMappings,
      dpr_normalized: dprNormalized
    };
  }

  /**
   * Calculate gradient type distribution
   */
  private calculateGradientMetrics(nodes: FigmaNodeResult[]): Record<string, number> {
    const gradients: Record<string, number> = {
      'linear': 0,
      'radial': 0,
      'angular': 0,
      'diamond': 0
    };
    
    for (const nodeResult of nodes) {
      const node = nodeResult.node as SceneNode;
      if (!('fills' in node)) continue;
      
      const fills = node.fills as Paint[];
      for (const fill of fills) {
        if (fill.type === 'GRADIENT_LINEAR') {
          gradients.linear++;
        } else if (fill.type === 'GRADIENT_RADIAL') {
          gradients.radial++;
        } else if (fill.type === 'GRADIENT_ANGULAR') {
          gradients.angular++;
        } else if (fill.type === 'GRADIENT_DIAMOND') {
          gradients.diamond++;
        }
      }
    }
    
    return gradients;
  }

  /**
   * Calculate effects distribution
   */
  private calculateEffectsMetrics(nodes: FigmaNodeResult[]): Record<string, number> {
    const effects: Record<string, number> = {
      'drop': 0,
      'inner': 0,
      'layer_blur': 0,
      'background_blur': 0
    };
    
    for (const nodeResult of nodes) {
      const node = nodeResult.node as SceneNode;
      if (!('effects' in node)) continue;
      
      const nodeEffects = node.effects as Effect[];
      for (const effect of nodeEffects) {
        if (effect.type === 'DROP_SHADOW') {
          effects.drop++;
        } else if (effect.type === 'INNER_SHADOW') {
          effects.inner++;
        } else if (effect.type === 'LAYER_BLUR') {
          effects.layer_blur++;
        } else if (effect.type === 'BACKGROUND_BLUR') {
          effects.background_blur++;
        }
      }
    }
    
    return effects;
  }

  /**
   * Calculate constraints usage
   */
  private calculateConstraintsMetrics(nodes: FigmaNodeResult[]): BuilderMetrics['constraints'] {
    let framesWithConstraints = 0;
    let framesWithLayoutGrids = 0;
    
    for (const nodeResult of nodes) {
      const node = nodeResult.node as SceneNode;
      
      if ('constraints' in node && node.constraints) {
        // Check if constraints are meaningfully set (not default)
        const constraints = node.constraints;
        if (constraints.horizontal !== 'LEFT' || constraints.vertical !== 'TOP') {
          framesWithConstraints++;
        }
      }
      
      if ('layoutGrids' in node && (node as FrameNode).layoutGrids.length > 0) {
        framesWithLayoutGrids++;
      }
    }
    
    return {
      frames_with_constraints: framesWithConstraints,
      frames_with_layout_grids: framesWithLayoutGrids
    };
  }

  /**
   * Find elements that were rasterized instead of vectorized
   */
  private findRasterizations(
    nodes: FigmaNodeResult[], 
    originalItems: DrawableItem[]
  ): Array<{ selector: string; reason: string }> {
    const rasterizations: Array<{ selector: string; reason: string }> = [];
    
    for (const nodeResult of nodes) {
      if (!nodeResult.element) continue;
      
      const node = nodeResult.node as SceneNode;
      const originalItem = originalItems.find(item => item.element.id === nodeResult.element!.id);
      if (!originalItem) continue;
      
      // Check if SVG was rasterized instead of vectorized
      if (originalItem.element.svg && nodeResult.type !== 'VECTOR') {
        rasterizations.push({
          selector: originalItem.element.selector,
          reason: `SVG element rendered as ${nodeResult.type} instead of VECTOR`
        });
      }
      
      // Check if complex effects caused rasterization
      if (this.hasUnsupportedEffects(originalItem.element)) {
        rasterizations.push({
          selector: originalItem.element.selector,
          reason: 'Complex CSS effects not representable in Figma'
        });
      }
    }
    
    return rasterizations;
  }

  /**
   * Find elements that were completely skipped
   */
  private findSkippedElements(
    nodes: FigmaNodeResult[], 
    originalItems: DrawableItem[]
  ): Array<{ selector: string; reason: string }> {
    const skipped: Array<{ selector: string; reason: string }> = [];
    const createdElementIds = new Set(nodes.map(n => n.element?.id).filter(Boolean));
    
    for (const originalItem of originalItems) {
      if (!createdElementIds.has(originalItem.element.id)) {
        skipped.push({
          selector: originalItem.element.selector,
          reason: this.determineSkipReason(originalItem.element)
        });
      }
    }
    
    return skipped;
  }

  /**
   * Find violations of the mapping rules
   */
  private findViolations(
    nodes: FigmaNodeResult[], 
    originalItems: DrawableItem[]
  ): Array<{ selector: string; rule: string; detail: string }> {
    const violations: Array<{ selector: string; rule: string; detail: string }> = [];
    
    for (const nodeResult of nodes) {
      if (!nodeResult.element) continue;
      
      const originalItem = originalItems.find(item => item.element.id === nodeResult.element!.id);
      if (!originalItem) continue;
      
      // Check for incorrect node type mapping
      const expectedType = this.getExpectedNodeType(originalItem.element);
      if (expectedType !== nodeResult.type) {
        violations.push({
          selector: originalItem.element.selector,
          rule: 'Node type mapping',
          detail: `Expected ${expectedType}, got ${nodeResult.type}`
        });
      }
      
      // Check for missing multiple paints
      if (this.shouldHaveMultiplePaints(originalItem.element) && !this.hasMultiplePaints(nodeResult.node)) {
        violations.push({
          selector: originalItem.element.selector,
          rule: 'Multiple paints preservation',
          detail: 'Element with multiple backgrounds should have multiple paints'
        });
      }
    }
    
    return violations;
  }

  // Utility methods
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private cleanFontName(fontFamily: string): string {
    return fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  }

  private isFontMatch(requested: string, actual: string): boolean {
    // Exact match
    if (requested.toLowerCase() === actual.toLowerCase()) {
      return true;
    }
    
    // Common font mappings
    const fontMappings: Record<string, string[]> = {
      'helvetica': ['helvetica', 'helvetica neue', 'arial'],
      'times': ['times', 'times new roman', 'georgia'],
      'courier': ['courier', 'courier new', 'monaco', 'menlo']
    };
    
    const requestedLower = requested.toLowerCase();
    const actualLower = actual.toLowerCase();
    
    for (const [family, variants] of Object.entries(fontMappings)) {
      if (variants.includes(requestedLower) && variants.includes(actualLower)) {
        return true;
      }
    }
    
    return false;
  }

  private calculateFontImpact(originalItem: DrawableItem, textNode: TextNode): string {
    // Measure visual impact of font fallback
    const originalMetrics = this.estimateTextMetrics(originalItem);
    const actualMetrics = this.measureTextNode(textNode);
    
    const widthDiff = Math.abs(originalMetrics.width - actualMetrics.width) / originalMetrics.width;
    const heightDiff = Math.abs(originalMetrics.height - actualMetrics.height) / originalMetrics.height;
    
    if (widthDiff > 0.1 || heightDiff > 0.1) {
      return 'High impact - significant size difference';
    } else if (widthDiff > 0.05 || heightDiff > 0.05) {
      return 'Medium impact - noticeable difference';
    } else {
      return 'Low impact - minimal difference';
    }
  }

  private estimateTextMetrics(originalItem: DrawableItem): { width: number; height: number } {
    return {
      width: originalItem.worldRect.width,
      height: originalItem.worldRect.height
    };
  }

  private measureTextNode(textNode: TextNode): { width: number; height: number } {
    return {
      width: textNode.width,
      height: textNode.height
    };
  }

  private isDPRNormalized(fill: ImagePaint, originalImage?: any): boolean {
    // Check if image was properly normalized for device pixel ratio
    return !!(originalImage && originalImage.dpr && originalImage.dpr > 1);
  }

  private hasUnsupportedEffects(element: any): boolean {
    return !!(
      element.styles.filter?.includes('hue-rotate') ||
      element.styles.filter?.includes('saturate') ||
      element.styles.filter?.includes('contrast') ||
      element.styles.mixBlendMode &&
      !['normal', 'multiply', 'screen', 'overlay'].includes(element.styles.mixBlendMode)
    );
  }

  private determineSkipReason(element: any): string {
    if (!element.rect || element.rect.width === 0 || element.rect.height === 0) {
      return 'Zero-dimension element';
    }
    
    if (element.styles.display === 'none' || element.styles.visibility === 'hidden') {
      return 'Hidden element';
    }
    
    if (element.styles.opacity === '0') {
      return 'Transparent element';
    }
    
    return 'Unknown reason';
  }

  private getExpectedNodeType(element: any): string {
    // This should match the logic in NodeMapper
    if (element.text?.trim()) return 'TEXT';
    if (element.svg) return 'VECTOR';
    if (element.tagName === 'img') return 'RECTANGLE'; // Image fills
    return 'FRAME';
  }

  private shouldHaveMultiplePaints(element: any): boolean {
    const bg = element.styles.backgroundImage || '';
    return bg.includes(',') || (bg.includes('gradient') && element.styles.backgroundColor);
  }

  private hasMultiplePaints(node: SceneNode): boolean {
    if (!('fills' in node)) return false;
    return (node.fills as Paint[]).length > 1;
  }
}