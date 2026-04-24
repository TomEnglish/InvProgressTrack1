# Formal UAT (User Acceptance Testing) Script

Welcome to the **Progress Tracker v1.0** User Acceptance Testing phase. 
To guarantee test precision, you must execute these steps sequentially. 

***

## Phase 1: Account Generation (Admin Hub)
Before an email can be sent, the target email address **must physically exist** inside the Supabase Auth Matrix. If you request a password reset for an email that doesn't exist, Supabase will silently reject it to prevent hackers from scanning for valid emails.

1. Navigate to: `https://invenioprogress.netlify.app`
2. **Log in** as the master administrator:
   * Email: `live@invenio.com`
   * Password: *(Use whatever main password you set for this)*
3. Click the **Admin Hub** tab on the navigation bar.
4. Click the **"Add User"** button.
5. Create your physical testing account:
   * **Email Address**: *(Enter a real, physical email address you have inbox access to, like your personal Gmail or Work email)*
   * **Temporary Password**: `UATWelcome123!`
   * **Privilege Role**: `Viewer`
6. Click **"Deploy to Matrix"**. Verify you see the new email populate in the table below.
7. Completely **Log Out** of the application (or just open a brand new private Incognito Window to `https://invenioprogress.netlify.app`).

***

## Phase 2: Cryptographic Email Recovery
Now that the physical email is definitively registered in the database, we can securely test the SMTP pipeline.

1. On the clean Login Screen, click the blue **"Initialize Recovery?"** link above the password field.
2. Enter the exact **Test Email Address** you just registered in Phase 1.
3. Click **"Send Magic Link"**. The UI will flash green.
4. Open your physical email client (Gmail/Outlook). 
5. Wait ~15 seconds. You will receive an email from your configured Resend Domain. (If it doesn't arrive, check your Spam folder).
6. Click the secure **Reset Password link** physically embedded inside that email.
7. The magic link will instantly bounce you back into the Netlify App at the `/reset-password` endpoint. 
8. The screen will say **"Initialize Security Key"**. Type a brand new unique password into both boxes and hit **"Bind Credentials"**.
9. The system will flash green, successfully overwrite the old `UATWelcome123!` password, and redirect you into the dashboard as that new user!

***

## Phase 3: Token Interface & Dark Mode Theming
1. As your newly logged-in test user, click the **Moon / Sun** toggle on the top right.
2. Verify the background instantly shifts to deep `#0B1220`. 
3. Verify the main Invenio Logo in the top left physically shifts its vector color from the blue gradient to the solid Neon Cyan.
4. Click the **Key icon** next to the Sun/Moon toggle.
5. In the Account Security modal that pops up, attempt to physically change your password one final time and hit **Update Matrix**.

***

## Phase 4: Data Engineering Layer
1. Click the `Executive Overview` tab.
2. Hover over the mathematical `chart.js` S-curve spline lines. Confirm tooltip data strictly maps to the snapshot series cleanly in both Light and Dark modes.
3. Click the `Earned Value` tab. Confirm the EVM table renders with SPI and CPI columns.
4. Navigate to `Data Upload`.
5. Click **Blank Template**. Open it. Verify the headers map identically to the schema parameters (`dwg`, `budget_hrs`, `actual_hrs`, `percent_complete`).
6. Click **Mock Data**. Verify the payload contains actual numerical array lines to test.

---
> [!IMPORTANT]
> If the email fundamentally fails to arrive in Phase 2, it confirms your Production Supabase SMTP Resend Settings were either fully misconfigured, or the Resend API key is invalid. You will need to check the exact `Config` -> `Email` settings in your Supabase Dashboard!
