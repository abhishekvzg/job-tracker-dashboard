import fs from "fs";
import path from "path";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const TOKEN_KV_KEY = "google-oauth-token";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/callback/google";

type GoogleClientCredentials = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

function hasKv() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: REDIS_URL!, token: REDIS_TOKEN! });
}

export function hasCredentials() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return true;
  return fs.existsSync(CREDENTIALS_PATH);
}

function loadClientCredentials(): GoogleClientCredentials {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: process.env.GOOGLE_REDIRECT_URI ? [process.env.GOOGLE_REDIRECT_URI] : undefined,
    };
  }
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      "Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars, or place a credentials.json in the project root for local dev."
    );
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const creds: GoogleClientCredentials | undefined = raw.web ?? raw.installed;
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error("credentials.json is missing client_id/client_secret under 'web' or 'installed'.");
  }
  return creds;
}

export function getOAuth2Client() {
  const { client_id, client_secret, redirect_uris } = loadClientCredentials();
  const redirectUri = redirect_uris?.[0] ?? DEFAULT_REDIRECT_URI;
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

async function readToken(): Promise<Credentials> {
  if (hasKv()) {
    const redis = await getRedis();
    return (await redis.get<Credentials>(TOKEN_KV_KEY)) ?? {};
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
}

export async function saveToken(tokens: Credentials) {
  const existing = (await hasToken()) ? await readToken() : {};
  const merged = { ...existing, ...tokens };
  if (hasKv()) {
    const redis = await getRedis();
    await redis.set(TOKEN_KV_KEY, merged);
  } else {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  }
}

async function clearToken() {
  if (hasKv()) {
    const redis = await getRedis();
    await redis.del(TOKEN_KV_KEY);
  } else {
    fs.rmSync(TOKEN_PATH, { force: true });
  }
}

export async function hasToken() {
  if (hasKv()) {
    const redis = await getRedis();
    return (await redis.get(TOKEN_KV_KEY)) != null;
  }
  return fs.existsSync(TOKEN_PATH);
}

export async function getAuthorizedClient() {
  if (!hasCredentials()) {
    throw new Error("MISSING_CREDENTIALS");
  }
  if (!(await hasToken())) {
    throw new Error("NOT_AUTHENTICATED");
  }
  const client = getOAuth2Client();
  const token = await readToken();
  client.setCredentials(token);
  client.on("tokens", (newTokens) => {
    saveToken(newTokens);
  });

  try {
    // Forces a refresh now so an expired/revoked refresh_token (invalid_grant)
    // surfaces here instead of mid-request, so we can clear the dead token.
    await client.getAccessToken();
  } catch (err) {
    const reason = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
    if (reason === "invalid_grant") {
      await clearToken();
    }
    throw new Error("NOT_AUTHENTICATED");
  }

  return client;
}
