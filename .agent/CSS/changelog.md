# CSS Changelog

Track all style-impacting changes here. This ensures agents document CSS modifications without polluting feature PRDs or system docs.

---

## 2025-12-29

### Fixed - Board and ProjectDetails Header Positioning in Topbar Mode

**Files Modified**:
1. `src/styles/board.css` - Applied fixed layout for topbar mode (lines 102-138)
2. `src/styles/project_details.css` - Applied fixed layout for topbar mode (lines 816-860)

**The Issue**:
- Same header positioning problem as Messages page
- Headers were being pushed up into navbar in topbar mode
- Content was scrolling underneath the fixed navbar

**The Fix - Board Page**:
```css
/* Topbar mode (max-width: 600px) */
.board-header {
  position: fixed;
  top: 64px;           /* Right below navbar */
  width: 100%;
}

.board-container {
  position: fixed;
  top: 137px;          /* navbar + header */
  bottom: 60px;        /* above footer */
  width: 100%;
  overflow-y: auto;    /* Scrollable */
}
```

**The Fix - ProjectDetails Page**:
```css
/* Topbar mode (max-width: 600px) */
.project-details {
  position: fixed;
  top: 64px;           /* Right below navbar */
  bottom: 60px;        /* above footer */
  width: 100%;
  overflow-y: auto;    /* Scrollable */
}

.project-details h1 {
  position: sticky;
  top: 0;              /* Sticks to top of scroll container */
  background: var(--bg-primary);
}
```

**Impact**:
- ✅ Board header stays fixed below navbar in topbar mode
- ✅ ProjectDetails header stays sticky at top of content in topbar mode
- ✅ Both pages have scrollable content between header and footer
- ✅ 100% width for all elements on mobile
- ✅ Consistent layout with Messages page
- ✅ Desktop/sidebar mode unaffected

---

### Changed - Messages Page Mobile Layout to Fixed Header/Input

**Files Modified**:
1. `src/styles/message.css` - Changed mobile layout to fixed positioning (lines 177-226)
2. `src/components/Message.tsx` - Changed scrollIntoView to use `block: "end"` (lines 155, 167)

**The Change**:
- Converted Messages page to a fixed layout on mobile (topbar mode)
- Header stays fixed right below navbar
- Input bar stays fixed right above footer
- Message list scrolls between them

**New Layout Structure**:
```css
/* Mobile (max-width: 600px) with topbar */
.message-header {
  position: fixed;
  top: 64px;           /* Right below navbar */
  width: 100%;
}

.message-list {
  position: fixed;
  top: 121px;          /* navbar + header */
  bottom: 130px;       /* footer + input */
  width: 100%;
  overflow-y: auto;    /* Scrollable */
}

.message-input {
  position: fixed;
  bottom: 60px;        /* Right above footer */
  width: 100%;
}
```

