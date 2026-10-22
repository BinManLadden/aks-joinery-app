# AKS Joinery Cloud Sync

The app is hosted on GitHub Pages. Supabase stores the shared team copy, so no office computer or server needs to stay switched on.

## The project is prepared

The AKS Joinery Sync project is in the London region. The website update includes its Project URL and **publishable** key, so staff will not need to copy those values by hand. The publishable key is designed for browser apps; database row-level security restricts access to the signed-in team account.

The database table and its row-level security rules are set up by `cloud-setup.sql`. If you ever need to recreate them, open Supabase **SQL Editor**, paste the file contents, and select **Run**. The script keeps existing policies and adds any that are missing.

## Publish the app update

1. Extract `AKS-Joinery-Cloud-Sync-Setup-Updated.zip` on your computer.
2. In the existing `aks-joinery-app` repository, select **Add file** → **Upload files**.
3. Upload these files from the extracted folder to the repository's top level: `index.html`, `sync.js`, `service-worker.js`, `manifest.webmanifest`, and `CLOUD-SYNC-INSTRUCTIONS.md`. Keep `index.html` directly in the repository root. The existing `icons/aks-icon.svg` can stay where it is.
4. Commit the changes to `main` and wait for the green **pages build and deployment** run.

Do not upload `AKS-Holden-Fold-import-backup.json` to the public repository. It contains plot and price data.

## Create the shared team login and first cloud copy

1. Open the published app and choose **Backup & settings** → **Cloud sync for your team**. The Project URL and publishable key should already be filled in.
2. Enter the team email address and a strong password that the staff will share. Select **Create team login** once. If Supabase asks for email confirmation, confirm it from that inbox, then return to the app and select **Sign in**.
3. On the first device, select **Import backup** and choose `AKS-Holden-Fold-import-backup.json`. This replaces the local app data on that device, so export a backup first if it contains records you want to keep.
4. Select **Upload this device to cloud** and confirm. This creates the shared copy.

## Connect the other staff devices

On each device, open the same published app, enter the shared team email and password, then select **Sign in** and **Download shared data to this device** once. After that, changes sync while the device is online. The app checks for updates every 15 seconds.

## Keep in mind

- Never put a Supabase **Secret** or **service-role** key in the website or public GitHub repository. Only the publishable key belongs in the browser.
- Everyone using the shared login can view and change the same data. The prototype does not record which staff member made each change.
- Keep regular exports with **Download full backup**. If two devices edit at once, the app pauses and asks which copy to keep; it does not merge edits automatically.
- Offline changes stay on that device and sync after it reconnects, if it was already linked to the shared account.
