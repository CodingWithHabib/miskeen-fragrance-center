# Permanent product and category uniqueness

Products are unique by normalized product name + category. Categories are unique by normalized name and slug. Callable Cloud Functions enforce these identities in Firestore transactions and maintain private reservation documents in `_uniqueProducts` and `_uniqueCategories`. Firestore clients cannot write products, categories, or reservation documents directly.

## Safe production rollout

Use the Firebase project owner/admin account. This is separate from the Netlify deploy.

1. Review the duplicate report without changing data:

   ```cmd
   cd functions
   npm install
   node migrate-uniqueness.js
   ```

   It prints duplicate groups and record IDs. It does not change Firestore in dry-run mode. Existing duplicate records are deliberately preserved and represented by ID lists in the uniqueness indexes.

2. Deploy the restrictive Firestore rules first. This intentionally pauses product/category writes from the old client while the index is built:

   ```cmd
   cd ..
   firebase deploy --only firestore:rules --project miskeen-fragrance-center
   ```

3. Backfill indexes. Run once while direct client writes are paused:

   ```cmd
   cd functions
   node migrate-uniqueness.js --apply
   ```

   This does not delete product/category documents. It writes `uniquenessKey` onto product documents and builds reservation documents. Check the output and Firestore console after it completes.

4. Deploy callable Functions:

   ```cmd
   cd ..
   firebase deploy --only functions --project miskeen-fragrance-center
   ```

5. Merge the accompanying GitHub pull request. Netlify then deploys the client that routes product/category admin CRUD through the callable functions.

6. Test as an admin: create a new product/category, try the same name/category or name/slug again, edit an existing record, and delete one. Duplicate creates should return an error; same-key edits should continue to work.

## Important

Do not run `--apply` until the dry-run output has been reviewed. Keep a Firestore export/backup before production changes. Cloud Functions deployment may require enabling billing (Blaze plan) and the Firebase CLI must be authenticated. The normal `firebase-config.js` web config is not the Admin credential; use the authorized Firebase CLI session, never commit a service-account key.
