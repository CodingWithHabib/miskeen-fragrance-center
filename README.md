# Miskeen Fragrance Center — Setup & Run Guide

## 📋 Project Overview

A production-ready, modular e-commerce platform for selling attars and perfumes with:
- ✅ ES6 modular architecture
- ✅ Firebase Firestore + Realtime DB integration
- ✅ Cloudinary image uploads  
- ✅ WhatsApp direct ordering
- ✅ Admin dashboard with product/review management
- ✅ Responsive design, security, and error handling

---

## 🚀 Quick Start (Local Development)

### Option 1: Python (Easiest)

```bash
cd "e:\Web Dev\Miskeen Store"
python -m http.server 8000
```

Then open: **http://localhost:8000**

### Option 2: Node.js

Install `http-server` globally:
```bash
npm install -g http-server
cd "e:\Web Dev\Miskeen Store"
http-server -p 8000
```

Then open: **http://localhost:8000**

### Option 3: VS Code Live Server Extension

1. Install "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"

---

## ⚙️ Configuration

### 1. Firebase Setup (CRITICAL)

Before any features work, configure Firebase:

#### A. Enable Firestore Database
```
Firebase Console → miskeen-fragrance-center
Build → Firestore Database → Create Database
Region: asia-southeast1 (Southeast Asia)
Start Mode: Test Mode (for development)
```

#### B. Deploy Firestore Security Rules
```
Firestore Database → Rules tab
Replace with:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /reviews/{doc} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
    match /settings/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}

Click "Publish" ✓
```

#### C. Enable Realtime Database
```
Firebase Console → Build → Realtime Database → Create Database
Region: asia-southeast1
Start Mode: Test Mode
```

#### D. Deploy Realtime Database Rules
```
Realtime Database → Rules tab
Replace with:

{
  "rules": {
    "presence": {
      "visitors": {
        ".read": true,
        ".write": true
      }
    },
    "stock": {
      ".read": true,
      ".write": "auth != null"
    },
    "stats": {
      ".read": "auth != null",
      "totalViews": { ".read": true, ".write": true },
      "totalOrders": { ".read": true, ".write": true },
      "ordersToday": { ".read": true, ".write": true }
    },
    "orderLog": {
      ".read": "auth != null",
      ".write": true
    }
  }
}

Click "Publish" ✓
```

#### E. Enable Email/Password Authentication
```
Firebase Console → Build → Authentication → Get Started
Sign-in method → Email/Password → Enable
Users tab → Add User
Email: your@email.com
Password: YourStrongPassword123!
Click Add User ✓
```

**Save your credentials — you'll need them to access the admin panel!**

---

### 2. Cloudinary Setup (For Image Uploads)

```
Cloudinary.com → Sign up free
Dashboard → Copy Cloud Name
Settings → Upload → Upload presets → Add upload preset
Signing Mode: UNSIGNED
Folder: miskeen
Save → Copy Preset Name

On your live site:
Admin Panel → Settings tab → Enter:
  - Cloud Name: [from dashboard]
  - Upload Preset: [your preset name]
Click Save ✓
```

---

## 🎮 Using the Application

### Customer Features
- **Browse Products**: Filter by category, search by name/description
- **Select Sizes**: Click size pills to choose volume/type
- **Adjust Quantities**: Use +/− buttons
- **Order via WhatsApp**: Click "ORDER ON WHATSAPP" button
- **Submit Reviews**: Leave feedback on Reviews page (1-minute cooldown between submissions)

### Admin Features
Access with: **Triple-click the logo** OR **Ctrl+Shift+A**

Login with your Firebase credentials (email/password from setup step E)

#### Tabs:
1. **Manage (Products)**
   - View all products
   - Edit/Delete products
   - Mark as Featured
   - Upload product images

2. **Reviews**
   - View all customer reviews
   - Approve/Delete reviews

3. **Stock**
   - Track inventory levels
   - Update stock quantities

4. **Dashboard**
   - View sales statistics
   - See recent orders
   - Monitor visitor count

5. **Settings**
   - Update store name, WhatsApp, email, hours
   - Enter Cloudinary credentials
   - Set featured product image

---

## 📁 Project Structure

