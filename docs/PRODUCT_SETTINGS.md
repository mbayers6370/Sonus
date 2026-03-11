# Sonus Product Settings

This document records product-level decisions so behavior stays consistent while we ship.

## Related Docs
- `docs/ARCHITECTURE.md` - runtime structure and system boundaries
- `docs/API.md` - backend contract and endpoint reference
- `docs/ENV.md` - environment variables and local defaults

## Progress Model
- No XP system.
- Keep streaks as the motivation primitive.
- Progress state stores and restores current lesson path (`currentBandId`, `currentUnitId`, `currentLessonIdx`).
- Language changes should not auto-reset lesson path.

## Learning Framework Policy
- Use official/recognizable frameworks where possible:
  - Japanese: JLPT-style tiers (N5 -> N1).
- Keep labels learner-friendly in UI (e.g., `Band 3`, not raw IDs).

## Language Selection Policy
- User selects a primary target language during onboarding.
- Ongoing language changes happen in Profile settings.
- Home should behave as a learner dashboard for the current target language.

## Weak Words Policy
- Maintain `word_memory_state` from all quiz and speak attempts.
- Review injection uses weak signals, but lesson content remains intact (append, do not replace core words).
- "Words To Work On" should only show active weak words.
- Remove a word from the visible weak list immediately after a correct attempt in any context (quiz or speak).
- Default display threshold can be tuned with `minTotalMisses` (current API default: 3).

## Pronunciation Scoring Policy
- Compare target vs detected pronunciation by:
  - Initial
  - Final
  - Tone
- Score each independently and show explicit feedback (pass/fail + percentages).
- Keep transcript + detected transliteration visible for learner debugging.

## Home Surface
- Use practical daily cards (resume, streak, spotlight, motivation, shortcuts).
- Phrase/motivation content should rotate at most once per day.
- Tone should remain PG-13 and learner-safe.
