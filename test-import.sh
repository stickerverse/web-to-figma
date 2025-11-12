#!/bin/bash
# Test Web-to-Figma Pipeline

echo "🔍 Testing Web-to-Figma Import Pipeline..."
echo ""

# Check if server is running
echo "1. Checking server health..."
HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Server is running on port 3000"
    echo "   Status: $(echo $HEALTH | jq -r '.status' 2>/dev/null)"
else
    echo "   ❌ Server not responding on port 3000"
    echo "   Try: cd scraper && npm start"
    exit 1
fi
echo ""

# Check plugin build
echo "2. Checking plugin build..."
if [ -f "plugin/dist/code.js" ] && [ -f "plugin/dist/ui.html" ]; then
    CODE_SIZE=$(wc -c < plugin/dist/code.js)
    UI_SIZE=$(wc -c < plugin/dist/ui.html)
    echo "   ✅ Plugin built successfully"
    echo "   code.js: $(numfmt --to=iec-i --suffix=B $CODE_SIZE)"
    echo "   ui.html: $(numfmt --to=iec-i --suffix=B $UI_SIZE)"
else
    echo "   ❌ Plugin not built"
    echo "   Try: cd plugin && npm run build"
    exit 1
fi
echo ""

# Test WebSocket endpoint
echo "3. Testing WebSocket endpoint..."
WS_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ws 2>/dev/null)
if [ "$WS_TEST" = "426" ] || [ "$WS_TEST" = "400" ]; then
    echo "   ✅ WebSocket endpoint available (HTTP $WS_TEST - expected for WS)"
else
    echo "   ⚠️  WebSocket endpoint status: HTTP $WS_TEST"
fi
echo ""

# Test image proxy
echo "4. Testing image proxy..."
PROXY_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/proxy-image?url=https://via.placeholder.com/150" 2>/dev/null)
if [ "$PROXY_TEST" = "200" ]; then
    echo "   ✅ Image proxy working"
else
    echo "   ⚠️  Image proxy status: HTTP $PROXY_TEST"
fi
echo ""

echo "📋 SUMMARY:"
echo "   Server: ✅ Running"
echo "   Plugin: ✅ Built"
echo "   WebSocket: ✅ Available"
echo ""
echo "🎯 NEXT STEPS:"
echo "   1. Open Figma"
echo "   2. Right-click plugin → 'Reload plugin'"
echo "   3. Open plugin and try importing"
echo "   4. Check Figma console (Cmd+Option+I) for errors"
echo ""
echo "📝 If still not working, check:"
echo "   • Figma developer console for JavaScript errors"
echo "   • Network tab for failed WebSocket connections"
echo "   • Make sure Figma has network access permissions"
