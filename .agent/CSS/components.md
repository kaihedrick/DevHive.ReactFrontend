# Component Styles

Reusable UI component patterns. Each component has its own CSS file in `src/styles/`.

---

## Button

**File**: `src/styles/global.css` (`.button` classes)

```css
.button              /* Base button styles */
.button-primary      /* Gold background, dark text */
.button-secondary    /* Blue background, white text */
.button-outline      /* Transparent with gold border */
.button-small        /* Smaller padding/font */
.button-large        /* Larger padding/font */
.button-icon         /* Button with icon + text */
```

### Usage

```html
<button class="button button-primary">Save</button>
<button class="button button-secondary button-small">Cancel</button>
```

---

## Card

**File**: `src/styles/global.css` (`.card` classes)

```css
.card           /* White background, shadow, rounded */
.card-title     /* Bold heading */
.card-subtitle  /* Secondary text */
.card-content   /* Body text */
```

---

## Form Elements

**File**: `src/styles/global.css`

```css
.form-container     /* Card-style form wrapper */
.form-title         /* Form heading */
.form-group         /* Label + input wrapper */
.form-label         /* Input label */
.form-error         /* Red error text */
.form-success       /* Green success text */
.form-button        /* Full-width submit button */
.form-button-primary
.form-button-secondary
```

---

## Component-Specific Files

| Component | File | Key Classes |
|-----------|------|-------------|
| Navbar | `navbar.css` | `.navbar`, `.nav-item` |
| Footer | `footer.css` | `.footer` |
| Toast | `toast.css` | `.toast`, `.toast-container` |
| Modal | `modal.css` | `.modal`, `.modal-overlay` |
| Task Inspector | `task_inspector.css` | `.task-inspector`, `.inspector-panel` |
| Sprint Inspector | `sprint_inspector.css` | `.sprint-inspector` |
| Board | `board.css` | `.board`, `.column`, `.task-card` |
| Backlog | `backlog.css` | `.backlog`, `.sprint-list` |
| Projects | `projects.css` | `.project-card`, `.project-grid` |
| Messages | `message.css` | `.message`, `.chat-container` |
| Contacts | `contacts.css` | `.contact-list`, `.contact-item` |

---

## Related Documentation

- [Design Tokens](./tokens.md) - Colors, spacing used in components
- [CSS Architecture](./architecture.md) - Naming conventions
- [Utilities](./utilities.md) - Helper classes
