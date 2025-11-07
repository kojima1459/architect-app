// Simple test script to verify the API endpoints
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('Testing API endpoints...\n');

  // Test 1: Check if server is running
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/auth.me`);
    console.log('✓ Server is running');
    console.log('  Status:', response.status);
  } catch (error) {
    console.error('✗ Server is not running:', error.message);
    return;
  }

  console.log('\nNote: Protected endpoints require authentication.');
  console.log('Please test the chat functionality through the browser UI.');
}

testAPI();
