# Desktop Build Automation

Automated pipeline that builds the **Qeyam Desktop** app for **Windows** and **macOS** on every frontend push, and exposes permanent download links you can embed anywhere on your website.

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Your Download Links](#2-your-download-links)
3. [Files Created by This Setup](#3-files-created-by-this-setup)
4. [Step-by-Step Setup](#4-step-by-step-setup)
   - [Step 1 — Add the `icon.icns` file for macOS](#step-1--add-the-iconicns-file-for-macos)
   - [Step 2 — Push this desktop repo to GitHub](#step-2--push-this-desktop-repo-to-github)
   - [Step 3 — Set up GitHub secrets](#step-3--set-up-github-secrets)
   - [Step 4 — Deploy the download service on Coolify](#step-4--deploy-the-download-service-on-coolify)
   - [Step 5 — Push the updated frontend workflow](#step-5--push-the-updated-frontend-workflow)
   - [Step 6 — Test end to end](#step-6--test-end-to-end)
5. [Build Matrix](#5-build-matrix)
6. [Architecture Diagram](#6-architecture-diagram)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. How It Works

1. Developer pushes code to `frontend/main`.
2. The existing `frontend` GitHub Actions workflow deploys to Coolify **and** fires a `repository_dispatch` event to this (`desktop`) repo.
3. This repo's `build-desktop.yml` workflow runs **two parallel jobs** — one on a Windows runner and one on a macOS runner.
4. Both jobs:
   - Check out the frontend repo and run `npm run build`
   - Copy the compiled output into `desktop/src/`
   - Fix asset paths for Electron local-file loading
   - Run `electron-builder` to produce the installer
   - Rename the output to a **fixed filename** (always the same name regardless of version)
5. A third job collects both outputs and creates a **GitHub Release** tagged with the date.
6. Because the filenames are fixed, GitHub's `/releases/latest/download/` URL always resolves to the newest file — no link updates needed.

---

## 2. Your Download Links

Once everything is set up, embed these two links on your website:

### Option A — Direct GitHub links (no Coolify service needed)

```
Windows installer:  https://github.com/YOUR_ORG/desktop/releases/latest/download/Qeyam-Setup.exe
macOS disk image:   https://github.com/YOUR_ORG/desktop/releases/latest/download/Qeyam.dmg
```

Replace `YOUR_ORG` with your GitHub organisation/username.

### Option B — Branded links via Coolify (recommended)

Deploy the `download-service/` folder to Coolify and assign a domain (e.g. `download.qeyam.com`):

```
Windows installer:  https://download.qeyam.com/windows
macOS disk image:   https://download.qeyam.com/mac
Windows portable:   https://download.qeyam.com/windows/zip
macOS portable:     https://download.qeyam.com/mac/zip
```

These URLs are **permanent** — they will keep working after every new release because the underlying filenames never change.

### Example HTML snippet for your website

```html
<a href="https://download.qeyam.com/windows">
  Download for Windows
</a>

<a href="https://download.qeyam.com/mac">
  Download for macOS
</a>
```

---

## 3. Files Created by This Setup

```
desktop/
├── .github/
│   └── workflows/
│       └── build-desktop.yml        ← automated build pipeline
├── download-service/
│   ├── Dockerfile                   ← deploy this on Coolify
│   └── nginx.conf                   ← redirect rules (edit YOUR_ORG/YOUR_REPO)
├── package.json                     ← updated with build:win and build:mac scripts
└── AUTOMATION.md                    ← this document

frontend/
└── .github/
    └── workflows/
        └── deploy.yml               ← updated to trigger desktop build on push
```

---

## 4. Step-by-Step Setup

### Step 1 — Add the `icon.icns` file for macOS

The macOS build requires an `.icns` icon file. You already have `icon.ico` for Windows.

**To convert your existing icon:**

1. Visit [cloudconvert.com/ico-to-icns](https://cloudconvert.com/ico-to-icns) (or any converter)
2. Upload `icon.ico`, download `icon.icns`
3. Place `icon.icns` in the root of this repo alongside `icon.ico`

If you skip this step the macOS build will still work but use a default blank icon.

---

### Step 2 — Push this desktop repo to GitHub

If the desktop repo is not yet on GitHub:

```bash
cd /path/to/desktop
git init
git remote add origin https://github.com/YOUR_ORG/desktop.git
git add .
git commit -m "add build automation"
git push -u origin main
```

---

### Step 3 — Set up GitHub secrets

#### In the `desktop` repo

Go to **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|-------------|-------|
| `GH_PAT` | A GitHub Personal Access Token with `repo` read scope (needed to check out the private `frontend` repo during the build) |

#### In the `frontend` repo

| Secret name | Value |
|-------------|-------|
| `DESKTOP_REPO_PAT` | A GitHub Personal Access Token with `repo` scope (needed to trigger `repository_dispatch` on the desktop repo) |

**How to create a Personal Access Token:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scope: `repo`
4. Copy the token and paste it as the secret value

> Both secrets can use the same token if it is owned by an account that has access to both repos.

---

### Step 4 — Deploy the download service on Coolify

1. In Coolify, create a **new service → Docker**.
2. Connect it to this (`desktop`) repo.
3. Set **Dockerfile path** to `download-service/Dockerfile`.
4. Set **Publish directory** to `download-service/`.
5. Assign a domain, e.g. `download.qeyam.com`.

**Before deploying, edit `download-service/nginx.conf`** and replace the placeholder:

```nginx
set $github_base "https://github.com/YOUR_ORG/YOUR_REPO/releases/latest/download";
```

Change `YOUR_ORG` and `YOUR_REPO` to match your actual GitHub repository. Example:

```nginx
set $github_base "https://github.com/qeyam/desktop/releases/latest/download";
```

6. Click **Deploy**. The service is now live.

Verify it works:
```bash
curl -I https://download.qeyam.com/windows
# Expect: HTTP/1.1 302 Found
# Location: https://github.com/.../releases/latest/download/Qeyam-Setup.exe
```

---

### Step 5 — Push the updated frontend workflow

The `frontend/.github/workflows/deploy.yml` has already been updated to add the desktop build trigger. Commit and push it to the frontend repo:

```bash
cd /path/to/frontend
git add .github/workflows/deploy.yml
git commit -m "trigger desktop build on push to main"
git push
```

---

### Step 6 — Test end to end

You can trigger the desktop build manually without waiting for a frontend push:

1. Go to the `desktop` repo on GitHub.
2. Click **Actions → Build Desktop App → Run workflow**.
3. Watch both Windows and macOS jobs run in parallel (~10-15 minutes).
4. When done, check the **Releases** tab — you should see a new release with 4 files attached.
5. Visit `https://download.qeyam.com/windows` — it should redirect and start the download.

---

## 5. Build Matrix

| Platform | Runner | Output file | Download URL suffix |
|----------|--------|-------------|---------------------|
| Windows installer | `windows-latest` | `Qeyam-Setup.exe` | `/windows` |
| Windows portable | `windows-latest` | `Qeyam-win.zip` | `/windows/zip` |
| macOS disk image (Intel + Apple Silicon) | `macos-latest` | `Qeyam.dmg` | `/mac` |
| macOS portable | `macos-latest` | `Qeyam-mac.zip` | `/mac/zip` |

---

## 6. Architecture Diagram

```
git push → frontend/main
        │
        ▼
frontend GitHub Actions  (deploy.yml)
  ├─ Step 1: Trigger Coolify web deploy   (existing)
  └─ Step 2: repository_dispatch ─────────────────────────┐
                                                           │
                                    desktop GitHub Actions (build-desktop.yml)
                                           │
                             ┌─────────────┴─────────────┐
                             │                           │
                     windows-latest               macos-latest
                     ─────────────                ────────────
                     1. checkout frontend         1. checkout frontend
                     2. npm run build             2. npm run build
                     3. copy → desktop/src        3. copy → desktop/src
                     4. fix index.html paths      4. fix index.html paths
                     5. electron-builder --win    5. electron-builder --mac
                     6. rename → Qeyam-Setup.exe  6. rename → Qeyam.dmg
                             │                           │
                             └─────────────┬─────────────┘
                                           │
                                   GitHub Release
                              (fixed filenames attached)
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                     │
              /releases/latest/download/            download-service
              Qeyam-Setup.exe                        (nginx on Coolify)
              Qeyam.dmg                                   │
                                              download.qeyam.com/windows
                                              download.qeyam.com/mac
                                                           │
                                              Embed links on your website ✓
```

---

## 7. Troubleshooting

### `sed` fails on macOS runner

macOS `sed` requires an explicit empty string after `-i`. The workflow already handles this with separate steps per OS (`if: runner.os == 'macOS'`). If it still fails, check that both steps are present.

### macOS shows "App is damaged" or "can't be opened"

Unsigned macOS apps trigger Gatekeeper. For internal/team use, users run once:
```bash
xattr -cr /Applications/Qeyam.app
```
For public distribution, add Apple notarization secrets when ready:
- `APPLE_ID`
- `APPLE_APP_PASSWORD` (app-specific password from appleid.apple.com)
- `APPLE_TEAM_ID`

### Windows shows SmartScreen warning

Unsigned `.exe` files show a blue SmartScreen dialog. Users click **More info → Run anyway**. This goes away after enough users run the installer (Microsoft reputation system) or when you add a code signing certificate.

### `repository_dispatch` does not trigger the build

- Check that `DESKTOP_REPO_PAT` in the frontend repo has `repo` scope.
- Verify the `repo: 'desktop'` name in `deploy.yml` exactly matches the GitHub repo name.
- In the desktop repo, go to **Actions** and check if a failed event appears under **Build Desktop App**.

### Build succeeds but the download link 404s

GitHub takes a few seconds to process the release. Also confirm the Release was created as `latest` (not pre-release). You can verify from the Releases page — the latest one should have a **Latest** badge.

### The `frontend` repo is private and checkout fails

Confirm `GH_PAT` in the desktop repo secrets has `repo` read access and belongs to an account that is a collaborator on the frontend repo.

---

*Last updated: March 2026*
