# Utility Classes

Helper classes for common patterns. Defined in `src/styles/global.css`.

---

## Layout

### Flexbox

```css
.flex              /* display: flex */
.flex-col          /* flex-direction: column */
.flex-row          /* flex-direction: row */
.items-center      /* align-items: center */
.justify-center    /* justify-content: center */
.justify-between   /* justify-content: space-between */
```

### Gap

```css
.gap-2   /* gap: var(--space-2)  - 8px */
.gap-3   /* gap: var(--space-3)  - 12px */
.gap-4   /* gap: var(--space-4)  - 16px */
```

### Grid

```css
.grid          /* display: grid; gap: var(--space-4) */
.grid-cols-1   /* 1 column */
.grid-cols-2   /* 2 columns */
.grid-cols-3   /* 3 columns */
.grid-cols-4   /* 4 columns */
```

---

## Responsive

### Grid (Breakpoint-prefixed)

```css
.sm\:grid-cols-2   /* 2 cols at 640px+ */
.md\:grid-cols-3   /* 3 cols at 768px+ */
.lg\:grid-cols-4   /* 4 cols at 1024px+ */
```

### Flex (Mobile-prefixed)

```css
.mobile\:flex-col      /* Column layout on mobile */
.mobile\:items-start   /* Align start on mobile */
```

---

## Visibility

### Hidden (show at breakpoint)

```css
.hidden-xs   /* Hidden by default, shown never */
.hidden-sm   /* Hidden by default, shown at 640px+ */
.hidden-md   /* Hidden by default, shown at 768px+ */
.hidden-lg   /* Hidden by default, shown at 1024px+ */
.hidden-xl   /* Hidden by default, shown at 1280px+ */
```

### Visible (hide at breakpoint)

```css
.visible-xs   /* Visible by default */
.visible-sm   /* Visible by default, hidden at 640px+ */
.visible-md   /* Visible by default, hidden at 768px+ */
.visible-lg   /* Visible by default, hidden at 1024px+ */
.visible-xl   /* Visible by default, hidden at 1280px+ */
```

---

## Typography

```css
.text-small   /* font-size: var(--font-size-sm) */
.caption      /* font-size: var(--font-size-xs), tertiary color */
```

---

## Spacing

### Mobile Utilities

```css
.mobile-padding   /* padding: var(--mobile-padding)  - 1rem */
.mobile-margin    /* margin: var(--mobile-margin)    - 0.5rem */
.mobile-gap       /* gap: var(--mobile-gap)          - 0.75rem */
```

### Footer-Aware

```css
.with-footer-pad     /* Bottom padding for footer clearance */
.scroll-pad-bottom   /* Scroll padding for fixed footer */
```

---

## Containers

```css
.container          /* Centered, max-width, responsive padding */
.content-container  /* Same as container */
.scrollable-container  /* Touch-friendly scrolling */
```

---

## Related Documentation

- [Layout System](./layout.md) - Breakpoints and grid details
- [Design Tokens](./tokens.md) - Spacing values
- [CSS Architecture](./architecture.md) - When to use utilities vs custom CSS
