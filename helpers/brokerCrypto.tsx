import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "crypto";

const TOKEN_CONTEXT = "cuetrade-broker-token-v1";

function tokenKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return createHash("sha256").update(secret + ":" + TOKEN_CONTEXT).digest();
}

export function encryptBrokerSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptBrokerSecret(value: string) {
  const [ivText, tagText, payloadText] = value.split(".");
  if (!ivText || !tagText || !payloadText) throw new Error("Invalid encrypted broker secret");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashOauthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

type WebullSignArgs = {
  host: string;
  path: string;
  query?: Record<string, string>;
  body?: string;
  appKey: string;
  appSecret: string;
};

export function signWebullRequest({
  host,
  path,
  query = {},
  body = "",
  appKey,
  appSecret,
}: WebullSignArgs) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = randomBytes(16).toString("hex");
  const signingHeaders: Record<string, string> = {
    host,
    "x-app-key": appKey,
    "x-signature-algorithm": "HMAC-SHA1",
    "x-signature-nonce": nonce,
    "x-signature-version": "1.0",
    "x-timestamp": timestamp,
  };

  const signedValues = { ...query, ...signingHeaders };
  const sorted = Object.keys(signedValues)
    .sort()
    .map((key) => key + "=" + signedValues[key])
    .join("&");

  const bodyMd5 = body
    ? createHash("md5").update(body).digest("hex").toUpperCase()
    : "";

  const raw = path + "&" + sorted + (bodyMd5 ? "&" + bodyMd5 : "");
  const encoded = encodeURIComponent(raw);
  const signature = createHmac("sha1", appSecret + "&").update(encoded).digest("base64");

  return {
    "x-app-key": appKey,
    "x-timestamp": timestamp,
    "x-signature-version": "1.0",
    "x-signature-algorithm": "HMAC-SHA1",
    "x-signature-nonce": nonce,
    "x-version": "v3",
    "x-signature": signature,
  };
}

