# SeqPulse Design System

**Version:** 2.0
**Created:** 2026-02-23
**Designer:** Satoru (AI Senior)
**Vision:** "L'outil de confiance pour les équipes qui craignent de casser la prod"

---

## Core Principles

1. **Calm & Precise** — Information density without visual noise
2. **Safety-Forward** — Status communication that inspires confidence
3. **Semantic, Not Alarmist** — Colors reinforce meaning without drama
4. **Micro-Interaction Rich** — Subtle animations that guide attention
5. **Dark Mode Depth** — Rich contrast, not just inverted light mode

---

## Color Palette

### Primary Identity — Trust Blue-Green

```
Light: oklch(0.55 0.12 180)
Dark: oklch(0.62 0.14 180)
```

A calibrated blue-green that signals:
- ✅ Trustworthiness (green component)
- ✅ Technical precision (blue component)
- ✅ Dev/Infro familiarity (industry standard palette)

### Verdict Colors — Semantic Status

These aren't just red/orange/green — they're purposeful semantic signals.

#### OK — Flow Confidence
```
Light: oklch(0.65 0.14 150)
Dark: oklch(0.72 0.15 150)
```
*Green-adjacent but not generic "success green." Signals "you're good to keep going."*

#### Warning — Caution, Not Panic
```
Light: oklch(0.70 0.12 65)
Dark: oklch(0.78 0.13 65)
```
*Warm amber-orange. Visible but not alarming. "Check this when convenient."*

#### Rollback — Action Required
```
Light: oklch(0.60 0.18 30)
Dark: oklch(0.70 0.20 30)
```
*Clear red, calibrated for visibility. "This needs attention now."*

### Supporting Palette

| Purpose | Light | Dark |
|---------|-------|------|
| Background | `oklch(0.99 0.003 95)` | `oklch(0.12 0.015 220)` |
| Card | `oklch(1 0 0)` | `oklch(0.18 0.018 220)` |
| Muted | `oklch(0.96 0.005 220)` | `oklch(0.22 0.015 220)` |
| Border | `oklch(0.90 0.008 220)` | `oklch(0.25 0.02 220)` |

**Note:** Dark mode uses deeper, richer backgrounds instead of simple black, with layered borders for depth perception.

---

## Typography

### Font Stack

- **Primary:** Satoshi (Bold/Semibold) — Headers, nav, CTAs
- **Body:** Inter (Regular/Medium) — Content, labels, UI text
- **Monospace:** Geist Mono — Metrics, deployment numbers, code

### Scale

```
H1: 2xl (24px) / Satoshi Bold 600
H2: xl (20px) / Satoshi Bold 600
H3: lg (18px) / Satoshi Bold 600
Body Base: sm (14px) / Inter Regular 400
Small: xs (12px) / Inter Medium 500
Mono: sm (14px) / Geist Mono
```

### Hierarchy Rules

1. **All headers** → Satoshi Bold
2. **Numbers/tabular** → Geist Mono
3. **Everything else** → Inter Regular
4. **Never mix fonts** within the same visual level

---

## Spacing & Layout

### Grid System

```
Mobile: 1 column
Tablet: 2 columns (@xl/main)
Desktop: 3 columns (@5xl/main)
Wide: 4 columns (with live deployment)
```

### Container Padding

```
Mobile: px-4 (16px)
Tablet+: px-6 (24px)
```

### Gap System

```
Tight: gap-2 (8px) — Related items
Default: gap-4 (16px) — Section spacing
Loose: gap-6 (24px) — Major sections
```

---

## Components

### Cards

**Base State:**
- Border: `border-border/60`
- Shadow: None
- Radius: `--radius` (0.625rem)

**Hover State:**
- Border: `border-border` (fully visible)
- Shadow: `shadow-md` or `dark:shadow-lg dark:shadow-black/20`
- Translate: `translateY(-2px)` (subtle lift)

**Verdict-Specific Hover:**
- OK cards → Green border tint
- Warning cards → Orange border tint
- Rollback cards → Red border tint

### Badges

**Verdict Badges:**
```
Background: color/10
Text: color
Hover: color/15
Transition: 300ms
```

**Live Status Badges:**
- Spinning dot when running/pending
- Static dot when finished/analyzed
- Animation: `live-dot` keyframe

### Buttons

**Primary (CTA):**
- Background: `--primary`
- Hover: `opacity-90`
- Radius: `--radius`

