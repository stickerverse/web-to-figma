# STUCK AT 5% - Phase 0.5 Page Screenshot Hanging

## Problem Identified

Plugin stuck at 5% completion = stuck at **Phase 0.5 page screenshot capture** (line 853 in scraper.ts).

## Root Cause

The `page.screenshot()` call has a 30-second timeout, but Playwright's screenshot may still hang on certain sites due to:
1. Lazy-loaded images that never finish
2. Infinite scroll detection
3. Very large pages (10,000+ px height)
4. Sites with iframes that block completion

## What You Should See in Server Terminal

If stuck at Phase 0.5 page screenshot, you'll see:

```
[Phase 0] 🌐 Navigating to URL...
[Phase 0] ✅ Page loaded
[Phase 1] ⏳ Waiting for page to fully load...
[Phase 1] ✅ Loaded in 2000ms
[Phase 2] 📐 Capturing render environment...
[Phase 0.5] 📸 Screenshot-everything-first...
[Phase 0.5] 📸 Capturing primary screenshots...
[STUCK HERE - NO FURTHER LOGS FOR 30+ SECONDS]
```

Then either:
- Timeout after 30s: `[Phase 0.5] ❌ Full page screenshot failed: Page screenshot timeout`
- Or just hangs forever

## Quick Fix #1: Reduce Timeout

Edit `/Users/skirk92/projects/web/scraper/src/scraper.ts` line 845:

```typescript
// BEFORE
const PAGE_SCREENSHOT_TIMEOUT = 30000; // 30 seconds for full page screenshot

// AFTER
const PAGE_SCREENSHOT_TIMEOUT = 10000; // 10 seconds (faster failure)
```

## Quick Fix #2: Disable Phase 0.5 Page Screenshot Entirely

Edit `/Users/skirk92/projects/web/scraper/src/scraper.ts` line 849-866:

```typescript
// OPTION 1: Skip page screenshot entirely
let pageScreenshot: Buffer;
try {
  console.log("[Phase 0.5] ⚠️  Skipping page screenshot to prevent hanging");
  pageScreenshot = Buffer.alloc(0); // Empty buffer
  console.log(`[Phase 0.5] ✅ Page screenshot skipped`);
} catch (error) {
  console.error(`[Phase 0.5] ❌ Full page screenshot failed: ${(error as Error).message}`);
  throw error;
}
```

## Better Fix: Make Page Screenshot Optional

I'll implement this now - add a flag to skip the page screenshot if it's causing issues.

## Testing

After applying fix:

```bash
# 1. Rebuild scraper
cd /Users/skirk92/projects/web/scraper
npm run build

# 2. Restart server
pkill -f "node.*server"
./start-scraper.sh

# 3. Test in Figma plugin with example.com
```

Expected behavior after fix:
- ✅ Should get past 5% quickly (within 2-3 seconds)
- ✅ Should reach Phase 3-5 (DOM extraction)
- ✅ Progress should show 20-40% within 10 seconds

---

**Status:** Implementing fix now...
