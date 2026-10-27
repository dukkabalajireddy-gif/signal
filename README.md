# Signal

A horizontal **social-listening / demand-signal** tool. You add keywords to track, and
Signal surfaces matching mentions from across social platforms (X, Reddit, communities,
LinkedIn) as scored, actionable signals — so you can reach out the moment demand appears.

The first demo configuration tracks **AI-hiring signals across India** (companies showing
active demand for AI talent), but nothing is hard-coded to that vertical: swap the tracked
keywords and the signal pool in `src/data.ts` and the same UI tracks any topic.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Status

Wizard-of-Oz prototype: the feed, filters, keyword tracking and live activity all work
against convincing seeded data (`src/data.ts`), with new signals streaming in live. Real
data sources (X / Reddit / community APIs), the **Pipeline** board and **Insights** are
the next build steps.
