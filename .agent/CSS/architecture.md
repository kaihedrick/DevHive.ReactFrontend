# CSS Architecture

## Design Philosophy

DevHive uses a **component-scoped CSS** approach with **global design tokens** for consistency.

### Core Principles

1. **Token-First**: All values (colors, spacing, fonts) come from CSS variables
2. **Mobile-First**: Base styles target mobile, then scale up via breakpoints
3. **Component Isolation**: Each component has its own `.css` file
4. **Utility Augmentation**: Common patterns available as utility classes

## CSS Methodology

### Naming Convention

BEM-inspired naming for component classes:

```css
/* Block */
.backlog { }

/* Element */
.backlog__header { }
.backlog__task-list { }

/* Modifier */
.backlog--collapsed { }
.backlog__task--selected { }
```

### File Organization

```
src/styles/
├── index.css          # Global: variables, resets, base typography
├── utilities.css      # Utility classes (.flex, .hidden, .mt-4, etc.)
└── [component].css    # Component-specific styles
```

### Import Pattern

Components import their own styles:

```tsx
// src/components/Backlog.tsx
import "../styles/backlog.css";
```

## Constraints

### DO

- Use CSS variables for all colors, spacing, and typography
- Write mobile-first media queries
- Keep selectors shallow (max 3 levels)
- Use semantic class names

### DO NOT

- Hardcode colors, sizes, or fonts
- Use `!important` (except for utility overrides)
- Nest selectors more than 3 levels deep
- Use inline styles for anything other than dynamic values

## Related Documentation

- [Design Tokens](./tokens.md) - All CSS variable definitions
- [Layout System](./layout.md) - Grid, flexbox, breakpoints
- [Utility Classes](./utilities.md) - Available helper classes
- [Anti-Patterns](./anti-patterns.md) - Common mistakes to avoid
- [Responsive Design SOP](../SOP/responsive_design.md) - Breakpoint usage patterns