**Why This Layout**:
- Header always visible for context (who you're messaging)
- Input always accessible (no scrolling to type)
- Message list uses all available space efficiently
- Most recent messages always visible above input
- Consistent with modern messaging app UX

**Scroll Behavior Fix**:
- Changed `block: "nearest"` to `block: "end"` in scrollIntoView() calls
- Ensures messages scroll fully to the bottom on initial load
- Added `inline: "nearest"` to prevent horizontal scrolling of parent containers
- Messages now always appear at the very bottom, flush to input bar

**Layout Scope**:
- Fixed layout only applies to mobile (topbar mode) via `body.has-topbar` selector
- Desktop/sidebar mode uses flexbox layout with scrollable `.message-list`
- Header is sticky in sidebar mode, fixed in topbar mode

**Impact**:
- ✅ Header stays in constant position below navbar (topbar mode)
- ✅ Input bar stays flush to footer, always accessible (topbar mode)
- ✅ Message list scrolls independently in both modes
- ✅ 100% width for all elements on mobile
- ✅ Most recent messages fully scrolled to bottom on load
- ✅ Sidebar mode maintains proper scrollable layout

---

### Fixed - Auto-scroll Behavior After Overflow Fix

**Files Modified**:
1. `src/components/Message.tsx` - Added `block: "nearest"` to scrollIntoView() calls (lines 155, 167)

**The Issue**:
- After fixing `.content` to be a scroll container (`overflow-y: auto`), navigating from Contacts to Messages caused the page to auto-scroll down past the header
- User had to manually scroll up to see the header every time

**Root Cause**:
```typescript
// BEFORE
messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
```
- `scrollIntoView()` without options scrolls ALL ancestor scroll containers
- Now that `.content` is a scroll container, it was scrolling both `.message-list` AND `.content`
- This caused the entire page to scroll down, hiding the header

**The Fix**:
```typescript
// Line 155 - smooth scroll on message updates
messagesEndRef.current?.scrollIntoView({
  behavior: "smooth",
  block: "nearest"  // Only scroll .message-list, not .content
});

// Line 167 - auto scroll on mount
messagesEndRef.current?.scrollIntoView({
  behavior: "auto",
  block: "nearest"  // Only scroll .message-list, not .content
});
```

**Why This Works**:
- `block: "nearest"` tells scrollIntoView() to only scroll the nearest scroll container
- Only `.message-list` scrolls to show new messages
- `.content` stays at the top, keeping the header visible
- Perfect scroll behavior: messages scroll within their container, page stays put

**Impact**:
- ✅ Messages page no longer auto-scrolls down on navigation
- ✅ Header stays visible when entering the page
- ✅ Message list still scrolls to bottom to show newest messages
- ✅ No manual scrolling needed to see the header

---

### Fixed - .content overflow:visible Breaking Sticky Positioning (ACTUAL ACTUAL ROOT CAUSE)

**Files Modified**:
1. `src/styles/global.css` - Changed `.content` from `overflow: visible` to `overflow-y: auto` (line 27)
2. `src/styles/global.css` - Removed `padding: 0 !important` from universal selector (line 187)
3. `src/styles/global.css` - Removed `padding: 0 !important` from `main` element (line 254)

**The ACTUAL Root Cause**:
```css
/* global.css line 24-26 */
.app-container.has-navbar .content {
  overflow: visible !important;  /* ← THIS WAS THE REAL PROBLEM */
}
```

**Why This Broke Sticky Positioning**:
1. `.content` had `overflow: visible` instead of `overflow-y: auto`
2. Elements with `overflow: visible` are NOT scroll containers
3. Sticky positioned elements need a scroll container to stick relative to
4. The `.message-header` has `position: sticky; top: 0`
5. With no scroll container in `.content`, it looked for the next one up (body/html)
6. It stuck to `top: 0` of the VIEWPORT, overlapping the fixed navbar
7. Even though `.content` had `padding-top: 64px`, the sticky element ignored it

**Additional Issues Fixed**:
```css
/* Also in global.css */
* {
    padding: 0 !important;  /* ← Also nuking all padding */
}

main {
    padding: 0 !important;  /* ← Forcing main to have no padding */
}
```

**Why These Also Caused Problems**:
- The universal selector reset all padding (including component padding)
- The `main` padding reset prevented any top spacing on the main element

**The Complete Fix**:
```css
/* 1. Make .content a proper scroll container */
.app-container.has-navbar .content {
  overflow-y: auto !important;  /* CHANGED from visible */
  overflow-x: visible !important;
}

/* 2. Remove universal padding reset */
* {
    margin: 0 !important;
    box-sizing: border-box !important;
    /* REMOVED: padding: 0 !important */
}

/* 3. Remove main padding reset */
main {
    display: flex !important;
    flex-direction: column !important;
    /* ... other properties ... */
    /* REMOVED: padding: 0 !important */
}
```

**Why This Works**:
1. **`.content` is now a scroll container** (`overflow-y: auto`)
   - Sticky elements can stick relative to `.content`
   - `.message-header` with `position: sticky; top: 0` sticks to `.content` top
   - The top of `.content` is 64px below the navbar (due to padding-top)
   - Result: sticky headers stay below the navbar ✅

2. **Padding is no longer globally reset**
   - `.content { padding-top: 64px }` actually applies
   - Defensive padding on pages works
   - Component padding preserved

3. **`main` can have padding if needed**
   - No longer forced to `padding: 0`
   - Mobile can add `padding-top` if needed

**Impact**:
- ✅ **Sticky headers now work correctly on ALL pages**
- ✅ Messages page header stays below navbar (fixed sticky positioning)
- ✅ ProjectDetails page header stays below navbar
- ✅ Board page works correctly
- ✅ Backlog page still works (already had defensive padding)
- ✅ Contacts page header stays below navbar (fixed sticky positioning)
- ✅ No more need for sidebar/topbar toggle workaround
- ✅ Navigation from Contacts → Messages → ProjectDetails works perfectly
- ✅ `.content` is now a proper scroll container for all sticky elements
- ✅ All component padding preserved and working

---

### Fixed - Defensive Padding for Messages and ProjectDetails (PARTIAL FIX)

**Files Modified**:
1. `src/styles/message.css` - Added defensive `padding-top` when `body.has-topbar` (lines 177-205)
2. `src/styles/project_details.css` - Added defensive `padding-top` when `body.has-topbar` (lines 816-833)

**The Issue**:
- Even after fixing `100vh` issues, Messages and ProjectDetails were still getting pushed up
- These pages were missing **defensive padding** that Backlog already had

**The Pattern (from backlog.css)**:
```css
@media (max-width: 600px) {
  body.has-topbar .page-container {
    padding-top: var(--space-4) !important;
    margin-top: 0 !important;
  }

  body.has-topbar .page-container > *:first-child {
    margin-top: 0 !important;
  }
}
```

**Why This Works**:
- Provides failsafe padding when topbar is present
- Prevents sticky headers from being pushed under the navbar
- Ensures first child element doesn't add extra margin
- Works even if `.content` padding fails to apply

**Pages Now Protected**:
- ✅ Backlog (already had it)
- ✅ Messages (NOW ADDED)
- ✅ ProjectDetails (NOW ADDED)
- ✅ Board (has its own `padding-top: 0` for flush look)

---

### Fixed - Header Positioning: Viewport Height Breaking Scroll Container Hierarchy (ROOT CAUSE CONFIRMED)

**Files Modified (Comprehensive 100vh Cleanup)**:
1. `src/styles/contacts.css` - Line 8: `min-height: 100vh` → `min-height: 0`
2. `src/styles/board.css` - Lines 8, 143: Changed all `100vh` references to `0`
3. `src/styles/project_details.css` - Lines 9, 53: Changed `100vh` references to `0`
4. `src/styles/account_details.css` - Lines 23, 35, 56: Changed all `100vh` references to `0`
5. `src/styles/backlog.css` - Line 12: `min-height: 100vh` → `min-height: 0`
6. `src/styles/projects.css` - Line 12: `min-height: 100vh` → `min-height: 0`
7. `src/styles/invite_members.css` - Line 20: `min-height: calc(100vh - 100px)` → `min-height: 0`
8. `src/styles/create_sprint.css` - Lines 54, 94: Changed `100vh` references to `0` or `100%`
9. `src/styles/global.css` - Line 322: Increased specificity of `.content` padding rule
10. `src/styles/navbar.css` - Removed `.content` from `transition: all` rule

**Files NOT Modified (Intentional 100vh Usage)**:
- `login_register.css` - Full-page layouts without navbar (correct usage)
- `forgot_password.css` - Full-page layouts without navbar (correct usage)
- `invite_accept.css` - Full-page layouts without navbar (correct usage)
- `global.css` - Structural elements (`app-container`, `main`) require `100vh`
- `navbar.css` - Navbar itself requires `height: 100vh`
- `footer.css` - Footer layout calculations
- `board.css` (lines 46, 55, 209) - Mobile `position: fixed` and max-height rules (intentional)
- `project_details.css` (lines 247, 438, 447) - Modal/overlay full-viewport coverage (intentional)
- `responsive.css` (line 325) - Utility class `.h-screen` (intentional)

**The Root Cause**:
- `.content` has `padding-top: 64px` when `body.has-topbar` is present (mobile)
- Page components (`.contacts-page`, `.board-page`, `.project-details-page`) had `min-height: 100vh`
- `100vh` = full viewport height, which is **larger** than `.content`'s content-box (which subtracts the 64px padding)
- This caused page components to overflow their parent (`.content`)
- The overflow broke the scroll container hierarchy for sticky headers
- Sticky headers then stuck to the wrong reference point (viewport instead of `.content`)

**Why Backlog Worked**:
- Backlog had defensive padding: `body.has-topbar .backlog-page { padding-top: 16px }`
- It didn't rely solely on `.content`'s padding
- Its own padding compensated for the layout issue

**Why Toggling Sidebar→Topbar Fixed It Temporarily**:
- Toggling removes and re-adds the `body.has-topbar` class
- This forces browser to recalculate layout and sticky positioning
- Sticky elements re-establish their scroll container reference
- BUT the underlying `min-height: 100vh` issue remained, so bug returned on next navigation

**The Fix**:
- Changed all page-level `min-height: 100vh` to `min-height: 0`
- Added `height: 100%` to ensure pages fill their parent naturally
- Pages now respect `.content`'s content-box height (accounting for padding)
- Scroll container hierarchy preserved
- Sticky headers stick correctly to `.content`, not viewport

**Impact**:
- ✅ Headers stay correctly positioned on Messages, ProjectDetails, and Board
- ✅ No more content pushed up into navbar
- ✅ Works immediately after navigation (no toggle required)
- ✅ Maintains responsive layout on all screen sizes
- ✅ Preserves sticky header behavior within scroll containers

---

### Fixed - CSS Transition Causing Header Positioning Bugs
- **Files Modified**:
  1. `src/styles/navbar.css` - Removed `transition: all` from `.content` element

- **Root Cause Discovered**:
  - `body .content` had `transition: all 300ms` applied (navbar.css line 495)
  - When navigating between pages (e.g., Messages → ProjectDetails), React re-renders content inside `.content`
  - The `transition: all` was interrupting the `padding-top` CSS property changes during navigation
  - Result: `padding-top: 64px` (from `body.has-topbar .content`) would get stuck at intermediate/wrong values

- **Why Toggling Sidebar→Topbar Fixed It**:
  - Removing classes: `document.body.classList.remove("has-sidebar", "has-topbar")` forced transition to complete/reset
  - Re-adding class: `document.body.classList.add("has-topbar")` gave fresh CSS calculation without interrupted transition
  - This "reset" mechanism was the clue to finding the root cause

- **Fix**:
  - Removed `.content` from the `transition: all` rule
  - Kept specific transitions on `.navbar` and `body main` for smooth sidebar expansion
  - `.content` now has NO transition - `padding-top` changes apply instantly
  - Prevents layout bugs during navigation

- **Impact**:
  - ✅ Headers stay properly positioned when navigating between all pages
  - ✅ No more need to toggle sidebar/topbar to "reset" layout
  - ✅ Maintains smooth navbar animations for sidebar expansion
  - ✅ Instant padding updates prevent visual glitches

---

### Fixed - Multiple Global CSS Leaks Causing Header Positioning Issues
- **Files Modified**:
  1. `src/components/Contacts.js` - Removed inline `<style>` tag, fixed classname mismatch
  2. `src/styles/contacts.css` - Updated min-height to 100vh
  3. `src/styles/backlog.css` - Removed unscoped global CSS rules (lines 2201-2211)
  4. `src/styles/create_sprint.css` - Removed unscoped global CSS rules (lines 542-552)

- **Changes**:
  1. **Contacts Component**:
     - Removed inline `<style>` tag that globally overrode `.content, main, body` backgrounds
     - Fixed classname mismatch: `contact-list-item` → `contact-item` to match CSS
     - Added `min-height: 100vh` to `.contacts-page` for proper background coverage

  2. **Backlog CSS**:
     - Removed unscoped global rules targeting `.content`, `main`, and `body`
     - Background already properly handled by `.backlog-page` wrapper

  3. **CreateSprint CSS**:
     - Removed unscoped global rules targeting `.content`, `main`, and `body`
     - Background properly handled by parent wrappers and global CSS

- **Root Cause**:
  - Multiple CSS files contained unscoped global rules that affected `body`, `main`, and `.content` elements across the entire application
  - These rules persisted after navigation because CSS modules stay loaded throughout the session
  - When navigating from Contacts/Messages to ProjectDetails/Board, the accumulated global CSS overrides caused layout conflicts, particularly with the `body.has-topbar .content { padding-top: 64px }` rule

- **Impact**:
  - ✅ Fixes header positioning on ProjectDetails and Board pages after navigating from Contacts/Messages
  - ✅ Eliminates CSS pollution across route changes
  - ✅ Maintains visual appearance of all affected pages
  - ✅ Follows CSS architecture best practices (component-scoped styling)

- **Technical Details**:
  - React doesn't unmount inline `<style>` tags when components unmount
  - CSS files imported in components are loaded globally and persist
  - The `!important` flags made these global overrides impossible to override locally
  - Proper solution: Use page-level wrapper classes for styling instead of global selectors

---

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
