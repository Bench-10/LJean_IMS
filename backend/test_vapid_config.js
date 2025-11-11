/**
 * Push Notification Diagnostic Script
 * Run this to verify push notification configuration
 * 
 * Usage: node backend/test_vapid_config.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading environment from:', envPath);
dotenv.config({ path: envPath });

console.log('\n=== VAPID Configuration Diagnostic ===\n');

// Check if VAPID keys are set
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

console.log('1. Environment Variables:');
console.log('   VAPID_PUBLIC_KEY:', VAPID_PUBLIC_KEY ? '✅ Set' : '❌ Not Set');
console.log('   VAPID_PRIVATE_KEY:', VAPID_PRIVATE_KEY ? '✅ Set' : '❌ Not Set');
console.log('   VAPID_SUBJECT:', VAPID_SUBJECT || '❌ Not Set (will use default)');

if (VAPID_PUBLIC_KEY) {
  console.log('\n2. VAPID Public Key Details:');
  console.log('   Length:', VAPID_PUBLIC_KEY.length, '(should be 87 for standard keys)');
  console.log('   First 20 chars:', VAPID_PUBLIC_KEY.substring(0, 20) + '...');
  console.log('   Valid format:', /^[A-Za-z0-9_-]{87}$/.test(VAPID_PUBLIC_KEY) ? '✅ Yes' : '⚠️  Non-standard length');
}

if (VAPID_PRIVATE_KEY) {
  console.log('\n3. VAPID Private Key Details:');
  console.log('   Length:', VAPID_PRIVATE_KEY.length, '(should be 43 for standard keys)');
  console.log('   First 10 chars:', VAPID_PRIVATE_KEY.substring(0, 10) + '...');
  console.log('   Valid format:', /^[A-Za-z0-9_-]{43}$/.test(VAPID_PRIVATE_KEY) ? '✅ Yes' : '⚠️  Non-standard length');
}

// Test web-push configuration
console.log('\n4. Testing web-push library:');
try {
  const webPush = await import('web-push');
  
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.default.setVapidDetails(
      VAPID_SUBJECT || 'mailto:admin@example.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    console.log('   ✅ web-push.setVapidDetails() succeeded');
    console.log('   ✅ VAPID keys are valid!');
  } else {
    console.log('   ❌ Cannot test web-push: VAPID keys not set');
  }
} catch (error) {
  console.log('   ❌ web-push configuration failed:', error.message);
}

// Summary
console.log('\n=== Summary ===\n');

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.log('❌ VAPID keys are NOT configured properly!');
  console.log('\nTo fix:');
  console.log('1. Generate new keys: npx web-push generate-vapid-keys');
  console.log('2. Add to .env file:');
  console.log('   VAPID_PUBLIC_KEY=<your-public-key>');
  console.log('   VAPID_PRIVATE_KEY=<your-private-key>');
  console.log('   VAPID_SUBJECT=mailto:admin@yourdomain.com');
  console.log('3. Restart your server');
  process.exit(1);
} else if (VAPID_PUBLIC_KEY === 'YOUR_PUBLIC_KEY_HERE' || VAPID_PRIVATE_KEY === 'YOUR_PRIVATE_KEY_HERE') {
  console.log('⚠️  VAPID keys are using placeholder values!');
  console.log('\nTo fix:');
  console.log('1. Generate new keys: npx web-push generate-vapid-keys');
  console.log('2. Replace placeholder values in .env');
  console.log('3. Restart your server');
  process.exit(1);
} else {
  console.log('✅ VAPID configuration looks good!');
  console.log('✅ Push notifications should work correctly.');
  console.log('\nNext steps:');
  console.log('1. Make sure your server is running');
  console.log('2. Open your app and enable push notifications');
  console.log('3. Test by approving/rejecting a user request');
  process.exit(0);
}
