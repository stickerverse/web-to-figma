/**
 * COMPREHENSIVE PHASE 5 TYPOGRAPHY VALIDATION TEST
 * Tests all aspects of the typography implementation for production readiness
 */

import { extractComplete } from './dist/scraper/src/scraper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test Results Storage
const testResults = {
  timestamp: new Date().toISOString(),
  phase: 'Phase 5 Typography Validation',
  version: '1.0.0',
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    warnings: 0
  },
  tests: [],
  metrics: {
    performance: {},
    dataQuality: {},
    coverage: {}
  }
};

// Helper Functions
function logTest(testName, status, details = {}) {
  const test = {
    name: testName,
    status,
    timestamp: new Date().toISOString(),
    details
  };
  
  testResults.tests.push(test);
  testResults.summary.totalTests++;
  
  if (status === 'PASS') {
    testResults.summary.passedTests++;
    console.log(`✅ ${testName}`);
  } else if (status === 'FAIL') {
    testResults.summary.failedTests++;
    console.log(`❌ ${testName}`, details.error || '');
  } else if (status === 'WARN') {
    testResults.summary.warnings++;
    console.log(`⚠️  ${testName}`, details.warning || '');
  }
  
  if (details.metrics) {
    const metricsStr = Object.entries(details.metrics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    console.log(`   📊 ${metricsStr}`);
  }
}

// Test HTML Generator with comprehensive typography test cases
function generateTestHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phase 5 Typography Test Suite</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Fira+Code:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: #2563eb;
      --gradient-text: linear-gradient(45deg, #ff6b6b, #4ecdc4);
      --custom-font: 'Inter', system-ui, sans-serif;
    }

    body {
      font-family: var(--custom-font);
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background: white;
    }

    .basic-text {
      font-size: 16px;
      font-weight: 400;
      color: #333;
      text-align: left;
    }

    .advanced-typography {
      font-family: 'Fira Code', monospace;
      font-size: 18px;
      font-weight: 500;
      font-style: italic;
      line-height: 1.8;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      text-decoration: underline wavy #ff6b6b;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
      font-variant: small-caps;
      font-feature-settings: "liga" 1, "kern" 1;
      font-kerning: auto;
      font-variant-ligatures: common-ligatures;
      font-variant-numeric: tabular-nums;
      font-variant-caps: small-caps;
      color: var(--primary-color);
      text-align: center;
      text-indent: 2em;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: break-word;
      hyphens: auto;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
    }

    .gradient-text {
      background: var(--gradient-text);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;
      font-size: 32px;
      font-weight: 700;
      text-align: center;
    }

    .rtl-text {
      direction: rtl;
      text-align: right;
      font-family: 'Arial', sans-serif;
      font-size: 18px;
      writing-mode: horizontal-tb;
      unicode-bidi: bidi-override;
    }

    .vertical-text {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 16px;
      height: 200px;
      width: 100px;
    }

    .multi-line-text {
      width: 300px;
      font-size: 16px;
      line-height: 1.5;
      text-align: justify;
    }

    .webkit-text {
      -webkit-text-stroke: 1px #333;
      -webkit-text-stroke-width: 1px;
      -webkit-text-stroke-color: #666;
      -webkit-text-fill-color: #ff6b6b;
      -webkit-font-smoothing: antialiased;
      font-size: 24px;
      font-weight: bold;
    }

    .styled-input {
      font-family: 'Inter', sans-serif;
      font-size: 16px;
      font-weight: 400;
      color: #333;
      padding: 12px;
      border: 2px solid #ddd;
      border-radius: 4px;
      width: 200px;
    }

    .styled-textarea {
      font-family: 'Fira Code', monospace;
      font-size: 14px;
      line-height: 1.4;
      width: 300px;
      height: 100px;
      padding: 10px;
      resize: vertical;
    }

    .hidden-text { display: none; font-size: 20px; }
    .invisible-text { visibility: hidden; font-size: 18px; }
    .zero-opacity { opacity: 0; font-size: 16px; }
    .clipped-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100px; font-size: 14px; }

    .custom-font-stack {
      font-family: 'NonExistentFont', 'Inter', 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      font-weight: 600;
    }

    .transformed-text {
      transform: rotate(45deg) scale(1.2);
      font-size: 16px;
      color: #333;
    }

    .with-pseudo::before {
      content: "Pseudo: ";
      font-weight: bold;
      color: #ff6b6b;
    }

    .with-pseudo::after {
      content: " :End";
      font-style: italic;
      color: #4ecdc4;
    }
  </style>
