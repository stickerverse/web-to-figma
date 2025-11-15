#!/usr/bin/env node

/**
 * Test script to diagnose extraction hanging issues
 * This directly calls the scraper to see where it gets stuck
 */

const WebSocket = require('ws');

console.log('🔍 Testing extraction process...\n');

const ws = new WebSocket('ws://localhost:3000/ws');

let lastMessageTime = Date.now();
let messageCount = 0;

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  console.log('📤 Sending extraction request for https://stripe.com\n');

  ws.send(JSON.stringify({
    url: 'https://stripe.com',
    mode: 'maximum'
  }));

  lastMessageTime = Date.now();
});

ws.on('message', (data) => {
  messageCount++;
  const message = JSON.parse(data.toString());
  const now = Date.now();
  const timeSinceStart = ((now - lastMessageTime) / 1000).toFixed(2);

  console.log(`\n[${messageCount}] Message received (${timeSinceStart}s since last):`);
  console.log(`  Type: ${message.type}`);

  switch (message.type) {
    case 'LOG':
      console.log(`  📋 LOG: ${message.payload?.message || 'No message'}`);
      break;

    case 'PROGRESS':
      console.log(`  ⏳ PROGRESS: ${message.payload?.stage || 'unknown'}`);
      console.log(`     ${message.payload?.message || 'No message'}`);
      if (message.payload?.current !== undefined) {
        console.log(`     Progress: ${message.payload.current}/${message.payload.total}`);
      }
      break;

    case 'TOKENS':
      console.log(`  🎨 TOKENS received`);
      break;

    case 'FONTS':
      console.log(`  🔤 FONTS: ${message.payload?.length || 0} fonts`);
      break;

    case 'NODES':
      const nodeCount = message.payload?.nodes?.length || 0;
      console.log(`  📦 NODES: ${nodeCount} nodes in this batch`);
      if (nodeCount > 0) {
        console.log(`     First node: ${JSON.stringify(message.payload.nodes[0]).substring(0, 100)}...`);
      }
      break;

    case 'IMAGE_CHUNK':
      console.log(`  🖼️  IMAGE_CHUNK: ${message.nodeId} (${message.chunkIndex + 1}/${message.totalChunks})`);
      break;

    case 'COMPLETE':
      console.log(`  ✅ COMPLETE!`);
      console.log(`\n✨ Total messages received: ${messageCount}`);
      ws.close();
      process.exit(0);
      break;

    case 'ERROR':
    case 'error':
      console.error(`  ❌ ERROR: ${message.payload?.message || message.error || 'Unknown error'}`);
      ws.close();
      process.exit(1);
      break;

    default:
      console.log(`  ❓ Unknown type: ${JSON.stringify(message).substring(0, 200)}...`);
  }

  lastMessageTime = now;
});

ws.on('error', (error) => {
  console.error('\n❌ WebSocket error:', error.message);
  console.error('\n💡 Make sure the scraper server is running:');
  console.error('   cd scraper && npm start');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket closed');
  if (messageCount === 0) {
    console.error('\n⚠️  No messages received before close!');
    console.error('This suggests the server may be hanging during extraction.');
  }
});

// Timeout after 5 minutes
setTimeout(() => {
  console.error('\n⏱️  TIMEOUT after 5 minutes');
  console.error(`📊 Received ${messageCount} messages before timeout`);
  console.error('\n🔍 The extraction appears to be hanging. Check server logs for details.');
  ws.close();
  process.exit(1);
}, 300000);

// Progress indicator
setInterval(() => {
  const elapsed = Math.floor((Date.now() - lastMessageTime) / 1000);
  if (elapsed > 10 && ws.readyState === WebSocket.OPEN) {
    process.stdout.write(`\r⏳ Waiting for next message... (${elapsed}s)      `);
  }
}, 1000);
