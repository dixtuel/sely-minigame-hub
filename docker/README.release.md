# Docker release bundle

Requirements: Docker Engine with the Compose plugin. The app uses a persistent SQLite volume by default and a local Redis service for the leaderboard cache.

1. Load the platform-specific image archive first:

   ```sh
   gzip -dc sely-minigame-hub-__RELEASE_TAG__-linux-__ARCH__-image.tar.gz | docker load
   ```

2. Copy `.env.example` to `.env` and set only the options you need. Do not publish this file or put it in source control.
3. Start the app:

   ```sh
   docker compose up -d --pull never
   docker compose ps
   ```

4. Open `http://localhost:3000` (or the port selected in `.env`).

To stop it without deleting data, run `docker compose down`. Do not add `--volumes` unless you intend to erase the local database and Redis cache. Back up the `sely-data` volume before replacing the installation.

The bundle is a self-hosted Docker image, not a Vercel deployment. Vercel users should deploy the tagged source repository and configure their own Vercel project variables.
