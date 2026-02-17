const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

const SHARE_DIR = path.join(__dirname, "shared");
const SUBMISSIONS_DIR = path.join(SHARE_DIR, "submissions");

// ---- helpers ----
function isVisible(name) {
  return !name.startsWith(".");
}

function resolveInsideShare(rel) {
  const safeRel = (rel || "").toString().replace(/\\/g, "/");
  const abs = path.resolve(SHARE_DIR, safeRel);
  if (!abs.startsWith(SHARE_DIR)) return null;
  return abs;
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

// Ensure submissions folder exists
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

// ---- Multer upload config ----
const ALLOWED_EXT = new Set([".pdf", ".zip", ".java", ".txt", ".png", ".jpg", ".jpeg"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const studentId = (req.body.studentId || "").trim();
      const safeId = studentId.replace(/[^a-zA-Z0-9_-]/g, "");
      const dest = path.join(SUBMISSIONS_DIR, safeId || "unknown");
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      // keep original name but strip weird characters
      const original = file.originalname.replace(/[^\w.\-() ]+/g, "_");
      cb(null, original);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ext = extLower(file.originalname);
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`File type not allowed: ${ext}`));
    }
    cb(null, true);
  },
});

// ---- Routes ----

// nicer “open” route for preview (inline)
app.get("/open", async (req, res) => {
  const relFile = (req.query.file || "").toString();
  if (!relFile) return res.status(400).send("Missing file parameter");
  if (path.basename(relFile).startsWith(".")) return res.status(404).send("Not found");

  const absFile = resolveInsideShare(relFile);
  if (!absFile) return res.status(403).send("Forbidden");

  try {
    const st = await fs.promises.stat(absFile);
    if (!st.isFile()) return res.status(404).send("Not found");

    // Inline viewing for PDFs/images
    res.sendFile(absFile);
  } catch {
    res.status(404).send("Not found");
  }
});

app.get("/download", async (req, res) => {
  const relFile = (req.query.file || "").toString();
  if (!relFile) return res.status(400).send("Missing file parameter");
  if (path.basename(relFile).startsWith(".")) return res.status(404).send("Not found");

  const absFile = resolveInsideShare(relFile);
  if (!absFile) return res.status(403).send("Forbidden");

  try {
    const st = await fs.promises.stat(absFile);
    if (!st.isFile()) return res.status(404).send("Not found");
    res.download(absFile, path.basename(absFile));
  } catch {
    res.status(404).send("Not found");
  }
});

// Upload page
app.get("/upload", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Upload Submission</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .dropzone {
      border: 2px dashed #999;
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      color: #666;
      background: #fafafa;
    }
    .dropzone.dragover { background: #f0f7ff; border-color: #0d6efd; color: #0d6efd; }
  </style>
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">CENG114 — Submission Upload</h3>
      <a class="btn btn-outline-secondary" href="/">Back to files</a>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <form id="upForm" action="/upload" method="post" enctype="multipart/form-data">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label">Student ID (required)</label>
              <input class="form-control" name="studentId" required placeholder="e.g. 2020123456">
            </div>
            <div class="col-md-8">
              <label class="form-label">Notes (optional)</label>
              <input class="form-control" name="note" placeholder="e.g. Part A + Part B">
            </div>
            <div class="col-12">
              <div id="dz" class="dropzone">
                <div class="fw-semibold">Drag & drop files here</div>
                <div class="small">or click to choose</div>
                <input id="fileInput" class="form-control mt-3" type="file" name="files" multiple required>
                <div class="small mt-2 text-muted">
                  Allowed: .pdf .zip .java .txt .png .jpg — Max 50MB each
                </div>
              </div>
            </div>
            <div class="col-12 d-flex gap-2">
              <button class="btn btn-primary" type="submit">Upload</button>
              <a class="btn btn-outline-secondary" href="/">Browse files</a>
            </div>
          </div>
        </form>
        <div class="mt-3" id="result"></div>
      </div>
    </div>
  </div>

<script>
  const dz = document.getElementById('dz');
  const input = document.getElementById('fileInput');

  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    input.files = e.dataTransfer.files;
  });
