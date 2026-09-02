import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { pbkdf2Sync } from "node:crypto";
import { randomBytes } from "node:crypto";

const sql = neon(process.env.DDGEI_DATABASE_URL);

// Generate new password hash for "admin123"
const salt = new Uint8Array(16);
crypto.getRandomValues(new Uint8Array(16)); // This won't work in Node

// Let's use a simpler approach
import { randomBytes } from "node:crypto";
import { pbkdf2Sync } from "node:crypto";

const salt = crypto.randomBytes(16);
const derived = pbkdf2Sync("admin123", crypto.randomBytes(16), 600000, 32, "sha256");
const hash = "pbkdf2_sha256$600000$" + Buffer.from(crypto.randomBytes(16)).toString("base64") + "$" + pbkdf2Sync("admin123", crypto.randomBytes(16), 600000, 32, "sha256").toString("hex");

console.log("novo hash:", hash);

// Wait, the issue is we need to use the same salt for both generation and verification
// The hash format is: pbkdf2_sha256$iterations$salt$hash
// Salt is base64 encoded, hash is hex

// Let me do this properly in the script