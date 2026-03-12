# Sonus Product Scope

## Decision
Sonus is positioned as a multilingual language-learning platform now.

## What This Means
- Product, docs, and public copy should describe Sonus as multilingual.
- Language-specific features and curricula can ship progressively by track.
- Architecture, routing, and persistence should stay language-aware by default.

## Identity Guardrails
- Do not describe Sonus as a single-language app in top-level docs.
- Keep framework labels tied to the selected language (for example, JLPT/TOPIK/CEFR).
- Keep public pages explicit about whether content is language-specific (for example, Japanese travel phrases) versus global product behavior.

## Implementation Notes
- Frontend routing is standardized on `BrowserRouter` with SPA rewrites.
- Legacy hash deep links are auto-normalized at boot.
- SRS policy logic must stay regression-tested because it affects all language tracks.
