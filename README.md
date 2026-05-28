# QuickPipe ⚡

> The fastest, distraction-free cross-device pipeline for your links and text snippets.

QuickPipe is a minimalist, cross-device sync tool designed to solve a single, universal frustration: the annoying friction of messaging yourself on WhatsApp or emailing yourself just to move a link from your laptop to your phone. 

We stripped away the heavy bloat of traditional device sync tools to build a dedicated, lightning-fast data pipeline that protects your focus and logs your history in a clean, searchable feed.

---

## 🚀 The Ecosystem

QuickPipe consists of three core components that work together seamlessly:

### 1. Mobile App (Android/iOS)
Your centralized dashboard for reading, managing, and interacting with your synced links on the go.
- Built with **React Native** & **Expo**.
- Styled with modern, glassmorphism UI using **NativeWind** (TailwindCSS).
- Secure, passwordless authentication via Email OTP.
- One-tap copy and browser launching.

### 2. Chrome Extension
The quickest way to push content from your desktop browser to your mobile device.
- Built on **Manifest V3**.
- Push the current active tab with a single click (or keyboard shortcut).
- Paste and push text from your clipboard.
- Automatically connects to your QuickPipe account using a secure `syncKey`.

### 3. Backend API
The central nervous system that securely routes your data between devices.
- Built with **Node.js** and **Express**.
- Data stored securely in **MongoDB**.
- Endpoints for OTP generation, device pairing, and real-time history fetching.
- Hosted on Render.

---

## ✨ Features

- **Blazing Fast Sync:** Push a link from Chrome and see it instantly on your phone.
- **Passwordless Auth:** Secure email OTP login. No passwords to remember or get leaked.
- **Universal Clipboard:** Push not just URLs, but raw text and snippets.
- **Device Management:** Track which devices are connected to your pipeline and unlink them remotely.
- **Searchable Feed:** Quickly find past links with the built-in debounced search.
- **Developer Friendly:** Completely open-source and free to self-host.

---

## 🛠️ Tech Stack

**Frontend / Mobile:**
- React Native (Expo)
- NativeWind (TailwindCSS)
- React Navigation

**Browser Extension:**
- Vanilla JavaScript (Manifest V3)
- Chrome Storage API
- Standard Fetch API

**Backend:**
- Node.js & Express
- MongoDB & Mongoose
- Nodemailer (for OTPs)
- Helmet & Express Rate Limit (for security)

---

## ⚙️ Local Setup & Installation

Want to run QuickPipe locally or self-host it? Here is how to get started.

### Prerequisites
- Node.js (v18+)
- MongoDB instance (local or Atlas)
- Expo CLI

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:8081
```
Start the server:
```bash
npm run dev
```

### 2. Mobile App Setup
```bash
cd mobile-client
npm install
```
Ensure the `config.js` in `mobile-client` points to your backend URL (e.g., `http://your-local-ip:5000`).
Start the Expo development server:
```bash
npx expo start
```

### 3. Chrome Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `chrome-extension` folder in this repository.
4. Open the extension popup and enter your `syncKey` (generated from the Mobile App).

---

## ❤️ Support This Project

QuickPipe is completely free and open-source. If you find it useful and want to help cover the backend server costs and fuel future development, please consider supporting me!

[![Support Me](https://img.shields.io/badge/Support_Me-nikhim.me-34d399?style=for-the-badge&logo=heart&logoColor=white)](https://nikhim.me/supportme)

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
