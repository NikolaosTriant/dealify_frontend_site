# Dealify Landing Page — Codex Execution Context

## Ρόλος σου
Εκτελείς targeted edits σε δύο αρχεία. Δεν αλλάζεις τίποτα εκτός από ό,τι σου ζητείται ρητά.

## Αρχεία που αγγίζεις
- `src/pages/LandingPage.tsx`
- `src/styles/landing.css`

## Stack
- React + Vite + TypeScript
- Pure CSS (no Tailwind) scoped to `.landing-page`
- CSS variables: `--lp-*`
- No GSAP — animations με `@keyframes` + `IntersectionObserver`

## Brand
- Accent: `#00BFA6` (Deal Teal) | Dark: `#007A6B`
- Canvas: `#0C0D11` | Surface: `#13151C` | Elevated: `#1C1F2B`
- Text: `#F9FAFB` / `#6B7280` / `#374151`

## Αρχιτεκτονική σελίδας
```
.landing-page (height:100vh, overflow:hidden, flex column)
  nav.landing-nav (fixed, 56px, flex-shrink:0)
  main.landing-main (flex:1, overflow-y:scroll)
    section.landing-hero
    .snap-dots (fixed, right side)
    .snap-container (scroll-snap-type: y mandatory)
      section.snap-section[data-section-idx="0"]  ← S1 Χάος (phone + copy)
      section.snap-section[data-section-idx="1"]  ← S2 Skill tree + Phone
      section.snap-section[data-section-idx="2"]  ← S3 Payoff
    (landing-closeout, landing-proof, landing-footer → display:none προς το παρόν)
```

## IntersectionObserver
Προσθέτει class `s1-playing` / `s2-playing` / `s3-playing` στο αντίστοιχο section όταν είναι ορατό (threshold: 0.6). Αυτό ενεργοποιεί τα CSS animations.

## Κανόνες
- Μην αλλάζεις keyframe ονόματα χωρίς να ενημερώσεις και τα animation references
- Μην βάζεις Tailwind classes
- Μην αγγίζεις `App.tsx` ή router
- Μετά από κάθε αλλαγή: `npm run build` για να επιβεβαιώσεις ότι δεν υπάρχουν errors
