# Stitch Start

Tell it your machine and your design. It tells you how to set up: fabric, needle, thread, stabilizer, tension, stitch length and sizing, using only the settings your machine actually has. Includes step-by-step threading, bobbin and needle guides for each machine, a tension guide, and "Ask Claude" for a personal review of your design picture and notes.

One codebase builds the **website**, the **iPhone app** and the **Android app** (Expo + React Native). To put it online, follow **[LAUNCH-GUIDE.md](LAUNCH-GUIDE.md)**.

## Run it on your computer

```bash
npm install
npm run web        # opens the website version
npm start          # scan the QR code with the Expo Go app to try it on your phone
```

Without a `.env` file the app runs in demo mode (no accounts, saved on the device, Ask Claude off). To connect it to Supabase, copy `.env.example` to `.env` and fill in the two values.

## Checks

```bash
npm test           # recommendation engine and machine library tests
npm run typecheck  # TypeScript
npm run lint
npm run build:web  # builds the website into dist/
```

## How the code is organized

| Folder | What's in it |
|---|---|
| `src/core/` | Machine library (`machines.ts`), recommendation rules (`engine.ts`), shared types. No app code, so the server uses the same files. |
| `src/app/` | The screens. Each file is a page (Expo Router). |
| `src/ui/` | Building blocks: buttons, cards, the setup card, threading guides, hoop and tension drawings. |
| `src/lib/` | Sign-in (`auth.tsx`), Supabase connection, and saving/loading (`store.ts`). |
| `supabase/migrations/` | Database tables and privacy rules. |
| `supabase/functions/` | Server code: `advise` (calls the Claude API) and `delete-account`. `_shared/` is copied from `src/core` by `npm run sync-core`. |
| `tests/` | Engine tests. |

After editing anything in `src/core/`, run `npm run sync-core` (or `npm test`, which does it for you) so the server gets the same rules.

## Security notes

- The Claude API key lives only in Supabase secrets, never in the app.
- The app sends only a project id to the `advise` function. The server loads the project for the signed-in owner and builds the prompt itself, so the endpoint can't be used as a general Claude proxy.
- Each person can ask Claude a limited number of times per day (`DAILY_ADVICE_LIMIT`, default 20).
- Row Level Security on every table and on the `designs` storage bucket means people can only reach their own data.
