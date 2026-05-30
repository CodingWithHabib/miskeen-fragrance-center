const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

// Grant admin claim to a user
async function grantAdminClaim(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Admin claim granted to ${email}`);
    console.log(`User UID: ${user.uid}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Replace with your admin email
const adminEmail = process.argv[2] || 'your-admin-email@example.com';

if (adminEmail === 'your-admin-email@example.com') {
  console.log('⚠️  Please provide an email address:');
  console.log('   node js/grant-admin.js admin@example.com');
} else {
  grantAdminClaim(adminEmail);
}
