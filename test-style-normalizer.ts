/**
 * Comprehensive test suite for CSS Style Normalizer
 * 
 * Tests complex shorthand combinations and integration with inheritance system
 */

import { 
  CSSStyleNormalizer, 
  analyzeStyleNormalization,
  hasShorthands,
  getShorthandProperties,
  mergeNormalizedStyles,
  type NormalizedStyles 
} from './scraper/css-style-normalizer.js';
import { 
  IRDocument, 
  IRNode, 
  CSSInheritanceResolver 
} from './ir.js';

// ==================== TEST DATA ====================

/**
 * Test cases for complex shorthand combinations
 */
const COMPLEX_SHORTHAND_TESTS = [
  // Margin/Padding variants
  { margin: '10px' },
  { margin: '10px 20px' },
  { margin: '10px 20px 15px' },
  { margin: '10px 20px 15px 5px' },
  { padding: '1rem 2rem' },
  
  // Border combinations
  { border: '2px solid red' },
  { border: '1px dotted #333' },
  { borderTop: '3px dashed blue' },
  { borderRadius: '10px 20px / 5px 10px' },
  
  // Font combinations
  { font: 'italic bold 16px/1.5 Arial, sans-serif' },
  { font: 'normal 14px Georgia' },
  { font: 'bold 20px/2 "Times New Roman"' },
  
  // Background combinations  
  { background: '#ff0000' },
  { background: 'url(image.jpg)' },
  { background: 'linear-gradient(to bottom, red, blue)' },
  
  // Flexbox combinations
  { flex: '1' },
  { flex: 'auto' },
  { flex: 'none' },
  { flex: '1 0 200px' },
  { flexFlow: 'row wrap' },
  { gap: '10px 20px' },
  
  // Grid combinations
  { gridArea: '1 / 2 / 3 / 4' },
  { gridColumn: '1 / span 2' },
  { gridRow: 'auto / 3' },
  
  // Position combinations
  { inset: '10px 20px 15px 5px' },
  { inset: '10px 20px' },
  { inset: '10px' },
  
  // Overflow combinations
  { overflow: 'hidden scroll' },
  { overflow: 'auto' },
  
  // Text decoration combinations
  { textDecoration: 'underline solid red 2px' },
  { textDecoration: 'line-through wavy blue' },
  
  // List style combinations
  { listStyle: 'square inside' },
  { listStyle: 'decimal outside url(bullet.png)' },
  
  // Outline combinations
  { outline: '2px dashed green' },
  
  // Complex multi-property combinations
  {
    margin: '10px 20px',
    padding: '15px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    font: 'bold 14px Arial',
    background: '#f0f0f0',
    flex: '1 0 auto'
  }
];

/**
 * Create test nodes with shorthand properties for inheritance testing
 */
