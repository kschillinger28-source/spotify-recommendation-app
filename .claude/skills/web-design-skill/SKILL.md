---
name: web-design-skill
description: Web UI design and frontend quality guidance from Vercel's agent-skills. Use when asked to review a UI, audit accessibility/UX, check a site against web interface guidelines, apply React/Next.js performance or composition patterns, add view transitions, review docs prose, or deploy/optimize on Vercel.
---

# Web Design Skill

Bundle of Vercel's open-source agent skills (https://github.com/vercel-labs/agent-skills, MIT). Each sub-skill lives in `skills/<name>/SKILL.md` — read the matching one before starting, then follow it.

| Need | Read |
|------|------|
| Review UI code for interface/accessibility/UX compliance (default for "review my UI") | `skills/web-design-guidelines/SKILL.md` |
| React/Next.js performance optimization | `skills/react-best-practices/SKILL.md` |
| Component architecture, compound components, avoiding boolean-prop sprawl | `skills/composition-patterns/SKILL.md` |
| Smooth animations via React View Transitions | `skills/react-view-transitions/SKILL.md` |
| React Native / Expo (relevant to `mobile/` here) | `skills/react-native-skills/SKILL.md` |
| Review docs/prose | `skills/writing-guidelines/SKILL.md` |
| Vercel cost/performance tuning | `skills/vercel-optimize/SKILL.md` |
| Deploy to Vercel | `skills/deploy-to-vercel/SKILL.md`, `skills/vercel-cli-with-tokens/SKILL.md` |

Notes:
- `web-design-guidelines` fetches its rules live from GitHub at review time (needs network).
- For generative visual direction (avoiding generic-looking UI), pair with the `taste-skill`.
- Upstream overview: `UPSTREAM-README.md`.
