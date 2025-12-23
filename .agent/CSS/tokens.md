# Design Tokens

All design values are defined as CSS variables in `src/styles/global.css`. Never hardcode values.

## Colors

### Primary Colors (Gold)

| Token | Value | Usage |
|-------|-------|-------|
| `--gold` | `hsl(45, 100%, 58%)` | Primary accent, CTAs |
| `--dark-gold` | `hsl(45, 100%, 50%)` | Hover states |
| `--light-gold` | `hsl(45, 100%, 70%)` | Subtle highlights |

### Secondary Colors (Blue)

| Token | Value | Usage |
|-------|-------|-------|
| `--complementary-blue` | `hsl(217, 100%, 58%)` | Secondary accent |
| `--dark-blue` | `hsl(217, 100%, 45%)` | Hover states |
| `--light-blue` | `hsl(217, 80%, 75%)` | Backgrounds |

### Neutral Colors

| Token | Lightness | Usage |
|-------|-----------|-------|
| `--black` | 13% | Dark text, backgrounds |
| `--dark-gray` | 27% | Secondary text |
| `--gray` | 53% | Borders, placeholders |
| `--light-gray` | 93% | Backgrounds |
| `--white` | 100% | Cards, inputs |

### Semantic Colors

| Token | Maps To | Usage |
|-------|---------|-------|
| `--bg-primary` | `--white` | Card backgrounds |
| `--bg-secondary` | `--light-gray` | Page backgrounds |
| `--text-primary` | `--black` | Headings, body text |
| `--text-secondary` | `--dark-gray` | Subtitles, captions |
| `--text-tertiary` | `--gray` | Placeholders, hints |
| `--border-color` | `--light-gray` | Input/card borders |
| `--accent-primary` | `--gold` | Primary actions |
| `--accent-secondary` | `--complementary-blue` | Secondary actions |

---

## Typography

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--primary-font` | `'Montserrat', sans-serif` | UI, headings, buttons |
| `--secondary-font` | `'Judson', serif` | Body text, paragraphs |

### Font Sizes

| Token | Size | px equivalent |
|-------|------|---------------|
| `--font-size-xs` | `0.75rem` | 12px |
| `--font-size-sm` | `0.875rem` | 14px |
| `--font-size-base` | `1rem` | 16px |
| `--font-size-lg` | `1.125rem` | 18px |
| `--font-size-xl` | `1.25rem` | 20px |
| `--font-size-2xl` | `1.5rem` | 24px |
| `--font-size-3xl` | `1.875rem` | 30px |

### Font Weights

| Token | Value |
|-------|-------|
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 600 |
| `--font-weight-bold` | 700 |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--line-height-tight` | 1.2 | Headings |
| `--line-height-normal` | 1.5 | Body text |
| `--line-height-loose` | 1.8 | Long-form content |

---

## Spacing

| Token | Size | px equivalent |
|-------|------|---------------|
| `--space-1` | `0.25rem` | 4px |
| `--space-2` | `0.5rem` | 8px |
| `--space-3` | `0.75rem` | 12px |
| `--space-4` | `1rem` | 16px |
| `--space-5` | `1.25rem` | 20px |
| `--space-6` | `1.5rem` | 24px |
| `--space-8` | `2rem` | 32px |
| `--space-10` | `2.5rem` | 40px |
| `--space-12` | `3rem` | 48px |
| `--space-16` | `4rem` | 64px |

### Mobile Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--mobile-padding` | `1rem` | Container padding on mobile |
| `--mobile-margin` | `0.5rem` | Element margins on mobile |
| `--mobile-gap` | `0.75rem` | Grid/flex gaps on mobile |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--border-radius-sm` | `4px` | Small elements, badges |
| `--border-radius` | `8px` | Default (cards, buttons) |
| `--border-radius-lg` | `12px` | Large cards, modals |
| `--border-radius-xl` | `16px` | Hero sections |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px hsla(0, 0%, 0%, 0.05)` | Subtle depth |
| `--shadow-md` | `0 4px 6px hsla(0, 0%, 0%, 0.1)` | Cards, dropdowns |
| `--shadow-lg` | `0 10px 15px hsla(0, 0%, 0%, 0.1)` | Modals, overlays |
| `--shadow-focus` | `0 0 0 3px hsla(45, 100%, 50%, 0.3)` | Focus ring |

---

## Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `150ms` | Hover states, small elements |
| `--transition-normal` | `300ms` | Default animations |
| `--transition-slow` | `500ms` | Page transitions, large elements |

---

## Component-Specific Tokens

### Navbar

| Token | Value |
|-------|-------|
| `--navbar-bg` | `var(--black)` |
| `--navbar-hover` | `var(--dark-gray)` |
| `--navbar-text` | `var(--white)` |
| `--navbar-accent` | `var(--gold)` |
| `--navbar-height-mobile` | `64px` |
| `--navbar-width-collapsed` | `80px` |
| `--navbar-width-expanded` | `200px` |

### Footer

| Token | Value |
|-------|-------|
| `--footer-h` | `60px` |
| `--footer-height` | `60px` |

### iOS Safe Areas

| Token | Value |
|-------|-------|
| `--sab` | `env(safe-area-inset-bottom)` |
| `--sat` | `env(safe-area-inset-top)` |
| `--sal` | `env(safe-area-inset-left)` |
| `--sar` | `env(safe-area-inset-right)` |

---

## Related Documentation

- [CSS Architecture](./architecture.md) - How to use these tokens
- [Layout System](./layout.md) - Breakpoints and responsive tokens
- [Theming](./theming.md) - Dark mode overrides
