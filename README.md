# AKS Joinery — GitHub Pages upload

This folder contains the AKS Joinery app prepared for GitHub Pages. `index.html` is at the top level, with its sync support, PWA files, and icons alongside it.

## Put the app in your repository

1. Extract `AKS-Joinery-GitHub-Pages.zip` on your computer.
2. Open your existing repository on GitHub and select **Add file → Upload files**.
3. Upload the app files from the extracted folder: `index.html`, `sync.js`, `manifest.webmanifest`, `service-worker.js`, and the `icons` folder. Keep both SVG files inside `icons`.
4. Check that `index.html` is directly in the repository's top level, not inside another folder.
5. If you want, also upload this folder's `README.md` as the repository guide. If your repository already has a `README.md`, leave this one out so it does not replace yours.
6. Enter a commit message such as `Add AKS Joinery app`, then commit the upload to your repository's default branch (usually `main`).

Do not upload the ZIP itself. GitHub Pages needs the files extracted, and it needs `index.html` at the publishing folder's top level.

## Turn on GitHub Pages

1. In the repository, open **Settings**.
2. In the left sidebar, select **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the default branch (usually `main`) and the `/(root)` folder, then select **Save**.
5. Return to the Pages settings after deployment starts and open the site link shown there. The first publication can take a few minutes.

GitHub's instructions: [upload files to a repository](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) and [configure GitHub Pages from a branch](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Install and update on Android

Open the published HTTPS link in Chrome on the phone, then use **⋮ → Install app** (or **Install and create shortcut**, depending on the Chrome version). Current steps are in [Google Chrome Help](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-001). After you commit a new version, open the app while online; the service worker can refresh the app files, and a close/reopen may be needed to see the update.

## Sync and visibility

- This is a static website, so GitHub Pages can host it without a server that you maintain.
- Until a device is linked in **Backup & settings**, data is stored only in that browser on that device. Follow [CLOUD-SYNC-INSTRUCTIONS.md](CLOUD-SYNC-INSTRUCTIONS.md) to connect the staff devices to the shared Supabase account.
- Export regular backups with **Download full backup**. Cloud sync requires an internet connection; offline changes stay on the device until it reconnects.
- GitHub Pages sites are publicly available on the internet, including when the repository is private. Do not put confidential information or database secret/service-role keys in the public repository.