```
Miskeen Store/
├── index.html              # Main HTML (clean, modular)
├── css/
│   └── style.css           # All styling (1000+ lines, extracted)
├── js/
│   ├── app.js              # Main app orchestrator
│   └── modules/
│       ├── utils.js        # Validation, sanitization, helpers
│       ├── firebase.js     # Database & auth operations
│       ├── cloudinary.js   # Image upload & optimization
│       ├── services.js     # Business logic layer
│       ├── products.js     # Product display & filtering
│       ├── admin.js        # Admin panel & auth
│       └── reviews.js      # Review system
```

---

## 🔐 Security Features

- ✅ Input validation & XSS sanitization
- ✅ Firebase security rules enforcement
- ✅ Brute-force login protection (5 attempts in 15 min)
- ✅ Email/password authentication
- ✅ HTTPS enforced on production (Netlify)
- ✅ Cookie security (SameSite=Strict)

---

## 📍 Deploying to Production

### Option A: Netlify (Recommended - Free)

```
1. Netlify.com → Sign up (Google/GitHub)
2. Drag & drop the entire folder OR connect Git repo
3. Netlify automatically deploys and gives you a URL
4. Set custom domain in Site Settings → Domain Management
```

### Option B: GitHub Pages + Custom Domain

```
1. Push to GitHub
2. Enable Pages in repo settings
3. Point your domain CNAME to GitHub Pages
```

---

## 🐛 Troubleshooting

### "Firebase not initialized"
→ Check your Firebase config in `js/modules/firebase.js`

### "Cloudinary upload failed"
→ Make sure Cloud Name and Upload Preset are set in Admin Settings

### "White page, no content"
→ Check browser console (F12) for JavaScript errors

### "Products not loading"
→ Verify Firestore rules are published correctly

### "Can't log into admin"
→ Double-check email/password from Firebase Authentication

---

## 📊 Architecture

### Module Dependencies
```
app.js (Orchestrator)
├── utils.js (Validation, helpers)
├── firebase.js (Database operations)
│   └── Firestore + Realtime DB
├── cloudinary.js (Image uploads)
├── services.js (Business logic)
│   ├── uses: utils.js, firebase.js, cloudinary.js
├── products.js (Product UI)
│   ├── uses: services.js, utils.js
├── admin.js (Admin panel)
│   └── uses: firebase.js
└── reviews.js (Review system)
    └── uses: services.js, utils.js
```

---

## 💡 Key Features

### Product Management
- Multiple sizes per product with individual pricing
- Featured product highlight on homepage
- Image uploads with auto-compression
- Category filtering (attar, perfume, oud, musk, rose)
- Search functionality
- Stock tracking indicators

### Order System
- Direct WhatsApp ordering with auto-generated messages
- Order logging to Realtime Database
- Daily order statistics
- Visitor count tracking

### Review System
- 1-minute cooldown between submissions (prevents spam)
- Admin approval workflow
- 5-star rating system
- Mobile-friendly review display

### Admin Dashboard
- Real-time statistics
- Recent orders log
- Visitor analytics
- Settings management

---

## 🛠️ Development

### Adding Features
1. Create utility functions in `utils.js`
2. Add Firebase operations in `firebase.js`
3. Implement business logic in `services.js`
4. Create UI in product-specific module
5. Export and expose to global scope

### Code Style
- Use `const`/`let` (no `var`)
- Arrow functions for callbacks
- Template literals for strings
- Comments for blocks (/* ══════ */)
- Modular structure (one responsibility per file)

---

## 📞 Support

- Firebase Issues: https://firebase.google.com/support
- Cloudinary Issues: https://support.cloudinary.com
- GitHub Issues: Check project repository

---

## 📄 License

© 2025 Miskeen Fragrance Center. All Rights Reserved.

---

## ✅ Deployment Checklist

Before going live:

- [ ] Firebase Firestore rules deployed
- [ ] Firebase Realtime Database rules deployed
- [ ] Authentication enabled with admin user created
- [ ] Cloudinary account created with upload preset
- [ ] All product data entered with images
- [ ] Contact details updated (WhatsApp, email, hours)
- [ ] Tested on desktop and mobile
- [ ] SSL certificate valid (automatic on Netlify)
- [ ] DNS pointing to hosting provider
- [ ] Admin can log in and manage products

---

**You're all set! 🚀 Start the dev server and begin building!**