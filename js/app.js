/* ============================================================
   TEN YEARS OF BABA — app
   Hash-routed single page: #/intro → #/year/2016 … #/years, #/about
   All copy/photos/bubbles come from content.json.
   ============================================================ */

(async function () {
  const app = document.getElementById("app");
  const DATA = await fetch("content.json").then((r) => r.json());
  const YEARS = DATA.years;

  const yearIndex = (y) => YEARS.findIndex((d) => d.year === Number(y));

  /* -------------------- audio (tiny generative pad, no assets) -------------------- */
  const Sound = {
    ctx: null,
    master: null,
    enabled: false,
    started: false,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);

      // warm two-osc pad through a lazy lowpass
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      lp.connect(this.master);

      [[110, 0.05], [164.81, 0.035], [220, 0.03]].forEach(([f, g], i) => {
        const o = this.ctx.createOscillator();
        o.type = i === 2 ? "sine" : "triangle";
        o.frequency.value = f;
        o.detune.value = i * 4 - 4;
        const og = this.ctx.createGain();
        og.gain.value = g;
        o.connect(og); og.connect(lp);
        o.start();
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.06 + i * 0.04;
        const lg = this.ctx.createGain();
        lg.gain.value = g * 0.5;
        lfo.connect(lg); lg.connect(og.gain);
        lfo.start();
      });

      // vinyl-style crackle
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) * 0.5 : 0;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const ng = this.ctx.createGain(); ng.gain.value = 0.10;
      noise.connect(ng); ng.connect(this.master);
      noise.start();
      this.started = true;
    },
    setEnabled(on) {
      this.enabled = on;
      if (on) this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(on ? 0.5 : 0, this.ctx.currentTime + 0.8);
    },
    blip(freq = 660) {
      if (!this.enabled || !this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.32);
    },
  };

  /* -------------------- confetti particles -------------------- */
  const Confetti = {
    canvas: null, ctx: null, parts: [], ambient: 0, acc: 0, last: 0,
    COLORS: ["#e8643c", "#f2b441", "#6fc7bd", "#2e9c8e", "#d9ecf2", "#c84e2b"],
    init() {
      if (this.canvas) return;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "confetti";
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      const fit = () => { this.canvas.width = innerWidth; this.canvas.height = innerHeight; };
      fit();
      window.addEventListener("resize", fit);
      const tick = (t) => {
        const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
        this.last = t;
        this.acc += this.ambient * dt;
        while (this.acc >= 1) { this.acc--; this.spawn(Math.random() * innerWidth, -14, 0, 30 + Math.random() * 50, true); }
        const c = this.ctx;
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.parts.length > 420) this.parts.splice(0, this.parts.length - 420);
        this.parts = this.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
        for (const p of this.parts) {
          p.vy += 150 * dt;
          p.vx *= 0.99; p.vy *= 0.992;
          p.x += p.vx * dt + Math.sin(p.phase + t / 550) * p.sway;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          p.life -= dt;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.globalAlpha = Math.max(0, Math.min(1, p.life / 0.8)) * 0.95;
          c.fillStyle = p.color;
          if (p.shape === 0) c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          else if (p.shape === 1) { c.beginPath(); c.arc(0, 0, p.size / 3, 0, 7); c.fill(); }
          else c.fillRect(-p.size / 6, -p.size * 0.9, p.size / 3, p.size * 1.8);
          c.restore();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    spawn(x, y, vx, vy, gentle) {
      this.parts.push({
        x, y,
        vx: vx + (Math.random() - 0.5) * (gentle ? 24 : 320),
        vy: vy + (gentle ? 0 : (Math.random() - 0.85) * 320),
        rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 9,
        sway: gentle ? 0.5 + Math.random() : 0.3,
        phase: Math.random() * 6.3,
        size: 6 + Math.random() * 8,
        life: gentle ? 16 : 2.1 + Math.random() * 1.7,
        shape: (Math.random() * 3) | 0,
        color: this.COLORS[(Math.random() * this.COLORS.length) | 0],
      });
    },
    burst(x, y, n = 26) {
      this.init();
      for (let i = 0; i < n; i++) this.spawn(x, y, 0, -70, false);
    },
    setAmbient(rate) { this.init(); this.ambient = rate; },
  };

  /* -------------------- autoplay / kiosk mode -------------------- */
  const Auto = {
    on: sessionStorage.getItem("baba10-auto") === "1",
    enabledAt: 0,
    SPEED: 150, // px/s of automatic strip scroll
    enable() {
      this.on = true;
      this.enabledAt = Date.now();
      sessionStorage.setItem("baba10-auto", "1");
      this.pill();
    },
    disable() {
      this.on = false;
      sessionStorage.removeItem("baba10-auto");
      document.querySelectorAll(".auto-pill").forEach((n) => n.remove());
      document.querySelectorAll(".auto-toggle").forEach((n) => (n.textContent = "▶ PLAY"));
    },
    pill() {
      if (document.querySelector(".auto-pill")) return;
      const p = document.createElement("div");
      p.className = "auto-pill";
      p.textContent = "▶ autoplay — touch to take control";
      document.body.appendChild(p);
    },
  };
  // any human interaction hands control back
  ["wheel", "touchstart", "keydown"].forEach((ev) =>
    window.addEventListener(ev, (e) => {
      if (!Auto.on) return;
      if (Date.now() - Auto.enabledAt < 1200) return;
      if (e.target && e.target.closest && e.target.closest(".auto-toggle, .year-row-auto")) return;
      Auto.disable();
    }, { passive: true })
  );

  /* -------------------- helpers -------------------- */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // photo with automatic "drop a photo here" placeholder fallback
  function makePhoto(p, alt, compact) {
    const wrap = el("div", "photo-wrap");
    const placeholder = el("div", "panel-placeholder" + (compact ? " compact" : ""));
    if (!compact) placeholder.appendChild(el("div", "ph-label", "drop a photo here"));
    placeholder.appendChild(el("div", "ph-path", esc(p.photo)));
    wrap.appendChild(placeholder);
    const img = new Image();
    img.className = "panel-photo";
    img.alt = p.alt || alt;
    img.src = p.photo;
    img.addEventListener("load", () => { placeholder.style.display = "none"; wrap.appendChild(img); });
    return wrap;
  }

  const badge10 = () => el("div", "badge10", `<span>${esc(DATA.nav.badge || "10 YEARS!")}</span>`);

  // one year's recap as a portrait comic-book page (used in the strip and the finale album)
  function buildRecapPage(yd) {
    const rp = el("div", "recap-page");
    rp.appendChild(el("div", "recap-head", `<span>${yd.year}</span><span>${esc(yd.title)}</span>`));
    yd.panels.forEach((p, ri) => {
      const row = el("div", "recap-row");
      row.style.setProperty("--r", ri);
      row.appendChild(makePhoto(p, `${yd.year} recap ${ri + 1}`, true));
      if (p.bubble) row.appendChild(el("div", "recap-cap", esc(p.bubble)));
      rp.appendChild(row);
    });
    return rp;
  }

  const iris = el("div", "iris");
  document.body.appendChild(iris);

  function transitionTo(hash) {
    Sound.blip(440);
    iris.classList.add("on");
    setTimeout(() => {
      location.hash = hash;
      requestAnimationFrame(() => setTimeout(() => iris.classList.remove("on"), 120));
    }, 560);
  }

  /* -------------------- intro / loader -------------------- */
  let introDone = sessionStorage.getItem("baba10-intro") === "1";

  function buildIntro(onDone) {
    const intro = el("div", "intro");
    intro.appendChild(el("div", "intro-hint", esc(DATA.intro.soundHint)));

    // loader (big counting year + ribbon)
    const load = el("div", "intro-load");
    const yearEl = el("div", "intro-year", String(DATA.brand.startYear));
    load.appendChild(yearEl);
    if (DATA.intro.ribbon) load.appendChild(el("div", "intro-ribbon", "&#10038; " + esc(DATA.intro.ribbon) + " &#10038;"));
    intro.appendChild(load);

    // the closed comic book
    const book = el("div", "book");
    const inner = el("div", "book-inner");
    const under = el("div", "book-under");
    under.append(
      el("div", "bu-kicker", esc(YEARS[0].label)),
      el("div", "bu-year", String(YEARS[0].year)),
      el("div", "bu-title", esc(YEARS[0].title)),
      el("div", "bu-hint", "here we go...")
    );
    const cover = el("div", "book-cover");
    const bc = el("div", "bc-frame");
    bc.append(
      el("div", "bc-top", esc(DATA.brand.logoTop)),
      el("div", "bc-bottom", esc(DATA.brand.logoBottom)),
      el("div", "bc-sub", esc(DATA.book.coverSub)),
      el("div", "bc-press", esc(DATA.book.pressHint))
    );
    cover.appendChild(bc);
    cover.appendChild(badge10());
    inner.append(under, cover);
    book.appendChild(inner);
    intro.appendChild(book);

    const enter = el("div", "intro-enter");
    const bSound = el("button", null, esc(DATA.intro.enterWithSound));
    const bMute = el("button", null, esc(DATA.intro.enterWithoutSound));
    enter.append(bSound, bMute);
    intro.appendChild(enter);

    const prog = el("div", "intro-progress", "0%");
    intro.appendChild(prog);
    document.body.appendChild(intro);

    const y0 = DATA.brand.startYear, y1 = DATA.brand.endYear;
    const t0 = performance.now(), DUR = 3400;
    let raf;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / DUR);
      const e = 1 - Math.pow(1 - k, 3);
      yearEl.textContent = String(Math.round(y0 + (y1 - y0) * e));
      prog.textContent = Math.round(k * 100) + "%";
      if (k < 1) raf = requestAnimationFrame(tick);
      else {
        prog.textContent = esc(DATA.intro.loaderNote);
        intro.classList.add("ready");
        // kiosk mode: open the book by itself (muted — browsers block un-clicked audio)
        if (Auto.on) setTimeout(() => finish(false), 1000);
      }
    })(t0);

    let finished = false;
    function finish(withSound) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      sessionStorage.setItem("baba10-intro", "1");
      Sound.setEnabled(withSound);

      // open the book: cover swings, confetti pops, then we dive into year 1
      book.classList.add("open");
      Sound.blip(392); setTimeout(() => Sound.blip(523), 260); setTimeout(() => Sound.blip(659), 500);
      const r = book.getBoundingClientRect();
      Confetti.burst(r.left + r.width / 2, r.top + r.height / 3, 120);

      setTimeout(() => {
        intro.classList.add("hidden");
        const m = location.hash.match(/^#\/year\/(\d{4})/);
        if (!(m && yearIndex(m[1]) !== -1)) location.hash = "#/year/" + YEARS[0].year;
        setTimeout(() => intro.remove(), 1200);
        onDone();
      }, 1700);
    }
    bSound.addEventListener("click", (e) => { e.stopPropagation(); finish(true); });
    bMute.addEventListener("click", (e) => { e.stopPropagation(); finish(false); });
    intro.addEventListener("click", () => { if (intro.classList.contains("ready")) finish(true); });
  }

  /* -------------------- chrome (header / footer) -------------------- */
  function buildChrome({ dark, yearData }) {
    const chrome = el("div", "chrome" + (dark ? " dark" : ""));

    const hdr = el("header", "hdr");
    const left = el("div", "hdr-left");
    if (yearData) {
      left.append(
        el("span", null, esc(yearData.label)),
        el("span", "hdr-yearnum", String(yearData.year)),
        el("span", "hdr-sep", "/"),
        el("span", "hdr-title-txt", esc(yearData.title))
      );
    } else {
      left.append(el("span", null, esc(DATA.brand.name)));
    }

    const center = el("div", "hdr-center");
    const yearsLink = el("a", "hdr-link", esc(DATA.nav.years));
    yearsLink.href = "#/years";
    const logo = el("a", "logo");
    logo.href = "#/years";
    const card = el("div", "logo-card");
    card.append(el("div", "logo-top", esc(DATA.brand.logoTop)), el("div", "logo-bottom", esc(DATA.brand.logoBottom)));
    logo.appendChild(card);
    const aboutLink = el("a", "hdr-link", esc(DATA.nav.about));
    aboutLink.href = "#/about";
    center.append(yearsLink, logo, aboutLink);

    const right = el("div", "hdr-right");
    const play = el("button", "sound-toggle auto-toggle", Auto.on ? "■ STOP" : "▶ PLAY");
    play.title = "autoplay: run the whole decade hands-free, on a loop";
    play.addEventListener("click", () => {
      if (Auto.on) { Auto.disable(); }
      else {
        Auto.enable();
        play.textContent = "■ STOP";
        if (!/^#\/year\//.test(location.hash)) transitionTo("#/year/" + YEARS[0].year);
      }
    });
    right.appendChild(play);
    const snd = el("button", "sound-toggle" + (Sound.enabled ? "" : " muted"), "SOUND");
    snd.addEventListener("click", () => {
      Sound.setEnabled(!Sound.enabled);
      snd.classList.toggle("muted", !Sound.enabled);
    });
    right.appendChild(snd);

    hdr.append(left, center, right);
    chrome.appendChild(hdr);

    const ftr = el("footer", "ftr");
    const fl = el("div", "ftr-left");
    if (yearData) {
      const i = yearIndex(yearData.year);
      if (i > 0) {
        const prev = el("a", null, esc(DATA.nav.previous));
        prev.href = "#/year/" + YEARS[i - 1].year;
        fl.appendChild(prev);
      }
    }
    const fc = el("div", "ftr-center", esc(DATA.brand.tagline));
    const fr = el("div", "ftr-right");
    if (yearData) {
      const i = yearIndex(yearData.year);
      if (i < YEARS.length - 1) {
        const nx = el("a", null, YEARS[i + 1].year + " " + esc(DATA.nav.next));
        nx.href = "#/year/" + YEARS[i + 1].year;
        fr.appendChild(nx);
      } else {
        fr.append(el("span", null, esc(DATA.brand.credit)));
      }
    } else {
      fr.append(el("span", null, esc(DATA.brand.credit)));
    }
    ftr.append(fl, fc, fr);
    chrome.appendChild(ftr);
    return chrome;
  }

  /* -------------------- year chapter page -------------------- */
  let cleanup = null;

  function renderYear(yd) {
    const page = el("div", "page page-year");

    const ghost = el("div", "ghost-year", String(yd.year));
    page.appendChild(ghost);

    const strip = el("div", "strip");

    // title card
    const tc = el("div", "title-card");
    tc.append(
      el("div", "tc-label", esc(yd.label)),
      el("div", "tc-year", String(yd.year)),
      el("div", "tc-title", esc(yd.title)),
      el("div", "tc-scroll", "scroll &nbsp;&#10141;"),
      badge10()
    );
    strip.appendChild(tc);

    // photo panels with bubbles
    yd.panels.forEach((p, idx) => {
      const panel = el("div", "panel");
      panel.dataset.reveal = "1";
      const frame = el("div", "panel-frame");
      frame.appendChild(makePhoto(p, `${yd.year} photo ${idx + 1}`));

      panel.appendChild(frame);
      panel.appendChild(el("div", "panel-dots"));

      if (p.bubble) {
        const pos = ["top-left", "top-right", "bottom-left", "bottom-right"].includes(p.bubblePos)
          ? p.bubblePos : "top-left";
        panel.appendChild(el("div", "bubble " + pos, esc(p.bubble)));
      }
      strip.appendChild(panel);
    });

    // recap page — all the year's photos stacked like a comic-book page
    const recap = el("div", "recap");
    recap.dataset.reveal = "1";
    recap.appendChild(el("div", "recap-kicker", `${esc(DATA.nav.recapKicker || "that was")} <b>${yd.year}</b>`));
    recap.appendChild(buildRecapPage(yd));
    strip.appendChild(recap);

    // the year's photos fly off the strip into the recap page, "building" it
    const absorb = () => {
      const rows = [...recap.querySelectorAll(".recap-row")];
      const yearPanels = [...strip.querySelectorAll(".panel")];
      yearPanels.forEach((panel, pi) => {
        const row = rows[pi];
        const frame = panel.querySelector(".panel-frame");
        if (!row || !frame || panel.classList.contains("absorbed")) return;
        const from = frame.getBoundingClientRect();
        const to = row.getBoundingClientRect();
        const clone = frame.cloneNode(true);
        clone.classList.add("fly-clone");
        clone.style.left = from.left + "px";
        clone.style.top = from.top + "px";
        clone.style.width = from.width + "px";
        clone.style.height = from.height + "px";
        clone.style.transitionDelay = `${pi * 0.13}s, ${0.62 + pi * 0.13}s`;
        document.body.appendChild(clone);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          clone.style.transform =
            `translate(${to.left - from.left}px, ${to.top - from.top}px) ` +
            `scale(${to.width / from.width}, ${to.height / from.height})`;
          clone.style.opacity = "0";
        }));
        setTimeout(() => clone.remove(), 1250 + pi * 130);
        panel.classList.add("absorbed");
      });
    };

    // end card → next year (or back to years on the last chapter)
    const i = yearIndex(yd.year);
    const nextY = YEARS[i + 1];
    const ec = el("div", "end-card");
    ec.dataset.reveal = "1";
    ec.appendChild(badge10());
    if (nextY) {
      ec.append(
        el("div", "ec-label", esc(DATA.nav.next)),
        el("div", "ec-year", String(nextY.year)),
        el("div", "ec-title", esc(nextY.title))
      );
      ec.addEventListener("click", () => transitionTo("#/year/" + nextY.year));
    } else {
      ec.append(
        el("div", "ec-label", esc(DATA.book.finaleLabel)),
        el("div", "ec-year ec-album", esc(DATA.book.albumLabel)),
        el("div", "ec-title", esc(DATA.brand.credit))
      );
      ec.addEventListener("click", () => transitionTo("#/book"));
    }
    strip.appendChild(ec);

    page.appendChild(strip);

    const progress = el("div", "progress");
    page.appendChild(progress);

    app.appendChild(page);
    app.appendChild(buildChrome({ dark: false, yearData: yd }));

    /* ---- virtual horizontal scroll engine ---- */
    let target = 0, current = 0, max = 0, running = true, endFired = false, endPush = 0;
    const measure = () => { max = Math.max(0, strip.scrollWidth - window.innerWidth); };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);

    const tryAdvance = () => {
      if (endFired) return;
      endFired = true;
      if (nextY) transitionTo("#/year/" + nextY.year);
      else transitionTo("#/book");
    };

    const onWheel = (e) => {
      e.preventDefault();
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      // keep pushing at the end of the strip → advance to the next year
      if (target >= max - 2 && d > 0) {
        endPush += d;
        if (endPush > 900) tryAdvance();
      } else if (d < 0) {
        endPush = 0;
      }
      target = Math.max(0, Math.min(max, target + d * 1.4));
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    let touchX = 0;
    const onTS = (e) => { touchX = e.touches[0].clientX; };
    const onTM = (e) => {
      const dx = touchX - e.touches[0].clientX;
      touchX = e.touches[0].clientX;
      target = Math.max(0, Math.min(max, target + dx * 2.2));
    };
    window.addEventListener("touchstart", onTS, { passive: true });
    window.addEventListener("touchmove", onTM, { passive: true });

    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") target = Math.min(max, target + window.innerWidth * 0.55);
      if (e.key === "ArrowLeft") target = Math.max(0, target - window.innerWidth * 0.55);
    };
    window.addEventListener("keydown", onKey);

    const panels = [...strip.querySelectorAll("[data-reveal]")];
    let revealed = 0, lastT = 0, autoEnd = false;

    (function loop(t) {
      if (!running) return;
      const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
      lastT = t || 0;
      // autoplay: glide through the year by itself
      if (Auto.on && max > 0) {
        target = Math.min(max, target + Auto.SPEED * dt);
        if (!autoEnd && current >= max - 2) {
          autoEnd = true;
          setTimeout(() => { if (running && Auto.on) tryAdvance(); }, 2400);
        }
      }
      current += (target - current) * 0.075;
      if (Math.abs(target - current) < 0.05) current = target;
      strip.style.transform = `translate3d(${-current}px, 0, 0)`;
      ghost.style.transform = `translate3d(${-current * 0.22}px, -50%, 0)`;
      progress.style.width = max ? (current / max) * 100 + "%" : "0%";

      const vw = window.innerWidth;
      panels.forEach((p) => {
        if (p.classList.contains("on")) return;
        const r = p.getBoundingClientRect();
        if (r.left < vw * 0.82) {
          p.classList.add("on");
          revealed++;
          if (p.classList.contains("recap")) absorb();
          const isEnd = p.classList.contains("end-card");
          Confetti.burst(
            Math.min(r.left + r.width / 2, vw - 60),
            Math.max(70, r.top + r.height * 0.25),
            isEnd ? 90 : 16
          );
          if (isEnd) {
            Sound.blip(523); setTimeout(() => Sound.blip(659), 130); setTimeout(() => Sound.blip(784), 260);
          } else {
            Sound.blip(520 + revealed * 60);
          }
        }
      });

      requestAnimationFrame(loop);
    })();

    cleanup = () => {
      running = false;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTS);
      window.removeEventListener("touchmove", onTM);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
    };
  }

  /* -------------------- years index -------------------- */
  function renderYears() {
    const page = el("div", "page page-years");
    const list = el("div", "years-list");
    YEARS.forEach((yd, idx) => {
      const row = el("a", "year-row");
      row.style.setProperty("--i", idx);
      row.href = "#/year/" + yd.year;
      row.append(el("span", "yr-num", String(yd.year)), el("span", "yr-title", esc(yd.title)));
      row.addEventListener("mouseenter", () => Sound.blip(500 + (yd.year % 10) * 40));
      list.appendChild(row);
    });
    // the finale album
    const album = el("a", "year-row year-row-album");
    album.style.setProperty("--i", YEARS.length);
    album.href = "#/book";
    album.append(el("span", "yr-num", esc(DATA.book.albumLabel)), el("span", "yr-title", esc(DATA.book.finaleLabel)));
    album.addEventListener("mouseenter", () => Sound.blip(880));
    list.appendChild(album);
    // autoplay for big screens: runs the whole decade on a loop, hands-free
    const auto = el("a", "year-row year-row-album year-row-auto");
    auto.style.setProperty("--i", YEARS.length + 1);
    auto.href = "#/year/" + YEARS[0].year;
    auto.append(el("span", "yr-num", "▶ AUTOPLAY"), el("span", "yr-title", "hands-free, loops forever"));
    auto.addEventListener("click", (e) => {
      e.preventDefault();
      Auto.enable();
      transitionTo("#/year/" + YEARS[0].year);
    });
    list.appendChild(auto);
    page.appendChild(list);
    app.appendChild(page);
    app.appendChild(buildChrome({ dark: true }));
  }

  /* -------------------- finale album (#/book) -------------------- */
  function renderBook() {
    const page = el("div", "page page-book");
    const bookEl = el("div", "finale-book");
    const spreadEl = el("div", "fb-spread");
    const pageL = el("div", "fb-page fb-left");
    const pageR = el("div", "fb-page fb-right");
    spreadEl.append(pageL, pageR);
    bookEl.appendChild(spreadEl);
    bookEl.appendChild(el("div", "fb-hint", esc(DATA.book.flipHint)));
    page.appendChild(bookEl);

    // sheets: cover, one recap per year, end note (padded to an even count)
    const sheets = [{ type: "cover" }];
    YEARS.forEach((yd) => sheets.push({ type: "year", yd }));
    sheets.push({ type: "end" });
    if (sheets.length % 2) sheets.push({ type: "blank" });

    const sheetEl = (s) => {
      if (!s || s.type === "blank") return el("div", "fb-blank");
      if (s.type === "cover" || s.type === "end") {
        const c = el("div", "fb-cover-page");
        if (s.type === "cover") {
          c.append(
            el("div", "fbc-top", esc(DATA.brand.logoTop)),
            el("div", "fbc-bottom", esc(DATA.brand.logoBottom)),
            el("div", "fbc-sub", esc(DATA.book.coverSub))
          );
          c.appendChild(badge10());
        } else {
          c.append(
            el("div", "fbc-top", esc(DATA.book.endTitle)),
            el("div", "fbc-sub", esc(DATA.book.endNote))
          );
        }
        return c;
      }
      return buildRecapPage(s.yd);
    };

    let s = 0, flipping = false;
    const maxS = Math.ceil(sheets.length / 2) - 1;
    const renderSpread = () => {
      pageL.innerHTML = ""; pageR.innerHTML = "";
      pageL.appendChild(sheetEl(sheets[2 * s]));
      pageR.appendChild(sheetEl(sheets[2 * s + 1]));
      pageL.classList.toggle("can-flip", s > 0);
      pageR.classList.toggle("can-flip", s < maxS);
    };
    renderSpread();

    const flip = (dir) => {
      if (flipping) return;
      const ns = s + dir;
      if (ns < 0 || ns > maxS) return;
      flipping = true;
      Sound.blip(dir > 0 ? 470 : 410);
      const flipper = el("div", "fb-flipper " + (dir > 0 ? "fwd" : "bwd"));
      const front = el("div", "fp-front");
      const back = el("div", "fp-back");
      if (dir > 0) {
        front.appendChild(sheetEl(sheets[2 * s + 1]));
        back.appendChild(sheetEl(sheets[2 * ns]));
        pageR.innerHTML = ""; pageR.appendChild(sheetEl(sheets[2 * ns + 1]));
      } else {
        front.appendChild(sheetEl(sheets[2 * s]));
        back.appendChild(sheetEl(sheets[2 * ns + 1]));
        pageL.innerHTML = ""; pageL.appendChild(sheetEl(sheets[2 * ns]));
      }
      flipper.append(front, back);
      spreadEl.appendChild(flipper);
      requestAnimationFrame(() => requestAnimationFrame(() => flipper.classList.add("go")));
      setTimeout(() => { s = ns; renderSpread(); flipper.remove(); flipping = false; }, 1050);
    };

    pageR.addEventListener("click", () => flip(1));
    pageL.addEventListener("click", () => flip(-1));
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") flip(1);
      if (e.key === "ArrowLeft") flip(-1);
    };
    window.addEventListener("keydown", onKey);

    // autoplay: flip through the whole album, then loop back to year 1
    let autoTimer = null;
    if (Auto.on) {
      autoTimer = setInterval(() => {
        if (!Auto.on) { clearInterval(autoTimer); autoTimer = null; return; }
        if (flipping) return;
        if (s < maxS) flip(1);
        else {
          clearInterval(autoTimer); autoTimer = null;
          setTimeout(() => { if (Auto.on) transitionTo("#/year/" + YEARS[0].year); }, 4200);
        }
      }, 4200);
    }

    cleanup = () => {
      window.removeEventListener("keydown", onKey);
      if (autoTimer) clearInterval(autoTimer);
    };

    app.appendChild(page);
    app.appendChild(buildChrome({ dark: true }));
  }

  /* -------------------- about -------------------- */
  function renderAbout() {
    const page = el("div", "page page-about");
    const box = el("div", "about-box");
    box.appendChild(el("h1", null, esc(DATA.about.title)));
    DATA.about.paragraphs.forEach((p) => box.appendChild(el("p", null, esc(p))));
    page.appendChild(box);
    app.appendChild(page);
    app.appendChild(buildChrome({ dark: true }));
  }

  /* -------------------- router -------------------- */
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    app.innerHTML = "";
    const h = location.hash || "#/years";

    // #/play → kiosk mode from year 1
    if (h.startsWith("#/play")) {
      Auto.enable();
      location.hash = "#/year/" + YEARS[0].year;
      return;
    }
    if (Auto.on) Auto.pill();

    const mYear = h.match(/^#\/year\/(\d{4})/);

    document.title = DATA.brand.siteTitle + " | " + DATA.brand.name;

    if (mYear && yearIndex(mYear[1]) !== -1) {
      const yd = YEARS[yearIndex(mYear[1])];
      document.title = `${yd.year} — ${yd.title} | ${DATA.brand.siteTitle}`;
      renderYear(yd);
      Confetti.setAmbient(4);
    } else if (h.startsWith("#/about")) {
      renderAbout();
      Confetti.setAmbient(10);
    } else if (h.startsWith("#/book")) {
      document.title = `${DATA.book.albumLabel} | ${DATA.brand.siteTitle}`;
      renderBook();
      Confetti.setAmbient(12);
    } else {
      renderYears();
      Confetti.setAmbient(10);
    }
  }

  window.addEventListener("hashchange", route);

  // ?play in the URL also starts kiosk mode (handy for big-screen bookmarks)
  if (new URLSearchParams(location.search).has("play")) Auto.enable();

  if (introDone) {
    route();
  } else {
    route();
    buildIntro(() => {});
  }
})();
