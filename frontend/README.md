# frontend/

Next.js 14 (app router) UI. Design tokens in `src/app/globals.css` + `tailwind.config.ts` (A15.1 — no ad-hoc colors); trust rules are enforced in `src/components/` (confidence badges, paraphrased employee evidence, facts-only why-lines). Entry: `npm run dev`; screens under `src/app/w/[slug]/` (admin) and `src/app/i/[token]/` (respondent); mocks in `src/lib/mocks.ts` are display-only and die as live endpoints land — conversation paths never mock.
