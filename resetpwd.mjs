import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { pbkdf2Sync } from "node:crypto";
import { randomBytes } from "node:crypto";

const sql = neon(process.env.DDGEI_DATABASE_URL);

const salt = randomBytes(16);
const hash = "pbkdf2_sha256$600000$" + Buffer.from(randomBytes(16)).toString("base64") + "$" + pbkdf2Sync("admin123", randomBytes(16), 600000, 32, "sha256").toString("hex");

console.log("novo hash:", hash);

const sqlClient = neon(process.env.DDGEI_DATABASE_URL);
const r = await sql("UPDATE users SET password=$1 WHERE username=$2", [hash, "admin"]);
console.log("updated:", r);