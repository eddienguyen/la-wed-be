/**
 * HTTPS Development Server
 * 
 * Wraps the Express app with HTTPS for local development.
 * Required because frontend is now HTTPS and browsers block mixed content.
 * 
 * To generate certificates, run:
 *   mkdir -p .cert && openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout .cert/key.pem -out .cert/cert.pem -days 365
 */

import https from 'node:https';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import app from './app.js';
import { disconnectDatabase } from './utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

// Read self-signed certificates
const certPath = join(__dirname, '../.cert/cert.pem');
const keyPath = join(__dirname, '../.cert/key.pem');

let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
} catch (error) {
  console.error('\n❌ Error: SSL certificates not found!');
  console.error('   Please run: mkdir -p .cert && openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost" -keyout .cert/key.pem -out .cert/cert.pem -days 365\n');
  process.exit(1);
}

// Create HTTPS server
const server = https.createServer(httpsOptions, app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🔒 HTTPS Development Server');
  console.log(`✅ Backend running on https://localhost:${PORT}`);
  console.log(`✅ Network: https://192.168.0.101:${PORT}`);
  console.log('\n⚠️  You\'ll see a certificate warning - this is normal for self-signed certs');
  console.log('   Click "Advanced" → "Proceed to localhost" to continue\n');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await disconnectDatabase();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(async () => {
    await disconnectDatabase();
    console.log('Server closed');
    process.exit(0);
  });
});