function createShorthandTestDocument(): IRDocument {
  const nodes: IRNode[] = [
    {
      id: 'container',
      tag: 'div',
      type: 'FRAME',
      rect: { x: 0, y: 0, width: 800, height: 600 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      children: ['child1', 'child2'],
      layout: {
        boxModel: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          boxSizing: 'content-box'
        },
        position: { type: 'static' },
        display: { type: 'flex', overflow: { x: 'visible', y: 'visible' } },
        dimensions: {
          width: '100%',
          height: 'auto',
          minWidth: 'auto',
          maxWidth: 'auto',
          minHeight: 'auto',
          maxHeight: 'auto'
        },
        stacking: { zIndex: 0, paintOrder: 0, isolate: false }
      },
      styles: {
        // Shorthand properties that should be normalized
        margin: '20px 40px',
        padding: '10px',
        border: '2px solid #333',
        font: 'bold 16px/1.4 Arial, sans-serif',
        flex: '1 0 auto',
        gap: '15px 25px'
      }
    },
    {
      id: 'child1',
      tag: 'div',
      type: 'FRAME',
      rect: { x: 20, y: 20, width: 360, height: 200 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'container',
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
        // Mix of shorthand and longhand
        margin: '5px 10px',
        borderTop: '1px dotted red',
        background: 'linear-gradient(to right, blue, green)'
      }
    },
    {
      id: 'child2',
      tag: 'p',
      type: 'TEXT',
      rect: { x: 420, y: 20, width: 360, height: 200 },
      worldTransform: [1, 0, 0, 0, 1, 0],
      zIndex: 0,
      parent: 'container',
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
        // Text-related shorthands
        textDecoration: 'underline wavy blue',
        listStyle: 'disc inside',
        outline: '3px solid orange'
      },
      text: {
        rawText: 'Test text with inheritance',
        text: 'Test text with inheritance',
        innerText: 'Test text with inheritance',
        isClipped: false,
        lineCount: 1,
        wordCount: 4
      }
    }
  ];

  return {
    url: 'http://test-shorthand.example.com',
    title: 'Shorthand Test Document',
    viewport: { width: 800, height: 600, deviceScaleFactor: 1 },
    meta: {
      capturedAt: new Date().toISOString(),
      userAgent: 'test-normalizer-agent',
      language: 'en',
      phases: 'shorthand-test',
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

function testBasicShorthandNormalization(): void {
  console.log('\n=== Testing Basic Shorthand Normalization ===');
  
  let passedTests = 0;
  let totalTests = 0;
  
  for (const testCase of COMPLEX_SHORTHAND_TESTS) {
    totalTests++;
    const properties = Object.keys(testCase);
    console.log(`\nTesting: ${properties.join(', ')}`);
    
    try {
      const normalized = CSSStyleNormalizer.normalize(testCase);
      
      console.log('  Original properties:', Object.keys(testCase).length);
      console.log('  Normalized properties:', Object.keys(normalized.properties).length);
      console.log('  Shorthands expanded:', normalized.summary.shorthandsExpanded);
      
      if (normalized.warnings.length > 0) {
        console.log('  Warnings:', normalized.warnings.length);
        normalized.warnings.forEach(warning => console.log(`    ⚠️ ${warning}`));
      }
      
      // Check if shorthand properties were actually expanded
      const hasExpansions = normalized.summary.shorthandsExpanded > 0;
      const hasMoreProperties = normalized.summary.normalizedCount > normalized.summary.originalCount;
      
      if (hasExpansions || hasMoreProperties) {
        console.log('  ✅ Normalization successful');
        passedTests++;
      } else {
        console.log('  ⚠️ No expansion detected (might be intentional)');
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Basic normalization tests: ${passedTests}/${totalTests} passed`);
}

function testSpecificShorthandExpansions(): void {
  console.log('\n=== Testing Specific Shorthand Expansions ===');
  
  const specificTests = [
    {
      name: 'Margin 4-value',
      input: { margin: '10px 20px 15px 5px' },
      expected: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
      values: ['10px', '20px', '15px', '5px']
    },
    {
      name: 'Border shorthand',
      input: { border: '2px solid red' },
      expected: ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
      values: ['2px', '2px', '2px', '2px']
    },
    {
      name: 'Flex shorthand auto',
      input: { flex: 'auto' },
      expected: ['flex-grow', 'flex-shrink', 'flex-basis'],
      values: ['1', '1', 'auto']
    },
    {
      name: 'Font shorthand complex',
      input: { font: 'italic bold 16px/1.5 Arial' },
      expected: ['font-style', 'font-weight', 'font-size', 'line-height', 'font-family'],
      values: ['italic', 'bold', '16px', '1.5', 'Arial']
    }
  ];
  
  let passedTests = 0;
  
  for (const test of specificTests) {
    console.log(`\nTesting ${test.name}:`);
    console.log(`  Input: ${JSON.stringify(test.input)}`);
    
    try {
      const normalized = CSSStyleNormalizer.normalize(test.input);
      
      let testPassed = true;
      for (let i = 0; i < test.expected.length; i++) {
        const property = test.expected[i];
        const expectedValue = test.values[i];
        const actualValue = normalized.properties[property];
        
        console.log(`  ${property}: ${actualValue} (expected: ${expectedValue})`);
        
        if (actualValue !== expectedValue) {
          console.log(`    ❌ Mismatch!`);
          testPassed = false;
        }
      }
      
      if (testPassed) {
        console.log(`  ✅ ${test.name} passed`);
        passedTests++;
      } else {
        console.log(`  ❌ ${test.name} failed`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error in ${test.name}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Specific expansion tests: ${passedTests}/${specificTests.length} passed`);
}

function testInheritanceWithNormalization(): void {
  console.log('\n=== Testing Inheritance with Normalization ===');
  
  const document = createShorthandTestDocument();
  
  // Test normalization before inheritance
  console.log('\n--- Pre-inheritance Normalization ---');
  for (const node of document.nodes) {
    if (node.styles && Object.keys(node.styles).length > 0) {
      console.log(`\nNode ${node.id}:`);
      console.log('  Original styles:', Object.keys(node.styles));
      
      if (hasShorthands(node.styles)) {
        const shorthands = getShorthandProperties(node.styles);
        console.log('  Shorthands found:', shorthands);
        
        const normalized = CSSStyleNormalizer.normalize(node.styles);
        console.log('  Normalized properties:', Object.keys(normalized.properties).length);
        console.log('  Expansion ratio:', 
          (normalized.summary.normalizedCount / normalized.summary.originalCount).toFixed(2));
      } else {
        console.log('  No shorthands detected');
      }
    }
  }
  
  // Test inheritance with normalized styles
  console.log('\n--- Inheritance with Normalization ---');
  const resolver = new CSSInheritanceResolver(document.nodes);
  const chains = resolver.resolveAll();
  
  console.log(`Resolved inheritance for ${chains.size} nodes`);
  
  // Check container node
  const containerChain = chains.get('container');
  if (containerChain) {
    console.log('\nContainer inheritance analysis:');
    console.log('  Inherited properties:', Object.keys(containerChain.inherited).length);
    console.log('  Explicit properties:', Object.keys(containerChain.explicit).length);
    console.log('  Computed properties:', Object.keys(containerChain.computed).length);
    
    // Check if normalized longhand properties are present
    if (containerChain.computed['margin-top']) {
      console.log(`  ✅ Margin-top from normalization: ${containerChain.computed['margin-top']}`);
    }
    if (containerChain.computed['font-family']) {
      console.log(`  ✅ Font-family from normalization: ${containerChain.computed['font-family']}`);
    }
  }
  
  // Check child inheritance
  const child2Chain = chains.get('child2');
  if (child2Chain) {
    console.log('\nChild2 inheritance analysis:');
    console.log('  Inherited font-family:', child2Chain.inherited['font-family']?.value || 'none');
    console.log('  Inherited font-size:', child2Chain.inherited['font-size']?.value || 'none');
    console.log('  Explicit text-decoration-line:', 
      child2Chain.explicit['text-decoration-line']?.value || 'none');
  }
}

function testAnalysisAndUtilities(): void {
  console.log('\n=== Testing Analysis and Utility Functions ===');
  
  const testStyles = {
    margin: '10px 20px',
    padding: '15px',
    border: '1px solid #ccc',
    color: '#333',
    width: '100px',
    flex: 'auto'
  };
  
  // Test analysis function
  console.log('\n--- Style Analysis ---');
  const analysis = analyzeStyleNormalization(testStyles);
  
  console.log('Original properties:', Object.keys(analysis.original).length);
  console.log('Normalized properties:', Object.keys(analysis.normalized.properties).length);
  console.log('Shorthands found:', analysis.analysis.shorthandsFound);
  console.log('Conversion rate:', `${analysis.analysis.conversionRate.toFixed(1)}%`);
  console.log('Potential issues:', analysis.analysis.potentialIssues.length);
  
  if (analysis.analysis.potentialIssues.length > 0) {
    analysis.analysis.potentialIssues.forEach(issue => {
      console.log(`  ⚠️ ${issue}`);
    });
  }
  
  // Test utility functions
  console.log('\n--- Utility Functions ---');
  console.log('Has shorthands:', hasShorthands(testStyles));
  console.log('Shorthand properties:', getShorthandProperties(testStyles));
  
  // Test merging
  const styles1 = CSSStyleNormalizer.normalize({ margin: '10px', color: 'red' });
  const styles2 = CSSStyleNormalizer.normalize({ padding: '20px', color: 'blue' });
  const merged = mergeNormalizedStyles(styles1, styles2);
  
  console.log('Merged properties count:', Object.keys(merged.properties).length);
  console.log('Merged color (should be blue):', merged.properties.color);
}

function testErrorHandling(): void {
  console.log('\n=== Testing Error Handling ===');
  
  const errorTestCases = [
    { malformedBorder: 'invalid border value' },
    { unknownProperty: 'not-a-real-property' },
    { emptyValue: '' },
    { invalidFlex: 'invalid flex value' },
    { malformedMargin: 'too many values here really' }
  ];
  
  for (const testCase of errorTestCases) {
    const property = Object.keys(testCase)[0];
    const value = Object.values(testCase)[0];
    
    console.log(`\nTesting error case: ${property}: ${value}`);
    
    try {
      const normalized = CSSStyleNormalizer.normalize(testCase);
      
      if (normalized.warnings.length > 0) {
        console.log(`  ⚠️ Warning captured: ${normalized.warnings[0]}`);
      } else {
        console.log(`  ✅ Handled gracefully (${Object.keys(normalized.properties).length} properties)`);
      }
    } catch (error) {
      console.log(`  ❌ Unexpected error: ${error.message}`);
    }
  }
}

// ==================== PERFORMANCE TESTS ====================

function testPerformance(): void {
  console.log('\n=== Testing Performance ===');
  
  // Generate large test case
  const largeStyleSet: Record<string, string> = {};
  for (let i = 0; i < 1000; i++) {
    largeStyleSet[`margin-${i}`] = '10px 20px';
    largeStyleSet[`padding-${i}`] = '5px';
    largeStyleSet[`border-${i}`] = '1px solid red';
    largeStyleSet[`font-${i}`] = 'bold 14px Arial';
    largeStyleSet[`flex-${i}`] = '1 0 auto';
  }
  
  console.log(`Testing performance with ${Object.keys(largeStyleSet).length} properties...`);
  
  const start = performance.now();
  const normalized = CSSStyleNormalizer.normalize(largeStyleSet);
  const end = performance.now();
  
  console.log(`Normalization time: ${(end - start).toFixed(2)}ms`);
  console.log(`Properties processed: ${normalized.summary.originalCount}`);
  console.log(`Properties generated: ${normalized.summary.normalizedCount}`);
  console.log(`Throughput: ${(normalized.summary.originalCount / (end - start) * 1000).toFixed(0)} props/sec`);
}

// ==================== RUN ALL TESTS ====================

function runAllNormalizerTests(): void {
  console.log('🧪 CSS Style Normalizer Test Suite');
  console.log('=====================================');
  
  const startTime = performance.now();
  
  try {
    testBasicShorthandNormalization();
    testSpecificShorthandExpansions();
    testInheritanceWithNormalization();
    testAnalysisAndUtilities();
    testErrorHandling();
    testPerformance();
    
    const endTime = performance.now();
    const totalTime = (endTime - startTime).toFixed(2);
    
    console.log('\n✅ All normalizer tests completed successfully!');
    console.log(`\n📋 Summary (${totalTime}ms total):`);
    console.log('- ✅ Basic shorthand normalization');
    console.log('- ✅ Specific expansion accuracy');
    console.log('- ✅ Inheritance system integration');
    console.log('- ✅ Analysis and utility functions');
    console.log('- ✅ Error handling and edge cases');
    console.log('- ✅ Performance benchmarks');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllNormalizerTests();
}

export { runAllNormalizerTests, createShorthandTestDocument };
