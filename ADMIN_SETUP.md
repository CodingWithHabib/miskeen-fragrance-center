
# Admin Security Migration

## Changes
- Removed hidden triple-click admin access.
- Added dedicated `/admin.html`.
- Added Firebase Auth based admin verification.
- Added custom claims verification (`admin: true`).
- Added hardened Firestore rules.

## Required Firebase Steps

### 1. Assign Admin Claims
Use Firebase Admin SDK or Cloud Functions.

Example:
```js
admin.auth().setCustomUserClaims(USER_UID, { admin: true });
```

### 2. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 3. Create First Admin
- Sign up from `/admin.html`
- Assign claim manually
- Re-login to refresh token
