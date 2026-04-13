# Dealify Landing Page — Consolidated Fixes Pass

Files: `src/pages/LandingPage.tsx` + `src/styles/landing.css`
Build must pass with zero TypeScript errors after all changes.

---

## FIX 1 — Snap lock (architecture fix)

The root problem: `snap-container` has `height: auto; overflow-y: scroll` nested inside `landing-main` which also scrolls. A nested scroll container with `height: auto` never activates scroll-snap. Fix: move scroll-snap to `landing-main`.

### CSS changes

Find and replace:
```css
.landing-page > main,
.landing-main {
  flex: 1;
  overflow-y: scroll;
  scroll-behavior: smooth;
}
```
With:
```css
.landing-page > main,
.landing-main {
  flex: 1;
  overflow-y: scroll;
  scroll-behavior: smooth;
  scroll-snap-type: y proximity;
}
```

Find and replace:
```css
.snap-container {
  height: auto;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
}
```
With:
```css
.snap-container {
  height: auto;
  overflow-y: visible;
  scroll-snap-type: none;
}
```

The `.snap-section` rules stay exactly as-is — `scroll-snap-align: start; scroll-snap-stop: always; height: 100vh` remain unchanged.

Also update the existing overriding rule at line ~1346:
```css
/* FROM: */
.snap-section {
  padding-top: 56px; /* nav height */
}
```
Keep this as-is. No change needed here.

---

## FIX 2 — Hero card: wider + logo bigger

### CSS: hero card width
Find:
```css
.lp-hero-card {
  position: relative;
  width: min(420px, 88vw);
```
Replace `width: min(420px, 88vw)` with `width: min(620px, 90vw)`.

### CSS: hero pills layout (keep them fitting the wider card)
Find `.lp-hero-pills` and ensure it has `max-width: min(620px, 90vw)` added.

### CSS: nav logo — make bigger
Find:
```css
.landing-logo {
  position: relative;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--lp-teal);
  flex: 0 0 auto;
}
```
Replace with:
```css
.landing-logo {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--lp-teal);
  flex: 0 0 auto;
}
```

Find:
```css
.landing-logo__block--light { top: 6px; left: 6px; background: #FFFFFF; }
.landing-logo__block--dark  { right: 6px; bottom: 6px; background: #007A6B; }
```
Replace with:
```css
.landing-logo__block { width: 11px; height: 11px; border-radius: 3px; }
.landing-logo__block--light { top: 7px; left: 7px; background: #FFFFFF; }
.landing-logo__block--dark  { right: 7px; bottom: 7px; background: #007A6B; }
```

Also update `.landing-nav__wordmark` font-size from `15px` to `17px`.

---

## FIX 3 — S1 phone: 3D perspective + bigger

### CSS: remove the scale(0.78) override and add 3D transform

Find:
```css
/* S1 phone sizing in snap context */
.snap-section .phone-wrapper {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  transform: none !important;
  transform-origin: center center;
  scale: 0.78;
}
```
Replace with:
```css
/* S1 phone sizing in snap context */
.snap-section .phone-wrapper {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  transform: perspective(900px) rotateY(14deg) rotateX(3deg) !important;
  transform-style: preserve-3d;
  filter: drop-shadow(-16px 24px 48px rgba(0,0,0,0.7));
}
```

Find:
```css
.phone-frame {
  width: min(320px, 28vw);
  height: min(620px, 72vh);
```
Replace with:
```css
.phone-frame {
  width: min(380px, 32vw);
  height: min(700px, 80vh);
```

Add side-edge highlight to phone-frame (append after existing `.phone-frame` rule):
```css
.phone-frame::after {
  content: '';
  position: absolute;
  left: 0;
  top: 8%;
  bottom: 8%;
  width: 3px;
  background: linear-gradient(to bottom,
    rgba(255,255,255,0.0) 0%,
    rgba(255,255,255,0.12) 30%,
    rgba(255,255,255,0.20) 50%,
    rgba(255,255,255,0.12) 70%,
    rgba(255,255,255,0.0) 100%
  );
  border-radius: 2px 0 0 2px;
  z-index: 10;
  pointer-events: none;
}
```

---

## FIX 4 — S3 payoff: bigger numbers, better use of space

### CSS changes

Find:
```css
.s3-big-number {
  font-size: 64px;
  font-weight: 900;
  color: #F9FAFB;
  letter-spacing: -4px;
  line-height: 1;
}
```
Replace with:
```css
.s3-big-number {
  font-size: 110px;
  font-weight: 900;
  color: #F9FAFB;
  letter-spacing: -6px;
  line-height: 1;
}
```

