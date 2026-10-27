# AH Head Office Design Team Diary

The daily work log for the AH Head Office design team. It's a free website on **GitHub Pages**
with a free **Supabase** database. Everyone signs in once with their work email and a password they choose. No daily login.
No passwords, no Claude account, no cost.

- **Site:** https://saicharan13579-source.github.io/ah-design-diary/
- **What's here:** the 3D M82 build in Hyderabad's live weather, the daily log, the calendar, weekly
  and monthly summaries per person, CSV export, and Anusha logging updates for Sai Charan.

## One-time database setup (about 5 minutes, free, no card)

1. Go to **https://supabase.com** → **Start your project** → **Continue with GitHub**.
2. Click **New project**:
   - Name: `ah-design-diary`
   - Database password: anything strong (you won't need it day to day)
   - Region: **South Asia (Mumbai)**
   - Click **Create new project**, then wait about 1 minute.
3. **SQL Editor → New query.** Paste the whole of `supabase-setup.sql` from this repository.
   Change the **four emails** in the *TEAM EMAILS* block to your team's real emails, then click **Run**.
4. **Authentication → Sign In / Providers:** turn **Confirm email** off and click **Save**, so new passwords work at once with no email.
   *(Optional)* **Authentication → Emails → Magic Link** template, which needs custom SMTP.
   Replace the message body with the text below, then click **Save**. This makes the email carry a
   6-digit code, which Outlook's link scanner can't use up.
   ```
   <h2>AH Design Team Diary</h2><p>Your sign-in code is:</p><h1>{{ .Token }}</h1><p>It expires in 1 hour.</p>
   ```
5. **Authentication → URL Configuration → Site URL:**
   `https://saicharan13579-source.github.io/ah-design-diary/`
6. **Project Settings → API.** Copy the **Project URL** and the **anon public** key into `config.js`
   in this repository (edit it on GitHub with the pencil icon). Also set `ownerEmail` to Sai Charan's
   email, then **Commit**.

GitHub Pages updates within about a minute. Open the site, enter your email, type the code, and you're in.

## Using it

- **First visit:** click **First time here? Create your password**, enter your work email and choose a password. Only emails in `team_access` can do this. Then each person chooses their name under **Who are you?** and logs their update.
- **Anusha** can log, edit and delete updates for **everyone** (choose the person in **Logging for**). Set by `can_log_all` in `team_access`.
- **Only the owner email** can change the team list, enforced by the database rules.
- **Adding a person later:** add their email to the `team_access` table (Supabase → Table Editor),
  then add them with the **Team list** button on the site.
- **Your data:** Supabase → Table Editor → `docs`. You can download it as CSV at any time.

**Note:** on the free plan Supabase pauses a project after 7 days with no visits. Daily use keeps it
awake. If it ever pauses, open the Supabase dashboard and click **Restore**.
