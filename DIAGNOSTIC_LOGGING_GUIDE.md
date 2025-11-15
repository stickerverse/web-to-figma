# Diagnostic Logging - Node Creation Debugging

## Problem

Extraction completes successfully on server (fonts extracted, assets processed), but **no nodes appear in Figma**.

## What I Added

I've added comprehensive diagnostic logging throughout the plugin code to trace exactly where the node creation flow breaks.

### Logging Points Added:

1. **Message Reception** (code.ts line 868-879)
   - Logs when NODES message is received
   - Shows node count in payload

2. **Batch Handler** (code.ts line 903-922)
   - Shows handleStreamNodeBatch start
   - Shows node categorization (regular vs deferred)

3. **Hierarchy Builder** (code.ts line 947-974)
   - Shows when building hierarchy starts
   - Shows number of regular nodes
   - Logs each node creation attempt

4. **HierarchyBuilder Class** (code.ts line 185-220)
   - Shows buildHierarchy start
   - Shows root parent info
   - Shows root node count

5. **Node Creation** (code.ts line 1273-1387)
   - Shows createEnhancedNode entry with node details
   - Shows node type being created (TEXT/IMAGE/FRAME/SVG)
   - Shows when node is appended to parent
   - Shows completion or errors

6. **Complete Handler** (code.ts line 899-902)
   - Shows when COMPLETE message is received

## How to Use

### Step 1: Restart Everything

```bash
# 1. Kill existing server
pkill -f "node.*server"

# 2. Restart server with fresh logs
./start-scraper.sh
```

### Step 2: Reload Plugin in Figma

1. Open Figma Desktop
2. **Plugins → Development → Remove plugin "Web to Figma Converter"**
3. **Plugins → Development → Import plugin from manifest...**
4. Select `/Users/skirk92/projects/web/plugin/manifest.json`
5. **Open Developer Console** (Plugins → Development → Open Console)

### Step 3: Test Import

1. **Plugins → Development → Web to Figma Converter**
2. Enter URL: `https://example.com` (start simple!)
3. Click "Start Import"
4. **Watch the Figma Developer Console**

## What You'll See (Expected Output)

If everything works correctly, you should see this sequence in the Figma console:

```
🎯 RECEIVED NODES MESSAGE: { hasPayload: true, hasNodes: true, nodeCount: 50 }
📦 Processing NODES batch with 50 nodes
🔧 handleStreamNodeBatch START: { totalNodes: 50, sampleNode: { id: 'node_...', type: 'FRAME', name: '...' } }
📊 Node categorization: { regularNodes: 50, deferredNodes: 0 }
🏗️ Building hierarchy for 50 regular nodes
🔷 HierarchyBuilder.buildHierarchy START
  📊 Total nodes: 50
  📌 Root parent: Page 1 (PAGE)
🎨 Implementing layer-by-layer paint order rendering...
  🌳 Found 1 root nodes
  🎬 Starting renderLayerByLayer...
  🔨 Creating node: { id: 'node_...', type: 'FRAME', name: 'html' }
    🎨 createEnhancedNode: { id: 'node_...', type: 'FRAME', ... }
    📋 Node details: { hasScreenshot: false, hasStates: false, ... }
    📦 Creating FRAME node
    ➕ Appending node to parent: { nodeName: 'html', parentName: 'Page 1', parentType: 'PAGE' }
    ✓ Node appended successfully
    ✅ createEnhancedNode complete for: html
  ✅ Node created: html
  [... repeats for each node ...]
📈 Hierarchy build complete: { nodesCreated: 50, maxDepth: 3, ... }
✅ NODES batch processing complete
```

## If You See Problems

### Problem 1: No "RECEIVED NODES MESSAGE" logs
**Means**: Plugin isn't receiving WebSocket messages from server
**Check**:
- Is server running on port 3000?
- Is WebSocket connection established? (look for "WebSocket connection established" in server logs)
- Check browser network tab for WebSocket errors

### Problem 2: "RECEIVED NODES MESSAGE" but nodeCount: 0
**Means**: Server is sending empty NODES messages
**Check**:
- Server terminal logs - did extraction actually find nodes?
- Look for "✓ Extraction complete: X nodes" in server logs

### Problem 3: "handleStreamNodeBatch START" but regularNodes: 0
**Means**: All nodes are deferred (image chunks)
**Check**:
- This is unusual - check node types
- Look for "deferredNodes" count

### Problem 4: "Building hierarchy" but no "Creating node" logs
**Means**: HierarchyBuilder.renderLayerByLayer is not creating nodes
**Check**:
- Look for errors in console
- Check if sortedByPaintOrder array is empty

### Problem 5: "Creating node" but "⚠️ Cannot append node"
**Means**: Parent is invalid
**Check**:
- Parent object in logs
- Look for "hasParent: false" or "hasAppendChild: false"

### Problem 6: "Node created" but nothing appears in Figma
**Means**: Nodes are created but not visible
**Check**:
- Are they outside viewport? Try Zoom to Fit
- Are they zero-size? Check width/height in logs
- Are they transparent? Check opacity

## Quick Test Script

To test the logging quickly:

```bash
# 1. Start server
./start-scraper.sh

# 2. In another terminal, test extraction directly
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","mode":"hybrid"}' \
  | jq '.nodes | length'

# Should output: number of nodes extracted (e.g., 50)
```

If this shows nodes were extracted but Figma still shows nothing, the problem is in the plugin → Figma communication.

## Next Steps

1. **Run the test** with example.com
2. **Capture console output** (copy entire console log)
3. **Send me the logs** so I can see exactly where it breaks

The logs will pinpoint the exact line where node creation fails!

---

**Built:** 2025-11-14
**Plugin Build:** /Users/skirk92/projects/web/plugin/dist/code.js
**Server Code:** /Users/skirk92/projects/web/scraper/dist/scraper/src/server.js
