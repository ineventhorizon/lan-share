const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const SHARE_DIR = path.join(__dirname, "shared");

// Hide hidden files/folders (.DS_Store, .git, etc.)
function isVisible(name) {
  return !name.startsWith(".");
}

// Prevent path traversal
function resolveInsideShare(rel) {
  const safeRel = (rel || "").replace(/\\/g, "/"); // normalize slashes
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

// Browse (root or a subdirectory via ?dir=)
app.get("/", async (req, res) => {
  try {
    const relDir = (req.query.dir || "").toString();
    const absDir = resolveInsideShare(relDir);

    if (!absDir) return res.status(403).send("Forbidden");

    const st = await fs.promises.stat(absDir);
    if (!st.isDirectory()) return res.status(404).send("Not a directory");

    const entries = await fs.promises.readdir(absDir, { withFileTypes: true });

    const items = entries
      .filter((e) => isVisible(e.name))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    // Parent directory link
    let parentLink = "";
    if (relDir) {
      const normalized = relDir.replace(/\/+$/, ""); // trim trailing /
      const parent = normalized.includes("/")
        ? normalized.slice(0, normalized.lastIndexOf("/"))
        : "";
      parentLink = `<li>📁 <a href="/?dir=${encodeURIComponent(parent)}">.. (parent)</a></li>`;
    }

    const listHtml = items
      .map((entry) => {
        const name = entry.name;
        const childRel = relDir ? `${relDir.replace(/\/+$/, "")}/${name}` : name;

        if (entry.isDirectory()) {
          return `<li>📁 <a href="/?dir=${encodeURIComponent(childRel)}">${escapeHtml(
            name
          )}/</a></li>`;
        } else {
          return `<li>📄 <a href="/download?file=${encodeURIComponent(
            childRel
          )}">${escapeHtml(name)}</a></li>`;
        }
      })
      .join("");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>LAN Share</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 2rem; }
    ul { line-height: 1.9; padding-left: 1.2rem; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #f4f4f4; padding: 3px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>LAN Share</h1>
  <p>Current folder: <code>/${escapeHtml(relDir)}</code></p>
  <ul>
    ${parentLink}
    ${listHtml || `<li><em>No visible files here.</em></li>`}
  </ul>
</body>
</html>`);
  } catch (err) {
    res.status(404).send("Folder not found");
  }
});

// Download file via ?file=
app.get("/download", async (req, res) => {
  try {
    const relFile = (req.query.file || "").toString();
    if (!relFile) return res.status(400).send("Missing file parameter");

    // Block hidden files even if guessed
    if (path.basename(relFile).startsWith(".")) return res.status(404).send("File not found");

    const absFile = resolveInsideShare(relFile);
    if (!absFile) return res.status(403).send("Forbidden");

    const st = await fs.promises.stat(absFile);
    if (!st.isFile()) return res.status(404).send("File not found");

    res.download(absFile, path.basename(absFile));
  } catch {
    res.status(404).send("File not found");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LAN Share running on http://0.0.0.0:${PORT}`);
});
