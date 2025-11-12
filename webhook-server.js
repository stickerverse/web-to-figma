#!/usr/bin/env node
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = parseInt(process.env.WEBHOOK_PORT || '3001', 10);
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const REPO_PATH = process.env.REPO_PATH || path.resolve(__dirname);

if (!SECRET) {
  console.warn('Warning: GITHUB_WEBHOOK_SECRET is not set. The webhook endpoint will accept unsigned payloads.');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/payload') {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    const payload = Buffer.concat(chunks);
    if (SECRET) {
      const signature = req.headers['x-hub-signature-256'] || '';
      if (!verifySignature(payload, signature)) {
        console.warn('Rejected payload with invalid signature.');
        res.writeHead(401);
        res.end('Invalid signature');
        return;
      }
    }

    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      res.writeHead(200);
      res.end('ignored');
      return;
    }

    const body = JSON.parse(payload.toString('utf8'));
    const ref = body.ref;
    if (!ref || !ref.startsWith('refs/heads/')) {
      res.writeHead(400);
      res.end('missing ref');
      return;
    }

    const branch = ref.replace('refs/heads/', '');
    if (branch !== 'main') {
      res.writeHead(200);
      res.end('ignored');
      return;
    }

    console.log(`Received push to ${branch}, updating ${REPO_PATH}...`);
    const gitPull = spawn('git', ['pull', '--ff-only', 'origin', branch], {
      cwd: REPO_PATH,
      stdio: 'inherit'
    });

    gitPull.on('close', (code) => {
      if (code === 0) {
        console.log('Repository updated successfully.');
        res.writeHead(200);
        res.end('pulled');
      } else {
        console.error(`git pull failed with exit code ${code}.`);
        res.writeHead(500);
        res.end('git pull failed');
      }
    });
  });
});

function verifySignature(body, signatureHeader) {
  if (!signatureHeader) return false;
  const computed = `sha256=${crypto.createHmac('sha256', SECRET).update(body).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
}

server.listen(PORT, () => {
  console.log(`Webhook listener running on http://localhost:${PORT}/payload`);
  console.log('Set WEBHOOK_PORT, GITHUB_WEBHOOK_SECRET, and REPO_PATH as needed.');
});