Find:
```css
.s3-check-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(0,191,166,0.4);
  background: rgba(0,191,166,0.07);
  display: flex;
  align-items: center;
  justify-content: center;
}
.s3-check-icon {
  font-size: 26px;
  color: #00BFA6;
}
```
Replace with:
```css
.s3-check-ring {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 2px solid rgba(0,191,166,0.45);
  background: rgba(0,191,166,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.s3-check-icon {
  font-size: 38px;
  color: #00BFA6;
}
```

Find:
```css
.s3-stat-val {
  font-size: 20px;
  font-weight: 800;
  color: rgba(0,191,166,0.8);
}
.s3-stat-label {
  font-size: 8px;
  color: rgba(107,114,128,0.55);
}
```
Replace with:
```css
.s3-stat-val {
  font-size: 28px;
  font-weight: 900;
  color: rgba(0,191,166,0.85);
  letter-spacing: -1px;
}
.s3-stat-label {
  font-size: 10px;
  color: rgba(107,114,128,0.7);
  margin-top: 2px;
}
```

Find:
```css
.s3-number-label {
  font-size: 10px;
  color: rgba(0,191,166,0.5);
  letter-spacing: 2px;
  text-transform: uppercase;
}
```
Replace with:
```css
.s3-number-label {
  font-size: 13px;
  color: rgba(0,191,166,0.6);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 4px;
}
```

Find:
```css
.s3-stats-row {
  display: flex;
  gap: 20px;
  margin-top: 4px;
}
```
Replace with:
```css
.s3-stats-row {
  display: flex;
  gap: 24px;
  margin-top: 16px;
}
```

### JSX: add stagger animation IDs to S3 stats

In the S3 section, find the three stat divs:
```jsx
<div className="s3-stats-row">
  <div className="s3-stat">
    <div className="s3-stat-val">0</div>
    <div className="s3-stat-label">τηλεφωνήματα</div>
  </div>
  <div className="s3-stat-divider" />
  <div className="s3-stat">
    <div className="s3-stat-val">0</div>
    <div className="s3-stat-label">χαμένα email</div>
  </div>
  <div className="s3-stat-divider" />
  <div className="s3-stat">
    <div className="s3-stat-val">6</div>
    <div className="s3-stat-label">μέλη ομάδας</div>
  </div>
</div>
```
Replace with:
```jsx
<div className="s3-stats-row" id="s3-stats-row">
  <div className="s3-stat s3-stat--anim" style={{'--si': 0} as React.CSSProperties}>
    <div className="s3-stat-val" data-target="0">0</div>
    <div className="s3-stat-label">τηλεφωνήματα</div>
  </div>
  <div className="s3-stat-divider" />
  <div className="s3-stat s3-stat--anim" style={{'--si': 1} as React.CSSProperties}>
    <div className="s3-stat-val" data-target="0">0</div>
    <div className="s3-stat-label">χαμένα email</div>
  </div>
  <div className="s3-stat-divider" />
  <div className="s3-stat s3-stat--anim" style={{'--si': 2} as React.CSSProperties}>
    <div className="s3-stat-val" data-target="6">0</div>
    <div className="s3-stat-label">μέλη ομάδας</div>
  </div>
</div>
```

Also add an ID to the big number:
```jsx
<div className="s3-big-number" id="s3-big-number">47</div>
```

### CSS: S3 stat stagger animation

