import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt with N=2^14, r=8, p=1 (OWASP minimum) and a per-password salt.
// Stored as "scrypt$N$r$p$salt$key" so parameters can be raised later.
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

function derive(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEYLEN, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash to compare against when the username doesn't exist, so timing doesn't leak which usernames are taken. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  return (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));
}
