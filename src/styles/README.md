# DevHive CSS Architecture

## Overview
This project uses a modular CSS architecture to prevent style bleeding and maintain clean separation of concerns.

## File Structure

### Core CSS Files
- **`tokens.css`** - CSS variables only (colors, spacing, typography, etc.)
- **`utilities.css`** - Helper classes and utility functions
- **`resets.css`** - Global resets and base styles with scoped form resets

### Component-Specific CSS
- **`InputField.module.css`** - Scoped styles for the InputField component
- **`AuthPage.module.css`** - Scoped styles for the AuthPage component

## Key Principles

### 1. CSS Modules
- All component styles use CSS Modules (`.module.css`)
- Styles are automatically scoped to prevent conflicts
- No global CSS classes for components

### 2. Scoped Form Resets
- Form resets are scoped under `.dh-form-reset` class
- Only applied where explicitly needed
- Uses `:where()` for zero specificity

### 3. Design Tokens
- All design values (colors, spacing, etc.) are CSS variables
- Defined once in `tokens.css`
- Consistent across all components

### 4. Utility Classes
- Helper classes for common patterns
- Layout utilities (`.stack-4`, `.cluster`)
- Spacing utilities (`.mt-4`, `.mb-3`)
- Text utilities (`.text-center`, `.text-muted`)

## Usage

### Importing CSS
```typescript
// App entry point
import './styles/tokens.css';
import './styles/utilities.css';
import './styles/resets.css';
```

### Using CSS Modules
```typescript
import styles from './Component.module.css';

return <div className={styles.container}>...</div>;
```

### Form Resets
```typescript
// Wrap forms that need baseline resets
<form className="dh-form-reset">
  <InputField ... />
</form>
```

## Benefits

1. **No Style Bleeding** - CSS Modules prevent conflicts
2. **Predictable Cascade** - Clear specificity hierarchy
3. **Maintainable** - Scoped styles are easier to manage
4. **Reusable** - Components can be used anywhere without style conflicts
5. **Performance** - Only necessary CSS is loaded

## Migration Notes

- Old `InputField.js` renamed to `InputField.legacy.js`
- Old `index.css` removed in favor of modular approach
- All auth page styles now use CSS Modules
- Form resets are scoped and won't affect other pages

## Contribution Guidelines

### Adding New Components
1. **Always create a CSS Module** (`.module.css`) next to your component
2. **Never import shared CSS** into leaf components
3. **Use design tokens** from `tokens.css` for all values
4. **Follow BEM naming** convention in CSS Modules

### Adding New Pages
1. **Create page-specific CSS Module** (e.g., `ProjectPage.module.css`)
2. **Scope all styles** under a page class
3. **Use utility classes** for common patterns
4. **Import only tokens, utilities, and resets** at app level

### CSS Import Rules
```typescript
// ✅ CORRECT: Import at app level only
// App.tsx or main.tsx
import './styles/tokens.css';
import './styles/utilities.css';
import './styles/resets.css';

// ❌ WRONG: Import in components
import '../styles/global.css'; // Don't do this
```

### Form Styling
1. **Wrap forms** with `className="dh-form-reset"` for baseline styles
2. **Use InputField component** for all form inputs
3. **Never style raw input elements** outside of resets.css
4. **Use CSS Modules** for component-specific styling

### Testing Requirements
- **Write tests** for all new components
- **Test visual regression** for any style changes
- **Verify no style bleeding** between components
- **Check accessibility** (focus states, ARIA labels)

## Tools and Scripts

### Stylelint
```bash
# Install stylelint
npm install --save-dev stylelint stylelint-config-standard

# Run stylelint
npx stylelint "src/**/*.css"
```

### Check for !important
```powershell
# Windows PowerShell
.\scripts\check-important.ps1

# Linux/Mac
./scripts/check-important.sh
```

### Build Verification
The build will fail if:
- CSS files import other CSS files
- Raw input/textarea/select elements are styled outside resets.css
- `!important` declarations are found in component CSS