Append to end of landing.css:
```css
/* ─── S3 STAT STAGGER ─── */
.s3-stat--anim {
  opacity: 0;
  transform: translateY(10px);
}
.s3-stat--anim.s3-stat--visible {
  animation: s3-stat-in 0.5s ease forwards;
  animation-delay: calc(var(--si, 0) * 200ms + 300ms);
}
@keyframes s3-stat-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### JS: add S3 stat animation useEffect

Add this as a new useEffect block before the JSX return, after the existing useEffects:

```typescript
useEffect(() => {
  const statsRow = document.getElementById('s3-stats-row');
  if (!statsRow) return;

  let rafIds: number[] = [];

  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();

      const statEls = statsRow.querySelectorAll<HTMLElement>('.s3-stat--anim');
      statEls.forEach((el) => el.classList.add('s3-stat--visible'));

      // Count-up for any stat-val with data-target > 0
      statsRow.querySelectorAll<HTMLElement>('.s3-stat-val[data-target]').forEach((el, i) => {
        const target = parseInt(el.dataset.target || '0', 10);
        if (target === 0) { el.textContent = '0'; return; }
        const delay = i * 200 + 400;
        const duration = 900;
        const startTime = performance.now() + delay;

        function tick(now: number) {
          if (now < startTime) { rafIds.push(requestAnimationFrame(tick)); return; }
          const t = Math.min((now - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(ease * target));
          if (t < 1) rafIds.push(requestAnimationFrame(tick));
        }
        rafIds.push(requestAnimationFrame(tick));
      });
    },
    { threshold: 0.6 }
  );

  io.observe(statsRow);
  return () => {
    io.disconnect();
    rafIds.forEach(cancelAnimationFrame);
  };
}, []);
```

---

## FIX 5 — Showcase: bigger frame + smoother sticky

### CSS: larger frame height
Find:
```css
.lp-sc-screen {
  display: none;
  height: 340px;
  overflow: hidden;
  animation: lp-sc-screen-in 0.35s ease;
}
```
Replace `height: 340px` with `height: 440px`.

### CSS: sticky frame top offset
Find:
```css
.lp-sc-sticky-wrap {
  flex: 0 0 52%;
  position: sticky;
  top: 80px;
}
```
Replace with:
```css
.lp-sc-sticky-wrap {
  flex: 0 0 52%;
  position: sticky;
  top: 72px;
  align-self: flex-start;
  max-height: calc(100vh - 88px);
}
```

### JS: update showcase IntersectionObserver threshold for smoother follow
In the showcase useEffect, find:
```typescript
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = parseInt(
          (entry.target as HTMLElement).dataset.idx ?? '0'
        );
        activate(idx);
        desktopItems.forEach((el, i) =>
          el.classList.toggle('lp-sc-item--active', i === idx)
        );
      }
    });
  },
  { threshold: 0.55 }
);
```
Replace `threshold: 0.55` with `threshold: 0.4` and add `rootMargin: '-10% 0px -10% 0px'`:
```typescript
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = parseInt(
          (entry.target as HTMLElement).dataset.idx ?? '0'
        );
        activate(idx);
        desktopItems.forEach((el, i) =>
          el.classList.toggle('lp-sc-item--active', i === idx)
        );
      }
    });
  },
  { threshold: 0.4, rootMargin: '-10% 0px -10% 0px' }
);
```

---

## FIX 6 — Remove stat bar entirely

### JSX: delete the lp-stat-bar div
Find and delete this entire block:
```jsx
{/* ── TRANSITION STRIP ─────────────────────────────────────────────────── */}
<div className="lp-stat-bar" id="lp-stat-bar">
  {[
    { value: 47, suffix: '',  label: 'μέρες κατά μέσο όρο' },
    { value: 0,  suffix: '',  label: 'χαμένα email' },
    { value: 6,  suffix: '+', label: 'ρόλοι ανά deal' },
    { value: 1,  suffix: '',  label: 'link — όλα μέσα' },
  ].map((s, i) => (
    <div className="lp-stat-bar__item" key={i}>
      <div className="lp-stat-bar__number-row">
        <span className="lp-stat-bar__value" data-target={s.value}>0</span>
        {s.suffix && (
          <span className="lp-stat-bar__suffix">{s.suffix}</span>
        )}
      </div>
      <span className="lp-stat-bar__label">{s.label}</span>
    </div>
  ))}
</div>
```

### JS: also remove the stat bar counter useEffect
In the third useEffect, find and delete this block (the stat bar part only, keep the sticky bar part):
```typescript
// ── Stat counter animation ─────────────────────────────────
const statBar = document.getElementById('lp-stat-bar');
let statRafIds: number[] = [];
let statObserver: IntersectionObserver | null = null;

if (statBar) {
  statObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      statBar.querySelectorAll<HTMLElement>('.lp-stat-bar__value').forEach((el) => {
        const target = parseInt(el.dataset.target || '0', 10);
        if (target === 0) { el.textContent = '0'; return; }
        const duration = 1200;
        const start = performance.now();
        function tick(now: number) {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(ease * target));
          if (t < 1) statRafIds.push(requestAnimationFrame(tick));
        }
        statRafIds.push(requestAnimationFrame(tick));
      });
      statObserver?.disconnect();
    },
    { threshold: 0.5 }
  );
  statObserver.observe(statBar);
}
```

Also remove `statRafIds` and `statObserver` from the cleanup:
```typescript
// FROM:
return () => {
  statObserver?.disconnect();
  snapObs?.disconnect();
  statRafIds.forEach((id) => cancelAnimationFrame(id));
};
// TO:
return () => {
  snapObs?.disconnect();
};
```

---

## FIX 7 — Sticky bar: hide when footer is visible

### JS: update the sticky bar useEffect to also observe footer

Find in the third useEffect:
```typescript
if (stickyBar && snapContainer) {
  snapObs = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        stickyBar.classList.add('lp-sticky-bar--visible');
      } else {
        stickyBar.classList.remove('lp-sticky-bar--visible');
      }
    },
    { threshold: 0.05 }
  );
  snapObs.observe(snapContainer);
}
```

Replace with:
```typescript
const footer = document.querySelector<HTMLElement>('.lp-footer');
let footerObs: IntersectionObserver | null = null;

