const SALT = "replace-with-your-study-secret";

export async function sha256(text) {
  const data = new TextEncoder().encode(SALT + text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}