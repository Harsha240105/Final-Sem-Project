const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// First check wallet
function checkWallet(addr) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ walletAddress: addr });
    const req = http.request({
      hostname: 'localhost', port: 5001, path: '/api/auth/check-wallet',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Try to register
function registerUser(addr) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ walletAddress: addr, role: 'student', name: 'Test User', message: 'test', signature: '0x000' });
    const req = http.request({
      hostname: 'localhost', port: 5001, path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Try nonce
function getNonce() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5001, path: '/api/auth/nonce',
      method: 'GET'
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const addr = "0x742d35cc6634c0532925a3b844bc9e7595f2bd18";
  
  console.log("=== Checking wallet ===");
  const walletCheck = await checkWallet(addr);
  console.log(JSON.stringify(walletCheck, null, 2));

  console.log("\n=== Getting nonce ===");
  const nonce = await getNonce();
  console.log(JSON.stringify(nonce, null, 2));
}

main().catch(console.error);
