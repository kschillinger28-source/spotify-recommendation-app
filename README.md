# Music Queue Helper (Phase 1 + 2 + 6 + 7)

This project intentionally includes only:

- project setup
- environment variable structure
- Spotify OAuth flow
- add to queue
- search tracks by song/artist keywords
- local storage of desired start offset
- detect when queued song becomes current
- attempt seek to recommended timestamp
- fallback UI when seek cannot be verified
- music-first themed UI
- multi-provider selector (Spotify active, SoundCloud/Apple Music staged)
- local run instructions

It does **not** include the recommendation engine yet.

## Tech Stack

- Node.js (18+)
- Express
- Spotify Web API OAuth Authorization Code flow

## 1) Create a Spotify App

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create a new app.
3. Open your app settings and copy:
   - Client ID
   - Client Secret
4. In **Redirect URIs**, add:
  - `http://localhost:3000/auth/spotify/callback`
5. Save changes.

## 2) Configure Environment Variables

Copy the template:

```bash
cp .env.example .env
```

Edit `.env` with your actual Spotify credentials:

```env
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000

SPOTIFY_CLIENT_ID=your_actual_client_id
SPOTIFY_CLIENT_SECRET=your_actual_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
SPOTIFY_SCOPES=user-read-email user-read-private user-top-read user-read-playback-state user-read-currently-playing user-modify-playback-state
```

## 3) Install Dependencies

```bash
npm install
```

## 4) Run Locally

Development mode:

```bash
npm run dev
```

Production-like run:

```bash
npm start
```

Server base URL: `http://localhost:3000`

## 5) Test Spotify OAuth Flow

1. Start the server.
2. Open:
   - `http://localhost:3000/auth/spotify/login`
3. Sign in to Spotify and approve scopes.
4. Spotify redirects to callback:
   - `http://localhost:3000/auth/spotify/callback?code=...&state=...`
5. The callback endpoint returns token JSON.

## 6) Use Queue + Seek UI

1. Open:
   - `http://localhost:3000`
2. Choose provider:
   - `Spotify` works today.
   - `SoundCloud` and `Apple Music` are marked coming soon.
3. Paste a valid Spotify access token.
   - Optional but recommended: paste your Spotify refresh token once so access tokens auto-refresh on expiry.
4. Find your track:
   - Search by song/artist/keywords (auto-search while typing) and click **Use This Track**, or
   - Use result quick actions (**Play Now**, **Queue**, **Queue + Seek**) directly from each search card, or
   - Enter a `spotify:track:<id>` URI manually.
   - You can also paste a Spotify track URL or 22-char track ID.
5. Enter your recommended start offset in seconds.
   - This value is saved in local storage.
6. Choose one:
   - **Play Track Now** to immediately switch playback to this track.
   - **Queue Song Only** to keep Spotify native transition/mix behavior.
   - **Queue + Auto Seek** to jump to your offset when target track starts.
7. Optional: set **Seek Delay (seconds)** to wait briefly before sending seek.
8. The UI will:
   - add the track to Spotify queue
   - optionally poll playback state until that track becomes current
   - optionally attempt seek to your offset
   - verify playback progress when auto-seek is used
9. If verification fails, manual fallback instructions appear.
10. Use the bottom **Quick Actions** dock to trigger actions without scrolling.

## Available Endpoints

- `GET /health` - health check
- `GET /auth/spotify/login` - starts OAuth flow
- `GET /auth/spotify/callback` - OAuth callback and token exchange
- `POST /auth/spotify/refresh` - refreshes access token
  - Body:
    ```json
    { "refreshToken": "..." }
    ```
- `GET /auth/spotify/profile` - fetches current user profile
  - Header:
    - `Authorization: Bearer <access_token>`
- `GET /auth/spotify/search/tracks?q=<query>&limit=10` - search tracks by text
  - Header:
    - `Authorization: Bearer <access_token>`
- `PUT /auth/spotify/player/play-now` - start playback immediately for one track
  - Header:
    - `Authorization: Bearer <access_token>`
  - Body:
    ```json
    { "trackUri": "spotify:track:...", "deviceId": "optional", "positionMs": 15000 }
    ```
- `POST /auth/spotify/player/queue` - add a track URI to queue
  - Header:
    - `Authorization: Bearer <access_token>`
  - Body:
    ```json
    { "trackUri": "spotify:track:...", "deviceId": "optional" }
    ```
- `GET /auth/spotify/player/current` - get current playback state
  - Header:
    - `Authorization: Bearer <access_token>`
- `PUT /auth/spotify/player/seek` - seek currently playing track
  - Header:
    - `Authorization: Bearer <access_token>`
  - Body:
    ```json
    { "positionMs": 42000, "deviceId": "optional" }
    ```

## Limitations (Important)

- Spotify playback controls require an active playback device.
- Queue and seek can fail on unsupported account/device combinations.
- Playback state is eventually consistent; progress data can lag.
- A seek request may succeed but verification can still look unreliable.
- SoundCloud and Apple Music are UI placeholders in this phase and need separate auth/API integration before they work.
- Spotify crossfade/mix style transitions are controlled by Spotify apps, not by this API.
- Because of the above, manual fallback UI is provided and should be treated as the final backup.

## Project Structure

```text
spotify-recommendation-app/
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── public/
│   ├── app.js
│   └── index.html
└── src/
    ├── config/
    │   └── env.js
    ├── routes/
    │   └── auth.js
    ├── utils/
    │   └── spotify.js
    └── server.js
```
