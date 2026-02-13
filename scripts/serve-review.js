#!/usr/bin/env node

/**
 * Simple HTTP server to serve the review interface
 * Run with: node serve-review.js
 * Then open: http://localhost:3456
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const scriptsDir = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  let filePath = path.join(scriptsDir, req.url === '/' ? 'review-interface.html' : req.url);
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error', 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('\n✨ Review Interface Server Started!\n');
  console.log(`   Open in browser: http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
