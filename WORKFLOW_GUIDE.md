# Web-to-Figma Complete Workflow Guide

## ✅ ALL FIXES IMPLEMENTED

### Issues Fixed:
1. ✅ **Plugin hanging on screenshots** - Fixed with timeout wrappers and opt-in Phase 0.5
2. ✅ **No terminal updates** - Added comprehensive LOG message system
3. ✅ **Server not running** - Created startup script
4. ✅ **Missing progress reporting** - Integrated logger throughout workflow

---

## Complete Workflow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WEB-TO-FIGMA PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

1. SCRAPER SERVER (scraper/src/server.ts)
   ├── HTTP Server (port 3000)
   ├── WebSocket Server (ws://localhost:3000/ws)
   └── Logger Integration ✅ NEW

2. EXTRACTION PIPELINE (scraper/src/scraper.ts)
   ├── Phase 0: Navigate to URL
   ├── Phase 0.5: Screenshot capture (with timeouts) ✅ FIXED
   ├── Phase 1: Wait for page load
   ├── Phase 2: Capture rendering environment
   ├── Phase 3-5: Extract DOM
   ├── Phase 6: Text rasterization
   ├── Phase 7: Figma pre-conversion
   ├── Phase 8: Validation
   ├── Phase 9: Optimization
   ├── Phase 10: IR compilation
   └── Phase 11: CSS inheritance resolution

3. STREAMING (scraper/src/stream-controller.ts)
   ├── Stream TOKENS message
   ├── Stream FONTS message
   ├── Stream NODES message (batched)
   ├── Stream IMAGE_CHUNK messages
   ├── Stream LOG messages ✅ NEW
   ├── Stream PROGRESS messages
   └── Stream COMPLETE message

4. PLUGIN UI (plugin/src/ui.html)
   ├── WebSocket connection
   ├── Message handler
   ├── Terminal logger ✅ ENHANCED
   ├── Progress bar
   └── Message forwarding to code.ts

5. PLUGIN CORE (plugin/src/code.ts)
   ├── Message receiver
   ├── Node creation
   ├── Hierarchy builder
   ├── Image assembler
   └── Final Figma rendering
```

---

## 🚀 HOW TO START THE SERVER

### Option 1: Using the Startup Script (Recommended)
```bash
cd /Users/skirk92/projects/web
./start-scraper.sh
```

### Option 2: Manual Start
```bash
cd /Users/skirk92/projects/web/scraper
npm run build
npm start
```

### Expected Output:
```
============================================================
🚀 Web-to-Figma Scraper Server
============================================================

Server running on http://localhost:3000

Available endpoints:
  ✓ GET  /health          - Health check
  ✓ GET  /screenshot?url= - Capture screenshot
  ✓ WS   /ws              - WebSocket streaming

Ready to accept connections...
============================================================
```

---

## 🔌 HOW TO USE THE PLUGIN

### Step 1: Start the Server
```bash
./start-scraper.sh
```

### Step 2: Open Figma
1. Open Figma Desktop app
2. Go to Plugins → Development → Import plugin from manifest
3. Select: `/Users/skirk92/projects/web/plugin/manifest.json`

### Step 3: Run the Plugin
1. In Figma: Plugins → Development → Web to Figma
2. Enter a URL (e.g., https://stripe.com)
3. Click "Start Import"

### Step 4: Watch the Terminal
The plugin UI will now show:
- ✅ Real-time log messages from each phase
- ✅ Progress bar updates
- ✅ Screenshot preview
- ✅ Node count and status updates

---

## 📊 WHAT YOU'LL SEE IN THE TERMINAL

```
[00:00:01] 🚀 Starting web-to-figma conversion
[00:00:01] 📄 Target: https://stripe.com
[00:00:02] ✓ Connected to server on port 3000
[00:00:03] ℹ️ [Phase 0] 🌐 Navigating to URL...
[00:00:05] ✅ [Phase 0] Page loaded
[00:00:05] ℹ️ [Phase 1] ⏳ Waiting for page to fully load...
[00:00:07] ✅ [Phase 1] Loaded in 2000ms
[00:00:07] ℹ️ [Phase 2] 📐 Capturing render environment...
[00:00:08] ✅ [Phase 2] DPR: 2
[00:00:08] ℹ️ [Phase 0.5] 📸 Capturing primary screenshots...
[00:00:10] ✅ [Phase 0.5] Full page screenshot captured (234.5 KB)
[00:00:10] ℹ️ [Phase 0.5] Page screenshot captured, element screenshots disabled
[00:00:10] ✓ Tokens extracted
[00:00:12] ✓ 45 fonts loaded
[00:00:15] ℹ️ Processing images 23/50
[00:00:18] ℹ️ Streaming nodes 150/350
[00:00:22] ✓ Import complete!
```

---

## ⚙️ KEY CONFIGURATION OPTIONS

### Enable Phase 0.5 Element Screenshots (Optional)
By default, Phase 0.5 element screenshots are **disabled** to prevent hanging.

To enable (only for simple sites):
```typescript
// In scraper/src/server.ts, modify the extraction call:
await extractMaximum(url, {
  capturePhase0Screenshots: true  // Enable element screenshots
});
```

**Warning:** Only enable for sites with < 1000 elements.

---

## 🐛 TROUBLESHOOTING

### Problem: "Server not found"
**Solution:** Start the scraper server first:
```bash
./start-scraper.sh
```

### Problem: "No terminal updates"
**Solution:** This has been fixed! LOG messages now flow through WebSocket.

### Problem: "Plugin hangs"
**Solution:** Phase 0.5 has been fixed with timeout wrappers. Screenshots now have:
- 30s timeout for full page screenshot
- 10s timeout for element query
- 3s timeout for element count estimation

### Problem: "Nothing built in Figma"
**Check:**
1. Is the server running? (`ps aux | grep server`)
2. Is the plugin loaded in Figma?
3. Check the terminal for error messages
4. Check Figma's developer console (Plugins → Development → Open Console)

---

## 📁 FILE STRUCTURE

```
/Users/skirk92/projects/web/
├── scraper/
│   ├── src/
│   │   ├── server.ts          # WebSocket server + logger integration ✅
│   │   ├── scraper.ts         # Extraction pipeline (all phases) ✅
│   │   ├── stream-controller.ts  # Data streaming
│   │   ├── logger.ts          # Unified logging system ✅ NEW
│   │   └── progress-tracker.ts   # Progress tracking
│   └── dist/                  # Compiled output
├── plugin/
│   ├── src/
│   │   ├── code.ts            # Figma plugin core
│   │   └── ui.html            # Plugin UI + LOG handler ✅
│   └── dist/                  # Compiled output
└── start-scraper.sh           # Quick start script ✅ NEW
```

---

## 🎯 NEXT STEPS

1. **Start the server:**
   ```bash
   ./start-scraper.sh
   ```

2. **Load the plugin in Figma**

3. **Test with a simple site first:**
   - Try: https://example.com (very simple)
   - Then: https://stripe.com (medium complexity)
   - Finally: https://apple.com (complex)

4. **Watch the terminal logs** to see the extraction progress

5. **Check Figma** to see nodes being created

---

## 💡 TIPS

- **Start simple:** Test with https://example.com first
- **Check server logs:** The terminal shows detailed extraction progress
- **Monitor memory:** Complex sites may use significant memory
- **Use timeouts:** Phase 0.5 has built-in safety timeouts
- **Disable Phase 0.5 screenshots:** They're off by default for safety

---

## 🔍 DEBUGGING

### View Server Logs:
```bash
# Server logs show in terminal where you ran start-scraper.sh
```

### View Plugin Logs:
1. Open Figma
2. Plugins → Development → Open Console
3. See plugin-side console.log messages

### View UI Logs:
- The terminal section in the plugin UI shows real-time extraction logs

---

**STATUS:** ✅ All systems operational. Ready to extract websites to Figma!
