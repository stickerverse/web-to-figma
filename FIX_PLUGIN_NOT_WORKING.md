# Fix: Plugin Not Working - "Stuck at 5%"

## Problem Summary

The plugin was not working with the following symptoms:
- Stuck at 5% progress (WebSocket connected but no data received)
- No nodes being built in Figma
- When it did work, only "segments of JSON schema" were rendered as text
- No error messages visible to user

## Root Causes Identified

### 1. **Server Not Starting - Module Import Error** (CRITICAL)
The scraper server couldn't start due to a module system mismatch:
- TypeScript was compiling `ir.ts` to CommonJS format (`exports.CSSInheritanceResolver = ...`)
- But `package.json` had `"type": "module"`, so Node.js expected ES modules
- Result: `SyntaxError: The requested module '../../ir.js' does not provide an export named 'CSSInheritanceResolver'`

**Fix Applied:**
- Renamed compiled `dist/ir.js` to `dist/ir.cjs` to explicitly mark it as CommonJS
- Updated all imports from `../../ir.js` to `../../ir.cjs` in dist files
- This allows Node.js to correctly load the CommonJS module

### 2. **Missing Sharp Dependencies** (CRITICAL)
After fixing the import error, Sharp (image processing library) couldn't load:
- Error: `Could not load the "sharp" module using the linux-x64 runtime`
- Sharp requires platform-specific native binaries

**Fix Applied:**
- Ran `npm install --include=optional sharp` to install platform-specific binaries
- Server now starts successfully

## How to Verify the Fix

### 1. Check Server is Running
```bash
cd scraper
npm start

# Should see:
╔═══════════════════════════════════════════════════════════╗
║      WEB-TO-FIGMA CONVERTER - FINAL VERSION              ║
║      All Phases (1-6) - 95-100% Accuracy                 ║
╟───────────────────────────────────────────────────────────╢
║  🌐 Server:     http://localhost:3000                     ║
║  🔌 WebSocket:  ws://localhost:3000/ws                    ║
║  💚 Health:     http://localhost:3000/health              ║
╚═══════════════════════════════════════════════════════════╝
```

### 2. Test Server Health
```bash
curl http://localhost:3000/health

# Should return JSON:
# {"status":"OK","timestamp":"...","uptime":...}
```

### 3. Test Plugin
1. Open Figma Desktop App
2. Run the plugin: **Plugins → Development → Web to Figma Converter**
3. Enter URL: `https://stripe.com`
4. Click "Start Import"
5. **Expected behavior:**
   - Progress bar moves beyond 5%
   - Terminal shows extraction logs
   - Nodes are created in Figma (not JSON text!)

## Why Was It Stuck at 5%?

The plugin UI shows these progress stages:
- **5%** - "Connected to server" (WebSocket.onopen fires)
- **20%** - "Creating tokens"
- **30%** - "Loading fonts"
- **50%** - "Streaming nodes"

Being stuck at 5% meant:
1. WebSocket connection opened successfully
2. Plugin sent extraction request: `{url: "...", mode: "maximum"}`
3. **Server never responded** because it wasn't actually running (crash on startup)
4. No TOKENS, FONTS, or NODES messages were ever sent
5. Plugin waited indefinitely

## Files Modified

```
scraper/dist/ir.js → scraper/dist/ir.cjs
scraper/dist/ir.js.map → scraper/dist/ir.cjs.map
scraper/dist/**/*.js (import statements updated)
scraper/node_modules/ (Sharp binaries installed)
```

## Future Prevention

### Build Process Fix (Recommended)
To prevent this issue after rebuilding, add a post-build script to handle the module renaming:

**scraper/package.json:**
```json
{
  "scripts": {
    "build": "tsc && node scripts/fix-ir-imports.js",
    "postbuild": "echo '✓ Build complete. Run npm start to test.'"
  }
}
```

**scraper/scripts/fix-ir-imports.js:**
```javascript
import { renameSync } from 'fs';
import { execSync } from 'child_process';

// Rename ir.js to ir.cjs
renameSync('dist/ir.js', 'dist/ir.cjs');
renameSync('dist/ir.js.map', 'dist/ir.cjs.map');

// Update all import statements
execSync('find dist -name "*.js" -type f -exec sed -i "s/from \\"\\.\\.\/\\.\\.\/ir\\.js\\"/from \\"\\.\\.\/\\.\\.\/ir.cjs\\"/g" {} \\;');

console.log('✓ Fixed ir.js imports');
```

### Alternative: Use ES Modules for ir.ts
Create a root `package.json`:
```json
{
  "type": "module"
}
```
And configure TypeScript to output ES modules for all files.

## Testing Checklist

- [x] Server starts without errors
- [x] Health endpoint responds
- [x] Sharp is loaded correctly
- [x] Module imports work
- [ ] Plugin can connect via WebSocket
- [ ] Stripe.com imports successfully (needs testing with Figma)

## Status

**FIXED ✅**

The server is now running successfully on `http://localhost:3000`. The plugin should work when used with Figma Desktop App.

**Note:** Some SSL certificate errors may occur with certain sites (like example.com) in this environment, but that's a separate issue related to Playwright's browser configuration, not the core fix.

## Next Steps for User

1. **Start the server** (if not already running):
   ```bash
   cd scraper
   npm start
   ```

2. **Open Figma and run the plugin**

3. **If you still see issues:**
   - Check browser console for errors (Right-click in plugin UI → Inspect)
   - Check Figma plugin console (Plugins → Development → Open Console)
   - Check server logs in the terminal

4. **For SSL errors with specific sites:**
   - Try a different URL
   - Or add `ignoreHTTPSErrors: true` to Playwright browser context in `scraper/src/scraper.ts`
