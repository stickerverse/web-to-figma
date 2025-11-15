/**
 * COMPREHENSIVE PHASE 5 TYPOGRAPHY VALIDATION SUITE
 */

const { extractComplete } = require('./dist/scraper/src/scraper.js');
const fs = require('fs');

class TypographyValidator {
  constructor() {
    this.results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      errors: [],
      warnings: [],
      metrics: {},
      detailedResults: {}
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, details };
    
    if (level === 'ERROR') {
      this.results.errors.push(logEntry);
      console.error('ERROR:', message, details ? JSON.stringify(details, null, 2) : '');
    } else if (level === 'WARN') {
      this.results.warnings.push(logEntry);
      console.warn('WARN:', message);
    } else if (level === 'PASS') {
      console.log('PASS:', message);
    } else {
      console.log('INFO:', message);
    }
  }

  test(description, testFn) {
    this.results.totalTests++;
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        this.results.passedTests++;
        this.log('PASS', 'Test passed: ' + description);
        return true;
      } else {
        this.results.failedTests++;
        this.log('ERROR', 'Test failed: ' + description, { result });
        return false;
      }
    } catch (error) {
      this.results.failedTests++;
      this.log('ERROR', 'Test exception: ' + description, { error: error.message });
      return false;
    }
  }

  async validateSite(site) {
    console.log('\nTesting site:', site.name, site.url);
    
    const startTime = Date.now();
    let extractionResult;
    
    try {
      extractionResult = await extractComplete(site.url, {
        captureFonts: true,
        captureScreenshots: false,
        captureStates: false,
        capturePseudoElements: false
      });
    } catch (error) {
      this.log('ERROR', 'Failed to extract ' + site.name, { error: error.message });
      return;
    }

    const extractionTime = Date.now() - startTime;
    this.results.metrics[site.name + '_extractionTime'] = extractionTime;

    const textNodes = extractionResult.nodes.filter(node => 
      node.nodeType === 'TEXT' || 
      (node.styles && node.styles.typography) ||
      (node.extractedText && node.extractedText.text && node.extractedText.text.trim().length > 0)
    );
    
    const nodesWithTypography = extractionResult.nodes.filter(node => 
      node.styles && node.styles.typography
    );

    this.test('[' + site.name + '] Every text node has typography object', () => {
      if (textNodes.length === 0) {
        this.log('WARN', 'No text nodes found for ' + site.name);
        return true;
      }
      
      const textNodesWithoutTypography = textNodes.filter(node => 
        \!node.styles || \!node.styles.typography
      );
      
      if (textNodesWithoutTypography.length > 0) {
        this.log('ERROR', 'Found ' + textNodesWithoutTypography.length + ' text nodes without typography');
        return false;
      }
      
      return true;
    });

    // Store results
    this.results.detailedResults[site.name] = {
      url: site.url,
      extractionTime,
      totalNodes: extractionResult.nodes.length,
      textNodes: textNodes.length,
      nodesWithTypography: nodesWithTypography.length,
      fontFaces: extractionResult.fontFaces ? extractionResult.fontFaces.length : 0
    };

    console.log('Metrics for', site.name + ':');
    console.log('  Extraction time:', extractionTime + 'ms');
    console.log('  Total nodes:', extractionResult.nodes.length);
    console.log('  Text nodes:', textNodes.length);
    console.log('  Nodes with typography:', nodesWithTypography.length);
  }

  async validateAcceptanceCriteria() {
    console.log('\nPHASE 5 TYPOGRAPHY ACCEPTANCE CRITERIA VALIDATION');
    
    const testSites = [
      { 
        name: 'Simple Site', 
        url: 'https://example.com'
      },
      {
        name: 'Complex Design Site',
        url: 'https://news.ycombinator.com'
      }
    ];

    for (const site of testSites) {
      await this.validateSite(site);
    }
  }

  generateReport() {
    const totalTests = this.results.totalTests;
    const successRate = totalTests > 0 ? ((this.results.passedTests / totalTests) * 100).toFixed(2) + '%' : '0%';
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: totalTests,
        passedTests: this.results.passedTests,
        failedTests: this.results.failedTests,
        successRate: successRate
      },
      errors: this.results.errors,
      warnings: this.results.warnings,
      metrics: this.results.metrics,
      detailedResults: this.results.detailedResults,
      conclusion: {
        productionReady: this.results.failedTests === 0,
        recommendations: []
      }
    };

    if (this.results.failedTests > 0) {
      report.conclusion.recommendations.push('Address all failed tests before production deployment');
    }
    
    if (this.results.failedTests === 0 && this.results.warnings.length < 3) {
      report.conclusion.recommendations.push('Phase 5 typography implementation is production ready');
    }

    return report;
  }
}

async function runComprehensiveValidation() {
  console.log('PHASE 5 TYPOGRAPHY COMPREHENSIVE VALIDATION SUITE');
  console.log('Started at:', new Date().toISOString());
  
  const validator = new TypographyValidator();
  
  try {
    await validator.validateAcceptanceCriteria();
  } catch (error) {
    validator.log('ERROR', 'Validation suite execution failed', { error: error.message });
  }

  const report = validator.generateReport();
  
  const reportFile = 'phase5-typography-comprehensive-validation-report.json';
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log('\nFINAL VALIDATION REPORT');
  console.log('Summary:');
  console.log('  Total tests run:', report.summary.totalTests);
  console.log('  Tests passed:', report.summary.passedTests);
  console.log('  Tests failed:', report.summary.failedTests);
  console.log('  Success rate:', report.summary.successRate);
  console.log('Production Readiness:', report.conclusion.productionReady ? 'READY' : 'NOT READY');
  
  if (report.errors.length > 0) {
    console.log('\nErrors:', report.errors.length);
    report.errors.forEach(error => {
      console.log('  -', error.message);
    });
  }
  
  if (report.warnings.length > 0) {
    console.log('\nWarnings:', report.warnings.length);
    report.warnings.forEach(warning => {
      console.log('  -', warning.message);
    });
  }
  
  console.log('\nRecommendations:');
  report.conclusion.recommendations.forEach(rec => {
    console.log('  •', rec);
  });
  
  console.log('\nDetailed report saved to:', reportFile);
  
  process.exit(report.conclusion.productionReady ? 0 : 1);
}

runComprehensiveValidation().catch(error => {
  console.error('\nValidation suite crashed:', error);
  process.exit(1);
});
EOF < /dev/null