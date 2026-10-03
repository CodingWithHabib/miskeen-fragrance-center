import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" with { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.auth().setCustomUserClaims(
  "LXiwrjGVhiPf5aMMRoq7hzBGCiF2",
  { admin: true }
)
.then(() => {
  console.log("Admin claim added successfully");
})
.catch(console.error);