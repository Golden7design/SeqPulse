# SeqPulse Design Overhaul — Changelog

**Date:** 2026-02-23
**Version:** 2.0
**Designer:** Satoru
**Scope:** Complete visual identity & design system refresh

---

## What Changed

### Color System

#### ✅ New Primary Identity
- **Before:** Generic gray-blue (`oklch(0.216 0.006 56.043)`)
- **After:** Trust blue-green (`oklch(0.55 0.12 180)` light, `oklch(0.62 0.14 180)` dark)
- **Why:** Signals trust + precision. Not another generic SaaS blue.

#### ✅ Semantic Verdict Colors
Three calibrated colors that communicate status without alarm:

| Verdict | Before | After |
|---------|--------|-------|
| OK | Green `oklch(0.646 0.222 41)` | Flow confidence `oklch(0.65 0.14 150)` |
| Warning | Orange `oklch(0.828 0.189 84)` | Caution `oklch(0.70 0.12 65)` |
| Rollback | Red `oklch(0.577 0.245 27)` | Action required `oklch(0.60 0.18 30)` |

**Benefit:** Colors reinforce meaning. Green = "you're good," not "everything perfect."

#### ✅ Dark Mode Depth
- **Before:** Simple inversion, flat black backgrounds
- **After:** Layered navy with rich contrast (`oklch(0.12 0.015 220)` background)
- **Benefit:** Eye-friendly at night, professional, depth without distraction

### Animations & Micro-Interactions

#### ✅ New Animations
- `card-lift` — Cards rise slightly on hover (200ms)
- `status-pulse` — Live status indicators breathe gently (2s)
- `status-glow-*` — Verdict badges glow with semantic color (2s)
- `live-dot` — Running deployments show animated dot (1.5s)
- `slide-in-up` — New content slides up (300ms)
- `fade-in` — Smooth entry (200ms)

#### ✅ Interaction States
All components now have purposeful hover/focus states:
- Cards: Border brightens + shadow lifts
- Badges: Background darkens on hover
- Buttons: Outline fades, background appears
- SDH items: Border appears + subtle background tint

### Component Updates

#### ✅ Section Cards (`section-cards.tsx`)
- Hover states with color-coded border tints
- Verdict-specific border highlights (green/orange/red)
- Smoother transitions (300ms)
- Better typography hierarchy (uppercase labels, smaller metadata)
- Live deployment card with pulsing blue indicator

#### ✅ Latest SDH (`latest-sdh.tsx`)
- Added severity badges to each item
- Hover animations on icons (scale 110%)
- Better empty state with icon + descriptive text
- Metric display for context
- Improved typography (smaller, cleaner)

#### ✅ Color Utilities (`lib/color-utils.ts`)
New helper functions for verdict colors:
- `getVerdictColor(type, variant)` — Returns semantic color
- `getVerdictGlowAnimation(type)` — Returns animation keyframe
- Light/dark mode awareness built-in

### Documentation

#### ✅ Design System Document
Created `docs/DESIGN_SYSTEM.md`:
- Color palette with rationale
- Typography hierarchy
- Spacing & layout system
- Component specifications
- Animation timing scale
- State management
- Accessibility guidelines
- Future enhancement phases

#### ✅ Design Decisions Log
Every major decision documented with rationale.

---

## Migration Guide

### For Developers

No breaking changes — all updates are additive and use CSS custom properties.

#### Using Verdict Colors
```tsx
import { getVerdictColor } from "@/lib/color-utils"

return (
  <Badge className={getVerdictBadgeClasses("warning", 5.2)}>
    <IconTrendingDown /> +5.2%
  </Badge>
)
```

#### Adding Card Hovers
```tsx
// Before
<Card>

// After
<Card className="group hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 transition-all duration-300">
  <CardHeader>
    {/* ... */}
  </CardHeader>
</Card>
```

#### Live Status Indicators
```tsx
{isRunning && (
  <span className="mr-1.5 h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
)}
```

### For Designers

#### Color References
- Primary: `--primary` OKLCH variable
- Verdict colors: `--verdict-ok`, `--verdict-warning`, `--verdict-rollback`
- Chart colors: `--chart-1` through `--chart-5`

#### Animation Timing
- Hover/focus: 200-300ms
- Status pulses: 2000ms
- Entry animations: 200-300ms

---

## Testing & Validation

### Contrast Ratios
All color pairs meet WCAG AA:
- Normal text: >4.5:1
- Large text: >3:1
- UI controls: >3:1

### Reduced Motion
Users preferring reduced motion see:
- No pulse animations
- Instant transitions (no lift/fade)
- Static status indicators

### Dark Mode
Tested across:
- Light mode (default)
- Dark mode (class-based toggle)
- Auto mode (system preference)

---

## Performance Impact

**Bundle size:** ~0KB (pure CSS)
**Animations:** GPU-accelerated transforms only
**No external dependencies:** Uses Tailwind + custom CSS

---

## Rollback Plan

If issues arise, revert these files:
1. `app/globals.css` — Color variables + animations
2. `tailwind.config.ts` — Tailwind color config
3. `components/section-cards.tsx` — Verdict card updates
4. `components/latest-sdh.tsx` — SDH list updates
5. `lib/color-utils.ts` — Helper utilities

**Backup:** All original files remain in git history.

---

## Next Steps (Phase 2)

### Short-term (1-2 weeks)
- [ ] Custom SVG icons for verdict states
- [ ] Staggered grid entry animations
- [ ] Smooth state transitions between deployment states
- [ ] Enhanced chart tooltips with verdict context

### Medium-term (3-4 weeks)
- [ ] Framer Motion integration for complex transitions
- [ ] Interactive deployment timeline
- [ ] Real-time status stream UI
- [ ] Custom cursor for verdict hover states

### Long-term (1-2 months)
- [ ] Comprehensive animation library
- [ ] Advanced data visualizations
- [ ] Notification system with motion design
- [ ] Onboarding flow with playful animations

---

## Feedback & Iteration

This design system is **not** final — it's a foundation. Expect refinements based on:
- User testing results
- Performance metrics
- A/B testing on key flows
- Design review cycles

**Suggestion format:** Use project issue tracker with `design-system` label.

---

## Acknowledgments

- **Tailwind v4** for native OKLCH support
- **Satoshi font** (Designers Foundry)
- **Inter font** (Jonas Nießner)
- **Shadcn UI** for base component structure

---

*Designed with calm precision by Satoru — 2026-02-23*