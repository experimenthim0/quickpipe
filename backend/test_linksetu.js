import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://localhost:27017/linksetu';
const API_URL = 'http://localhost:5000';
const TEST_EMAIL = 'verify-test@linksetu.org';

// Temporary local Schema to fetch OTP directly from Mongo
const userSchema = new mongoose.Schema({
  email: String,
  syncKey: String,
  activeOtp: { code: String, expiresAt: Date }
});
const User = mongoose.model('TestUser', userSchema, 'users');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Starting LinkSetu API Integration Verification ---');
  
  // 1. Ping the server to ensure it is online
  try {
    const ping = await fetch(API_URL);
    const status = await ping.json();
    console.log('✅ Server Connection Status:', status);
  } catch (err) {
    console.error('❌ Server is offline. Please make sure the server is running on port 5000.', err.message);
    process.exit(1);
  }

  // Connect to DB directly to read OTP
  console.log('Connecting to database to monitor OTP code...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // Clean old test users to ensure clean slate
  await User.deleteMany({ email: TEST_EMAIL });

  // 2. Request OTP
  console.log('\n[Step 1] Requesting OTP for:', TEST_EMAIL);
  const reqOtpResponse = await fetch(`${API_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });
  
  if (!reqOtpResponse.ok) {
    console.error('❌ Failed to request OTP');
    process.exit(1);
  }
  const reqOtpData = await reqOtpResponse.json();
  console.log('✅ OTP request status:', reqOtpData.message);

  // Retrieve the generated OTP directly from MongoDB to simulate email interceptor
  await delay(1000); // Wait a moment for write completion
  const userRecord = await User.findOne({ email: TEST_EMAIL });
  if (!userRecord || !userRecord.activeOtp || !userRecord.activeOtp.code) {
    console.error('❌ Failed to retrieve OTP from Database');
    process.exit(1);
  }
  const otpCode = userRecord.activeOtp.code;
  console.log('🔍 Extracted OTP Code from DB:', otpCode);

  // 3. Verify OTP
  console.log('\n[Step 2] Verifying OTP...');
  const verifyResponse = await fetch(`${API_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, code: otpCode })
  });

  if (!verifyResponse.ok) {
    const err = await verifyResponse.json();
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
  const verifyData = await verifyResponse.json();
  const syncKey = verifyData.syncKey;
  console.log('✅ OTP verified. Received syncKey:', syncKey);

  // 4. Push Link from Desktop Client
  console.log('\n[Step 3] Pushing link entry (Source: desktop)...');
  const pushLinkResponse = await fetch(`${API_URL}/api/links/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      syncKey,
      content: 'https://github.com/google/gemini',
      sourceDevice: 'desktop'
    })
  });
  
  if (pushLinkResponse.status === 201) {
    console.log('✅ Link push succeeded (201 Created)');
  } else {
    console.error('❌ Link push failed:', await pushLinkResponse.json());
    process.exit(1);
  }

  // 5. Push Text snippet from Mobile Client
  console.log('\n[Step 4] Pushing text snippet entry (Source: mobile)...');
  const pushTextResponse = await fetch(`${API_URL}/api/links/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      syncKey,
      content: 'Setting up Node backend with Express and MongoDB is fast.',
      sourceDevice: 'mobile'
    })
  });

  if (pushTextResponse.status === 201) {
    console.log('✅ Text push succeeded (201 Created)');
  } else {
    console.error('❌ Text push failed:', await pushTextResponse.json());
    process.exit(1);
  }

  // 6. Get History (No filter)
  console.log('\n[Step 5] Retrieving all link history...');
  const historyResponse = await fetch(`${API_URL}/api/links/history?syncKey=${syncKey}`);
  const historyData = await historyResponse.json();
  console.log(`✅ Received ${historyData.count} items:`);
  historyData.links.forEach(item => {
    console.log(` - [${item.sourceDevice}] ${item.content} (${item.createdAt})`);
  });

  // 7. Get History (Search Filter: text index search or fallback)
  console.log('\n[Step 6] Searching history for term: "gemini"...');
  const searchResponse1 = await fetch(`${API_URL}/api/links/history?syncKey=${syncKey}&search=gemini`);
  const searchData1 = await searchResponse1.json();
  console.log(`✅ Search matches count: ${searchData1.count}`);
  searchData1.links.forEach(item => {
    console.log(` - Match: [${item.sourceDevice}] ${item.content}`);
  });

  console.log('\n[Step 7] Searching history for term: "backend"...');
  const searchResponse2 = await fetch(`${API_URL}/api/links/history?syncKey=${syncKey}&search=backend`);
  const searchData2 = await searchResponse2.json();
  console.log(`✅ Search matches count: ${searchData2.count}`);
  searchData2.links.forEach(item => {
    console.log(` - Match: [${item.sourceDevice}] ${item.content}`);
  });

  // Cleanup testing data from collections
  console.log('\n[Cleanup] Cleaning test user and link records...');
  const LinkCollection = mongoose.connection.collection('links');
  await LinkCollection.deleteMany({ syncKey });
  await User.deleteMany({ email: TEST_EMAIL });
  console.log('✅ DB cleaned.');

  await mongoose.disconnect();
  console.log('\n🎉 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
