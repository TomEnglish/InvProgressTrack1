# Human UAT Checklist — Progress Tracker

This is the **human-only** companion to [uat_script.md](uat_script.md). The scripted flow itself is covered by automation (`cd frontend && npm run test:uat`). What's below is the stuff a human has to try, see, and judge — things that can't be captured by a Playwright assertion.

Each section is an independent assignment. One person per section is ideal; if fewer people, prioritize sections A → G.

**URL:** https://invenioprogress.netlify.app
**Your test account:** the tester will be issued a unique login. Do not share.

---

## A. Email deliverability (assign to 2-3 people on different email providers)

We use one SMTP provider but every inbox filters differently. We need coverage.

- [ ] Trigger a password recovery for your own account
- [ ] Email arrives within 1 minute
- [ ] Email is in **Inbox**, not Spam/Junk/Promotions
- [ ] Sender name / from address looks trustworthy (not phishy)
- [ ] Subject line makes sense
- [ ] Email renders correctly (no broken layout, no missing images)
- [ ] Mobile preview of the email is readable
- [ ] The "Reset Password" link actually works — one click, no "expired" error
- [ ] After resetting, you can log in with the new password

**If the email lands in spam**, note your email provider (Gmail personal, Gmail Workspace, Outlook/O365, Yahoo, corporate). Don't move it to inbox — leave it there and tell Elliott what provider.

---

## B. Real data & calculations (assign to a project controller)

The automation checks downloads and navigation; it does not validate that the math is correct. Only a project person can.

- [ ] Upload a real (or realistic) project CSV via **Data Upload**
- [ ] Open **Executive Overview** — do the KPIs (Overall Progress, CPI, SPI, Schedule Var, Total Tracked Items) match what you'd expect?
- [ ] Open **Earned Value** — verify the per-period SPI/CPI/SV/CV numbers against a hand calculation on 2-3 rows. Do the values match?
- [ ] Open **Period Tracking** — do the period-over-period deltas make sense?
- [ ] **Progress Audits** — filter by IWP / DWG / ISO. Does the filter work? Does the filtered list match what you'd expect?
- [ ] Try uploading a CSV with intentionally wrong data (negative budgets, zero values, duplicate drawings). What happens? Does the app fail gracefully or throw a stack trace?

**Report:** any number that's wrong, misleading, or inconsistent between tabs.

---

## C. Role-based access (assign to a QA-minded tester)

The app has two roles: **Admin** and **Viewer**. Viewers should be read-only. Test that RLS actually enforces that.

- [ ] Log in as a **Viewer**
- [ ] Can you see Admin Hub in the nav? (Should not appear, or should be denied on click)
- [ ] If you manually type `/admin` in the URL, what happens? (Should show "Access Denied")
- [ ] Can you upload a CSV? (Should be denied)
- [ ] Open **Data Upload** page directly via URL — does the UI let you upload?
- [ ] Open browser devtools → Network tab. Try to modify a progress item by clicking around. Do any mutations succeed?
- [ ] Log in as **Admin** in a second browser window. Do you see a separate tenant's data? (You should not — tenant isolation check.)

**Report:** any action a Viewer can perform that they shouldn't, or any data leakage between tenants.

---

## D. Cross-browser & device (spread across 2+ testers)

Automation only runs Chromium desktop. Please cover:

- [ ] **Safari** on macOS (desktop)
- [ ] **Firefox** on any OS
- [ ] **iOS Safari** on iPhone (portrait + landscape)
- [ ] **Android Chrome** on a phone
- [ ] A smaller laptop screen (13" or smaller)

For each browser/device, walk through the core flow: log in → view Executive Overview → upload a CSV → check EV table. Note anything that looks broken, misaligned, unreadable, or behaves oddly. Test dark mode on each too.

---

## E. Onboarding / first-run (assign to someone who has NEVER seen the app)

This is the most valuable single test. Once you've seen the app, you can't unsee it — a fresh set of eyes catches confusion and friction that regular users hit.

- [ ] Have a colleague open the app for the first time with just their login credentials
- [ ] Give them one goal: *"Upload a project CSV and tell me the project's CPI."*
- [ ] **Do not help them.** Watch, take notes.
- [ ] Every moment they hesitate, re-read, or ask a question is a UX bug — log it.

**Report:** the list of "where did they get stuck" moments.

---

## F. Content & tone review (assign to a non-engineer end-user)

The UI copy has been partially simplified but may still have stylized phrasing. A Kindred project controller reading it cold should be able to tell us if the language feels right for the audience.

- [ ] Read every page, dialog, tooltip, and button label in the app
- [ ] Flag anything that sounds "trying too hard", "tech-speaky", confusing, condescending, or that a project controls person wouldn't actually say
- [ ] Flag typos or awkward grammar
- [ ] Confirm "Kindred Industrial Services | Project Controls" branding is correct (title, logo, etc.)

**Report:** list of phrases + a suggested replacement (doesn't need to be polished — just the intent).

---

## G. Resilience / edge cases (assign to a QA-minded tester)

Things that *shouldn't* happen but sometimes do.

- [ ] **Flight mode test:** start uploading a CSV, disable wifi mid-upload. What happens? Does the app show a clear error or hang?
- [ ] **Back-button test:** fill a form partway, hit Back, come forward. Is the form recovered or empty?
- [ ] **Stale tab test:** open the app, leave it idle for 90+ minutes, come back. Does it recover gracefully or show a cryptic error?
- [ ] **Double-submit test:** click "Sign In" or "Create User" rapidly multiple times. Do you create duplicate requests / duplicate users?
- [ ] **Two-session test:** log in from two browsers at once. Change password in one. What happens in the other? Does it redirect to login, or keep pretending you're logged in?
- [ ] **Malformed CSV:** upload a file that's not a CSV (a PDF, an image, a text file with garbage). Does the app refuse gracefully or crash?
- [ ] **Large CSV:** upload a very large file (1000+ rows). Does it complete? How long does it take? Is there a progress indicator?

**Report:** anything that produced a stack trace, a cryptic error, data loss, or felt "scary."

---

## H. Accessibility (optional — time-permitting)

- [ ] Navigate the login flow using only the keyboard (Tab, Shift+Tab, Enter). Can you complete it?
- [ ] Check color contrast in both light and dark mode. Is any text hard to read?
- [ ] Turn on VoiceOver (Mac) or NVDA (Windows) and try to log in. Are labels announced correctly?

---

## How to report issues

For each finding, provide:

1. **What you did** (exact steps)
2. **What you expected** to happen
3. **What actually happened**
4. **Screenshot or screen recording** if visual
5. **Browser + OS + device** (e.g. "Safari 18 on macOS 15, iPhone 15 Pro")
6. **Severity guess:** blocker / major / minor / polish

Drop each finding into [the project's issue tracker or a shared doc — Elliott will fill this in].

Thanks for testing.
