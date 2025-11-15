/**
 * CSS Inheritance Layer - Debugging and Analysis Utilities
 * 
 * This module provides utilities for debugging and analyzing the CSS inheritance
 * chain implementation. Use these tools to understand how properties flow through
 * the inheritance hierarchy and identify style resolution issues.
 */

import type { IRDocument, IRNode, IRInheritanceChain } from './ir.js';
import { InheritanceUtils, INHERITABLE_PROPERTIES } from './ir.js';

// ==================== INHERITANCE DEBUGGING UTILITIES ====================

/**
 * Generate a comprehensive inheritance report for all nodes in a document
 */
export function generateInheritanceReport(document: IRDocument): InheritanceReport {
  const allChains = new Map<string, IRInheritanceChain>();
  
  // Collect all inheritance chains
  for (const node of document.nodes) {
    if (node.inheritanceChain) {
      allChains.set(node.id, node.inheritanceChain);
    }
  }
  
  const nodeReports = document.nodes
    .filter(node => node.inheritanceChain)
    .map(node => InheritanceUtils.createDebugSummary(node.id, node.inheritanceChain!, allChains));
  
  return {
    documentUrl: document.url,
    totalNodes: document.nodes.length,
    nodesWithInheritance: nodeReports.length,
    summary: generateSummaryStats(nodeReports, allChains),
    nodeReports,
    propertyUsageStats: analyzePropertyUsage(allChains),
    inheritanceDepthAnalysis: analyzeInheritanceDepths(allChains),
    recommendations: generateOptimizationRecommendations(allChains),
  };
}

/**
 * Find nodes with potential inheritance issues
 */
export function findInheritanceIssues(document: IRDocument): InheritanceIssue[] {
  const issues: InheritanceIssue[] = [];
  
  for (const node of document.nodes) {
    if (!node.inheritanceChain) {
      issues.push({
        nodeId: node.id,
        type: 'missing-inheritance-chain',
        severity: 'warning',
        message: `Node ${node.id} is missing inheritance chain data`,
        selector: node.selector,
      });
      continue;
    }
    
    const chain = node.inheritanceChain;
    
    // Check for conflicting property sources
    for (const [property, explicitProp] of Object.entries(chain.explicit)) {
      if (chain.inherited[property] && explicitProp.overridesInheritance) {
        const inheritedProp = chain.inherited[property];
        issues.push({
          nodeId: node.id,
          type: 'inheritance-override',
          severity: 'info',
          message: `Property '${property}' overrides inherited value '${inheritedProp.value}' with '${explicitProp.value}'`,
          property,
          inheritedValue: inheritedProp.value,
          explicitValue: explicitProp.value,
          sourceId: inheritedProp.sourceId,
          selector: node.selector,
        });
      }
    }
    
    // Check for excessive inheritance distance
    for (const [property, inheritedProp] of Object.entries(chain.inherited)) {
      if (inheritedProp.distance > 5) {
        issues.push({
          nodeId: node.id,
          type: 'deep-inheritance',
          severity: 'warning',
          message: `Property '${property}' inherited from ${inheritedProp.distance} levels up`,
          property,
          distance: inheritedProp.distance,
          sourceId: inheritedProp.sourceId,
          selector: node.selector,
        });
      }
    }
    
    // Check for properties that should inherit but don't
    const parentNode = document.nodes.find(n => n.id === node.parent);
    if (parentNode?.inheritanceChain) {
      for (const property of INHERITABLE_PROPERTIES) {
        const parentHasProperty = parentNode.inheritanceChain.computed[property];
        const childHasProperty = chain.computed[property];
        const childExplicitlySetProperty = chain.explicit[property];
        
        if (parentHasProperty && !childHasProperty && !childExplicitlySetProperty) {
          issues.push({
            nodeId: node.id,
            type: 'missing-inheritance',
            severity: 'warning',
            message: `Property '${property}' should inherit from parent but is missing`,
            property,
            parentValue: parentHasProperty,
            selector: node.selector,
          });
        }
      }
    }
  }
  
  return issues;
}

/**
 * Trace inheritance path for a specific property on a specific node
 */
