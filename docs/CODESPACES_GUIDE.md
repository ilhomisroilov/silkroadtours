# Testing the project online with GitHub Codespaces

A **Codespace** is a computer in the cloud that opens in your web browser. It already has Node.js, Python and a code editor (VS Code). You install nothing on your own computer. GitHub's free plan includes enough Codespace hours each month for this testing. Stop the Codespace when you finish (Part F) so you don't use up your hours.

**Your secrets stay private.** Passwords and API keys never go into chat, never go into the code, and are never committed to GitHub. For testing, the project creates random test-only secrets by itself.

---

## Part A — Put the project on GitHub (once, about 10 minutes)

1. Sign in at **github.com**. If you don't have an account, create a free one.
2. Click **+** (top right) → **New repository**.
   - Repository name: `silkroad-tours`
   - Choose **Private**
   - Tick **Add a README file** (a repository can't open a Codespace while it's empty)
   - Click **Create repository**
3. On the new repository page, click the green **Code** button → **Codespaces** tab → **Create codespace on main**. A browser tab opens with VS Code. Wait until you see the file list on the left and a **Terminal** at the bottom. If you don't see a terminal, open the menu ☰ → **Terminal** → **New Terminal**.
4. Drag the file `silkroad-tours-phase2.zip` from your computer into the file list on the left. Wait for it to upload.
5. Click inside the terminal, paste these lines and press **Enter**:
   ```bash
   unzip -o silkroad-tours-phase2.zip && cp -a silkroad-tours/. . && rm -rf silkroad-tours silkroad-tours-phase2.zip
   ```
   The project files now appear in the file list (`src`, `docs`, `package.json` …).
6. Save the files to GitHub (the commands go in the terminal, one block at a time):
   ```bash
   git add -A
   git commit -m "Phase 2 project"
   git push
   ```

## Part B — Set up the Codespace (automatic, 3–5 minutes)

Run:
```bash
npm run setup:codespace
```
It installs the packages, creates the random test secrets, creates the local database, and loads the 9 destinations and 18 tours. Wait for **✅ Setup complete**.

> In future Codespaces created from this repository, this step runs **by itself** (that's what the `.devcontainer` folder does).

If wrangler asks *"Ok to proceed?"*, type `y` and press Enter.

Then save the generated package list (this makes future installs identical):
```bash
git add package-lock.json && git commit -m "Add lockfile" && git push
```

## Part C — Run the tests (about 10 minutes)

Run each command and check its result before going on to the next one.

**Test 1 — Unit tests** (prices, passwords, Telegram formatting, form validation, translations):
```bash
npm run test:unit
```
✅ Expected: ends with `# fail 0`.

**Test 2 — Type check** (finds programming mistakes):
```bash
npm run typecheck
```
✅ Expected: no output and no errors.

**Test 3 — Start the app.** It keeps running in this terminal:
```bash
npm run dev
```
✅ Expected: `Ready in …`. A small pop-up says *"Your application running on port 3000 is available"*. Click **Open in Browser**, then add `/api/health` to the end of the address. You should see something like:
```json
{"data":{"status":"ok","database":{"destinations":9,"tours":18},"config":{...}}}
```
Try these addresses too (add them after the `.app.github.dev` part):
- `/api/tours?audience=domestic&currency=UZS`: the 7 domestic tours, priced in so'm
- `/api/tours/classic-silk-road-8-days/quote?adults=2&type=private&currency=EUR`: a price in euros
- `/api/destinations`: the 9 regions

> Remove `/api/health` from the address to see the website itself (it opens `/en`). Try `/uz` and `/ru`, and the admin panel at `/admin` (sign in with the test admin the smoke test creates — its password is in the file `.smoke-admin.json`).

**Test 4 — Full end-to-end test.** Open a **second** terminal (click **+** in the terminal panel) and run:
```bash
npm run test:smoke
```
This runs 29 checks against the running app. It creates a booking, a transfer request and a test admin account; logs in; confirms the booking (taking 2 seats); completes the trip; leaves and publishes a review; and checks the dashboard statistics and the tour editor.
✅ Expected: `Result: 28 passed, 0 failed, 1 skipped`. The skipped check is Telegram (Part D).

**Test 5 — Build exactly as Cloudflare will run it.** Stop `npm run dev` in the first terminal with **Ctrl + C**, then run:
```bash
npm run preview
```
Wait for `Ready on http://localhost:8787` (the first build takes a few minutes). In the second terminal run:
```bash
BASE_URL=http://localhost:8787 npm run test:smoke
```
✅ Expected: the same result as Test 4. This proves the Cloudflare Workers build works.

**Test 5b — Browser tests (optional, takes ~3 minutes).** With `npm run preview` still running, in the second terminal:
```bash
npx playwright install chromium
npm run test:e2e
```
✅ Expected: all tests passed. They click through the website on a desktop and a phone-sized screen (languages, currency, filters, a full booking, an airport transfer, the admin confirming a booking) and check accessibility.

**Test 6 — Automatic check on GitHub.** After any `git push`, open your repository on github.com → **Actions** tab. The **Test** workflow repeats Tests 1, 2, 4, 5 and 5b by itself and also checks the Lighthouse speed budgets. ✅ Expected: a green tick.

## Part D — Optional: test the Telegram alerts

1. In Telegram, create a bot with **@BotFather** and a group (see `MANUAL_SETUP.md`, step 3).
2. On github.com: your profile picture → **Settings** → **Codespaces** → **Secrets** → **New secret**:
   - `TELEGRAM_BOT_TOKEN`: the token from BotFather (repository access: `silkroad-tours`)
   - `TELEGRAM_CHAT_ID`: your group's id
   GitHub stores these encrypted. **Don't paste them into the chat.**
3. GitHub offers **Reload to apply** in the Codespace. Click it, then run:
   ```bash
   rm .dev.vars && npm run setup:codespace
   ```
4. Start `npm run dev` again and run `npm run test:smoke`. The Telegram check should now say *message sent*, and a booking message appears in your group.

## Part E — If something fails

- **Database counts are wrong, or you want a clean start:** `npm run db:reset:local`, then `rm -f .smoke-admin.json`.
- **`captcha_failed`:** `.dev.vars` must contain `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` for local tests.
- **Anything else:** copy the red ❌ lines (or the error text) into the chat. They never contain your secrets. Check before sending all the same.

## Part F — When you finish

Stop the Codespace so it stops using your free hours: github.com → **Code** → **Codespaces** → **⋯** → **Stop codespace**. Your files and database stay in it until you delete it.

---

**After all tests pass**, follow `docs/DEPLOYMENT.md` to put the site on Cloudflare.
