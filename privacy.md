# Privacy Policy for Quickpipe

**Effective Date:** May 28, 2026  
**Status:** Open Source & Community Driven  

Quickpipe ("we," "our," or "the project") is built from the ground up with a strict philosophy of **absolute data minimization**. Because Quickpipe is an open-source cross-device utility, we believe you should have complete visibility into how your data flows. 

Unlike traditional platforms, Quickpipe does not use tracking cookies, analytics SDKs, or third-party marketing trackers. We only handle the exact data necessary to pipe your links and text clips between your devices.

---

## 1. Information We Collect and Process

To maintain a zero-friction experience without traditional passwords, the system only processes two categories of information:

### A. Account & Authentication Data
* **Email Address:** When you register or log in via the mobile application, we collect your email address purely to dispatch a 6-digit passwordless One-Time Password (OTP) verification token.
* **Sync Key:** Upon successful verification, our backend generates a random, anonymous string (e.g., `SETU-XXXX-XXXX`). This key acts as the unlinked bridge between your mobile app and your browser profiles. 

### B. Pipeline Content Data
* **Synced Clips (URLs and Text):** When you execute the `Alt + S` shortcut, click the extension icon, or use the mobile share sheet, the application transmits the raw URL or text snippet to the cloud database.
* **Metadata:** We attach a device source tag (`desktop` or `mobile`) and a timestamp (`createdAt`) to each item so your history feed can render entries in chronological order.

---

## 2. How Your Data is Stored and Kept Secure

* **No Web Tracking:** The Chrome Extension uses the `activeTab` permission. This means it is **physically isolated** from your browser history. It cannot see what you are browsing, what tabs you have open, or what you type, *until* you explicitly trigger the pipeline via the shortcut or the send button on that specific active page.
* **Encryption in Transit:** All communications between the Chrome Extension, the React Native Mobile App, and the Central Express API backend are strictly encrypted utilizing HTTPS (TLS/SSL) protocols.
* **Text Indexing:** History items are stored in your user-allocated database cluster with an optimized text index, allowing you to execute real-time local search queries securely.

---

## 3. Data Retention and Deletion (Your Control)

You have total authority over your shared link history:
* **Manual Deletion:** Swiping left on an item in the mobile application or clicking the trash icon (`🗑️`) in the browser extension instantly and permanently dispatches a delete command, wiping that document out of the database cluster entirely.
* **Account Purging:** Since this project is open source, you can request full system deletion, or if you choose to self-host the repository, your data never leaves your personal infrastructure.

---

## 4. Third-Party Services and Infrastructure

By default, the public open-source iteration of Quickpipe utilizes trusted, foundational cloud architecture layers to route payloads:
* **Database & Hosting Providers:** The public instance API runs on secure node instances (e.g., Render/Railway) backed by cloud database sandboxes (e.g., MongoDB Atlas). 
* **Push Services:** Firebase Cloud Messaging (FCM) is used to wake up the Android client runtime and deliver the instant link sync notification payload.

We do not sell, rent, trade, or share your synced text, links, or email addresses with any advertising networks or data brokers.

---

## 5. Self-Hosting and Total Privacy Sovereignty

If you want absolute 100% data sovereignty, Quickpipe is completely modular. You are encouraged to fork the repository, deploy the Node.js/Express backend image on your own server, link it to your personal database instance, and point your local client builds to your unique domain. When self-hosting, no data ever touches our public service channels.

---

## 6. Contact and Community Auditing

Because this project is open-source, our entire system architecture, dependencies, and network parameters are open for inspection by the developer community. 

If you have questions about this privacy protocol, find an edge-case bug, or want to suggest security hardening patches, please open a public ticket on our official GitHub Issue Tracker.