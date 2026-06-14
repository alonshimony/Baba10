# Ten Years of Baba — Baba Entertainment 10th Anniversary Site

An interactive, comic-strip style anniversary scrapbook (2016 → 2026), inspired by
year-by-year "interactive graphic novel" sites. Pure static HTML/CSS/JS — no build
step, no dependencies. Host it anywhere (Vercel, Netlify, S3, GitHub Pages).

## How it works

- **Intro loader** — big year counter (2016 → 2026) with a progress %, then
  "ENTER WITH SOUND / ENTER WITHOUT SOUND". Shown once per browser session.
- **Year chapters** (`#/year/2018`) — vertical scrolling (wheel / touch / arrow
  keys) moves a horizontal comic strip. Each photo panel reveals with a
  halftone-dot dissolve and pops in its speech bubble. At the end of the strip
  the site auto-advances to the next year.
- **Years index** (`#/years`) — the full list of years; click one to jump in.
- **About** (`#/about`).
- Film grain, vignette, ghost parallax year, and a generative ambient
  soundtrack (WebAudio — no audio files needed).

## Easiest way to edit: the Setup page

Open **`setup.html`** through the local server (e.g. `http://localhost:4173/setup.html`):

- **Drag & drop photos** onto a year (multiple at once) or onto a single slot to replace it.
- Photos are **auto-cropped to 4:3 and auto-resized** (max 1600px wide, JPEG) in the browser.
- Write the **speech-bubble text** under each photo, pick the bubble corner, reorder or remove.
- **Background music**: drop an `.mp3` in the Background music box — it's saved to `audio/` and looped
  behind the experience (plays once a visitor enables sound; browsers block un-clicked audio).
- **Autoplay speed**: set the default play speed (0.5×–3×). During playback you can also tap the
  speed chip in the header to change it live; it's remembered for the session.
- **Running locally?** Click **"Save to local folder"** and pick the `baba-ten` folder — the
  processed photos are written into `photos/` and `content.json` is generated (Chrome/Edge).
- **Hosted on Vercel?** Open the **"Cloud setup"** box once, enter your GitHub `owner/repo`,
  branch, the folder the site lives in (e.g. `baba-ten`, or empty if it's the repo root) and a
  [fine-grained access token](https://github.com/settings/personal-access-tokens/new) with
  **Contents: Read and write** on that repo only. From then on, **"Save & update live site"**
  commits the photos + `content.json` to GitHub in a single commit — Vercel detects the push and
  redeploys automatically, so the live site updates in about a minute. The token stays in your
  browser (localStorage if "remember" is ticked); it is never part of the site itself.
- On browsers without folder access, use the **Download** buttons and add the files manually.

### Hosting on Vercel

Import the GitHub repo in Vercel, set the project's **Root Directory** to this folder
(`baba-ten`), framework preset "Other" — no build step needed. Every push to the production
branch (including pushes made by the setup page) triggers an automatic deployment.

## Editing by hand — everything is `content.json`

Open `content.json`. No code knowledge needed:

```jsonc
{
  "brand":  { "name": "...", "tagline": "...", "startYear": 2016, "endYear": 2026 },
  "intro":  { "soundHint": "...", "enterWithSound": "..." },
  "about":  { "title": "ABOUT", "paragraphs": ["...", "..."] },
  "years": [
    {
      "year": 2018,
      "label": "YEAR 3",            // small label above the big year
      "title": "Going Wild",        // chapter title
      "panels": [
        {
          "photo": "photos/2018-01.jpg",   // drop the file in /photos
          "bubble": "Speech bubble text",  // one bubble per photo
          "bubblePos": "top-left"          // top-left | top-right | bottom-left | bottom-right
        }
      ]
    }
  ]
}
```

- **Add / remove years**: add or delete an entry in `years` — navigation,
  prev/next links and the index update automatically.
- **Add / remove photos**: add or delete entries in a year's `panels` array.
- **Photos**: drop files into `photos/` with the names referenced in the JSON.
  Until a file exists, the site shows a labeled placeholder with the expected
  path. Photos are auto-cropped to 4:3 and shown in B&W comic style.

## Run locally

Serve the folder with any static server (fetch() needs http, not file://):

```
npx serve baba-ten
# or
python -m http.server -d baba-ten 8000
```
