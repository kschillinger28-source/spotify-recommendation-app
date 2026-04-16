import dotenv from "dotenv";

dotenv.config({ override: true });

const requiredKeys = [
  "APP_BASE_URL",
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI"
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingKeys.join(", ")}`
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  appBaseUrl: process.env.APP_BASE_URL,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI,
  spotifyScopes:
    process.env.SPOTIFY_SCOPES ??
    "user-read-email user-read-private user-top-read user-library-read user-read-recently-played playlist-read-private playlist-read-collaborative user-read-playback-state user-read-currently-playing user-modify-playback-state"
};
