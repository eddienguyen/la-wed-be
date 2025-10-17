#!/usr/bin/env node
/**
 * Test Fly.io PostgreSQL Connection
 * 
 * Tests connection to Fly.io PostgreSQL database through proxy
 * Run with: DATABASE_URL=postgres://postgres:cP7TOosTvFGXPRo@localhost:15432/postgres node scripts/test-flyio-connection.js
 * 
 * Prerequisites:
 * - Start proxy: flyctl proxy 15432:5432 -a ngocquan-wedding-postgres
 */

import { PrismaClient } from '@prisma/client';

const testConnection = async () => {
  console.log('🧪 Testing Fly.io PostgreSQL Connection\n');

  const prisma = new PrismaClient();

  try {
    console.log('📡 Connecting to PostgreSQL via Fly.io proxy...');
    console.log('Connection URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'Not set');
    console.log('');

    // Test 1: Check connection with raw query
    console.log('Test 1: PostgreSQL Version');
    const versionResult = await prisma.$queryRaw`SELECT version() as version`;
    console.log('Version:', versionResult[0].version);
    console.log('');

    // Test 2: List existing databases
    console.log('Test 2: List Databases');
    const dbResult = await prisma.$queryRaw`
      SELECT datname FROM pg_database WHERE datistemplate = false;
    `;
    console.log('Databases:', dbResult.map(r => r.datname).join(', '));
    console.log('');

    // Test 3: Test raw SQL execution
    console.log('Test 3: Table Operations Test');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message TEXT
      );
    `;
    console.log('✅ Created test table');

    await prisma.$executeRaw`
      INSERT INTO connection_test (message) VALUES ('Connection successful from local machine');
    `;
    console.log('✅ Inserted test data');

    const testResult = await prisma.$queryRaw`SELECT * FROM connection_test;`;
    console.log('✅ Queried test data:', testResult.length, 'rows');
    console.log('');

    // Clean up test table
    await prisma.$executeRaw`DROP TABLE connection_test;`;
    console.log('✅ Cleaned up test table\n');

    console.log('🎉 All connection tests passed!');
    console.log('Database is ready for migration.\n');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nMake sure you have:');
    console.error('1. Started the Fly.io proxy: flyctl proxy 15432:5432 -a ngocquan-wedding-postgres');
    console.error('2. Set DATABASE_URL environment variable');
    console.error('\nExample:');
    console.error('  DATABASE_URL=postgres://postgres:cP7TOosTvFGXPRo@localhost:15432/postgres node scripts/test-flyio-connection.js\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

await testConnection();
