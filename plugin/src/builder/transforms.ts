/**
 * TRANSFORM PROCESSING SYSTEM
 * 
 * Handles CSS transforms, coordinate systems, and world positioning
 * Flattens transform matrices and converts to absolute coordinates
 */

import { DrawableItem, TransformMatrix } from './index';

export class TransformProcessor {

  /**
   * Compute world rectangle with all transforms applied
   */
  computeWorldRect(element: any): { x: number; y: number; width: number; height: number } {
    const baseRect = element.rect;
    
    if (!element.transform) {
      return baseRect;
    }
    
    // Apply transform matrix to rectangle
    const transformedRect = this.applyTransformToRect(baseRect, element.transform);
    
    return transformedRect;
  }

  /**
   * Apply CSS transform to Figma node
   */
  applyTransform(node: SceneNode, transform: TransformMatrix): void {
    const matrix = transform.matrix;
    
    if (matrix.length >= 6) {
      const [a, b, c, d, tx, ty] = matrix;
      
      // Extract rotation from matrix
      const rotation = this.extractRotation(a, b, c, d);
      if (Math.abs(rotation) > 0.001) { // Only apply if significant rotation
        node.rotation = rotation;
      }
      
      // Extract scale from matrix
      const scale = this.extractScale(a, b, c, d);
      if (Math.abs(scale.x - 1) > 0.001 || Math.abs(scale.y - 1) > 0.001) {
        // Figma doesn't have direct scale property, we could resize the node
        // or note this as an approximation limitation
        console.warn('Scale transforms require approximation in Figma');
      }
      
      // Extract skew
      const skew = this.extractSkew(a, b, c, d);
      if (Math.abs(skew) > 0.001) {
        console.warn('Skew transforms not supported in Figma, approximation needed');
      }
      
      // Translation is handled by absolute positioning
      // tx, ty are already factored into the world coordinates
    }
  }

  /**
   * Parse CSS transform string into matrix
   */
  parseCSSTransform(transform: string): TransformMatrix | null {
    if (!transform || transform === 'none') {
      return null;
    }
    
    // Start with identity matrix
    let matrix = [1, 0, 0, 1, 0, 0];
    
    // Parse individual transform functions
    const functions = this.parseTransformFunctions(transform);
    
    for (const func of functions) {
      const funcMatrix = this.transformFunctionToMatrix(func);
      if (funcMatrix) {
        matrix = this.multiplyMatrices(matrix, funcMatrix);
      }
    }
    
    return { matrix };
  }

  /**
   * Apply transform matrix to rectangle
   */
  private applyTransformToRect(
    rect: { x: number; y: number; width: number; height: number },
    transform: TransformMatrix
  ): { x: number; y: number; width: number; height: number } {
    const matrix = transform.matrix;
    
    if (matrix.length < 6) {
      return rect;
    }
    
    const [a, b, c, d, tx, ty] = matrix;
    
    // Transform all four corners of the rectangle
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ];
    
    const transformedCorners = corners.map(corner => ({
      x: a * corner.x + c * corner.y + tx,
      y: b * corner.x + d * corner.y + ty
    }));
    
    // Find bounding box of transformed corners
    const minX = Math.min(...transformedCorners.map(c => c.x));
    const maxX = Math.max(...transformedCorners.map(c => c.x));
    const minY = Math.min(...transformedCorners.map(c => c.y));
    const maxY = Math.max(...transformedCorners.map(c => c.y));
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Extract rotation angle from transform matrix
   */
  private extractRotation(a: number, b: number, c: number, d: number): number {
    // Calculate rotation in radians, then convert to degrees
    const rotation = Math.atan2(b, a);
    return rotation * (180 / Math.PI);
  }

  /**
   * Extract scale from transform matrix
   */
  private extractScale(a: number, b: number, c: number, d: number): { x: number; y: number } {
    const scaleX = Math.sqrt(a * a + b * b);
    const scaleY = Math.sqrt(c * c + d * d);
    
    return { x: scaleX, y: scaleY };
  }

  /**
   * Extract skew from transform matrix
   */
  private extractSkew(a: number, b: number, c: number, d: number): number {
    const scale = this.extractScale(a, b, c, d);
    
    // Remove scale to isolate skew
    const normalizedA = a / scale.x;
    const normalizedC = c / scale.y;
    
    // Calculate skew angle
    return Math.atan2(normalizedC, normalizedA) * (180 / Math.PI);
  }

  /**
   * Parse CSS transform functions
   */
  private parseTransformFunctions(transform: string): TransformFunction[] {
    const functions: TransformFunction[] = [];
    const regex = /(\w+)\(([^)]+)\)/g;
    let match;
    
    while ((match = regex.exec(transform)) !== null) {
      const name = match[1];
      const args = match[2].split(',').map(arg => arg.trim());
      
      functions.push({ name, args });
    }
    
