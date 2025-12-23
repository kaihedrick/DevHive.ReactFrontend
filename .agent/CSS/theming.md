# Theming

DevHive uses CSS variables for theming, with automatic dark mode support.

---

## Theme Variables

All theme colors are defined in `:root` and can be overridden for dark mode.

### Light Mode (Default)

```css
:root {
  --bg-primary: var(--white);         /* #fff */
  --bg-secondary: var(--light-gray);  /* #eee */
  --text-primary: var(--black);       /* #222 */
  --text-secondary: var(--dark-gray); /* #444 */
  --text-tertiary: var(--gray);       /* #888 */
  --border-color: var(--light-gray);  /* #eee */
}
```

### Dark Mode

Triggered automatically via `prefers-color-scheme: dark`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: hsl(0, 0%, 13%);      /* Dark background */
    --bg-secondary: hsl(0, 0%, 18%);    /* Slightly lighter */
    --text-primary: hsl(0, 0%, 100%);   /* White text */
    --text-secondary: hsl(0, 0%, 80%);  /* Light gray text */
    --text-tertiary: hsl(0, 0%, 65%);   /* Muted text */
    --border-color: hsl(0, 0%, 24%);    /* Dark borders */
  }
}
```

---

## Using Theme Variables

Always use semantic tokens, never raw colors:

```css
/* Good */
.card {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* Bad - hardcoded colors won't adapt to dark mode */
.card {
  background: white;
  color: #222;
  border: 1px solid #eee;
}
```

---

## Accent Colors

Accent colors remain consistent across themes:

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-primary` | `--gold` | Primary actions, highlights |
| `--accent-secondary` | `--complementary-blue` | Secondary actions |

These do not change in dark mode - the gold and blue provide sufficient contrast.

---

## Component-Specific Themes

### Navbar

The navbar has its own theme tokens:

```css
--navbar-bg: var(--black);
--navbar-hover: var(--dark-gray);
--navbar-text: var(--white);
--navbar-accent: var(--gold);
```

These remain dark in both light and dark mode for consistency.

---

## Future: Manual Theme Toggle

To add a manual theme toggle:

1. Add a `data-theme` attribute to `<html>`
2. Define overrides for each theme:

```css
[data-theme="dark"] {
  --bg-primary: hsl(0, 0%, 13%);
  --bg-secondary: hsl(0, 0%, 18%);
  /* ... */
}

[data-theme="light"] {
  --bg-primary: var(--white);
  --bg-secondary: var(--light-gray);
  /* ... */
}
```

3. Toggle in JavaScript:
```js
document.documentElement.setAttribute('data-theme', 'dark');
```

---

## Related Documentation

- [Design Tokens](./tokens.md) - All color variables
- [CSS Architecture](./architecture.md) - Variable usage rules
- [Anti-Patterns](./anti-patterns.md) - Theme-related mistakes
