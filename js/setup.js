/* ============================================================
   TEN YEARS OF BABA — setup / content editor
   Drag photos per year, write a bubble per photo, auto-crop to
   4:3, auto-resize, then save photos/ + content.json.
   ============================================================ */

(async function () {
  const $years = document.getElementById("years");
  const $status = document.getElementById("status");
  const $filePick = document.getElementById("filePick");

  const RATIO = 4 / 3;          // comic panel ratio
  const MAX_W = 1600;           // px — bigger images get shrunk
  const JPEG_Q = 0.85;
  const POS = ["top-left", "top-right", "bottom-left", "bottom-right"];

  let DATA;
  try {
    DATA = await fetch("content.json").then((r) => r.json());
  } catch (e) {
    status("Could not load content.json — open this page through the local server (e.g. http://localhost:4173/setup.html), not as a file.", true);
    return;
  }

  // runtime image state per panel object (kept out of the JSON)
  const blobs = new WeakMap(); // panel -> { blob, url }

  function status(msg, err) {
    $status.textContent = msg;
    $status.classList.toggle("err", !!err);
    if (!err && msg) setTimeout(() => { if ($status.textContent === msg) $status.textContent = ""; }, 6000);
  }

  /* ---------------- image processing: center-crop 4:3 + resize ---------------- */
  async function processImage(file) {
    if (!file.type.startsWith("image/")) throw new Error(file.name + " is not an image");
    const bmp = await createImageBitmap(file);
    let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
    if (sw / sh > RATIO) { // too wide → crop the sides
      const w = Math.round(sh * RATIO);
      sx = Math.round((sw - w) / 2);
      sw = w;
    } else if (sw / sh < RATIO) { // too tall → crop top/bottom
      const h = Math.round(sw / RATIO);
      sy = Math.round((sh - h) / 2);
      sh = h;
    }
    const outW = Math.min(MAX_W, sw);
    const outH = Math.round(outW / RATIO);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, outW, outH);
    bmp.close();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", JPEG_Q));
    if (!blob) throw new Error("could not encode " + file.name);
    return blob;
  }

  function attachImage(panel, blob) {
    const old = blobs.get(panel);
    if (old) URL.revokeObjectURL(old.url);
    blobs.set(panel, { blob, url: URL.createObjectURL(blob) });
  }

  /* ---------------- rendering ---------------- */
  function render() {
    $years.innerHTML = "";
    DATA.years.forEach((yd) => $years.appendChild(yearSection(yd)));
  }

  function yearSection(yd) {
    const sec = el("div", "year-sec");

    const head = el("div", "year-head");
    head.appendChild(el("div", "ynum", String(yd.year)));
    head.appendChild(input("f-label", yd.label, "label (e.g. YEAR 3)", (v) => (yd.label = v)));
    head.appendChild(input("f-title", yd.title, "chapter title", (v) => (yd.title = v)));
    sec.appendChild(head);

    const grid = el("div", "panels");
    yd.panels.forEach((p, i) => grid.appendChild(panelCard(yd, p, i)));

    // add/drop zone for new photos
    const add = el("div", "add-zone");
    add.innerHTML = "<div><b>+ drop photos here</b></div><div>or click to browse (multiple ok)</div>";
    bindDrop(add, async (files) => addFiles(yd, files));
    add.addEventListener("click", () => pickFiles((files) => addFiles(yd, files)));
    grid.appendChild(add);

    sec.appendChild(grid);
    return sec;
  }

  function panelCard(yd, p, i) {
    const card = el("div", "pcard");

    const drop = el("div", "drop");
    const hint = el("div", "hint");
    hint.textContent = "drop a photo or click to choose";
    const st = blobs.get(p);
    if (st) {
      drop.classList.add("has-img");
      drop.appendChild(imgEl(st.url));
    } else if (p.photo) {
      // existing photo from the site folder (may 404 if not added yet)
      const im = imgEl(p.photo);
      im.addEventListener("load", () => drop.classList.add("has-img"));
      im.addEventListener("error", () => im.remove());
      drop.appendChild(im);
    }
    drop.appendChild(hint);
    bindDrop(drop, async (files) => {
      if (!files.length) return;
      try {
        attachImage(p, await processImage(files[0]));
        render();
        status("photo cropped & resized ✓");
      } catch (e) { status(e.message, true); }
    });
    drop.addEventListener("click", () => pickFiles(async (files) => {
      if (!files.length) return;
      try {
        attachImage(p, await processImage(files[0]));
        render();
        status("photo cropped & resized ✓");
      } catch (e) { status(e.message, true); }
    }));
    card.appendChild(drop);

    const ta = document.createElement("textarea");
    ta.placeholder = "speech bubble text for this photo...";
    ta.value = p.bubble || "";
    ta.addEventListener("input", () => (p.bubble = ta.value));
    card.appendChild(ta);

    const row = el("div", "prow");
    const sel = document.createElement("select");
    POS.forEach((pos) => {
      const o = document.createElement("option");
      o.value = pos; o.textContent = "bubble: " + pos;
      if ((p.bubblePos || "top-left") === pos) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => (p.bubblePos = sel.value));
    row.appendChild(sel);

    row.appendChild(btn("↑", "move left/up", () => { if (i > 0) { swap(yd.panels, i, i - 1); render(); } }));
    row.appendChild(btn("↓", "move right/down", () => { if (i < yd.panels.length - 1) { swap(yd.panels, i, i + 1); render(); } }));
    const del = btn("×", "remove this photo", () => {
      if (!confirm("Remove this photo from " + yd.year + "?")) return;
      yd.panels.splice(i, 1);
      render();
    });
    del.classList.add("del");
    row.appendChild(del);
    card.appendChild(row);

    card.appendChild(el("div", "ppath", filenameFor(yd, p, i)));
    return card;
  }

  async function addFiles(yd, files) {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    status("processing " + imgs.length + " photo(s)…");
    for (const f of imgs) {
      try {
        const blob = await processImage(f);
        const p = { photo: "", bubble: "", bubblePos: POS[yd.panels.length % POS.length] };
        attachImage(p, blob);
        yd.panels.push(p);
      } catch (e) { status(e.message, true); }
    }
    render();
    status(imgs.length + " photo(s) added, cropped & resized ✓");
  }

  // photos/<year>-<nn>.jpg for new images; existing images keep their path
  function filenameFor(yd, p, i) {
    if (blobs.get(p)) return "photos/" + yd.year + "-" + String(i + 1).padStart(2, "0") + ".jpg";
    return p.photo || "(no photo yet)";
  }

  /* ---------------- export ---------------- */
  function cleanData() {
    const out = JSON.parse(JSON.stringify({ ...DATA, years: [] }));
    out.years = DATA.years.map((yd) => ({
      year: yd.year,
      label: yd.label,
      title: yd.title,
      panels: yd.panels.map((p, i) => {
        const o = { photo: filenameFor(yd, p, i), bubble: p.bubble || "", bubblePos: p.bubblePos || "top-left" };
        if (p.alt) o.alt = p.alt;
        if (!blobs.get(p) && !p.photo) o.photo = "photos/" + yd.year + "-" + String(i + 1).padStart(2, "0") + ".jpg";
        return o;
      }),
    }));
    return out;
  }

  function newImages() {
    const list = [];
    DATA.years.forEach((yd) => yd.panels.forEach((p, i) => {
      const st = blobs.get(p);
      if (st) list.push({ name: yd.year + "-" + String(i + 1).padStart(2, "0") + ".jpg", blob: st.blob });
    }));
    return list;
  }

  // primary: write straight into the picked baba-ten folder
  document.getElementById("saveDir").addEventListener("click", async () => {
    if (!window.showDirectoryPicker) {
      status("This browser can't write folders — use the two download buttons instead.", true);
      return;
    }
    try {
      const dir = await showDirectoryPicker({ mode: "readwrite" });
      try { await dir.getFileHandle("index.html"); }
      catch { if (!confirm("This folder doesn't look like the site folder (no index.html). Save here anyway?")) return; }

      const imgs = newImages();
      if (imgs.length) {
        const photosDir = await dir.getDirectoryHandle("photos", { create: true });
        for (const im of imgs) {
          const fh = await photosDir.getFileHandle(im.name, { create: true });
          const w = await fh.createWritable();
          await w.write(im.blob);
          await w.close();
        }
      }
      const jh = await dir.getFileHandle("content.json", { create: true });
      const jw = await jh.createWritable();
      await jw.write(JSON.stringify(cleanData(), null, 2) + "\n");
      await jw.close();
      status("saved content.json + " + imgs.length + " photo(s) ✓  — reload the site to see it");
    } catch (e) {
      if (e.name !== "AbortError") status("save failed: " + e.message, true);
    }
  });

  /* ---------------- cloud save: commit to GitHub → Vercel auto-deploys ---------------- */
  const GH_FIELDS = ["ghRepo", "ghBranch", "ghPath", "ghToken"];
  const $remember = document.getElementById("ghRemember");
  try {
    const saved = JSON.parse(localStorage.getItem("baba10-gh") || "null");
    if (saved) {
      GH_FIELDS.forEach((id) => { if (saved[id]) document.getElementById(id).value = saved[id]; });
      $remember.checked = true;
    }
  } catch {}
  // accept whatever the user pastes — full URL, .git suffix, slashes — reduce to "owner/repo"
  function normalizeRepo(v) {
    let r = (v || "").trim();
    r = r.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, ""); // strip URL prefix (protocol optional)
    r = r.replace(/^git@github\.com:/i, "");                  // strip ssh prefix
    r = r.replace(/\.git$/i, "");                             // strip .git
    r = r.replace(/^\/+|\/+$/g, "");                          // strip stray slashes
    const parts = r.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[0] + "/" + parts[1] : r; // keep only owner/repo
  }
  function ghSettings() {
    const s = {};
    GH_FIELDS.forEach((id) => (s[id] = document.getElementById(id).value.trim()));
    s.ghRepo = normalizeRepo(s.ghRepo);
    // reflect the cleaned value back into the field so the user sees what will be used
    const repoEl = document.getElementById("ghRepo");
    if (repoEl.value.trim() !== s.ghRepo) repoEl.value = s.ghRepo;
    if ($remember.checked) localStorage.setItem("baba10-gh", JSON.stringify(s));
    else localStorage.removeItem("baba10-gh");
    return s;
  }

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",", 2)[1]);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  async function gh(token, path, body) {
    const r = await fetch("https://api.github.com" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}));
      throw new Error("GitHub " + r.status + ": " + (detail.message || path));
    }
    return r.json();
  }

  document.getElementById("saveGh").addEventListener("click", async () => {
    const { ghRepo, ghBranch, ghPath, ghToken } = ghSettings();
    if (!ghRepo || !ghRepo.includes("/") || !ghToken) {
      document.getElementById("cloudBox").open = true;
      status("fill in the repository (owner/repo) and access token in the cloud setup box first", true);
      return;
    }
    const branch = ghBranch || "main";
    const base = ghPath ? ghPath.replace(/^\/+|\/+$/g, "") + "/" : "";
    const imgs = newImages();
    const btn = document.getElementById("saveGh");
    btn.disabled = true;
    try {
      status("uploading to GitHub…");
      // 1. current branch head + its tree
      const ref = await gh(ghToken, `/repos/${ghRepo}/git/ref/heads/${branch}`);
      const headSha = ref.object.sha;
      const headCommit = await gh(ghToken, `/repos/${ghRepo}/git/commits/${headSha}`);

      // 2. blobs: every new photo + the regenerated content.json
      const tree = [];
      for (let k = 0; k < imgs.length; k++) {
        status(`uploading photo ${k + 1}/${imgs.length}…`);
        const blob = await gh(ghToken, `/repos/${ghRepo}/git/blobs`, {
          content: await blobToBase64(imgs[k].blob),
          encoding: "base64",
        });
        tree.push({ path: base + "photos/" + imgs[k].name, mode: "100644", type: "blob", sha: blob.sha });
      }
      const jsonBlob = await gh(ghToken, `/repos/${ghRepo}/git/blobs`, {
        content: JSON.stringify(cleanData(), null, 2) + "\n",
        encoding: "utf-8",
      });
      tree.push({ path: base + "content.json", mode: "100644", type: "blob", sha: jsonBlob.sha });

      // 3. one commit on top of the branch, then move the branch to it
      status("creating commit…");
      const newTree = await gh(ghToken, `/repos/${ghRepo}/git/trees`, { base_tree: headCommit.tree.sha, tree });
      const commit = await gh(ghToken, `/repos/${ghRepo}/git/commits`, {
        message: `Update anniversary content (${imgs.length} photo(s) + content.json) via setup page`,
        tree: newTree.sha,
        parents: [headSha],
      });
      await fetch(`https://api.github.com/repos/${ghRepo}/git/refs/heads/${branch}`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + ghToken, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commit.sha }),
      }).then(async (r) => { if (!r.ok) throw new Error("GitHub " + r.status + ": could not update branch " + branch); });

      status(`pushed to ${ghRepo}@${branch} ✓ — Vercel is redeploying, the live site updates in ~1 minute`);
    } catch (e) {
      status(e.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // fallbacks
  document.getElementById("dlJson").addEventListener("click", () => {
    download("content.json", new Blob([JSON.stringify(cleanData(), null, 2)], { type: "application/json" }));
    status("downloaded content.json — put it in the baba-ten folder");
  });
  document.getElementById("dlImgs").addEventListener("click", () => {
    const imgs = newImages();
    if (!imgs.length) { status("no new photos to download", true); return; }
    imgs.forEach((im, k) => setTimeout(() => download(im.name, im.blob), k * 350));
    status("downloading " + imgs.length + " photo(s) — put them in baba-ten/photos/");
  });

  /* ---------------- small utils ---------------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function imgEl(src) { const im = new Image(); im.src = src; return im; }
  function swap(arr, a, b) { [arr[a], arr[b]] = [arr[b], arr[a]]; }
  function input(cls, val, ph, oninput) {
    const inp = document.createElement("input");
    inp.className = cls; inp.value = val || ""; inp.placeholder = ph;
    inp.addEventListener("input", () => oninput(inp.value));
    return inp;
  }
  function btn(txt, title, onclick) {
    const b = el("button", "pbtn");
    b.textContent = txt; b.title = title; b.type = "button";
    b.addEventListener("click", (e) => { e.stopPropagation(); onclick(); });
    return b;
  }
  function bindDrop(zone, onFiles) {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("over");
      onFiles([...e.dataTransfer.files]);
    });
  }
  let pickCb = null;
  function pickFiles(cb) { pickCb = cb; $filePick.value = ""; $filePick.click(); }
  $filePick.addEventListener("change", () => { if (pickCb) pickCb([...$filePick.files]); });
  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  render();
})();