    return functions;
  }

  /**
   * Convert transform function to matrix
   */
  private transformFunctionToMatrix(func: TransformFunction): number[] | null {
    const { name, args } = func;
    
    switch (name) {
      case 'translateX':
        const tx = this.parseValue(args[0]);
        return [1, 0, 0, 1, tx, 0];
        
      case 'translateY':
        const ty = this.parseValue(args[0]);
        return [1, 0, 0, 1, 0, ty];
        
      case 'translate':
        const translateX = this.parseValue(args[0]);
        const translateY = args[1] ? this.parseValue(args[1]) : 0;
        return [1, 0, 0, 1, translateX, translateY];
        
      case 'scaleX':
        const sx = parseFloat(args[0]);
        return [sx, 0, 0, 1, 0, 0];
        
      case 'scaleY':
        const sy = parseFloat(args[0]);
        return [1, 0, 0, sy, 0, 0];
        
      case 'scale':
        const scaleX = parseFloat(args[0]);
        const scaleY = args[1] ? parseFloat(args[1]) : scaleX;
        return [scaleX, 0, 0, scaleY, 0, 0];
        
      case 'rotate':
        const angle = this.parseAngle(args[0]);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [cos, sin, -sin, cos, 0, 0];
        
      case 'skewX':
        const skewXAngle = this.parseAngle(args[0]);
        const tanX = Math.tan(skewXAngle);
        return [1, 0, tanX, 1, 0, 0];
        
      case 'skewY':
        const skewYAngle = this.parseAngle(args[0]);
        const tanY = Math.tan(skewYAngle);
        return [1, tanY, 0, 1, 0, 0];
        
      case 'skew':
        const skewX = this.parseAngle(args[0]);
        const skewY = args[1] ? this.parseAngle(args[1]) : 0;
        const tanSkewX = Math.tan(skewX);
        const tanSkewY = Math.tan(skewY);
        return [1, tanSkewY, tanSkewX, 1, 0, 0];
        
      case 'matrix':
        if (args.length >= 6) {
          return args.slice(0, 6).map(arg => parseFloat(arg));
        }
        break;
        
      default:
        console.warn(`Unsupported transform function: ${name}`);
        return null;
    }
    
    return null;
  }

  /**
   * Multiply two 2D transformation matrices
   */
  private multiplyMatrices(m1: number[], m2: number[]): number[] {
    const [a1, b1, c1, d1, tx1, ty1] = m1;
    const [a2, b2, c2, d2, tx2, ty2] = m2;
    
    return [
      a1 * a2 + b1 * c2,
      a1 * b2 + b1 * d2,
      c1 * a2 + d1 * c2,
      c1 * b2 + d1 * d2,
      a1 * tx2 + b1 * ty2 + tx1,
      c1 * tx2 + d1 * ty2 + ty1
    ];
  }

  /**
   * Parse CSS value with units
   */
  private parseValue(value: string): number {
    const match = value.match(/^([-\d.]+)(.*)?$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2] || '';
    
    // Convert units to pixels (simplified)
    switch (unit) {
      case 'em': return num * 16; // Assume 16px base
      case 'rem': return num * 16;
      case '%': return num; // Context-dependent
      case 'vw': return num * window.innerWidth / 100;
      case 'vh': return num * window.innerHeight / 100;
      default: return num; // Assume pixels
    }
  }

  /**
   * Parse angle value
   */
  private parseAngle(value: string): number {
    const match = value.match(/^([-\d.]+)(.*)?$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2] || '';
    
    switch (unit) {
      case 'deg': return num * (Math.PI / 180); // Convert to radians
      case 'rad': return num;
      case 'grad': return num * (Math.PI / 200);
      case 'turn': return num * (2 * Math.PI);
      default: return num * (Math.PI / 180); // Assume degrees
    }
  }

  /**
   * Check if transform creates 3D context
   */
  is3DTransform(transform: string): boolean {
    const threeDFunctions = [
      'translateZ', 'translate3d',
      'rotateX', 'rotateY', 'rotateZ', 'rotate3d',
      'scaleZ', 'scale3d',
      'matrix3d',
      'perspective'
    ];
    
    return threeDFunctions.some(func => transform.includes(func));
  }

  /**
   * Convert 3D transform to 2D approximation
   */
  approximate3DTransform(transform: string): string {
    console.warn('3D transforms not fully supported, approximating with 2D');
    
    // Extract supported 2D components
    return transform
      .replace(/translateZ\([^)]+\)/g, '') // Remove Z translation
      .replace(/rotateX\([^)]+\)/g, '') // Remove X rotation
      .replace(/rotateY\([^)]+\)/g, '') // Remove Y rotation
      .replace(/scaleZ\([^)]+\)/g, '') // Remove Z scaling
      .replace(/perspective\([^)]+\)/g, '') // Remove perspective
      .replace(/matrix3d\([^)]+\)/g, '') // Remove 3D matrix
      .replace(/\s+/g, ' ')
      .trim();
  }
}

interface TransformFunction {
  name: string;
  args: string[];
}