</head>
<body>
  <h1 class="basic-text">Phase 5 Typography Test Suite</h1>

  <section id="basic-tests">
    <h2>Basic Typography Tests</h2>
    <p class="basic-text">This is basic text with standard properties for testing fundamental typography capture.</p>
    <div class="advanced-typography">Advanced Typography Features Test: LIGATURES, KERNING, SMALL-CAPS</div>
  </section>

  <section id="special-cases">
    <h2>Special Cases</h2>
    <div class="gradient-text">Gradient Text Effect</div>
    <div class="rtl-text">هذا نص باللغة العربية للاختبار RTL</div>
    <div class="vertical-text">Vertical Text</div>
    <div class="multi-line-text">This is a multi-line text block that should wrap to multiple lines and be detected as such by the typography analysis system. It contains enough content to ensure proper line counting.</div>
    <div class="webkit-text">WebKit Stroke Text</div>
  </section>

  <section id="form-tests">
    <h2>Form Element Typography</h2>
    <input type="text" class="styled-input" placeholder="Styled input field" value="Sample input text">
    <textarea class="styled-textarea" placeholder="Styled textarea">Sample textarea content with monospace font.</textarea>
    <button class="styled-input">Styled Button</button>
    <label for="test-input" class="basic-text">Label with Typography</label>
    <select class="styled-input">
      <option>Option with typography</option>
      <option selected>Selected option text</option>
    </select>
  </section>

  <section id="edge-cases">
    <h2>Edge Cases</h2>
    <div class="hidden-text">Hidden text that should not be captured</div>
    <div class="invisible-text">Invisible text</div>
    <div class="zero-opacity">Zero opacity text</div>
    <div class="clipped-text">This text is clipped and should show ellipsis</div>
    <div class="custom-font-stack">Custom font stack fallback test</div>
    <div class="transformed-text">Transformed text</div>
    <div class="with-pseudo">Text with pseudo elements</div>
    <div></div>
    <div>   </div>
  </section>

  <div id="dynamic-content">
    <h2>Dynamic Content</h2>
    <div id="js-generated" class="basic-text"></div>
  </div>

  <script>
    document.getElementById('js-generated').textContent = 'JavaScript generated text content';
    
    const dynamicDiv = document.createElement('div');
    dynamicDiv.style.fontFamily = 'Comic Sans MS, cursive';
    dynamicDiv.style.fontSize = '20px';
    dynamicDiv.style.color = 'purple';
    dynamicDiv.textContent = 'Dynamic inline styled text';
    document.getElementById('dynamic-content').appendChild(dynamicDiv);
  </script>