export function tracePropertyInheritance(
  document: IRDocument,
  nodeId: string,
  property: string
): PropertyInheritancePath | null {
  const node = document.nodes.find(n => n.id === nodeId);
  if (!node?.inheritanceChain) {
    return null;
  }
  
  const chain = node.inheritanceChain;
  const path: PropertyInheritanceStep[] = [];
  
  // Check if property is explicitly set on this node
  if (chain.explicit[property]) {
    const explicitProp = chain.explicit[property];
    path.push({
      nodeId,
      source: 'explicit',
      value: explicitProp.value,
      selector: node.selector,
      specificity: explicitProp.specificity,
    });
  }
  
  // Trace inherited property
  if (chain.inherited[property]) {
    const inheritedProp = chain.inherited[property];
    let currentNodeId: string | undefined = inheritedProp.sourceId;
    let distance = inheritedProp.distance;
    
    path.push({
      nodeId,
      source: 'inherited',
      value: inheritedProp.value,
      sourceId: inheritedProp.sourceId,
      distance: inheritedProp.distance,
      selector: node.selector,
    });
    
    // Follow the inheritance chain back to the source
    while (currentNodeId && distance > 0) {
      const sourceNode = document.nodes.find(n => n.id === currentNodeId);
      if (!sourceNode?.inheritanceChain) break;
      
      const sourceChain = sourceNode.inheritanceChain;
      
      if (sourceChain.explicit[property]) {
        path.push({
          nodeId: currentNodeId,
          source: 'explicit',
          value: sourceChain.explicit[property].value,
          selector: sourceNode.selector,
          specificity: sourceChain.explicit[property].specificity,
        });
        break;
      }
      
      if (sourceChain.inherited[property]) {
        const sourceInherited = sourceChain.inherited[property];
        path.push({
          nodeId: currentNodeId,
          source: 'inherited',
          value: sourceInherited.value,
          sourceId: sourceInherited.sourceId,
          distance: sourceInherited.distance,
          selector: sourceNode.selector,
        });
        currentNodeId = sourceInherited.sourceId;
        distance = sourceInherited.distance;
      } else {
        break;
      }
    }
  }
  
  return {
    nodeId,
    property,
    finalValue: chain.computed[property],
    path: path.reverse(), // Reverse to show source-to-target order
  };
}

/**
 * Create a visual tree showing inheritance relationships
 */
export function createInheritanceTree(document: IRDocument): InheritanceTree {
  const nodeMap = new Map(document.nodes.map(node => [node.id, node]));
  const tree: InheritanceTreeNode[] = [];
  
  // Find root nodes (no parent)
  const rootNodes = document.nodes.filter(node => !node.parent);
  
  for (const rootNode of rootNodes) {
    tree.push(buildInheritanceTreeNode(rootNode, nodeMap, new Set()));
  }
  
  return { roots: tree };
}

// ==================== HELPER FUNCTIONS ====================

function generateSummaryStats(
  nodeReports: ReturnType<typeof InheritanceUtils.createDebugSummary>[],
  allChains: Map<string, IRInheritanceChain>
): InheritanceSummary {
  const totalProperties = nodeReports.reduce((sum, report) => sum + report.totalProperties, 0);
  const totalInherited = nodeReports.reduce((sum, report) => sum + report.inheritedCount, 0);
  const totalExplicit = nodeReports.reduce((sum, report) => sum + report.explicitCount, 0);
  
  const inheritanceRatio = totalProperties > 0 ? totalInherited / totalProperties : 0;
  
  // Find most inherited properties
  const inheritanceFreq = new Map<string, number>();
  for (const chain of allChains.values()) {
    for (const property of Object.keys(chain.inherited)) {
      inheritanceFreq.set(property, (inheritanceFreq.get(property) || 0) + 1);
    }
  }
  
  const topInheritedProperties = Array.from(inheritanceFreq.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([property, count]) => ({ property, count }));
  
  return {
    totalProperties,
    totalInherited,
    totalExplicit,
    inheritanceRatio,
    topInheritedProperties,
    averageInheritanceDepth: calculateAverageInheritanceDepth(allChains),
  };
}