**Secondary/Outline:**
- Border: `border-border`
- Hover: `border-transparent bg-black/0.04 dark:bg-white/0.08`
- Transition: `200ms`

---

## Animations

### Duration Scale

```
Instant: 100ms — Toggle states
Short: 200ms — Hover, focus
Default: 300ms — Card hover, badge hover
Long: 2000ms — Status pulse, glow
```

### Keyframe Animations

#### Card Lift
```css
@keyframes card-lift {
  0% {
    transform: translateY(0);
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  }
  100% {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
}
```

#### Status Pulse (Rollback)
```css
@keyframes status-glow-rollback {
  0%, 100% {
    box-shadow: 0 0 0 0 hsla(30, 70%, 50%, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px hsla(30, 70%, 50%, 0);
  }
}
```

#### Live Dot
```css
@keyframes live-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}
```

---

## States & Feedback

### Deployment States

| State | Visual Treatment | Animation |
|-------|------------------|-----------|
| Pending | Static badge | — |
| Running | Spinning dot (blue) | `animate-spin` + pulse |
| Finished | Static badge (blue) | fade in 200ms |
| Analyzed | Verdict color | slide-in-up 300ms |

### Verdict Transitions

When a deployment verdict updates:
1. **Fade out** current status (150ms)
2. **Swap color** (instant)
3. **Fade in** new status (150ms)
4. **Glow pulse** (if rollback/warning, 2s)

---

## File Structure

```
frontend/
├── app/globals.css              # CSS variables + custom animations
├── lib/color-utils.ts            # Verdict color utilities
├── tailwind.config.ts           # Tailwind colors + theme
└── components/
    ├── section-cards.tsx       # Verdict cards (updated)
    ├── latest-sdh.tsx           # SDH list (updated)
    └── ui/                      # Base components (shadcn)
```

---

## Usage Patterns

### Verdict Badges

```tsx
import { getVerdictColor, type VerdictType } from "@/lib/color-utils"

<Badge
  variant="outline"
  className={getVerdictBadgeClasses(verdictType, changePct)}
>
  {icon} {label}
</Badge>
```

### Card Hovers

```tsx
<Card className="group transition-all duration-300 hover:shadow-lg">
  {/* Card content */}
</Card>
```

### Live Indicators

```tsx
{isLive && (
  <span className="mr-1.5 h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
)}
```

---

## Dark Mode Considerations

### Color Adjustments

Dark mode is **not** a simple inversion:
- Backgrounds are deep navy (`oklch(0.12 0.015 220)`)
- Borders have higher opacity for edge definition
- Verdict colors are slightly brighter for contrast
- Shadows use black with 20% opacity

### Depth Layering

```
Background: 0.12 L* (deepest)
Card: 0.18 L* (one level up)
Hover: 0.22 L* (accent)
Input: 0.28 L* (interactive)
```

---

## Accessibility

### Contrast

All foreground/background pairs meet WCAG AA:
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- UI controls: 3:1 minimum

### Focus States

All interactive elements have visible focus rings using `--ring` color.

### Reduced Motion

Users with `prefers-reduced-motion` will see:
- Static status indicators (no pulsing)
- Instant hover transitions (no lift)
- No fade animations

---

## Future Enhancements

### Phase 2 (Next)
- [ ] Custom icons for verdict states (SVG)
- [ ] Staggered entry animations for card grids
- [ ] Smooth state transitions between deployment states
- [ ] Enhanced chart tooltips with verdict context

### Phase 3
- [ ] Motion design system (Framer Motion integration)
- [ ] Interactive deployment timeline
- [ ] Real-time status stream
- [ ] Custom cursor for verdict hover states

---

## Design Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Blue-green primary | Trust + tech familiarity without generic blue overload | 2026-02-23 |
| Semantic verdict colors | Meaning > standard "success/warning/error" pattern | 2026-02-23 |
| Satoshi for headers | Bold, modern, distinctive from dev tools | 2026-02-23 |
| Subtle card hover | Lift without distraction | 2026-02-23 |
| Dark mode depth | Rich contrast, not flat black | 2026-02-23 |
| Live status pulse | Drawing attention without alarm | 2026-02-23 |

---

## Resources

- **Tailwind v4:** Native OKLCH support
- **Inter Font:** Variable font family (weights 400-600)
- **Satoshi Font:** Bold/Medium variants
- **OKLCH Color Space:** Modern perceptual uniformity

---

*Created by Satoru — AI Senior Designer & Developer*