/**
 * CENG114 LAN Share (single-file)
 *
 * Current behavior:
 * ✅ Remove "Notes" field from upload UI
 * ✅ Hide "submissions/" from the /files browser always
 * ✅ Show submissions ONLY when uploads are OPEN (upload-on exists)
 * ✅ Submissions have their OWN BUTTON (not mixed into /files)
 * ✅ Submissions are NAMES ONLY (no preview/download for anyone)
 * ✅ Public files (non-submissions): PREVIEW ONLY (NO download button)
 * ✅ Hidden files/folders not shown (.DS_Store, .git, etc.)
 * ✅ Uploads toggle without restart:
 *      Enable:  touch upload-on
 *      Disable: rm upload-on
 *
 * Offline Bootstrap:
 *   npm i bootstrap
 *   (served locally from /static/bootstrap)
 *
 * Setup:
 *   npm i express multer bootstrap
 *
 * Run:
 *   node server.js
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

const SHARE_DIR = path.join(__dirname, "shared");
const SUBMISSIONS_DIR = path.join(SHARE_DIR, "submissions");
const UPLOAD_FLAG = path.join(__dirname, "upload-on");
const SHARED_FLAG = path.join(__dirname, "shared-on");

function sharedEnabledNow() {
  return fs.existsSync(SHARED_FLAG);
}

// Upload policy
const MAX_FILE_MB = 50;
const MAX_FILES_PER_UPLOAD = 10;
const ALLOWED_EXT = new Set([".pdf", ".zip", ".java", ".txt", ".png", ".jpg", ".jpeg"]);

// ---------- Helpers ----------
function isVisible(name) {
  return !name.startsWith(".");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function extLower(name) {
  return path.extname(name).toLowerCase();
}

function isPreviewable(name) {
  const ext = extLower(name);
  return ext === ".pdf" || ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".webp";
}

function uploadsEnabledNow() {
  return fs.existsSync(UPLOAD_FLAG);
}

// Prevent path traversal: resolve a relative path inside SHARE_DIR only
function resolveInsideShare(rel) {
  const safeRel = (rel || "").toString().replace(/\\/g, "/");
  const abs = path.resolve(SHARE_DIR, safeRel);
  if (!abs.startsWith(SHARE_DIR)) return null;
  return abs;
}

// Normalize to forward-slashes
function normRel(rel) {
  return (rel || "").toString().replace(/\\/g, "/").replace(/^\/+/, "");
}

function isSubmissionsPath(rel) {
  const n = normRel(rel);
  return n === "submissions" || n.startsWith("submissions/");
}

// ---------- Ensure folders exist ----------
fs.mkdirSync(SHARE_DIR, { recursive: true });
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

// ---------- Multer upload config ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const studentIdRaw = (req.body.studentId || "").trim();
      const studentId = studentIdRaw.replace(/[^a-zA-Z0-9_-]/g, "") || "unknown";
      const dest = path.join(SUBMISSIONS_DIR, studentId);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const clean = file.originalname.replace(/[^\w.\-() ]+/g, "_");
      cb(null, clean);
    },
  }),
  limits: {
    fileSize: MAX_FILE_MB * 1024 * 1024,
    files: MAX_FILES_PER_UPLOAD,
  },
  fileFilter: (req, file, cb) => {
    const ext = extLower(file.originalname);
    if (!ALLOWED_EXT.has(ext)) return cb(new Error(`File type not allowed: ${ext}`));
    cb(null, true);
  },
});

// ---------- Serve Bootstrap locally (offline) ----------
app.use(
  "/static/bootstrap",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist"))
);

// ---------- Shared UI bits ----------
function topButtonsHtml(currentDir) {
  const uploadsOpen = uploadsEnabledNow();
  const subBtn = uploadsOpen
    ? `<a class="btn btn-outline-warning" href="/submissions">Submissions (names)</a>`
    : ""; // only show when uploads open
  return `
    <a class="btn btn-outline-secondary" href="/files?dir=${encodeURIComponent(currentDir || "")}">Refresh</a>
    <a class="btn btn-outline-primary" href="/upload">Student Upload</a>
    ${subBtn}
  `;
}

function uploadsBadgeHtml() {
  const uploadsOpen = uploadsEnabledNow();
  return `Uploads: <span class="badge ${uploadsOpen ? "text-bg-success" : "text-bg-secondary"}">${
    uploadsOpen ? "OPEN" : "CLOSED"
  }</span>`;
}

function statusBadgesHtml() {
  const uploadsOpen = uploadsEnabledNow();
  const sharedOpen = sharedEnabledNow();

  return `
    Shared: <span class="badge ${sharedOpen ? "text-bg-success" : "text-bg-secondary"}">${sharedOpen ? "OPEN" : "CLOSED"}</span>
    <span class="ms-2">Uploads: <span class="badge ${uploadsOpen ? "text-bg-success" : "text-bg-secondary"}">${uploadsOpen ? "OPEN" : "CLOSED"}</span></span>
  `;
}

// ---------- Routes ----------
app.get("/", (req, res) => res.redirect("/files"));

/**
 * Public file browser: ONLY shows ./shared content EXCEPT submissions/
 * - submissions is hidden from here always
 * - files have PREVIEW ONLY (no download button)
 */