function analyzePropertyUsage(allChains: Map<string, IRInheritanceChain>): PropertyUsageStats {
  const propertyStats = new Map<string, {
    inheritedCount: number;
    explicitCount: number;
    totalUsage: number;
  }>();
  
  for (const chain of allChains.values()) {
    // Count inherited properties
    for (const property of Object.keys(chain.inherited)) {
      const stats = propertyStats.get(property) || { inheritedCount: 0, explicitCount: 0, totalUsage: 0 };
      stats.inheritedCount++;
      stats.totalUsage++;
      propertyStats.set(property, stats);
    }
    
    // Count explicit properties
    for (const property of Object.keys(chain.explicit)) {
      const stats = propertyStats.get(property) || { inheritedCount: 0, explicitCount: 0, totalUsage: 0 };
      stats.explicitCount++;
      stats.totalUsage++;
      propertyStats.set(property, stats);
    }
  }
  
  return Array.from(propertyStats.entries()).map(([property, stats]) => ({
    property,
    ...stats,
    inheritanceRatio: stats.inheritedCount / stats.totalUsage,
  })).sort((a, b) => b.totalUsage - a.totalUsage);
}

function analyzeInheritanceDepths(allChains: Map<string, IRInheritanceChain>): InheritanceDepthStats {
  const depthCounts = new Map<number, number>();
  const propertyDepths: Array<{ property: string; depth: number; nodeId: string }> = [];
  
  for (const [nodeId, chain] of allChains) {
    for (const [property, inherited] of Object.entries(chain.inherited)) {
      const depth = inherited.distance;
      depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
      propertyDepths.push({ property, depth, nodeId });
    }
  }
  
  const maxDepth = Math.max(...Array.from(depthCounts.keys()));
  const averageDepth = calculateAverageInheritanceDepth(allChains);
  
  return {
    maxDepth,
    averageDepth,
    depthDistribution: Array.from(depthCounts.entries()).map(([depth, count]) => ({ depth, count })),
    deepestInheritances: propertyDepths.filter(p => p.depth >= 4).slice(0, 10),
  };
}

function calculateAverageInheritanceDepth(allChains: Map<string, IRInheritanceChain>): number {
  let totalDepth = 0;
  let count = 0;
  
  for (const chain of allChains.values()) {
    for (const inherited of Object.values(chain.inherited)) {
      totalDepth += inherited.distance;
      count++;
    }
  }
  
  return count > 0 ? totalDepth / count : 0;
}

function generateOptimizationRecommendations(allChains: Map<string, IRInheritanceChain>): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  
  // Check for opportunities to consolidate inherited properties
  const inheritancePatterns = new Map<string, string[]>();
  for (const [nodeId, chain] of allChains) {
    const inheritedProps = Object.keys(chain.inherited).sort().join(',');
    if (!inheritancePatterns.has(inheritedProps)) {
      inheritancePatterns.set(inheritedProps, []);
    }
    inheritancePatterns.get(inheritedProps)!.push(nodeId);
  }
  
  for (const [pattern, nodeIds] of inheritancePatterns) {
    if (nodeIds.length > 3 && pattern.split(',').length > 2) {
      recommendations.push({
        type: 'consolidation-opportunity',
        message: `${nodeIds.length} nodes share the same inheritance pattern: ${pattern}`,
        nodeIds,
        impact: 'medium',
      });
    }
  }
  
  return recommendations;
}

function buildInheritanceTreeNode(
  node: IRNode,
  nodeMap: Map<string, IRNode>,
  visited: Set<string>
): InheritanceTreeNode {
  if (visited.has(node.id)) {
    return { nodeId: node.id, selector: node.selector, children: [], isCircular: true };
  }
  
  visited.add(node.id);
  
  const children = node.children
    .map(childId => nodeMap.get(childId))
    .filter((child): child is IRNode => !!child)
    .map(child => buildInheritanceTreeNode(child, nodeMap, new Set(visited)));
  
  const inheritanceInfo = node.inheritanceChain ? {
    inheritedCount: Object.keys(node.inheritanceChain.inherited).length,
    explicitCount: Object.keys(node.inheritanceChain.explicit).length,
  } : undefined;
  
  return {
    nodeId: node.id,
    selector: node.selector,
    children,
    inheritanceInfo,
  };
}