if (stickyBar && snapContainer) {
  snapObs = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        stickyBar.classList.add('lp-sticky-bar--visible');
      } else {
        stickyBar.classList.remove('lp-sticky-bar--visible');
      }
    },
    { threshold: 0.05 }
  );
  snapObs.observe(snapContainer);
}

if (stickyBar && footer) {
  footerObs = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        stickyBar.classList.remove('lp-sticky-bar--visible');
      }
    },
    { threshold: 0.1 }
  );
  footerObs.observe(footer);
}
```

Also update the cleanup return:
```typescript
// FROM:
return () => {
  snapObs?.disconnect();
};
// TO:
return () => {
  snapObs?.disconnect();
  footerObs?.disconnect();
};
```

---

## FIX 8 — Hero: add animated notifications around deal card

### JSX: add floating notifications inside lp-hero-card-wrap, before the card

Find inside `.lp-hero-card-wrap`:
```jsx
<div className="lp-hero-card-glow" aria-hidden="true" />

<div className="lp-hero-card">
```

Replace with:
```jsx
<div className="lp-hero-card-glow" aria-hidden="true" />

{/* Floating notifications */}
<div className="lp-hero-notif lp-hero-notif--1" aria-hidden="true">
  <div className="lp-hero-notif-dot" style={{background:'#4ADE80'}} />
  <span>Αλεξάνδρα · Πιστ. Βαρών ολοκληρώθηκε</span>
</div>
<div className="lp-hero-notif lp-hero-notif--2" aria-hidden="true">
  <div className="lp-hero-notif-dot" style={{background:'#00BFA6'}} />
  <span>Πέτρος · Τοπογραφικό ανεβλήθηκε</span>
</div>
<div className="lp-hero-notif lp-hero-notif--3" aria-hidden="true">
  <div className="lp-hero-notif-dot" style={{background:'#60A5FA'}} />
  <span>Κ. Σπύρου · Εκκαθαριστικό σε έλεγχο</span>
</div>
<div className="lp-hero-notif lp-hero-notif--4" aria-hidden="true">
  <div className="lp-hero-notif-dot" style={{background:'#F59E0B'}} />
  <span>Deal · Κλείσιμο σε 3 μέρες</span>
</div>

<div className="lp-hero-card">
```

### CSS: append notification styles

```css
/* ─── HERO FLOATING NOTIFICATIONS ─── */
.lp-hero-card-wrap {
  position: relative;
}

.lp-hero-notif {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
}

.lp-hero-notif-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lp-hero-notif--1 {
  top: 20px;
  left: -20px;
  background: rgba(74,222,128,0.08);
  border-color: rgba(74,222,128,0.22);
  color: #4ADE80;
  animation: lp-notif-pop 5s ease 0.5s infinite;
}
.lp-hero-notif--2 {
  top: 80px;
  right: -10px;
  background: rgba(0,191,166,0.08);
  border-color: rgba(0,191,166,0.25);
  color: #00BFA6;
  animation: lp-notif-pop 5s ease 1.5s infinite;
}
.lp-hero-notif--3 {
  bottom: 140px;
  left: -10px;
  background: rgba(96,165,250,0.08);
  border-color: rgba(96,165,250,0.22);
  color: #60A5FA;
  animation: lp-notif-pop 5s ease 2.5s infinite;
}
.lp-hero-notif--4 {
  bottom: 80px;
  right: -20px;
  background: rgba(245,158,11,0.08);
  border-color: rgba(245,158,11,0.22);
  color: #F59E0B;
  animation: lp-notif-pop 5s ease 3.5s infinite;
}

@keyframes lp-notif-pop {
  0%   { opacity: 0; transform: translateY(6px) scale(0.95); }
  10%  { opacity: 1; transform: translateY(0) scale(1); }
  70%  { opacity: 1; transform: translateY(0) scale(1); }
  85%  { opacity: 0; transform: translateY(-4px) scale(0.97); }
  100% { opacity: 0; }
}

/* On smaller screens, hide side notifications */
@media (max-width: 900px) {
  .lp-hero-notif { display: none; }
}
```

---

## Notes

1. The `lp-footer` class must exist on the footer element (it already does: `<footer className="lp-footer">`).
2. The `footerObs` variable must be declared in the same scope as `snapObs` — add it alongside the existing let declarations.
3. Do NOT change any snap-section JSX structure or S1/S2/S3 content — only CSS and useEffect changes.
4. The `--si` CSS variable on `.s3-stat--anim` requires React's `CSSProperties` cast: `style={{'--si': 0} as React.CSSProperties}`.
5. After removing the stat bar, the flow is: `showcase → cta → footer`.
