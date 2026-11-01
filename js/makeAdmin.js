import admin from "firebase-admin";
import { applicationDefault } from "firebase-admin/app";

admin.initializeApp({ credential: applicationDefault() });

admin.auth().setCustomUserClaims(
  "LXiwrjGVhiPf5aMMRoq7hzBGCiF2",
  { admin: true }
)
.then(() => {
  console.log("Admin claim added successfully");
})
.catch(console.error);