import { mkdir, open, chmod, lstat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
await mkdir(new URL("../.local/", import.meta.url), { recursive: true, mode: 0o700 });
const directory = new URL("../.local/", import.meta.url);
if (!(await lstat(directory)).isDirectory()) throw new Error("Local secrets directory must be a real directory.");
await chmod(directory, 0o700);
try {
  const file = await open(new URL("../.local/postgres-password", import.meta.url), "wx", 0o600);
  await file.writeFile(randomBytes(32).toString("hex") + "\n");
  await file.close();
  console.log("Local password file created; its contents are not printed.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  const secret = new URL("../.local/postgres-password", import.meta.url);
  if (!(await lstat(secret)).isFile()) throw new Error("Local password must be a regular file.");
  await chmod(secret, 0o600);
  console.log("Local password file already exists; preserved.");
}
