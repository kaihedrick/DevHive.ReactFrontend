# CSS Changelog

Track all style-impacting changes here. This ensures agents document CSS modifications without polluting feature PRDs or system docs.

---

## 2025-12-26

### Fixed
- **File**: `src/styles/navbar.css`
- **Change**: Added iOS Safari-specific CSS fixes to prevent header from moving off screen during navigation
- **Reason**: iOS Safari's dynamic viewport behavior causes fixed positioned elements to shift when address bar appears/disappears during page transitions
- **Impact**: Navbar now stays fixed and visible on iOS Safari mobile when navigating between pages (board, backlog, contacts, account)

### Implementation Details
- Added `@supports (-webkit-touch-callout: none)` query for iOS Safari detection
- Used `translate3d(0, 0, 0)` and `translateZ(0)` for hardware acceleration
- Set high `z-index: 10000` to ensure navbar stays above content
- Added `min-height` and `backface-visibility` properties for viewport stability
- Included mobile-specific media query for additional iOS Safari fixes

## 2025-12-23

### Documentation Created
- Initial CSS documentation structure established
- Created: `architecture.md`, `tokens.md`, `layout.md`, `changelog.md`
- Documented all CSS variables from `src/styles/global.css`
- Added CSS Agent Prompting Pattern to main README

---

## Template for Future Entries

```markdown
## YYYY-MM-DD

### [Category: Added|Changed|Fixed|Removed]
- **File**: `src/styles/[filename].css`
- **Change**: Brief description
- **Reason**: Why this change was made
- **Impact**: What components/pages are affected
```

### Categories

| Category | Usage |
|----------|-------|
| **Added** | New tokens, classes, or components |
| **Changed** | Modified existing styles |
| **Fixed** | Bug fixes, alignment issues |
| **Removed** | Deprecated styles removed |
| **Breaking** | Changes that require component updates |

---

## Related Documentation

- [CSS Architecture](./architecture.md) - Design philosophy
- [Design Tokens](./tokens.md) - All CSS variables
- [Anti-Patterns](./anti-patterns.md) - What to avoid
