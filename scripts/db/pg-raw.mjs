// Dependency-free, READ-ONLY Postgres client (raw wire protocol over TLS).
// Used only to inspect the existing Supabase schema during the migration
// audit. Executes exactly the SELECT statements passed to it.
import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

function parseUrl(raw) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
  };
}

class Reader {
  constructor() { this.buf = Buffer.alloc(0); }
  push(chunk) { this.buf = Buffer.concat([this.buf, chunk]); }
  // Returns {type, body} or null when a full message isn't buffered yet.
  next() {
    if (this.buf.length < 5) return null;
    const type = String.fromCharCode(this.buf[0]);
    const len = this.buf.readInt32BE(1);
    if (this.buf.length < 1 + len) return null;
    const body = this.buf.subarray(5, 1 + len);
    this.buf = this.buf.subarray(1 + len);
    return { type, body };
  }
}

function msg(type, payload) {
  const len = Buffer.alloc(4);
  len.writeInt32BE(payload.length + 4);
  return Buffer.concat([Buffer.from(type), len, payload]);
}
function cstr(s) { return Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]); }

function hi(password, salt, iterations) {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}
function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}
function sha256(data) {
  return crypto.createHash("sha256").update(data).digest();
}
function xor(a, b) {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

export async function query(connectionString, statements) {
  const cfg = parseUrl(connectionString);

  const socket = await new Promise((res, rej) => {
    const s = net.connect(cfg.port, cfg.host);
    s.once("connect", () => res(s));
    s.once("error", rej);
  });

  // SSLRequest
  const ssl = Buffer.alloc(8);
  ssl.writeInt32BE(8, 0);
  ssl.writeInt32BE(80877103, 4);
  socket.write(ssl);
  const sslReply = await new Promise((res) => socket.once("data", res));
  if (String.fromCharCode(sslReply[0]) !== "S") throw new Error("Server refused TLS");

  const conn = tls.connect({ socket, servername: cfg.host, rejectUnauthorized: false });
  await new Promise((res, rej) => { conn.once("secureConnect", res); conn.once("error", rej); });

  const reader = new Reader();
  const pending = [];
  let waiter = null;
  conn.on("data", (c) => {
    reader.push(c);
    let m;
    while ((m = reader.next())) {
      pending.push(m);
      if (waiter) { const w = waiter; waiter = null; w(); }
    }
  });
  async function recv() {
    while (pending.length === 0) await new Promise((r) => { waiter = r; });
    return pending.shift();
  }

  // StartupMessage
  const params = Buffer.concat([cstr("user"), cstr(cfg.user), cstr("database"), cstr(cfg.database), Buffer.from([0])]);
  const startup = Buffer.alloc(8 + params.length);
  startup.writeInt32BE(8 + params.length, 0);
  startup.writeInt32BE(196608, 4);
  params.copy(startup, 8);
  conn.write(startup);

  // Auth loop (SCRAM-SHA-256 only)
  let clientNonce, clientFirstBare, saltedPassword, authMessage;
  for (;;) {
    const m = await recv();
    if (m.type === "E") throw new Error("PG error: " + m.body.toString("utf8").replace(/\0/g, " ").trim());
    if (m.type !== "R") continue;
    const code = m.body.readInt32BE(0);
    if (code === 0) break; // AuthenticationOk
    if (code === 10) {
      clientNonce = crypto.randomBytes(18).toString("base64");
      clientFirstBare = `n=,r=${clientNonce}`;
      const payload = Buffer.concat([cstr("SCRAM-SHA-256"), (() => {
        const b = Buffer.from("n,," + clientFirstBare, "utf8");
        const l = Buffer.alloc(4); l.writeInt32BE(b.length);
        return Buffer.concat([l, b]);
      })()]);
      conn.write(msg("p", payload));
    } else if (code === 11) {
      const serverFirst = m.body.subarray(4).toString("utf8");
      const attrs = Object.fromEntries(serverFirst.split(",").map((kv) => [kv[0], kv.slice(2)]));
      const salt = Buffer.from(attrs.s, "base64");
      const iterations = Number(attrs.i);
      saltedPassword = hi(cfg.password, salt, iterations);
      const clientKey = hmac(saltedPassword, "Client Key");
      const storedKey = sha256(clientKey);
      const clientFinalNoProof = `c=biws,r=${attrs.r}`;
      authMessage = `${clientFirstBare},${serverFirst},${clientFinalNoProof}`;
      const clientSignature = hmac(storedKey, authMessage);
      const proof = xor(clientKey, clientSignature).toString("base64");
      conn.write(msg("p", Buffer.from(`${clientFinalNoProof},p=${proof}`, "utf8")));
    } else if (code === 12) {
      // AuthenticationSASLFinal — verify the server signature.
      const serverFinal = m.body.subarray(4).toString("utf8");
      const v = serverFinal.split(",").find((s) => s.startsWith("v=")).slice(2);
      const serverKey = hmac(saltedPassword, "Server Key");
      const expected = hmac(serverKey, authMessage).toString("base64");
      if (v !== expected) throw new Error("Server signature mismatch");
    } else {
      throw new Error("Unsupported auth method: " + code);
    }
  }

  // Drain until ReadyForQuery
  for (;;) { const m = await recv(); if (m.type === "Z") break; if (m.type === "E") throw new Error("PG error"); }

  const results = [];
  for (const sql of statements) {
    conn.write(msg("Q", cstr(sql)));
    let cols = [];
    const rows = [];
    let error = null;
    for (;;) {
      const m = await recv();
      if (m.type === "T") {
        cols = [];
        const n = m.body.readInt16BE(0);
        let off = 2;
        for (let i = 0; i < n; i++) {
          const end = m.body.indexOf(0, off);
          cols.push(m.body.subarray(off, end).toString("utf8"));
          off = end + 1 + 18;
        }
      } else if (m.type === "D") {
        const n = m.body.readInt16BE(0);
        let off = 2;
        const row = {};
        for (let i = 0; i < n; i++) {
          const len = m.body.readInt32BE(off); off += 4;
          if (len === -1) { row[cols[i]] = null; }
          else { row[cols[i]] = m.body.subarray(off, off + len).toString("utf8"); off += len; }
        }
        rows.push(row);
      } else if (m.type === "E") {
        error = m.body.toString("utf8").replace(/\0/g, " ").trim();
      } else if (m.type === "Z") break;
    }
    results.push({ sql, rows, error });
  }

  conn.end();
  return results;
}
