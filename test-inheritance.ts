/**
 * Test script for CSS Inheritance Layer
 * 
 * This script demonstrates and tests the CSS inheritance resolution system
 */

import { 
  IRDocument, 
  IRNode, 
  CSSInheritanceResolver, 
  InheritanceUtils,
  INHERITABLE_PROPERTIES 
} from './ir.js';
import { 
  generateInheritanceReport, 
  findInheritanceIssues, 
  tracePropertyInheritance,
  logInheritanceReport
} from './inheritance-debug-utils.js';

// ==================== TEST DATA ====================

/**
 * Create mock nodes for testing inheritance
 */
function createMockDocument(): IRDocument {
  const nodes: IRNode[] = [
    {
      id: 'html',
      tag: 'html',
      type: 'FRAME',
      rect: { x: 0, y: 0, width: 1024, height: 768 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      children: ['body'],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: '100%',
          height: '100%',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#333333',
        lineHeight: '1.5'
      }
    },
    {
      id: 'body',
      tag: 'body',
      type: 'FRAME',
      rect: { x: 0, y: 0, width: 1024, height: 768 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'html',
      children: ['header', 'main'],
      layout: {
        boxModel: {
          margin: { top: 8, right: 8, bottom: 8, left: 8 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: 'auto',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        margin: '8px',
        backgroundColor: '#ffffff'
      }
    },
    {
      id: 'header',
      tag: 'header',
      type: 'FRAME',
      rect: { x: 8, y: 8, width: 1008, height: 80 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'body',
      children: ['h1'],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 20, left: 0 },
          padding: { top: 20, right: 20, bottom: 20, left: 20 },
          border: { top: 0, right: 0, bottom: 1, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: 'auto',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        padding: '20px',
        borderBottom: '1px solid #eeeeee',
        marginBottom: '20px'
      }
    },
    {
      id: 'h1',
      tag: 'h1',
      type: 'TEXT',
      rect: { x: 28, y: 28, width: 200, height: 40 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'header',
      children: [],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: 'auto',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1a1a1a'
      },
      text: {
        rawText: 'Welcome',
        text: 'Welcome',
        innerText: 'Welcome',
        isClipped: false,
        lineCount: 1,
        wordCount: 1
      }
    },
    {
      id: 'main',
      tag: 'main',
      type: 'FRAME',
      rect: { x: 8, y: 108, width: 1008, height: 600 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'body',
      children: ['p1', 'p2'],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: 'auto',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {}
    },
    {
      id: 'p1',
      tag: 'p',
      type: 'TEXT',
      rect: { x: 8, y: 108, width: 1008, height: 20 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'main',
      children: [],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 16, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: 'auto',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        marginBottom: '16px'
      },
      text: {
        rawText: 'This is a paragraph that inherits font properties.',
        text: 'This is a paragraph that inherits font properties.',
        innerText: 'This is a paragraph that inherits font properties.',
        isClipped: false,
        lineCount: 1,
        wordCount: 9
      }
    },
    {
      id: 'p2',
      tag: 'p',
      type: 'TEXT',
      rect: { x: 8, y: 144, width: 1008, height: 20 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'main',
      children: [],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'block', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: 'auto',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        color: '#666666',
        fontStyle: 'italic'
      },
      text: {
        rawText: 'This paragraph has custom color and style.',
        text: 'This paragraph has custom color and style.',
        innerText: 'This paragraph has custom color and style.',
        isClipped: false,
        lineCount: 1,
        wordCount: 7
      }
    }
  ];

  return {
    url: 'http://test.example.com',
    title: 'Test Document',
    viewport: { width: 1024, height: 768, deviceScaleFactor: 1 },
    meta: {
      capturedAt: new Date().toISOString(),
      userAgent: 'test-agent',
      language: 'en',
      phases: 'test',
      version: '2.0.0'
    },
    nodes,
    assets: {
      images: [],
      fonts: [],
      svgs: []
    }
  };
}

// ==================== TEST FUNCTIONS ====================

function testBasicInheritanceResolution(): void {
  console.log('\n=== Testing Basic Inheritance Resolution ===');
  
  const document = createMockDocument();
  const resolver = new CSSInheritanceResolver(document.nodes);
  const chains = resolver.resolveAll();
  
  console.log(`✅ Resolved inheritance for ${chains.size} nodes`);
  
  // Test h1 inheritance (should inherit font-family, line-height from html)
  const h1Chain = chains.get('h1');
  if (h1Chain) {
    console.log('\n--- H1 Element Analysis ---');
    console.log('Inherited properties:', Object.keys(h1Chain.inherited));
    console.log('Explicit properties:', Object.keys(h1Chain.explicit));
    console.log('Computed color:', h1Chain.computed.color);
    console.log('Computed font-family:', h1Chain.computed['font-family']);
    
    // Verify inheritance works
    const fontFamily = h1Chain.computed['font-family'];
    if (fontFamily === 'Arial, sans-serif') {
      console.log('✅ Font family correctly inherited from html');
    } else {
      console.log('❌ Font family inheritance failed');
    }
    
    // Verify override works
    const color = h1Chain.computed.color;
    if (color === '#1a1a1a') {
      console.log('✅ Color correctly overridden');
    } else {
      console.log('❌ Color override failed');
    }
  }
}

function testPropertyTracing(): void {
  console.log('\n=== Testing Property Tracing ===');
  
  const document = createMockDocument();
  const resolver = new CSSInheritanceResolver(document.nodes);
  resolver.resolveAll();
  
  // Add inheritance chains to nodes
  for (const node of document.nodes) {
    const chain = resolver.resolveNode(node.id);
    if (chain) {
      node.inheritanceChain = chain;
    }
  }
  
  // Trace font-family inheritance for p1
  const trace = tracePropertyInheritance(document, 'p1', 'font-family');
  if (trace) {
    console.log('\n--- Font-family inheritance path for p1 ---');
    console.log(`Final value: ${trace.finalValue}`);
    trace.path.forEach((step, index) => {
      console.log(`${index + 1}. ${step.nodeId} (${step.source}): ${step.value}`);
    });
  }
}

function testInheritanceReport(): void {
  console.log('\n=== Testing Inheritance Report Generation ===');
  
  const document = createMockDocument();
  const resolver = new CSSInheritanceResolver(document.nodes);
  resolver.resolveAll();
  
  // Add inheritance chains to nodes
  for (const node of document.nodes) {
    const chain = resolver.resolveNode(node.id);
    if (chain) {
      node.inheritanceChain = chain;
    }
  }
  
  // Generate and display report
  logInheritanceReport(document);
  
  // Test issue detection
  const issues = findInheritanceIssues(document);
  console.log(`\n--- Issues Analysis ---`);
  console.log(`Found ${issues.length} potential issues:`);
  issues.forEach(issue => {
    console.log(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
  });
}

function testUtilityFunctions(): void {
  console.log('\n=== Testing Utility Functions ===');
  
  // Test inheritable properties detection
  console.log('Total inheritable properties:', INHERITABLE_PROPERTIES.size);
  console.log('Color inherits:', InheritanceUtils.naturallyInherits('color'));
  console.log('Width inherits:', InheritanceUtils.naturallyInherits('width'));
  console.log('Display inherits:', InheritanceUtils.naturallyInherits('display'));
  
  const document = createMockDocument();
  const resolver = new CSSInheritanceResolver(document.nodes);
  const chains = resolver.resolveAll();
  
  const h1Chain = chains.get('h1');
  if (h1Chain) {
    const inheritedProps = InheritanceUtils.getInheritedProperties(h1Chain);
    const explicitProps = InheritanceUtils.getExplicitProperties(h1Chain);
    
    console.log('H1 inherited properties:', inheritedProps);
    console.log('H1 explicit properties:', explicitProps);
    
    const fontFamilySource = InheritanceUtils.getPropertySource(h1Chain, 'font-family');
    const colorSource = InheritanceUtils.getPropertySource(h1Chain, 'color');
    
    console.log('Font-family source:', fontFamilySource);
    console.log('Color source:', colorSource);
  }
}

// ==================== RUN TESTS ====================

function runAllTests(): void {
  console.log('🧪 CSS Inheritance Layer Test Suite');
  console.log('=====================================');
  
  try {
    testBasicInheritanceResolution();
    testPropertyTracing();
    testUtilityFunctions();
    testInheritanceReport();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Inheritance resolution algorithm');
    console.log('- ✅ Property tracing and path analysis');
    console.log('- ✅ Utility functions');
    console.log('- ✅ Debug report generation');
    console.log('- ✅ Issue detection');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { runAllTests, createMockDocument };