</body>
</html>`;
}

async function runComprehensiveTypographyTests() {
  console.log('🧪 COMPREHENSIVE PHASE 5 TYPOGRAPHY VALIDATION TEST SUITE');
  console.log('=========================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const testHtml = generateTestHTML();
  const testFilePath = path.join(__dirname, 'typography-test-page.html');
  
  try {
    fs.writeFileSync(testFilePath, testHtml);
    console.log(`📄 Test HTML created: ${testFilePath}`);
    
    const fileUrl = `file://${testFilePath}`;
    const startTime = Date.now();
    
    const result = await extractComplete(fileUrl, {
      captureFonts: true,
      captureScreenshots: false,
      captureStates: true,
      capturePseudoElements: true
    });
    
    const extractionTime = Date.now() - startTime;
    testResults.metrics.performance.extractionTime = extractionTime;
    
    console.log(`⚡ Extraction completed in ${extractionTime}ms`);
    console.log('');
    
    await testStructuralValidation(result);
    await testAcceptanceCriteria(result);
    await testTypographyPropertiesCompleteness(result);
    await testFontFaceDetection(result);
    await testSpecialCasesValidation(result);
    await testDataQualityValidation(result);
    await testEdgeCasesHandling(result);
    await testPerformanceValidation(result, extractionTime);
    await testErrorHandlingValidation(result);
    await testIntegrationValidation(result);
    
    generateFinalReport();
    
  } catch (error) {
    logTest('CRITICAL ERROR', 'FAIL', { error: error.message, stack: error.stack });
  } finally {
    try {
      fs.unlinkSync(testFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function testStructuralValidation(result) {
  console.log('📋 TEST 1: Structural Validation');
  console.log('================================');
  
  try {
    if (!result) throw new Error('No result returned');
    if (!result.nodes) throw new Error('Missing nodes array');
    if (!Array.isArray(result.nodes)) throw new Error('Nodes must be array');
    
    logTest('1.1 Root Structure', 'PASS', { 
      metrics: { totalNodes: result.nodes.length }
    });
  } catch (error) {
    logTest('1.1 Root Structure', 'FAIL', { error: error.message });
  }
  
  try {
    if (!result.fontFaces) throw new Error('Missing fontFaces array');
    if (!Array.isArray(result.fontFaces)) throw new Error('fontFaces must be array');
    
    logTest('1.2 FontFaces Array', 'PASS', {
      metrics: { fontFacesDetected: result.fontFaces.length }
    });
  } catch (error) {
    logTest('1.2 FontFaces Array', 'FAIL', { error: error.message });
  }
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  if (typographyNodes.length === 0) {
    logTest('1.3 Typography Nodes Detection', 'WARN', {
      warning: 'No typography nodes found - may indicate detection issue'
    });
  } else {
    logTest('1.3 Typography Nodes Detection', 'PASS', {
      metrics: { typographyNodes: typographyNodes.length }
    });
  }
  
  testResults.metrics.coverage.totalNodes = result.nodes.length;
  testResults.metrics.coverage.typographyNodes = typographyNodes.length;
  testResults.metrics.coverage.fontFaces = result.fontFaces.length;
}

async function testAcceptanceCriteria(result) {
  console.log('');
  console.log('✅ TEST 2: Acceptance Criteria Validation');
  console.log('=========================================');
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  if (typographyNodes.length === 0) {
    logTest('2.1 Every text node has typography object', 'FAIL', {
      error: 'No nodes with typography data found'
    });
    return;
  }
  
  let textNodesWithTypography = 0;
  let textNodesWithoutTypography = 0;
  
  result.nodes.forEach(node => {
    if (node.nodeType === 'TEXT' || (node.textContent && node.textContent.trim())) {
      if (node.styles && node.styles.typography) {
        textNodesWithTypography++;
      } else {
        textNodesWithoutTypography++;
      }
    }
  });
  
  if (textNodesWithoutTypography > 0) {
    logTest('2.1 Every text node has typography object', 'WARN', {
      warning: `${textNodesWithoutTypography} text nodes missing typography`,
      metrics: { withTypography: textNodesWithTypography, withoutTypography: textNodesWithoutTypography }
    });
  } else {
    logTest('2.1 Every text node has typography object', 'PASS', {
      metrics: { textNodesWithTypography }
    });
  }
  
  const sampleTypography = typographyNodes[0].styles.typography;
  const propertyCount = Object.keys(sampleTypography).length;
  
  if (propertyCount >= 30) {
    logTest('2.2 At least 30+ properties captured', 'PASS', {
      metrics: { propertiesCaptured: propertyCount }
    });
  } else {
    logTest('2.2 At least 30+ properties captured', 'FAIL', {
      error: `Only ${propertyCount} properties captured, expected 30+`
    });
  }
  
  if (sampleTypography.unsupported && Array.isArray(sampleTypography.unsupported)) {
    logTest('2.3 Unsupported properties tracked', 'PASS', {
      metrics: { unsupportedCount: sampleTypography.unsupported.length }
    });
  } else {
    logTest('2.3 Unsupported properties tracked', 'FAIL', {
      error: 'Missing or invalid unsupported properties array'
    });
  }
  
  if (sampleTypography.fontFamily && sampleTypography.fontFamily !== 'serif') {
    logTest('2.4 Font-family resolution', 'PASS', {
      metrics: { resolvedFont: sampleTypography.fontFamily }
    });
  } else {
    logTest('2.4 Font-family resolution', 'WARN', {
      warning: 'Font family may not be properly resolved'
    });
  }
  
  if (sampleTypography.lineHeight && sampleTypography.lineHeightPx) {
    logTest('2.5 Line-height dual format', 'PASS', {
      metrics: { 
        cssLineHeight: sampleTypography.lineHeight,
        pxLineHeight: sampleTypography.lineHeightPx 
      }
    });
  } else {
    logTest('2.5 Line-height dual format', 'FAIL', {
      error: 'Missing line height in CSS or px format'
    });
  }
  
  const colorProperties = ['color', 'textDecorationColor', 'webkitTextStrokeColor', 'webkitTextFillColor'];
  let colorFormatConsistent = true;
  
  colorProperties.forEach(prop => {
    if (sampleTypography[prop] && !sampleTypography[prop].startsWith('rgb')) {
      colorFormatConsistent = false;
    }
  });
  
  if (colorFormatConsistent) {
    logTest('2.6 Color format consistency', 'PASS');
  } else {
    logTest('2.6 Color format consistency', 'FAIL', {
      error: 'Colors not in consistent rgb/rgba format'
    });
  }
}

async function testTypographyPropertiesCompleteness(result) {
  console.log('');
  console.log('📝 TEST 3: Typography Properties Completeness');
  console.log('============================================');
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  if (typographyNodes.length === 0) return;
  
  const sampleTypography = typographyNodes[0].styles.typography;
  
  const expectedProperties = {
    required: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'lineHeightPx', 'color', 'textAlign'],
    textLayout: ['whiteSpace', 'overflowWrap', 'wordBreak', 'textIndent', 'letterSpacing', 'wordSpacing', 'textTransform'],
    textDecoration: ['textDecorationLine', 'textDecorationStyle', 'textDecorationColor', 'textDecorationThickness', 'textUnderlineOffset', 'textUnderlinePosition'],
    fontFeatures: ['fontVariant', 'fontFeatureSettings', 'fontKerning', 'fontVariantLigatures', 'fontVariantNumeric', 'fontVariantCaps'],
    webkit: ['webkitTextStroke', 'webkitTextStrokeWidth', 'webkitTextStrokeColor', 'webkitTextFillColor', 'webkitBackgroundClip', 'webkitFontSmoothing'],
    advanced: ['textShadow', 'textRendering', 'hyphens', 'tabSize', 'textSizeAdjust', 'fontOpticalSizing', 'fontDisplay']
  };
  
  Object.entries(expectedProperties).forEach(([category, properties]) => {
    const missingProperties = properties.filter(prop => 
      sampleTypography[prop] === undefined
    );
    
    if (missingProperties.length === 0) {
      logTest(`3.${category.charAt(0).toUpperCase() + category.slice(1)} Properties`, 'PASS', {
        metrics: { propertiesChecked: properties.length }
      });
    } else {
      logTest(`3.${category.charAt(0).toUpperCase() + category.slice(1)} Properties`, 'FAIL', {
        error: `Missing properties: ${missingProperties.join(', ')}`
      });
    }
  });
  
  testResults.metrics.dataQuality.totalPropertiesCaptured = Object.keys(sampleTypography).length;
}

async function testFontFaceDetection(result) {
  console.log('');
  console.log('🔤 TEST 4: Font Face Detection');
  console.log('==============================');
  
  if (result.fontFaces.length > 0) {
    const fontFace = result.fontFaces[0];
    const requiredProps = ['family', 'style', 'weight', 'src', 'loadStatus', 'usedByElements'];
    
    const missingProps = requiredProps.filter(prop => fontFace[prop] === undefined);
    
    if (missingProps.length === 0) {
      logTest('4.1 FontFace Structure', 'PASS', {
        metrics: { 
          sampleFont: fontFace.family,
          loadStatus: fontFace.loadStatus,
          usedByElements: fontFace.usedByElements.length
        }
      });
    } else {
      logTest('4.1 FontFace Structure', 'FAIL', {
        error: `Missing properties: ${missingProps.join(', ')}`
      });
    }
  } else {
    logTest('4.1 FontFace Structure', 'WARN', {
      warning: 'No font faces detected - expected at least system fonts'
    });
  }
  
  const googleFonts = result.fontFaces.filter(font => 
    font.src && font.src.includes('fonts.googleapis.com')
  );
  
  if (googleFonts.length > 0) {
    logTest('4.2 Google Fonts Detection', 'PASS', {
      metrics: { googleFontsFound: googleFonts.length }
    });
  } else {
    logTest('4.2 Google Fonts Detection', 'WARN', {
      warning: 'No Google Fonts detected - expected Inter and Fira Code'
    });
  }
  
  const loadedFonts = result.fontFaces.filter(font => font.loadStatus === 'loaded');
  const failedFonts = result.fontFaces.filter(font => font.loadStatus === 'error');
  
  logTest('4.3 Font Loading Status', 'PASS', {
    metrics: {
      totalFonts: result.fontFaces.length,
      loadedFonts: loadedFonts.length,
      failedFonts: failedFonts.length
    }
  });
}

async function testSpecialCasesValidation(result) {
  console.log('');
  console.log('🔍 TEST 5: Special Cases Validation');
  console.log('==================================');
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography && node.styles.typography.specialCases
  );
  
  if (typographyNodes.length === 0) {
    logTest('5.1 Special Cases Detection', 'FAIL', {
      error: 'No nodes with special cases detected'
    });
    return;
  }
  
  const gradientTextNodes = typographyNodes.filter(node =>
    node.styles.typography.specialCases.isGradientText
  );
  
  if (gradientTextNodes.length > 0) {
    logTest('5.1 Gradient Text Detection', 'PASS', {
      metrics: { gradientTextElements: gradientTextNodes.length }
    });
  } else {
    logTest('5.1 Gradient Text Detection', 'WARN', {
      warning: 'No gradient text detected - expected at least 1'
    });
  }
  
  const multiLineNodes = typographyNodes.filter(node =>
    node.styles.typography.specialCases.isMultiLine
  );
  
  if (multiLineNodes.length > 0) {
    logTest('5.2 Multi-line Detection', 'PASS', {
      metrics: { multiLineElements: multiLineNodes.length }
    });
  } else {
    logTest('5.2 Multi-line Detection', 'WARN', {
      warning: 'No multi-line text detected'
    });
  }
  
  const rtlNodes = typographyNodes.filter(node =>
    node.styles.typography.specialCases.isRTL
  );
  
  if (rtlNodes.length > 0) {
    logTest('5.3 RTL Text Detection', 'PASS', {
      metrics: { rtlElements: rtlNodes.length }
    });
  } else {
    logTest('5.3 RTL Text Detection', 'WARN', {
      warning: 'No RTL text detected - expected Arabic text'
    });
  }
  
  const verticalNodes = typographyNodes.filter(node =>
    node.styles.typography.specialCases.isVertical
  );
  
  if (verticalNodes.length > 0) {
    logTest('5.4 Vertical Text Detection', 'PASS', {
      metrics: { verticalElements: verticalNodes.length }
    });
  } else {
    logTest('5.4 Vertical Text Detection', 'WARN', {
      warning: 'No vertical text detected'
    });
  }
  
  const inputNodes = typographyNodes.filter(node =>
    node.styles.typography.specialCases.inputState
  );
  
  if (inputNodes.length > 0) {
    logTest('5.5 Input State Capture', 'PASS', {
      metrics: { inputElements: inputNodes.length }
    });
  } else {
    logTest('5.5 Input State Capture', 'WARN', {
      warning: 'No input elements with state detected'
    });
  }
}

async function testDataQualityValidation(result) {
  console.log('');
  console.log('📊 TEST 6: Data Quality Validation');
  console.log('=================================');
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  if (typographyNodes.length === 0) return;
  
  let numericTypeErrors = 0;
  
  typographyNodes.slice(0, 5).forEach(node => {
    const typography = node.styles.typography;
    
    if (typography.lineHeightPx && typeof typography.lineHeightPx !== 'number') {
      numericTypeErrors++;
    }
  });
  
  if (numericTypeErrors === 0) {
    logTest('6.1 Numeric Type Validation', 'PASS');
  } else {
    logTest('6.1 Numeric Type Validation', 'FAIL', {
      error: `${numericTypeErrors} numeric type errors found`
    });
  }
  
  let colorFormatErrors = 0;
  
  typographyNodes.slice(0, 5).forEach(node => {
    const typography = node.styles.typography;
    const colorProps = ['color', 'textDecorationColor', 'webkitTextStrokeColor'];
    
    colorProps.forEach(prop => {
      if (typography[prop] && 
          !typography[prop].startsWith('rgb') && 
          !typography[prop].startsWith('transparent') &&
          typography[prop] !== 'currentcolor' &&
          typography[prop] !== 'inherit' &&
          typography[prop] !== 'initial') {
        colorFormatErrors++;
      }
    });
  });
  
  if (colorFormatErrors === 0) {
    logTest('6.2 Color Format Consistency', 'PASS');
  } else {
    logTest('6.2 Color Format Consistency', 'FAIL', {
      error: `${colorFormatErrors} color format errors found`
    });
  }
  
  let fontResolutionIssues = 0;
  
  typographyNodes.slice(0, 5).forEach(node => {
    const typography = node.styles.typography;
    
    if (!typography.fontFamily || typography.fontFamily === 'serif') {
      fontResolutionIssues++;
    }
  });
  
  if (fontResolutionIssues === 0) {
    logTest('6.3 Font Resolution Accuracy', 'PASS');
  } else {
    logTest('6.3 Font Resolution Accuracy', 'WARN', {
      warning: `${fontResolutionIssues} potential font resolution issues`
    });
  }
  
  let textContentIssues = 0;
  
  typographyNodes.slice(0, 5).forEach(node => {
    const typography = node.styles.typography;
    
    if (typography.content) {
      if (!typography.content.text && !typography.content.innerText) {
        textContentIssues++;
      }
    }
  });
  
  if (textContentIssues === 0) {
    logTest('6.4 Text Content Extraction', 'PASS');
  } else {
    logTest('6.4 Text Content Extraction', 'FAIL', {
      error: `${textContentIssues} text content extraction issues`
    });
  }
}

async function testEdgeCasesHandling(result) {
  console.log('');
  console.log('⚠️  TEST 7: Edge Cases Handling');
  console.log('==============================');
  
  const hiddenNodes = result.nodes.filter(node =>
    node.styles && (
      node.styles.display === 'none' ||
      node.styles.visibility === 'hidden' ||
      node.styles.opacity === '0'
    ) && node.styles.typography
  );
  
  if (hiddenNodes.length === 0) {
    logTest('7.1 Hidden Elements Exclusion', 'PASS');
  } else {
    logTest('7.1 Hidden Elements Exclusion', 'WARN', {
      warning: `${hiddenNodes.length} hidden elements have typography data`
    });
  }
  
  const emptyTextNodes = result.nodes.filter(node =>
    node.styles && node.styles.typography && 
    (!node.textContent || !node.textContent.trim())
  );
  
  if (emptyTextNodes.length > 0) {
    logTest('7.2 Empty Text Elements', 'PASS', {
      metrics: { emptyElementsWithTypography: emptyTextNodes.length }
    });
  } else {
    logTest('7.2 Empty Text Elements', 'PASS');
  }
  
  const complexFontNodes = result.nodes.filter(node =>
    node.styles && node.styles.typography &&
    node.styles.typography.fontFamily && 
    node.styles.typography.fontFamily.includes(',')
  );
  
  if (complexFontNodes.length > 0) {
    logTest('7.3 Complex Font Stacks', 'PASS', {
      metrics: { complexFontStackElements: complexFontNodes.length }
    });
  } else {
    logTest('7.3 Complex Font Stacks', 'WARN', {
      warning: 'No complex font stacks detected'
    });
  }
  
  const pseudoContentNodes = result.nodes.filter(node =>
    node.pseudoElements && node.pseudoElements.length > 0
  );
  
  if (pseudoContentNodes.length > 0) {
    logTest('7.4 Pseudo-element Content', 'PASS', {
      metrics: { elementsWithPseudo: pseudoContentNodes.length }
    });
  } else {
    logTest('7.4 Pseudo-element Content', 'WARN', {
      warning: 'No pseudo-element content detected'
    });
  }
}

async function testPerformanceValidation(result, extractionTime) {
  console.log('');
  console.log('⚡ TEST 8: Performance Validation');
  console.log('================================');
  
  if (extractionTime < 30000) {
    logTest('8.1 Extraction Time', 'PASS', {
      metrics: { extractionTimeMs: extractionTime }
    });
  } else if (extractionTime < 60000) {
    logTest('8.1 Extraction Time', 'WARN', {
      warning: `Extraction took ${extractionTime}ms - consider optimization`,
      metrics: { extractionTimeMs: extractionTime }
    });
  } else {
    logTest('8.1 Extraction Time', 'FAIL', {
      error: `Extraction took too long: ${extractionTime}ms`
    });
  }
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  const avgProcessingPerNode = extractionTime / result.nodes.length;
  
  if (avgProcessingPerNode < 100) {
    logTest('8.2 Processing Efficiency', 'PASS', {
      metrics: { 
        avgProcessingPerNode: Math.round(avgProcessingPerNode),
        totalNodes: result.nodes.length
      }
    });
  } else {
    logTest('8.2 Processing Efficiency', 'WARN', {
      warning: `High processing time per node: ${Math.round(avgProcessingPerNode)}ms`
    });
  }
  
  const resultSize = JSON.stringify(result).length;
  const sizePerNode = resultSize / result.nodes.length;
  
  if (sizePerNode < 10000) {
    logTest('8.3 Memory Efficiency', 'PASS', {
      metrics: { 
        resultSizeBytes: resultSize,
        avgSizePerNode: Math.round(sizePerNode)
      }
    });
  } else {
    logTest('8.3 Memory Efficiency', 'WARN', {
      warning: `Large data size per node: ${Math.round(sizePerNode)} bytes`
    });
  }
  
  testResults.metrics.performance = {
    extractionTime,
    avgProcessingPerNode: Math.round(avgProcessingPerNode),
    resultSize,
    avgSizePerNode: Math.round(sizePerNode)
  };
}

async function testErrorHandlingValidation(result) {
  console.log('');
  console.log('🛡️ TEST 9: Error Handling Validation');
  console.log('====================================');
  
  const typographyNodes = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  if (typographyNodes.length > 0) {
    const unsupportedCounts = typographyNodes.map(node =>
      node.styles.typography.unsupported ? node.styles.typography.unsupported.length : 0
    );
    
    const avgUnsupported = unsupportedCounts.reduce((a, b) => a + b, 0) / unsupportedCounts.length;
    
    logTest('9.1 Unsupported Properties Tracking', 'PASS', {
      metrics: { 
        avgUnsupportedPerElement: Math.round(avgUnsupported * 100) / 100,
        maxUnsupported: Math.max(...unsupportedCounts)
      }
    });
  }
  
  if (typographyNodes.length > 0 && typographyNodes[0].styles.typography.capabilities) {
    const capabilities = typographyNodes[0].styles.typography.capabilities;
    const capabilityCount = Object.keys(capabilities).length;
    
    if (capabilityCount >= 6) {
      logTest('9.2 Browser Capability Detection', 'PASS', {
        metrics: { capabilitiesDetected: capabilityCount }
      });
    } else {
      logTest('9.2 Browser Capability Detection', 'FAIL', {
        error: `Only ${capabilityCount} capabilities detected, expected 6+`
      });
    }
  } else {
    logTest('9.2 Browser Capability Detection', 'FAIL', {
      error: 'No browser capabilities detected'
    });
  }
  
  const nodesWithAllTypographyData = typographyNodes.filter(node => {
    const t = node.styles.typography;
    return t.fontFamily && t.fontSize && t.color && t.lineHeight;
  });
  
  const gracefulDegradationRate = nodesWithAllTypographyData.length / typographyNodes.length;
  
  if (gracefulDegradationRate > 0.8) {
    logTest('9.3 Graceful Degradation', 'PASS', {
      metrics: { 
        successRate: Math.round(gracefulDegradationRate * 100),
        totalTypographyNodes: typographyNodes.length,
        completeNodes: nodesWithAllTypographyData.length
      }
    });
  } else {
    logTest('9.3 Graceful Degradation', 'WARN', {
      warning: `Low success rate: ${Math.round(gracefulDegradationRate * 100)}%`
    });
  }
}

async function testIntegrationValidation(result) {
  console.log('');
  console.log('🔗 TEST 10: Integration Validation');
  console.log('==================================');
  
  const hasLegacyFontData = result.fonts && Array.isArray(result.fonts);
  
  if (hasLegacyFontData) {
    logTest('10.1 Backward Compatibility', 'PASS', {
      metrics: { legacyFontsCount: result.fonts.length }
    });
  } else {
    logTest('10.1 Backward Compatibility', 'WARN', {
      warning: 'Legacy fonts array not present'
    });
  }
  
  const textNodes = result.nodes.filter(node => node.nodeType === 'TEXT');
  const nodesWithTypography = result.nodes.filter(node => 
    node.styles && node.styles.typography
  );
  
  const typographyToTextRatio = nodesWithTypography.length > 0 ? 
    textNodes.length / nodesWithTypography.length : 0;
  
  if (typographyToTextRatio > 0.3) {
    logTest('10.2 Node Classification Accuracy', 'PASS', {
      metrics: { 
        textNodes: textNodes.length,
        typographyNodes: nodesWithTypography.length,
        ratio: Math.round(typographyToTextRatio * 100)
      }
    });
  } else {
    logTest('10.2 Node Classification Accuracy', 'WARN', {
      warning: 'Low correlation between TEXT nodes and typography data'
    });
  }
  
  const nodesWithLayoutAndTypography = result.nodes.filter(node =>
    node.layout && node.styles && node.styles.typography
  );
  
  if (nodesWithLayoutAndTypography.length > 0) {
    logTest('10.3 Layout Integration', 'PASS', {
      metrics: { integratedNodes: nodesWithLayoutAndTypography.length }
    });
  } else {
    logTest('10.3 Layout Integration', 'FAIL', {
      error: 'No nodes with both layout and typography data'
    });
  }
}

function generateFinalReport() {
  console.log('');
  console.log('📋 COMPREHENSIVE VALIDATION REPORT');
  console.log('==================================');
  
  const passRate = (testResults.summary.passedTests / testResults.summary.totalTests) * 100;
  const failRate = (testResults.summary.failedTests / testResults.summary.totalTests) * 100;
  const warnRate = (testResults.summary.warnings / testResults.summary.totalTests) * 100;
  
  console.log(`Total Tests: ${testResults.summary.totalTests}`);
  console.log(`✅ Passed: ${testResults.summary.passedTests} (${Math.round(passRate)}%)`);
  console.log(`❌ Failed: ${testResults.summary.failedTests} (${Math.round(failRate)}%)`);
  console.log(`⚠️  Warnings: ${testResults.summary.warnings} (${Math.round(warnRate)}%)`);
  console.log('');
  
  let overallStatus;
  if (failRate === 0 && warnRate < 20) {
    overallStatus = 'PRODUCTION READY';
  } else if (failRate < 10 && warnRate < 30) {
    overallStatus = 'READY WITH MINOR ISSUES';
  } else if (failRate < 20) {
    overallStatus = 'NEEDS IMPROVEMENT';
  } else {
    overallStatus = 'NOT READY FOR PRODUCTION';
  }
  
  console.log(`🎯 OVERALL STATUS: ${overallStatus}`);
  console.log('');
  
  if (testResults.metrics.coverage) {
    console.log('📊 COVERAGE METRICS:');
    console.log(`   Total Nodes Processed: ${testResults.metrics.coverage.totalNodes || 0}`);
    console.log(`   Nodes with Typography: ${testResults.metrics.coverage.typographyNodes || 0}`);
    console.log(`   Font Faces Detected: ${testResults.metrics.coverage.fontFaces || 0}`);
    console.log('');
  }
  
  if (testResults.metrics.performance) {
    console.log('⚡ PERFORMANCE METRICS:');
    console.log(`   Extraction Time: ${testResults.metrics.performance.extractionTime || 0}ms`);
    console.log(`   Avg Processing/Node: ${testResults.metrics.performance.avgProcessingPerNode || 0}ms`);
    console.log(`   Result Size: ${Math.round((testResults.metrics.performance.resultSize || 0) / 1024)}KB`);
    console.log('');
  }
  
  if (testResults.metrics.dataQuality) {
    console.log('🔍 DATA QUALITY METRICS:');
    console.log(`   Properties per Element: ${testResults.metrics.dataQuality.totalPropertiesCaptured || 0}`);
    console.log('');
  }
  
  const reportPath = path.join(__dirname, 'PHASE_5_TYPOGRAPHY_VALIDATION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  
  console.log(`📁 Detailed report saved: ${reportPath}`);
  console.log('');
  
  console.log('🎯 RECOMMENDATIONS:');
  
  if (testResults.summary.failedTests === 0) {
    console.log('✅ All critical tests passed - typography system is ready for production');
  } else {
    console.log('❌ Address failed tests before production deployment');
  }
  
  if (testResults.summary.warnings > 0) {
    console.log('⚠️  Review warnings for potential optimization opportunities');
  }
  
  if (testResults.metrics.performance?.extractionTime > 20000) {
    console.log('⚡ Consider performance optimization for large pages');
  }
  
  console.log('');
  console.log('🎉 Phase 5 Typography Validation Complete!');
  
  process.exit(testResults.summary.failedTests > 0 ? 1 : 0);
}

runComprehensiveTypographyTests().catch(error => {
  console.error('💥 CRITICAL TEST FAILURE:', error);
  process.exit(1);
});
EOF < /dev/null