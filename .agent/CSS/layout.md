# Layout System

## Breakpoints

Mobile-first approach: base styles target mobile, then scale up.

| Name | Token | Min-width | Usage |
|------|-------|-----------|-------|
| xs | `--breakpoint-xs` | 480px | Large phones |
| sm | `--breakpoint-sm` | 640px | Small tablets |
| md | `--breakpoint-md` | 768px | Tablets |
| lg | `--breakpoint-lg` | 1024px | Laptops |
| xl | `--breakpoint-xl` | 1280px | Desktops |
| 2xl | `--breakpoint-2xl` | 1536px | Large monitors |

### Media Query Pattern

```css
/* Mobile-first: base styles apply to mobile */
.component {
  padding: var(--space-4);
}

/* Scale up for larger screens */
@media (min-width: 768px) {
  .component {
    padding: var(--space-6);
  }
}

@media (min-width: 1024px) {
  .component {
    padding: var(--space-8);
  }
}
```

---

## Container Widths

| Breakpoint | Max-width |
|------------|-----------|
| xs | 100% |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

```css
.container {
  width: 100%;
  max-width: var(--container-2xl);
  margin: 0 auto;
  padding: 0 var(--mobile-padding);
}
```

---

## Grid System

### Basic Grid

```css
.grid {
  display: grid;
  gap: var(--space-4);
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
```

### Responsive Grid Classes

```css
/* Available in global.css */
.sm\:grid-cols-2  /* 2 cols at 640px+ */
.sm\:grid-cols-3  /* 3 cols at 640px+ */
.md\:grid-cols-2  /* 2 cols at 768px+ */
.md\:grid-cols-3  /* 3 cols at 768px+ */
.md\:grid-cols-4  /* 4 cols at 768px+ */
.lg\:grid-cols-2  /* 2 cols at 1024px+ */
.lg\:grid-cols-3  /* 3 cols at 1024px+ */
.lg\:grid-cols-4  /* 4 cols at 1024px+ */
```

### Usage Example

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
</div>
```

---

## Flexbox Utilities

### Direction & Alignment

```css
.flex          { display: flex; }
.flex-col      { flex-direction: column; }
.flex-row      { flex-direction: row; }
.items-center  { align-items: center; }
.justify-center    { justify-content: center; }
.justify-between   { justify-content: space-between; }
```

### Gap Classes

```css
.gap-2 { gap: var(--space-2); }  /* 8px */
.gap-3 { gap: var(--space-3); }  /* 12px */
.gap-4 { gap: var(--space-4); }  /* 16px */
```

### Responsive Flex

```css
.mobile\:flex-col     { flex-direction: column; }  /* Mobile only */
.mobile\:items-start  { align-items: flex-start; } /* Mobile only */
```

---

## Sidebar Layout

The app uses a collapsible sidebar on desktop, topbar on mobile.

### Desktop (1024px+)

```
┌────────────────────────────────────────┐
│ Navbar │        Main Content           │
│ 80px   │                               │
│ (exp:  │                               │
│ 200px) │                               │
└────────────────────────────────────────┘
```

```css
body.has-sidebar main {
  margin-left: var(--navbar-width-collapsed);  /* 80px */
  width: calc(100% - var(--navbar-width-collapsed));
}

body.has-sidebar .navbar:hover ~ main {
  margin-left: var(--navbar-width-expanded);   /* 200px */
  width: calc(100% - var(--navbar-width-expanded));
}
```

### Mobile (<600px)

```
┌────────────────────────────────────────┐
│           Top Navbar (64px)            │
├────────────────────────────────────────┤
│                                        │
│            Main Content                │
│                                        │
└────────────────────────────────────────┘
```

```css
body.has-sidebar main {
  margin-left: 0;
  margin-top: var(--navbar-height-mobile);  /* 64px */
  width: 100%;
}
```

---

## Visibility Utilities

### Hide at Breakpoint

```css
.hidden-xs  /* Hidden by default */
.hidden-sm  /* Visible at 640px+ */
.hidden-md  /* Visible at 768px+ */
.hidden-lg  /* Visible at 1024px+ */
.hidden-xl  /* Visible at 1280px+ */
```

### Show at Breakpoint

```css
.visible-xs  /* Visible by default */
.visible-sm  /* Hidden at 640px+ */
.visible-md  /* Hidden at 768px+ */
.visible-lg  /* Hidden at 1024px+ */
.visible-xl  /* Hidden at 1280px+ */
```

---

## iOS Safe Areas

For notched devices and home indicator:

```css
:root {
  --sab: env(safe-area-inset-bottom);
  --sat: env(safe-area-inset-top);
  --sal: env(safe-area-inset-left);
  --sar: env(safe-area-inset-right);
}

/* Footer-aware padding */
.with-footer-pad {
  padding-bottom: calc(var(--footer-h) + var(--safe-bottom) + var(--footer-pad-extra));
}
```

---

## Dynamic Viewport Height

Use `dvh` units for iOS viewport bugs:

```css
.screen, .page, body, #root {
  min-height: 100dvh;  /* Dynamic viewport height */
}
```

---

## Related Documentation

- [Design Tokens](./tokens.md) - Spacing and sizing values
- [CSS Architecture](./architecture.md) - Methodology overview
- [Responsive Design SOP](../SOP/responsive_design.md) - Implementation patterns
