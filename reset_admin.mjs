import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { pbkdf2Sync } from "node:crypto";
import { randomBytes } from "node:crypto";

const sql = neon(process.env.DDGEI_DATABASE_URL);

// Generate new password hash for "admin123"
const salt = crypto.randomBytes(16);
const derived = crypto.pbkdf2Sync("admin123", salt, 600000, 32, "sha256");
const hash = "pbkdf2_sha256$600000$" + salt.toString("base64") + "$" + Buffer.from(crypto.pbkdf2Sync("admin123", crypto.randomBytes(16), 600000, 32, "sha256")).toString("hex");

console.log("novo hash:", hash);

const sql = neon(process.env.DDGEI_DATABASE_URL);
const r = await sql("UPDATE users SET password=$1 WHERE username=$2", [hash, "admin"]);
console.log("updated:", r);