</script>
</body>
</html>`);
});

// Upload handler
app.post("/upload", upload.array("files", 10), (req, res) => {
  const studentId = (req.body.studentId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "") || "unknown";
  const files = (req.files || []).map((f) => f.filename);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<title>Upload Complete</title></head>
<body class="bg-light">
<div class="container py-4">
  <div class="card shadow-sm">
    <div class="card-body">
      <h4 class="mb-3">Upload complete ✅</h4>
      <p class="mb-1">Student: <code>${escapeHtml(studentId)}</code></p>
      <p class="mb-3">Saved to: <code>/submissions/${escapeHtml(studentId)}/</code></p>

      <div class="mb-3">
        <div class="fw-semibold mb-2">Uploaded files</div>
        <ul class="mb-0">
          ${files.map(fn => `<li>${escapeHtml(fn)}</li>`).join("") || "<li>(none)</li>"}
        </ul>
      </div>

      <a class="btn btn-primary" href="/">Go to file list</a>
      <a class="btn btn-outline-secondary ms-2" href="/upload">Upload another</a>
    </div>
  </div>
</div>
</body></html>`);
});

// Browse UI (root or ?dir=)
app.get("/files", async (req, res) => {
  try {
    const relDir = (req.query.dir || "").toString().replace(/\/+$/, "");
    const absDir = resolveInsideShare(relDir);
    if (!absDir) return res.status(403).send("Forbidden");

    const st = await fs.promises.stat(absDir);
    if (!st.isDirectory()) return res.status(404).send("Not a directory");

    const entries = await fs.promises.readdir(absDir, { withFileTypes: true });

    const rows = await Promise.all(entries
      .filter(e => isVisible(e.name))
      .map(async (e) => {
        const rel = relDir ? `${relDir}/${e.name}` : e.name;
        const abs = resolveInsideShare(rel);
        let size = "";
        let mtime = "";
        try {
          const stat = await fs.promises.stat(abs);
          if (stat.isFile()) size = formatBytes(stat.size);
          mtime = new Date(stat.mtime).toLocaleString();
        } catch {}

        return { e, rel, size, mtime };
      }));

    rows.sort((a, b) => {
      if (a.e.isDirectory() && !b.e.isDirectory()) return -1;
      if (!a.e.isDirectory() && b.e.isDirectory()) return 1;
      return a.e.name.localeCompare(b.e.name);
    });

    // breadcrumbs
    const parts = relDir ? relDir.split("/").filter(Boolean) : [];
    let acc = "";
    const crumbs = [`<li class="breadcrumb-item"><a href="/files">Home</a></li>`].concat(
      parts.map((p, i) => {
        acc = acc ? `${acc}/${p}` : p;
        const isLast = i === parts.length - 1;
        return isLast
          ? `<li class="breadcrumb-item active">${escapeHtml(p)}</li>`
          : `<li class="breadcrumb-item"><a href="/files?dir=${encodeURIComponent(acc)}">${escapeHtml(p)}</a></li>`;
      })
    ).join("");

    const tableRows = rows.map(({ e, rel, size, mtime }) => {
      const name = e.name;
      const relEnc = encodeURIComponent(rel);
      if (e.isDirectory()) {
        return `<tr>
          <td>📁</td>
          <td><a href="/files?dir=${encodeURIComponent(rel)}">${escapeHtml(name)}/</a></td>
          <td class="text-muted">—</td>
          <td class="text-muted">${escapeHtml(mtime)}</td>
          <td class="text-muted">—</td>
        </tr>`;
      } else {
        const previewBtn = isPreviewable(name)
          ? `<a class="btn btn-sm btn-outline-primary" target="_blank" href="/open?file=${relEnc}">Preview</a>`
          : "";
        return `<tr>
          <td>📄</td>
          <td>${escapeHtml(name)}</td>
          <td class="text-muted">${escapeHtml(size)}</td>
          <td class="text-muted">${escapeHtml(mtime)}</td>
          <td class="d-flex gap-2">
            ${previewBtn}
            <a class="btn btn-sm btn-primary" href="/download?file=${relEnc}">Download</a>
          </td>
        </tr>`;
      }
    }).join("");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>LAN Share</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h3 class="mb-1">LAN Share</h3>
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb mb-0">${crumbs}</ol>
        </nav>
      </div>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" href="/upload">Student Upload</a>
        <a class="btn btn-outline-secondary" href="/files">Refresh</a>
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
  const tbl = document.getElementById('tbl').getElementsByTagName('tbody')[0];
  q.addEventListener('input', () => {
    const term = q.value.toLowerCase();
    [...tbl.rows].forEach(r => {
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

// Make / redirect to /files as homepage
app.get("/", (req, res) => res.redirect("/files"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LAN Share running on http://0.0.0.0:${PORT}`);
});
