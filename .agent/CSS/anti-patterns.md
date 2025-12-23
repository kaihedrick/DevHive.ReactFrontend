# CSS Anti-Patterns

What NOT to do. Document mistakes here to prevent repeating them.

---

## Hardcoded Values

### Problem

```css
/* BAD */
.card {
  padding: 16px;
  color: #222;
  border-radius: 8px;
}
```

### Solution

```css
/* GOOD */
.card {
  padding: var(--space-4);
  color: var(--text-primary);
  border-radius: var(--border-radius);
}
```

**Why**: Hardcoded values break theming and make global changes impossible.

---

## Over-Nesting

### Problem

```css
/* BAD - 4 levels deep */
.page .content .card .card-header .title {
  font-size: 18px;
}
```

### Solution

```css
/* GOOD - max 2-3 levels */
.card__title {
  font-size: var(--font-size-lg);
}
```

**Why**: Deep nesting creates specificity wars and makes CSS harder to maintain.

---

## Using `!important` Everywhere

### Problem

```css
/* BAD */
.button {
  background: gold !important;
  color: black !important;
  padding: 12px !important;
}
```

### Solution

```css
/* GOOD - only use !important for utilities */
.hidden { display: none !important; }

/* Normal components don't need it */
.button {
  background: var(--accent-primary);
  color: var(--black);
  padding: var(--space-3);
}
```

**Why**: `!important` prevents natural cascade and makes overrides impossible.

**Note**: This project uses `!important` extensively in global.css for design system enforcement. This is intentional for the base system, but component CSS should avoid it.

---

## Desktop-First Media Queries

### Problem

```css
/* BAD - desktop-first */
.card {
  padding: 32px;
}

@media (max-width: 768px) {
  .card {
    padding: 16px;
  }
}
```

### Solution

```css
/* GOOD - mobile-first */
.card {
  padding: var(--space-4);  /* 16px - mobile default */
}

@media (min-width: 768px) {
  .card {
    padding: var(--space-8);  /* 32px - tablet+ */
  }
}
```

**Why**: Mobile-first ensures mobile works by default, progressively enhancing.

---

## Inline Styles for Static Values

### Problem

```tsx
/* BAD */
<div style={{ marginTop: '20px', color: '#ffcc00' }}>
```

### Solution

```tsx
/* GOOD - use classes or CSS variables */
<div className="mt-5" style={{ '--dynamic-value': someVar }}>
```

**Why**: Inline styles can't be themed, cached, or overridden easily.

**Exception**: Dynamic values calculated in JS (animations, positions).

---

## Magic Numbers

### Problem

```css
/* BAD - what does 67px mean? */
.sidebar {
  width: 67px;
}
```

### Solution

```css
/* GOOD - named token or documented */
.sidebar {
  width: var(--navbar-width-collapsed);  /* 80px */
}
```

**Why**: Magic numbers are impossible to understand or maintain.

---

## Mixing Layout and Component CSS

### Problem

```css
/* BAD - component styling in global.css */
/* global.css */
.backlog .sprint-card {
  margin: 10px;
}
```

### Solution

```css
/* GOOD - component CSS in its own file */
/* backlog.css */
.backlog .sprint-card {
  margin: var(--space-3);
}
```

**Why**: Keeps concerns separated and makes components portable.

---

## Z-Index Wars

### Problem

```css
/* BAD */
.modal { z-index: 99999; }
.dropdown { z-index: 999999; }
.tooltip { z-index: 9999999; }
```

### Solution

Define a z-index scale:

```css
:root {
  --z-base: 1;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-tooltip: 400;
  --z-max: 500;
}
```

**Why**: Arbitrary z-indexes lead to escalation and unpredictable stacking.

---

## Discovered Issues

Document specific issues found in this codebase:

| Date | Issue | Location | Fix |
|------|-------|----------|-----|
| *Add entries as discovered* | | | |

---

## Related Documentation

- [CSS Architecture](./architecture.md) - Correct patterns
- [Design Tokens](./tokens.md) - Available variables
- [Changelog](./changelog.md) - Track fixes
