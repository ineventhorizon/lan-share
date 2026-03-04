# LAN Share

A simple **Node.js + Express local network file sharing system** designed for **offline lab environments**.

---

# 🚀 Quick Start


### 1️⃣ Install dependencies

```bash
npm install express multer bootstrap
```

### 2️⃣ Start the server

```bash
node server.js
```

You will see:

```
LAN Share running on http://0.0.0.0:3000
```


### 3️⃣ Students connect using

```
http://YOUR_IP:3000
```

Example:

```
http://192.168.1.25:3000
```

### 4️⃣ Optional controls

Open shared files:

```
touch shared-on
```

Open assignment submissions:

```
touch upload-on
```

Disable uploads:

```
rm upload-on
```

---

# Features

### File Sharing

* Share files from the `shared/` directory
* Students can browse folders
* Only **preview allowed** (no downloads)
* Supports preview for:

  * PDF
  * PNG
  * JPG
  * JPEG
  * GIF
  * WEBP

### Assignment Submissions

Students can upload files through the upload page.

Uploads require:

* **11 digit student ID**
* Allowed file types:

  * `.pdf`
  * `.zip`
  * `.java`
  * `.txt`
  * `.png`
  * `.jpg`
  * `.jpeg`

Uploads are saved as:

```
shared/
   submissions/
      STUDENT_ID/
          uploaded_file
```

### Privacy Protection

Students **cannot access submissions**.

The submissions page shows:

```
names only
```

No preview or download is possible.

### Upload Toggle (No Restart Required)

Enable uploads:

```
touch upload-on
```

Disable uploads:

```
rm upload-on
```

### Shared Files Toggle (Optional)

Enable shared files:

```
touch shared-on
```

Disable shared files:

```
rm shared-on
```

---

# Requirements

* Node.js **v16+**
* npm

Check installation:

```
node -v
npm -v
```

---

# Installation

Clone or download the project.

Install dependencies:

```
npm install express multer bootstrap
```

---

# Project Structure

```
lan-share/
│
├── server.js
├── package.json
├── upload-on        (optional toggle file)
├── shared-on        (optional toggle file)
│
├── shared/
│    ├── submissions/
│    └── (files you want to share)
│
└── node_modules/
```

---

# Running the Server

Start the server:

```
node server.js
```

You will see:

```
LAN Share running on http://0.0.0.0:3000
```

Students connect using your local IP.

Example:

```
http://192.168.1.25:3000
```

Find your IP:

### macOS / Linux

```
ifconfig
```

or

```
ipconfig getifaddr en0
```

### Windows

```
ipconfig
```

Look for:

```
IPv4 Address
```

---

# Instructor Usage

## Share Files

Place files inside:

```
shared/
```

Example:

```
shared/
   lecture1.pdf
   examples.zip
   code/
       example.java
```

These appear on the **/files** page.

---

## Open Uploads for Students

```
touch upload-on
```

Students can now upload assignments.

---

## Close Uploads

```
rm upload-on
```

Uploads immediately stop.

---

## View Submissions

Open:

```
http://YOUR_IP:3000/submissions
```

You will see:

```
submissions/
   20201234567/
       hw1.zip
       solution.java
```

Only filenames are visible.

---

# Upload Limits

| Setting              | Value     |
| -------------------- | --------- |
| Max file size        | 50MB      |
| Max files per upload | 1         |
| Student ID length    | 11 digits |

---

# Security

The server includes several protections:

* Path traversal protection
* Hidden files are not shown
* `.DS_Store` ignored
* Submissions cannot be previewed or downloaded
* Only allowed file types accepted
* Student IDs sanitized
* Submissions stored in isolated folders

---

# Offline Support

Bootstrap is served locally:

```
/static/bootstrap
```

This means:

* No internet connection required
* Works inside restricted lab networks

---

# Example Lab Workflow

Start of lab:

```
touch shared-on
rm upload-on
node server.js
```

Students download materials.

---

When assignment begins:

```
touch upload-on
```

Students submit files.

---

After deadline:

```
rm upload-on
```

Uploads immediately stop.

---

Instructor grading:

```
shared/submissions/
```

---

# Useful URLs

| Page                | URL            |
| ------------------- | -------------- |
| File browser        | `/files`       |
| Upload page         | `/upload`      |
| Submissions (names) | `/submissions` |

---

# Troubleshooting

### Students cannot connect

Check:

* Same network
* Correct IP address
* Port **3000**

---

### Bootstrap not loading

Install dependencies again:

```
npm install
```

---

### Uploads not working

Ensure uploads are enabled:

```
touch upload-on
```

---
