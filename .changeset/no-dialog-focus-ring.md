---
'sphere-plugin': patch
---

Stop painting a focus ring around the prompt panel. Chromium reports `:focus-visible` for the
programmatic `focus()` that follows a pick, so the whole dialog wore a 2 px accent outline on every
pick. The dialog takes focus only to be announced, so it paints none now, while its buttons and
fields keep theirs for keyboard use.
