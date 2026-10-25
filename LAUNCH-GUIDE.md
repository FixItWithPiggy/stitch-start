# Stitch Start: Launch Guide

This guide takes Stitch Start from code to a live website and apps in the App Store and Google Play. Do the parts in order. Each part says what it's for, so you can explain it to others too.

## How the pieces fit together

| Piece | What it does | Cost to start |
|---|---|---|
| **The app** (this code) | One codebase that becomes the website, the iPhone app and the Android app | Free |
| **GitHub** | Stores the code | Free |
| **Supabase** | Sign-in, saving machines and projects, storing design pictures, and the small server that talks to Claude | Free plan to start |
| **Claude API** (Claude Console) | Writes the "Ask Claude" advice | Pay per use |
| **Vercel** | Hosts the website | Free for personal use; Pro plan for a business that earns money |
| **Expo (EAS)** | Builds the iPhone and Android apps in the cloud, so you don't need a Mac | Free plan to start |
| **Apple Developer** | Publishes to the App Store | $99/year (you already have this) |
| **Google Play Console** | Publishes to Google Play | $25 one time |

**How a request flows:** the app shows the setup card instantly from its built-in rules. When someone taps **Ask Claude**, the app sends only the project's id to your Supabase server. The server loads that project, adds the design picture, and asks Claude. Your Claude key stays on the server, so nobody can copy it from the app.

**Demo mode:** until Supabase is connected, the app runs in demo mode. There's no sign-in, everything is saved on the device, and Ask Claude is off. You can try the app right away this way.

---

## Part 1: Supabase (accounts and saving)

1. Go to **supabase.com**, sign up, and click **New project**. Name it `stitch-start`, choose a strong database password (save it in your password manager), and pick the region closest to your users.
2. **Create the database.** In the project, open **SQL Editor**, click **New query**, paste everything from the file `supabase/migrations/20261025000000_initial.sql`, and click **Run**. You should see "Success". This creates the tables and the privacy rules that keep each person's projects private.
3. **Turn on email sign-in.** Go to **Authentication → Sign In / Providers** and make sure **Email** is on. Leave "Confirm email" on.
4. **Copy your app keys.** Go to **Project Settings → API** (or click **Connect**). Copy the **Project URL** and the **publishable key** (it may be called the "anon" key). These two are safe to put in the app.

## Part 2: Claude API key

1. Go to **console.anthropic.com** and sign in.
2. Add a payment method and some credit under **Billing**.
3. **Set a monthly spend limit** under **Limits** so costs can never surprise you.
4. Go to **API Keys → Create Key**, name it `stitch-start`, and copy it. It starts with `sk-ant-`. Treat it like a password: never paste it into chat, email, the app, or GitHub.

The app also limits each person to 20 Claude answers per day (you can change this, see Part 3).

## Part 3: Put the server functions online

These are the two small server programs: `advise` (Ask Claude) and `delete-account`. This part uses the computer's terminal. If you have a developer helping you, this is the part to hand them.

In the project folder:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy advise --no-verify-jwt
npx supabase functions deploy delete-account --no-verify-jwt
```

`YOUR_PROJECT_REF` is the code in your Supabase project's web address, after `/project/`. The `--no-verify-jwt` part is correct: each function checks who is signed in itself.

Then save the Claude key as a server secret. In Supabase, go to **Edge Functions → Secrets** and add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
| `DAILY_ADVICE_LIMIT` (optional) | answers per person per day, default `20` |
| `ANTHROPIC_MODEL` (optional) | default `claude-sonnet-5-5` |

## Part 4: The website (Vercel)

1. Go to **vercel.com**, sign in with GitHub, click **Add New → Project**, and choose the `stitch-start` repository.
2. Under **Environment Variables**, add:
   - `EXPO_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `EXPO_PUBLIC_SUPABASE_KEY` = your Supabase publishable (anon) key
3. Click **Deploy**. The settings in `vercel.json` handle the rest.
4. Copy your new web address (for example `stitch-start.vercel.app`). In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to it, so confirmation emails link to your site.
5. Your privacy policy is now at `your-address/privacy`. Apple and Google both ask for this link.

To use your own domain name later, add it in Vercel under **Settings → Domains**.

## Part 5: The iPhone app

1. Create a free account at **expo.dev**.
2. **Pick your app's permanent ID.** In `app.json`, the iPhone `bundleIdentifier` and Android `package` are set to `com.stitchstart.app`. Change them now if you want something else, such as `com.yourbusiness.stitchstart`. They can't change after the first release.
3. In the terminal, in the project folder:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
4. On **expo.dev**, open the project, go to **Environment variables**, and add the same two `EXPO_PUBLIC_SUPABASE_...` values for the **production** environment.
5. Build and send it to Apple:
   ```bash
   npx eas-cli@latest build --platform ios --profile production
   npx eas-cli@latest submit --platform ios
   ```
   The build asks you to sign in with your Apple Developer account and creates the certificates for you.
6. In **App Store Connect**, fill in the listing: name, description, screenshots, support email, and the privacy policy link. For **App Privacy**, declare: email address and photos/user content, used for app functionality, linked to the user, not used for tracking.
7. In **App Review Information**, give Apple a test account (an email and password you created in the app), so they can sign in and try it.
8. Before submitting for review, install the TestFlight build on your phone and try every screen.

## Part 6: The Android app

1. Sign up at **play.google.com/console** ($25).
2. Build and send it to Google:
   ```bash
   npx eas-cli@latest build --platform android --profile production
   npx eas-cli@latest submit --platform android
   ```
3. Fill in the store listing, privacy policy link, and **Data safety** form (same answers as Apple's App Privacy).
4. **New personal Google Play accounts** must run a closed test with at least 12 testers for 14 days before they can publish to everyone. Start this early, and ask your first users to join.

## Part 7: Before you launch, test these

- [ ] Create an account, confirm the email, sign out, sign back in, and reset the password.
- [ ] Add the Poolin EOC05 and check its fact sheet, threading steps and tension guide.
- [ ] Start a lettering project, add a design picture, save it, and tap **Ask Claude**.
- [ ] Do the same on a phone with the TestFlight or test build.
- [ ] Delete a test account from the Account screen and confirm it's gone in Supabase (**Authentication → Users**).
- [ ] Fill in your support email in `src/app/privacy.tsx` and review the privacy policy wording (ideally with a lawyer).
- [ ] Check the EOC05 details marked in the app against your printed manual.

## Adding more machines

Each machine is one entry in `src/core/machines.ts`. Copy an existing machine, fill every field from the manufacturer's manual and support pages, and list the sources. Then run:

```bash
npm test
```

The tests check that every machine has all four threading guides and its sources. Push the change to GitHub. Vercel updates the website automatically. For the phone apps, publish an over-the-air update with `npx eas-cli@latest update`, or make a new build.

To see which machines people are asking for, open Supabase → **Table Editor → machine_requests**.

## Costs to watch

- **Claude:** each "Ask Claude" answer is a small charge, usually a cent or two with a picture. Check current prices on the Claude pricing page. Your monthly spend limit and the daily limit per person keep this under control.
- **Supabase and Vercel:** free plans cover early testing. Move to paid plans as you grow or start charging customers.