app.get("/files", async (req, res) => {
  if (!sharedEnabledNow()) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(403).send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Shared Closed</title>
  <link href="/static/bootstrap/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-5">
    <div class="card shadow-sm">
      <div class="card-body">
        <h4 class="mb-2">Shared files are closed</h4>
        <p class="text-muted mb-3">Please wait for the instructor to open shared files.</p>
        <a class="btn btn-primary" href="/upload">Go to Upload</a>
      </div>
    </div>
  </div>
</body>
</html>`);
}
  try {
    let relDir = normRel((req.query.dir || "").toString()).replace(/\/+$/, "");
    if (!relDir) relDir = "";

    // Never allow browsing into submissions here
    if (isSubmissionsPath(relDir)) {
      return res.redirect("/files");
    }

    const absDir = resolveInsideShare(relDir);
    if (!absDir) return res.status(403).send("Forbidden");

    const st = await fs.promises.stat(absDir);
    if (!st.isDirectory()) return res.status(404).send("Not a directory");

    let entries = await fs.promises.readdir(absDir, { withFileTypes: true });

    // Hide dotfiles and ALWAYS hide submissions folder from /files
    entries = entries.filter((e) => {
      if (!isVisible(e.name)) return false;
      if (e.name === "submissions") return false;
      return true;
    });

    const rows = await Promise.all(
      entries.map(async (e) => {
        const rel = relDir ? `${relDir}/${e.name}` : e.name;
        const abs = resolveInsideShare(rel);
        let size = "—";
        let mtime = "—";
        try {
          const stat = await fs.promises.stat(abs);
          if (stat.isFile()) size = formatBytes(stat.size);
          mtime = new Date(stat.mtime).toLocaleString();
        } catch {}
        return { e, rel, size, mtime };
      })
    );

    rows.sort((a, b) => {
      if (a.e.isDirectory() && !b.e.isDirectory()) return -1;
      if (!a.e.isDirectory() && b.e.isDirectory()) return 1;
      return a.e.name.localeCompare(b.e.name);
    });

    // breadcrumbs
    const parts = relDir ? relDir.split("/").filter(Boolean) : [];
    let acc = "";
    const crumbs = [
      `<li class="breadcrumb-item"><a href="/files">Home</a></li>`,
      ...parts.map((p, i) => {
        acc = acc ? `${acc}/${p}` : p;
        const isLast = i === parts.length - 1;
        return isLast
          ? `<li class="breadcrumb-item active">${escapeHtml(p)}</li>`
          : `<li class="breadcrumb-item"><a href="/files?dir=${encodeURIComponent(acc)}">${escapeHtml(
              p
            )}</a></li>`;
      }),
    ].join("");

    const tableRows = rows
      .map(({ e, rel, size, mtime }) => {
        const name = e.name;

        if (e.isDirectory()) {
          return `<tr>
            <td>📁</td>
            <td><a href="/files?dir=${encodeURIComponent(rel)}">${escapeHtml(name)}/</a></td>
            <td class="text-muted">—</td>
            <td class="text-muted">${escapeHtml(mtime)}</td>
            <td class="text-muted">—</td>
          </tr>`;
        }

        const fileEnc = encodeURIComponent(rel);

        // PREVIEW ONLY: if not previewable, show "no preview"
        const actions = isPreviewable(name)
          ? `<a class="btn btn-sm btn-outline-primary" target="_blank" href="/open?file=${fileEnc}">Preview</a>`
          : `<span class="text-muted small">no preview</span>`;

        return `<tr>
          <td>📄</td>
          <td>${escapeHtml(name)}</td>
          <td class="text-muted">${escapeHtml(size)}</td>
          <td class="text-muted">${escapeHtml(mtime)}</td>
          <td>${actions}</td>
        </tr>`;
      })
      .join("");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>LAN Share</title>
  <link href="/static/bootstrap/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h3 class="mb-1">LAN Share</h3>
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb mb-0">${crumbs}</ol>
        </nav>
        <div class="small mt-2">${statusBadgesHtml()}</div>
      </div>
      <div class="d-flex gap-2">
        ${topButtonsHtml(relDir)}
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <input id="q" class="form-control mb-3" placeholder="Search in this folder...">
        <div class="table-responsive">
          <table class="table align-middle" id="tbl">
            <thead>
              <tr>
                <th style="width:48px;">Type</th>
                <th>Name</th>
                <th style="width:130px;">Size</th>
                <th style="width:200px;">Modified</th>
                <th style="width:220px;">Actions</th>
              </tr>
            </thead>
            <tbody>${tableRows || `<tr><td colspan="5"><em>No visible items here.</em></td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

<script>
  const q = document.getElementById('q');
  const tbody = document.getElementById('tbl').getElementsByTagName('tbody')[0];
  q.addEventListener('input', () => {
    const term = q.value.toLowerCase();
    [...tbody.rows].forEach(r => {
      const name = (r.cells[1]?.innerText || '').toLowerCase();
      r.style.display = name.includes(term) ? '' : 'none';
    });
  });
</script>
</body>
</html>`);
  } catch {
    res.status(404).send("Folder not found");
  }
});

/**
 * Submissions page: only visible when uploads are open.
 * - Shows student folders and filenames (names only)
 * - NO preview/download for anything in submissions
 */
app.get("/submissions", async (req, res) => {
  if (!uploadsEnabledNow()) {
    return res.status(404).send("Not available.");
  }

  try {
    let relDir = normRel((req.query.dir || "").toString()).replace(/\/+$/, "");
    if (!relDir) relDir = "submissions";

    if (!isSubmissionsPath(relDir)) relDir = "submissions";

    const absDir = resolveInsideShare(relDir);
    if (!absDir) return res.status(403).send("Forbidden");

    const st = await fs.promises.stat(absDir);
    if (!st.isDirectory()) return res.status(404).send("Not a directory");

    let entries = await fs.promises.readdir(absDir, { withFileTypes: true });
    entries = entries.filter((e) => isVisible(e.name));

    const rows = await Promise.all(
      entries.map(async (e) => {
        const rel = relDir ? `${relDir}/${e.name}` : e.name;
        const abs = resolveInsideShare(rel);
        let size = "—";
        let mtime = "—";
        try {
          const stat = await fs.promises.stat(abs);
          if (stat.isFile()) size = formatBytes(stat.size);
          mtime = new Date(stat.mtime).toLocaleString();
        } catch {}
        return { e, rel, size, mtime };
      })
    );

    rows.sort((a, b) => {
      if (a.e.isDirectory() && !b.e.isDirectory()) return -1;
      if (!a.e.isDirectory() && b.e.isDirectory()) return 1;
      return a.e.name.localeCompare(b.e.name);
    });

    const parts = relDir ? relDir.split("/").filter(Boolean) : [];
    let acc = "";
    const crumbs = [
      `<li class="breadcrumb-item"><a href="/files">Files</a></li>`,
      `<li class="breadcrumb-item"><a href="/submissions">Submissions</a></li>`,
      ...parts.slice(1).map((p, i) => {
        acc = acc ? `${acc}/${p}` : `submissions/${p}`;
        const isLast = i === parts.slice(1).length - 1;
        return isLast
          ? `<li class="breadcrumb-item active">${escapeHtml(p)}</li>`
          : `<li class="breadcrumb-item"><a href="/submissions?dir=${encodeURIComponent(acc)}">${escapeHtml(
              p
            )}</a></li>`;
      }),
    ].join("");

    const tableRows = rows
      .map(({ e, rel, size, mtime }) => {
        const name = e.name;

        if (e.isDirectory()) {
          return `<tr>
            <td>📁</td>
            <td><a href="/submissions?dir=${encodeURIComponent(rel)}">${escapeHtml(name)}/</a></td>
            <td class="text-muted">—</td>
            <td class="text-muted">${escapeHtml(mtime)}</td>
            <td><span class="text-muted small">names only</span></td>
          </tr>`;
        }

        return `<tr>
          <td>📄</td>
          <td>${escapeHtml(name)}</td>
          <td class="text-muted">${escapeHtml(size)}</td>
          <td class="text-muted">${escapeHtml(mtime)}</td>
          <td><span class="text-muted small">disabled</span></td>
        </tr>`;
      })
      .join("");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Submissions (Names)</title>
  <link href="/static/bootstrap/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h3 class="mb-1">Submissions (Names Only)</h3>
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb mb-0">${crumbs}</ol>
        </nav>
        <div class="small mt-2">${statusBadgesHtml()}</div>
      </div>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" href="/submissions?dir=${encodeURIComponent(relDir)}">Refresh</a>
        <a class="btn btn-outline-secondary" href="/files">Back to files</a>
      </div>
    </div>

    <div class="alert alert-warning">
      Downloads and previews are <b>disabled</b> for submissions. This page only shows names.
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <input id="q" class="form-control mb-3" placeholder="Search in this folder...">
        <div class="table-responsive">
          <table class="table align-middle" id="tbl">
            <thead>
              <tr>
                <th style="width:48px;">Type</th>
                <th>Name</th>
                <th style="width:130px;">Size</th>
                <th style="width:200px;">Modified</th>
                <th style="width:220px;">Actions</th>
              </tr>
            </thead>
            <tbody>${tableRows || `<tr><td colspan="5"><em>No visible items here.</em></td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

<script>
  const q = document.getElementById('q');
  const tbody = document.getElementById('tbl').getElementsByTagName('tbody')[0];
  q.addEventListener('input', () => {
    const term = q.value.toLowerCase();
    [...tbody.rows].forEach(r => {
      const name = (r.cells[1]?.innerText || '').toLowerCase();
      r.style.display = name.includes(term) ? '' : 'none';
    });
  });
</script>
</body>
</html>`);
  } catch {
    res.status(404).send("Folder not found");
  }
});

// Preview route (inline open) — HARD BLOCK submissions always
app.get("/open", async (req, res) => {
  const relFile = normRel((req.query.file || "").toString());
  if (!relFile) return res.status(400).send("Missing file");
  if (path.basename(relFile).startsWith(".")) return res.status(404).send("Not found");

  if (isSubmissionsPath(relFile)) {
    return res.status(403).send("Submissions cannot be viewed.");
  }
  if (!sharedEnabledNow()) {
  return res.status(403).send("Shared files are closed.");
  }

  const absFile = resolveInsideShare(relFile);
  if (!absFile) return res.status(403).send("Forbidden");

  try {
    const st = await fs.promises.stat(absFile);
    if (!st.isFile()) return res.status(404).send("Not found");
    res.sendFile(absFile);
  } catch {
    res.status(404).send("Not found");
  }
});

// OPTIONAL: keep /download route but disable it globally (since you want preview-only)
app.get("/download", (req, res) => {
  res.status(404).send("Downloads are disabled. Use Preview.");
});

// Upload page (students). Only works when upload-on flag exists.
app.get("/upload", (req, res) => {
  const open = uploadsEnabledNow();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Upload Submission</title>
  <link href="/static/bootstrap/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .dropzone {
      border: 2px dashed #999;
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      color: #666;
      background: #fafafa;
      cursor: pointer;
      user-select: none;
    }
    .dropzone.dragover { background: #f0f7ff; border-color: #0d6efd; color: #0d6efd; }
    .filehint { font-size: 0.9rem; color: #666; }
  </style>
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">CENG114 — Submission Upload</h3>
      ${sharedEnabledNow() ? `<a class="btn btn-outline-secondary" href="/files">Back to files</a>` : ``}
    </div>

    <div class="alert ${open ? "alert-success" : "alert-secondary"}">
      Uploads are currently <b>${open ? "OPEN" : "CLOSED"}</b>.
      ${open ? "" : "If you see this, wait for the instructor to open uploads."}
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <form action="/upload" method="post" enctype="multipart/form-data">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Student ID (required)</label>
              <input class="form-control" name="studentId" ${open ? "required" : "disabled"} placeholder="e.g. 2020123456">
            </div>

            <div class="col-12">
              <label id="dz" class="dropzone ${open ? "" : "opacity-50"}" for="fileInput">
                <div class="fw-semibold">Click to choose files</div>
                <div class="small">or drag & drop here</div>
                <div class="filehint mt-2">
                  Allowed: ${[...ALLOWED_EXT].join(" ")} — Max ${MAX_FILE_MB}MB each
                </div>
                <div id="selected" class="small mt-2"></div>
              </label>

              <input id="fileInput"
                     class="form-control mt-3"
                     type="file"
                     name="files"
                     multiple
                     ${open ? "required" : "disabled"}>
            </div>

            <div class="col-12 d-flex gap-2">
              <button class="btn btn-primary" type="submit" ${open ? "" : "disabled"}>Upload</button>
              ${sharedEnabledNow() ? `<a class="btn btn-outline-secondary" href="/files">Browse files</a>` : ``}
              ${open ? `<a class="btn btn-outline-warning" href="/submissions">Submissions (names)</a>` : ""}
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>

<script>
  const dz = document.getElementById('dz');
  const input = document.getElementById('fileInput');
  const selected = document.getElementById('selected');

  function showSelected() {
    if (!input.files || input.files.length === 0) {
      selected.textContent = '';
      return;
    }
    const names = Array.from(input.files).map(f => f.name);
    selected.textContent = "Selected: " + names.join(", ");
  }

  input.addEventListener('change', showSelected);

  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!input.disabled) dz.classList.add('dragover');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (input.disabled) return;

    try {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        showSelected();
      }
    } catch (_) {}
  });
</script>
</body>
</html>`);
});

