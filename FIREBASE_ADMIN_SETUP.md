# Firebase Admin Setup Instructions

## Overview
The admin authentication system requires Firebase custom claims to work. Users must have the `admin: true` custom claim to access the admin dashboard.

## Step 1: Set up Firebase Admin SDK

The project already has `firebase-admin` installed. You need to set up a script to grant admin claims.

## Step 2: Create Admin Grant Script

Create a new file `js/grant-admin.js`:

```javascript
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
grantAdminClaim('your-admin-email@example.com');
```

## Step 3: Run the Script

```bash
node js/grant-admin.js
```

## Step 4: Verify Admin Access

1. Go to `admin.html` in your browser
2. Sign in with the email you granted admin access to
3. You should see the admin dashboard

## Alternative: Use Firebase Console

If you prefer using Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `miskeen-fragrance-center`
3. Go to Authentication → Users
4. Find the user you want to make admin
5. Click on the user (you'll need to use Cloud Functions or Admin SDK to set custom claims - Firebase Console doesn't have a UI for this)

## Step 5: Revoke Admin Access (if needed)

To revoke admin access:

```javascript
await auth.setCustomUserClaims(user.uid, { admin: false });
```

## Security Notes

- Keep `serviceAccountKey.json` secure and never commit it to Git
- Only grant admin access to trusted users
- Admin users have full access to all CRUD operations
