<div align="center">
  <img src="renderer/assets/logo.png" alt="NoteQ Logo" width="120" />
  <h1>NoteQ</h1>
  <p><strong>Secure, Enterprise-Grade Markdown Note-Taking Application</strong></p>
</div>

---

## 📘 Overview

**NoteQ** is a professional, security-focused desktop application designed for managing Markdown notes with ease. Built with **Electron**, **React**, and **TipTap**, it combines a modern 3-column interface with military-grade security features to ensure your sensitive data remains private.

## ✨ Features

### 🔒 Enterprise Security
- **3-Factor Authentication**: Access your vault using a combination of **Project Location**, **Security PIN**, and **Recovery Key**.
- **Project-Bound Credentials**: Verification mechanisms are cryptographically bound to the specific project folder, preventing unauthorized access even if files are copied.
- **Self-Destruct Mechanism**: Automatic 3-pass secure wipe (DoD standard) triggers after 10 failed login attempts.
- **High-Cost Hashing**: PINs and Recovery Keys are protected using **Bcrypt (Cost 12)** to resist brute-force attacks.

### 📝 Powerful Editor
- **Rich Markdown Support**: Write in Markdown with real-time preview.
- **WYSIWYG Interface**: Powered by TipTap for a seamless writing experience.
- **Organization**: Manage notes with folders, tags, and categories.

### 🚀 Modern Architecture
- **Local-First**: All data is stored locally on your machine in standard JSON/Markdown formats.
- **Cross-Platform**: Built on Electron for Windows, macOS, and Linux support.

---

## 📅 Changelog

### v1.0.0 (Latest Update)
* **Security Core Overhaul**:
  * Implemented **3-Factor Authentication** (Vault Path + PIN + Recovery Key file).
  * Upgraded password hashing to **Bcrypt Cost 12** for enterprise-grade protection.
  * Added **Secure Self-Destruct**: Files are now overwritten 3 times (0xFF, 0x00, Random) before deletion to prevent recovery.
  * Hardened IPC communication channels to prevent injection attacks.
* **UI/UX Improvements**:
  * Added "Recovery Key" upload support on the Landing Page.
  * Improved error handling for login failures.
* **Maintenance**:
  * Cleaned up project structure and removed unused assets.
  * Standardized `.gitignore` configuration.

---

<div align="center">
  <sub>Built with ❤️ by OpenCore Lab.</sub>
</div>