// Upload handler
app.post(
  "/upload",
  (req, res, next) => {
    if (!uploadsEnabledNow()) return res.status(403).send("Uploads are currently closed.");
    next();
  },
  upload.array("files", MAX_FILES_PER_UPLOAD),
  (req, res) => {
    const studentIdRaw = (req.body.studentId || "").trim();
    const studentId = studentIdRaw.replace(/[^a-zA-Z0-9_-]/g, "") || "unknown";
    const files = (req.files || []).map((f) => f.filename);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link href="/static/bootstrap/css/bootstrap.min.css" rel="stylesheet"><title>Upload Complete</title></head>
<body class="bg-light">
<div class="container py-4">
  <div class="card shadow-sm">
    <div class="card-body">
      <h4 class="mb-3">Upload complete ✅</h4>
      <p class="mb-1">Student: <code>${escapeHtml(studentId)}</code></p>
      <p class="mb-3">Saved to: <code>/submissions/${escapeHtml(studentId)}/</code></p>

      <div class="alert alert-info">
        <b>Note:</b> Submissions are not downloadable/previewable. Only file names are visible.
      </div>

      <div class="mb-3">
        <div class="fw-semibold mb-2">Uploaded files</div>
        <ul class="mb-0">
          ${files.map((fn) => `<li>${escapeHtml(fn)}</li>`).join("") || "<li>(none)</li>"}
        </ul>
      </div>

      ${sharedEnabledNow() ? `<a class="btn btn-primary" href="/files">Back to files</a>` : ``}
      <a class="btn btn-outline-secondary ms-2" href="/upload">Upload another</a>
      <a class="btn btn-outline-warning ms-2" href="/submissions">Submissions (names)</a>
    </div>
  </div>
</div>
</body></html>`);
  }
);

// Multer error handling
app.use((err, req, res, next) => {
  const msg = err?.message || "Upload error";
  res.status(400).send(`Upload failed: ${escapeHtml(msg)}`);
});

// Listen on LAN
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LAN Share running on http://0.0.0.0:${PORT}`);
  console.log(`Uploads are ${uploadsEnabledNow() ? "OPEN" : "CLOSED"} (toggle with: touch upload-on / rm upload-on)`);
});