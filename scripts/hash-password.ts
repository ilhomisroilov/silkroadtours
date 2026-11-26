/**
 * Prints the PBKDF2 hash of a password, for the "Preview (test link)" workflow's
 * admin_password_hash input. The hash is safe to paste into GitHub; the password is not.
 *
 *   npx tsx scripts/hash-password.ts            (asks for the password, nothing is shown)
 */
import { createInterface } from "node:readline";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/lib/auth/password.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
let muted = false;
out._writeToOutput = (s: string) => {
  if (!muted || s.includes("\n")) out.output.write(muted ? "\n" : s);
};
rl.question(`Password (min ${PASSWORD_MIN_LENGTH} characters): `, (password) => {
  rl.close();
  void hashPassword(password.trim())
    .then((hash) => console.log(`\n${hash}`))
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
});
muted = true;
