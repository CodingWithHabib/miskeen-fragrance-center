# Firebase Admin Setup Instructions

## Overview
The admin authentication system requires Firebase custom claims to work. Users must have the `admin: true` custom claim to access the admin dashboard.

## Step 1: Assign the Admin Claim

The project includes an ES-module-compatible grant script. Keep the Firebase service-account JSON at `js/serviceAccountKey.json` locally; never commit or share that key.

```bash
node js/grant-admin.js your-login-email@example.com
```

The script preserves the user's other custom claims and adds `admin: true`.

## Step 2: Verify Admin Access

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

## Step 3: Revoke Admin Access (if needed)

To revoke admin access:

```javascript
await auth.setCustomUserClaims(user.uid, { admin: false });
```

## Security Notes

- Keep `serviceAccountKey.json` secure and never commit it to Git
- Only grant admin access to trusted users
- Admin users have full access to all CRUD operations
