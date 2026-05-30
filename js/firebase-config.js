/* ════════════════════════════════════════════════════════════════
   FIREBASE CREDENTIALS - LOCAL DEVELOPMENT
   
   ⚠️  WARNING: This file is excluded from Git (.gitignore)
   ⚠️  NEVER commit this file to version control
   ⚠️  For production, set environment variables on hosting platform
════════════════════════════════════════════════════════════════ */

export const firebaseConfig = {
  apiKey:            "AIzaSyDy9cBRGlQR507rKrcvaaeS465aMVjA7YE",
  authDomain:        "miskeen-fragrance-center.firebaseapp.com",
  projectId:         "miskeen-fragrance-center",
  storageBucket:     "miskeen-fragrance-center.firebasestorage.app",
  messagingSenderId: "607611380770",
  appId:             "1:607611380770:web:6a6c69c0c6f4497f1c967b",
  databaseURL:       "https://miskeen-fragrance-center-default-rtdb.asia-southeast1.firebasedatabase.app"
};

console.log('✅ Firebase config loaded from secure location');
