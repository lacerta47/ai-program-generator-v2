# AI Program Generator project instructions

This repository is the active Next.js 15 implementation of the AI Program
Generator. The legacy `../ai-프로그램-생성기/` mockup is reference-only: do not
develop there and never reintroduce its backdoor, plaintext-password, or
unauthenticated Cloud Function patterns.

## Read first when relevant

- For product or UI work, read `../PRODUCT.md` and `../DESIGN.md` before
  changing code. They define the primary users (children aged 7–10), tone,
  accessibility requirements, and design tokens.
- Existing design and implementation history is in
  `docs/superpowers/specs/` and `docs/superpowers/plans/`. Treat completed
  plans as history, not as a request to repeat their work.
- Treat local `.env.local` and `serviceAccountKey.json` as secrets. Do not
  read, print, commit, upload, or copy their values.

## Commands

Run all commands from this repository root.

```powershell
npm run dev
npm test
./node_modules/.bin/tsc --noEmit
npm run build
npm run check-key
node scripts/set-admin.mjs <email>
firebase deploy --only firestore:rules,firestore:indexes
```

- Do not run `npm run build` while the dev server is running because both use
  `.next`.
- Use the local `./node_modules/.bin/tsc --noEmit`; do not use `npx tsc`.
- Unit tests use Vitest and cover pure `lib/**/*.test.ts` logic. For a change
  to pure logic, add or update a focused test.
- Use one-off, uncommitted `scripts/selftest-*.mjs` scripts only when an
  integration check needs seeded data. Clean up their seeds. Firestore rules
  must be tested through the client SDK because Admin SDK bypasses rules.

## Architecture boundaries

- The app uses only the `lib/ai/types.ts` contract. Provider selection belongs
  only in `lib/ai/provider.ts`; Gemini parsing, schema mode, and retries stay
  encapsulated in `lib/ai/gemini.ts`.
- AI calls are server-only through `app/api/generate/route.ts`. Never expose
  provider keys to the client. Ignore client-supplied system prompts; select
  server prompts by the allowed `variant` key.
- Keep Firebase client initialization in `lib/firebase/client.ts`. Preserve
  cursor pagination and update `firestore.indexes.json` when a query shape
  changes.
- Authorization is enforced by `firestore.rules`, not UI state. Custom claims
  define admin, teacher, and student roles. `useAuth().isAdmin` is display-only.
- For `requireAdmin` and `requireTeacher`, use this exact success/error gate:

```ts
const gate = await requireX(req);
if (gate instanceof NextResponse) return gate;
```

- For new authenticated client calls, use `authedJson` or `authedFetch` from
  `lib/client/authedFetch.ts`; do not hand-roll ID-token bearer requests.

## Security invariants

- Do not weaken `/api/generate` authentication, quota reservation/refund, or
  server-side counters.
- Generated previews must remain an isolated cross-origin iframe obtained via
  `POST /api/preview`, with `sandbox="allow-scripts"`. Never revert to
  `srcDoc` or a same-origin fallback.
- Preserve Firestore field allowlists, ownership checks, category validation,
  moderation, counter protections, and schema/index/rules consistency.
- When changing Firestore queries or document schemas, update and validate the
  relevant rules and indexes before deployment.

## UI and product rules

- Build every screen from `components/ui/` primitives. Do not scatter
  one-off styles when a primitive should be extended.
- Use the CSS variables and Tailwind v4 theme in `app/globals.css`; there is
  no separate Tailwind configuration file.
- The UI serves children aged 7–10: Korean microcopy uses easy `~해요` wording,
  body text is at least 17px, touch targets are at least 44x44px, and focus
  states are obvious.
- Preserve light and dark mode, contrast requirements, and a
  `prefers-reduced-motion` alternative for every new animation.
- No decorative emoji or external mascot assets. `BuilderBot` is the sole
  approved mascot exception. Gradient text is reserved for the LUN wordmark.
- Render modals with `createPortal(..., document.body)`. Keep
  `suppressHydrationWarning` on the root HTML element, and do not remove the
  custom text-input cursor rule in `globals.css`.

## Project workflow

- Inspect the working tree before editing. It may contain user-owned,
  uncommitted files; leave unrelated changes untouched.
- Before a push or pull request, inspect the diff and run the proportionate
  checks. For meaningful application changes, run type checking and a
  production build when the dev server is stopped.
- If the user says to keep something as-is, preserve all of its details rather
  than making adjacent cleanup changes.
