import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

const expectedProjectId = 'miskeen-fragrance-center';

if (serviceAccount.project_id !== expectedProjectId) {
  console.error(`❌ Service account belongs to a different Firebase project. Expected ${expectedProjectId}.`);
  console.error('Use the service-account JSON from Firebase Console > Project settings > Service accounts.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function grantAdminClaim(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, {
      ...user.customClaims,
      admin: true
    });
    console.log(`✅ Admin claim granted to ${email}`);
    console.log(`User UID: ${user.uid}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ No Firebase Authentication user exists for ${email} in project ${expectedProjectId}.`);
      console.error('Create the account from the Admin sign-in page first, then rerun this command with that exact email.');
    } else {
      console.error('❌ Error:', error.message || error);
    }
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
}

const adminEmail = process.argv[2]?.trim();

if (!adminEmail) {
  console.error('Usage: node js/grant-admin.js admin@example.com');
  process.exitCode = 1;
} else {
  grantAdminClaim(adminEmail);
}
