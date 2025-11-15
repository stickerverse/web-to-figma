/**
 * Font Extraction Test Script
 * Tests the enhanced font extraction functionality
 */

const { extractHybrid } = require('./dist/scraper/src/scraper.js');

async function testFontExtraction() {
  console.log('🧪 Testing Font Extraction Functionality\n');
  
  // Test with a page that uses Google Fonts
  const testUrl = 'https://fonts.google.com/';
  
  try {
    console.log(`📋 Testing URL: ${testUrl}`);
    console.log('⏳ Starting extraction...\n');
    
    const startTime = Date.now();
    const result = await extractHybrid(testUrl);
    const endTime = Date.now();
    
    console.log(`\n✅ Extraction completed in ${endTime - startTime}ms`);
    console.log('\n📊 FONT EXTRACTION RESULTS:');
    console.log('═'.repeat(50));
    
    // Analyze font assets
    const fontAssets = result.assets?.fonts || [];
    console.log(`📝 Total font assets extracted: ${fontAssets.length}`);
    
    if (fontAssets.length > 0) {
      console.log('\n📋 Font Assets Details:');
      fontAssets.forEach((font, index) => {
        console.log(`\n${index + 1}. Font Family: ${font.family}`);
        console.log(`   Weight: ${font.weight}, Style: ${font.style}`);
        console.log(`   Sources: ${font.src?.length || 0}`);
        console.log(`   Data Size: ${font.data ? (font.data.length / 1000).toFixed(1) + 'KB' : 'Not downloaded'}`);
        console.log(`   Used by nodes: ${font.usedByNodes?.length || 0}`);
        console.log(`   Status: ${font.loadStatus || 'unknown'}`);
        
        // Show source URLs
        if (font.src && font.src.length > 0) {
          font.src.forEach((source, srcIndex) => {
            console.log(`   Source ${srcIndex + 1}: ${source.url} (${source.format || 'unknown format'})`);
          });
        }
      });
      
      // Summary statistics
      const loadedFonts = fontAssets.filter(font => font.data);
      const usedFonts = fontAssets.filter(font => font.usedByNodes && font.usedByNodes.length > 0);
      
      console.log('\n📈 Summary Statistics:');
      console.log(`   ✅ Successfully loaded: ${loadedFonts.length}/${fontAssets.length} fonts`);
      console.log(`   🎯 Actively used: ${usedFonts.length}/${fontAssets.length} fonts`);
      console.log(`   💾 Total data downloaded: ${loadedFonts.reduce((total, font) => total + (font.data?.length || 0), 0) / 1000}KB`);
      
      // Show font families found
      const uniqueFamilies = [...new Set(fontAssets.map(font => font.family))];
      console.log(`   📚 Unique font families: ${uniqueFamilies.length}`);
      console.log(`   Families: ${uniqueFamilies.join(', ')}`);
    }
    
    // Test with text nodes
    const textNodes = result.nodes.filter(node => node.type === 'TEXT');
    console.log(`\n📝 Text nodes found: ${textNodes.length}`);
    
    if (textNodes.length > 0) {
      console.log('\n📋 Text Node Font Usage:');
      textNodes.slice(0, 5).forEach((node, index) => {
        const fontFamily = node.textMetrics?.font?.family || node.styles?.fontFamily || 'Unknown';
        const fontWeight = node.textMetrics?.font?.weight || node.styles?.fontWeight || '400';
        const fontStyle = node.textMetrics?.font?.style || node.styles?.fontStyle || 'normal';
        const textContent = node.text?.rawText || node.text || '';
        
        console.log(`\n${index + 1}. Node ID: ${node.id}`);
        console.log(`   Font: ${fontFamily} (${fontWeight} ${fontStyle})`);
        console.log(`   Text: "${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}"`);
        console.log(`   Text metrics available: ${node.textMetrics ? 'Yes' : 'No'}`);
      });
    }
    
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 Font extraction test completed successfully!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Font extraction test failed:', error);
    console.error('Error details:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testFontExtraction()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testFontExtraction };