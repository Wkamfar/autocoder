# Accessibility Checklist (Wire2 Frontend)

**Owner:** Agent 2 (Frontend) + Agent 1 (UX)  
**Last updated:** 2026-01-14

This is the focused a11y regression list for the Wire2 UI.

## Modal/dialog checklist (must pass)

- **Role + labeling**
  - Dialog uses `role="dialog"` and `aria-modal="true"`
  - Dialog has a stable label via `aria-labelledby` (or `aria-label`)
- **Focus management**
  - Focus moves into the dialog on open
  - Focus is **trapped** within the dialog while open (Tab/Shift+Tab loops)
  - Focus returns to the triggering element on close (recommended)
- **Keyboard exits**
  - `Escape` closes (unless intentionally blocked)
  - Backdrop click closes (only if allowed; never closes when clicking inside panel)
- **No background interaction**
  - Background scroll is locked while open
  - Background controls are not reachable via keyboard

Reference implementation:

- `wire2/frontend/src/wire/ui/WireModal.tsx`

## Page-level checklist

- **Keyboard-only walkthrough**
  - `/v2/login`, `/v2/intents`, `/v2/intents/:id`, `/v2/approvals`, `/v2/onboarding/voice`
  - All primary actions reachable and usable with keyboard only
- **Visible focus**
  - Focus rings visible on buttons/inputs/links
- **Color/contrast**
  - Text and controls meet minimum contrast ratios
- **Error states**
  - Errors are announced in a readable way (no “only color” indicators)
  - Inline field errors are associated with inputs

## Quick manual test protocol (10 minutes)

- Open a modal and press Tab until it cycles; ensure it never escapes the modal.
- Press Shift+Tab from the first focusable element; it should wrap to the last.
- Press Escape; modal closes.
- Try scrolling background; it should stay locked while modal is open.