// ==================== TYPE DEFINITIONS ====================

export interface InheritanceReport {
  documentUrl: string;
  totalNodes: number;
  nodesWithInheritance: number;
  summary: InheritanceSummary;
  nodeReports: ReturnType<typeof InheritanceUtils.createDebugSummary>[];
  propertyUsageStats: PropertyUsageStats;
  inheritanceDepthAnalysis: InheritanceDepthStats;
  recommendations: OptimizationRecommendation[];
}

export interface InheritanceSummary {
  totalProperties: number;
  totalInherited: number;
  totalExplicit: number;
  inheritanceRatio: number;
  topInheritedProperties: Array<{ property: string; count: number }>;
  averageInheritanceDepth: number;
}

export type PropertyUsageStats = Array<{
  property: string;
  inheritedCount: number;
  explicitCount: number;
  totalUsage: number;
  inheritanceRatio: number;
}>;

export interface InheritanceDepthStats {
  maxDepth: number;
  averageDepth: number;
  depthDistribution: Array<{ depth: number; count: number }>;
  deepestInheritances: Array<{ property: string; depth: number; nodeId: string }>;
}

export interface InheritanceIssue {
  nodeId: string;
  type: 'missing-inheritance-chain' | 'inheritance-override' | 'deep-inheritance' | 'missing-inheritance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  property?: string;
  inheritedValue?: string;
  explicitValue?: string;
  parentValue?: string;
  sourceId?: string;
  distance?: number;
  selector?: string;
}

export interface PropertyInheritancePath {
  nodeId: string;
  property: string;
  finalValue?: string;
  path: PropertyInheritanceStep[];
}

export interface PropertyInheritanceStep {
  nodeId: string;
  source: 'explicit' | 'inherited';
  value: string;
  sourceId?: string;
  distance?: number;
  selector?: string;
  specificity?: number;
}

export interface InheritanceTree {
  roots: InheritanceTreeNode[];
}

export interface InheritanceTreeNode {
  nodeId: string;
  selector?: string;
  children: InheritanceTreeNode[];
  inheritanceInfo?: {
    inheritedCount: number;
    explicitCount: number;
  };
  isCircular?: boolean;
}

export interface OptimizationRecommendation {
  type: 'consolidation-opportunity' | 'reduce-depth' | 'eliminate-redundancy';
  message: string;
  nodeIds?: string[];
  impact: 'low' | 'medium' | 'high';
}

// ==================== EXAMPLE USAGE ====================

/**
 * Example: Generate and log inheritance report
 */
export function logInheritanceReport(document: IRDocument): void {
  const report = generateInheritanceReport(document);
  
  console.log('\n=== CSS INHERITANCE ANALYSIS REPORT ===');
  console.log(`Document: ${report.documentUrl}`);
  console.log(`Total Nodes: ${report.totalNodes}`);
  console.log(`Nodes with Inheritance: ${report.nodesWithInheritance}`);
  console.log(`\n--- Summary ---`);
  console.log(`Total Properties: ${report.summary.totalProperties}`);
  console.log(`Inherited: ${report.summary.totalInherited} (${(report.summary.inheritanceRatio * 100).toFixed(1)}%)`);
  console.log(`Explicit: ${report.summary.totalExplicit}`);
  console.log(`Average Inheritance Depth: ${report.summary.averageInheritanceDepth.toFixed(2)}`);
  
  console.log(`\n--- Top Inherited Properties ---`);
  report.summary.topInheritedProperties.slice(0, 5).forEach(prop => {
    console.log(`  ${prop.property}: ${prop.count} nodes`);
  });
  
  const issues = findInheritanceIssues(document);
  console.log(`\n--- Issues Found ---`);
  console.log(`Total Issues: ${issues.length}`);
  issues.filter(i => i.severity === 'error').forEach(issue => {
    console.log(`  ERROR: ${issue.message}`);
  });
  issues.filter(i => i.severity === 'warning').slice(0, 3).forEach(issue => {
    console.log(`  WARNING: ${issue.message}`);
  });
  
  console.log('\n=== END REPORT ===\n');
}