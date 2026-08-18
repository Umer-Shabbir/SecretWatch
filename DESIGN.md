# DESIGN.md — GitHub Native Design System

## 1. Purpose

This document defines the visual and interaction system for the GitHub Key Leak Reporter.

The product is a developer/security SaaS built around GitHub:
- Public marketing site
- Authenticated user dashboard
- GitHub token management
- Findings and flag history
- Scan rules
- Admin review queue
- User management
- Message templates
- Worker health and operational monitoring

The design direction is **GitHub Native**: familiar developer tooling patterns, GitHub-inspired information hierarchy, restrained color, compact data presentation, clear status labels, and strong emphasis on repository/file/code context.

The system should feel like a natural security extension of GitHub rather than a generic cybersecurity dashboard.

## 2. Design Principles

### 2.1 Developer-first
Use terminology developers already understand:
- Repository
- Finding
- Commit
- File
- Rule
- Issue
- Scan
- Token
- Worker
- Queue
- Review

Avoid marketing-heavy terminology inside the authenticated product.

### 2.2 Familiarity over novelty
Prefer established GitHub-style patterns:
- Tabs
- Breadcrumbs
- Tables
- Labels
- Inline status indicators
- Repository references
- Code snippets
- Activity feeds
- Compact forms

Do not introduce unusual interaction patterns unless they materially improve the workflow.

### 2.3 Information density with hierarchy
Security tooling needs to expose a lot of information, but density must remain readable.

Use:
- Compact rows
- Strong column hierarchy
- Consistent metadata placement
- Subtle borders
- Clear primary actions
- Progressive disclosure for technical details

### 2.4 Status must be immediately understandable
Every finding, job, worker and action should have a visually obvious state.

Use both:
- Color
- Text/icon

Never communicate state through color alone.

### 2.5 Trust and restraint
This product handles security findings and GitHub credentials.

Avoid:
- Excessive gradients
- Neon effects
- Decorative animations
- Fake terminal/hacker aesthetics
- Excessive shadows
- Unnecessary illustrations inside the application

The UI should feel trustworthy and professional.

---

# 3. Visual Identity

## 3.1 Overall Style

Primary reference:
**GitHub developer tooling + modern SaaS refinement**

Characteristics:
- Clean
- Technical
- Compact
- Neutral
- Professional
- Data-oriented
- Slightly rounded
- Border-driven rather than shadow-driven

The authenticated application should support both light and dark themes, with **light theme as the default** unless the product configuration specifies otherwise.

---

# 4. Color System

Use semantic tokens instead of hardcoding colors throughout components.

## 4.1 Light Theme

```css
--color-canvas-default: #ffffff;
--color-canvas-subtle: #f6f8fa;
--color-canvas-inset: #f6f8fa;

--color-border-default: #d0d7de;
--color-border-muted: #d8dee4;

--color-fg-default: #1f2328;
--color-fg-muted: #656d76;
--color-fg-subtle: #6e7781;

--color-accent-emphasis: #0969da;
--color-accent-fg: #0969da;
--color-accent-subtle: #ddf4ff;

--color-success-emphasis: #1f883d;
--color-success-fg: #1a7f37;
--color-success-subtle: #dafbe1;

--color-warning-emphasis: #9a6700;
--color-warning-fg: #9a6700;
--color-warning-subtle: #fff8c5;

--color-danger-emphasis: #cf222e;
--color-danger-fg: #cf222e;
--color-danger-subtle: #ffebe9;

--color-done-emphasis: #8250df;
--color-done-fg: #8250df;
--color-done-subtle: #fbefff;
```

## 4.2 Dark Theme

```css
--color-canvas-default: #0d1117;
--color-canvas-subtle: #161b22;
--color-canvas-inset: #010409;

--color-border-default: #30363d;
--color-border-muted: #21262d;

--color-fg-default: #e6edf3;
--color-fg-muted: #8b949e;
--color-fg-subtle: #6e7681;

--color-accent-emphasis: #1f6feb;
--color-accent-fg: #58a6ff;
--color-accent-subtle: #0d419d;

--color-success-emphasis: #238636;
--color-success-fg: #3fb950;
--color-success-subtle: #033a16;

--color-warning-emphasis: #9e6a03;
--color-warning-fg: #d29922;
--color-warning-subtle: #3d2e00;

--color-danger-emphasis: #da3633;
--color-danger-fg: #f85149;
--color-danger-subtle: #490202;

--color-done-emphasis: #8957e5;
--color-done-fg: #bc8cff;
--color-done-subtle: #321a5f;
```

## 4.3 Semantic Usage

### Blue
Use for:
- Primary links
- Navigation selection
- Primary actions
- Interactive controls

### Green
Use for:
- Success
- Healthy workers
- Completed scans
- Resolved/flagged successful actions

### Yellow
Use for:
- Warnings
- Pending states
- Rate-limit warnings
- Attention required

### Red
Use for:
- Failed jobs
- Critical findings
- Destructive actions
- Security errors

### Purple
Use sparingly for:
- Secondary status
- Special system states
- Admin-only distinctions

---

# 5. Typography

## 5.1 Primary Font

Use:

```text
Inter
```

Fallback:

```text
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

## 5.2 Monospace Font

Use:

```text
JetBrains Mono
```

Fallback:

```text
ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
```

Use monospace for:
- Repository paths
- Commit SHA
- Secret snippets
- Regex rules
- API/technical values
- Worker IDs
- Job IDs

Do not use monospace for normal UI copy.

## 5.3 Type Scale

```text
Display:       32px / 40px / 600
Page title:     24px / 32px / 600
Section title:  20px / 28px / 600
Card title:     16px / 24px / 600
Body:           14px / 22px / 400
Small:          12px / 18px / 400
Caption:        11px / 16px / 500
```

The default application body size is **14px**.

---

# 6. Spacing

Use a 4px base spacing system.

```text
4px   = 1
8px   = 2
12px  = 3
16px  = 4
20px  = 5
24px  = 6
32px  = 8
40px  = 10
48px  = 12
64px  = 16
```

Preferred spacing:
- Component internal padding: 8–16px
- Card padding: 16–24px
- Section spacing: 24–32px
- Page horizontal padding: 24–32px
- Major page sections: 32–48px

Avoid oversized whitespace in data-heavy application screens.

---

# 7. Border Radius

Keep corners restrained.

```text
Small controls: 6px
Buttons:        6px
Inputs:         6px
Cards:          6px
Modals:         8px
Large surfaces: 8px
```

Do not use pill-shaped containers for normal UI.

Pills are reserved for:
- Status badges
- Labels
- Tags

---

# 8. Shadows

The system is primarily border-driven.

Default:
```text
No shadow
```

Use very subtle shadows only for:
- Dropdowns
- Popovers
- Modals
- Floating panels

Avoid heavy card shadows.

---

# 9. Layout

## 9.1 Application Shell

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Header                                                   │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│ Sidebar      │ Main content                              │
│              │                                           │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

Sidebar:
- Width: 240px
- Fixed on desktop
- Collapsible where useful

Main content:
- Flexible
- Maximum content width generally 1200–1400px
- Horizontally centered when appropriate

## 9.2 Mobile

On mobile:
- Sidebar becomes a drawer
- Header remains accessible
- Tables become horizontally scrollable or transform into stacked rows
- Secondary actions move into menus
- Multi-column layouts collapse to one column

Do not simply shrink desktop layouts.

---

# 10. Navigation

## 10.1 Primary Navigation

Suggested sections:

```text
Overview
Findings
Scan Rules
Flags
────────────
Workers
Templates
Users
────────────
Settings
```

Use section labels for grouping.

Selected item:
- Subtle blue background
- Blue/strong text
- Optional leading icon

Do not overuse icons without labels.

## 10.2 Breadcrumbs

Use breadcrumbs on detailed pages:

```text
Findings / #4821
```

For repository context:

```text
Findings / acme/payment-api / src/config/aws.js
```

---

# 11. Header

Header should contain:

Left:
- Product logo/name
- Optional breadcrumb

Right:
- Search
- Notifications if implemented
- Theme switcher
- GitHub identity/avatar
- Account menu

Keep the header compact.

---

# 12. Buttons

## 12.1 Primary

Use for the most important action on a page.

Examples:
- Approve & Flag
- Add Token
- Create Rule
- Save Changes
- Run Scan

Appearance:
- Blue background
- White text
- 6px radius
- 32–36px height

## 12.2 Secondary

Use for alternative actions.

Examples:
- Cancel
- View Details
- Edit
- Retry

Appearance:
- Transparent/white surface
- Border
- Default foreground color

## 12.3 Danger

Use only for destructive operations.

Examples:
- Delete Token
- Disable Rule
- Delete User

Use red styling.

## 12.4 Button Rules

- One primary action per major context
- Avoid multiple visually equal primary buttons
- Destructive actions should require confirmation when consequences are meaningful
- Loading state must preserve button dimensions

---

# 13. Inputs and Forms

Inputs should look like developer tooling.

Default:
- 32–36px height
- 6px radius
- 1px border
- Clear focus ring
- 14px text

Example:

```text
GitHub Token

┌──────────────────────────────────────────────┐
│ ghp_••••••••••••••••••••••••••••            │
└──────────────────────────────────────────────┘
Token is encrypted before storage.

                         [Save Token]
```

Never display stored GitHub tokens in plaintext.

The architecture explicitly requires encrypted token storage and recommends OAuth instead of raw PAT collection when possible. fileciteturn0file0L253-L258

---

# 14. Cards

Cards should primarily organize information rather than decorate the interface.

Use:
- Border
- 6–8px radius
- 16–24px padding
- Optional subtle background

Avoid:
- Large shadows
- Excessive gradients
- Huge corner radii

Example:

```text
┌──────────────────────────────────────┐
│ Worker Health                        │
│                                      │
│ ● Scanner Worker          Healthy    │
│ ● Flagger Worker          Healthy    │
│ ● Scheduler               Healthy    │
└──────────────────────────────────────┘
```

---

# 15. Tables

Tables are a core component.

Use tables for:
- Findings
- Users
- Tokens
- Rules
- Templates
- Jobs
- Flags

Recommended structure:

```text
┌────────────┬──────────────┬──────────┬──────────┬─────────┐
│ Repository │ File         │ Rule     │ Status   │ Created │
├────────────┼──────────────┼──────────┼──────────┼─────────┤
│ acme/api   │ config/aws   │ AWS Key  │ PENDING  │ 2m ago  │
│ acme/shop  │ .env        │ Stripe   │ FLAGGED  │ 8m ago  │
└────────────┴──────────────┴──────────┴──────────┴─────────┘
```

Rules:
- Header has subtle background
- Rows use borders
- Hover state is subtle
- Status uses badge
- Repository names are links
- Technical values use monospace
- Avoid unnecessary vertical separators

---

# 16. Status Badges

Use compact labels.

Examples:

```text
PENDING
APPROVED
FLAGGED
IGNORED
FAILED
```

Finding statuses are defined by the architecture. fileciteturn0file0L115-L123

Semantic mapping:

```text
PENDING   → yellow
APPROVED  → blue
FLAGGED   → green
IGNORED   → gray
FAILED    → red
```

Always display the text.

---

# 17. Findings UI

The finding is the core product object.

Finding list should expose:

```text
Repository
File
Rule
Status
Commit
Detected time
Actions
```

Finding detail should expose:

```text
Finding #4821

Repository
acme/payment-api

File
src/config/aws.js

Commit
a84f3c91...

Matched rule
AWS Access Key

Status
PENDING

Redacted snippet
AKIA••••••••••7XQ

Actions
[Ignore] [Approve & Flag]
```

Never display the actual secret.

The data model explicitly stores only a redacted snippet and never the raw secret value. fileciteturn0file0L115-L123

---

# 18. Code / Secret Snippet

Use a code block for technical context.

```text
src/config/aws.js

const AWS_ACCESS_KEY = "AKIA••••••••••9F3";
```

Styling:
- Monospace
- Subtle inset background
- Border
- 6px radius
- Horizontal scrolling where needed

Secrets must always be redacted.

---

# 19. Review Queue

The review queue is an important admin workflow.

Recommended layout:

```text
Review Queue

37 findings awaiting review

[All] [Critical] [High] [Medium] [Low]

┌────────────────────────────────────────────────────────┐
│ acme/payment-api                                       │
│ src/config/aws.js                                     │
│                                                       │
│ AWS Access Key                                        │
│ Detected 4 minutes ago                                │
│                                                       │
│ [Ignore]                         [Approve & Flag]      │
└────────────────────────────────────────────────────────┘
```

The architecture supports an admin review gate where findings remain `PENDING` until approval. fileciteturn0file0L161-L165

---

# 20. Worker Monitoring

Workers should look operational rather than decorative.

Show:

```text
Scanner Worker
● Healthy

Concurrency
3

Queue
12 pending

Last job
24 seconds ago

Success rate
99.8%
```

Workers include:
- Scanner
- Flagger
- Scheduler

These are separate processes in the architecture. fileciteturn0file0L67-L77

For queue states use:
- Pending
- Processing
- Completed
- Failed

---

# 21. Rules UI

Scan rules should be displayed as developer-configurable rules.

Example:

```text
AWS Access Key
────────────────────────────────

Pattern
AKIA[0-9A-Z]{16}

Status
● Enabled

Created
Aug 15, 2026

[Edit] [Disable]
```

Rule management corresponds to the `ScanRule` model containing name, regex pattern and enabled state. fileciteturn0file0L144-L149

Regex values should use monospace.

---

# 22. Message Templates

Templates should resemble an editor rather than a rich marketing CMS.

Example:

```text
Template: Default Secret Finding

┌─────────────────────────────────────────────────────┐
│ Hello,                                               │
│                                                     │
│ A potential {{rule}} was detected in                │
│ {{repo}} at {{file}}.                                │
│                                                     │
│ Please rotate the exposed credential.               │
└─────────────────────────────────────────────────────┘

Available variables:
{{repo}}  {{file}}  {{rule}}

                         [Save Template]
```

The architecture defines these placeholders. fileciteturn0file0L137-L142

---

# 23. Alerts

Use alerts for meaningful system information.

### Success

```text
✓ Scan completed successfully.
```

### Warning

```text
! GitHub rate limit is approaching.
```

### Error

```text
× Worker failed to process this job.
```

### Info

```text
i Review is required before this finding can be flagged.
```

Do not make every event a toast.

---

# 24. Empty States

Empty states should be functional.

Example:

```text
No findings yet

Your scans haven't detected any potential secrets.

[Run a Scan]
```

Avoid large decorative illustrations.

---

# 25. Loading States

Prefer skeletons for page-level data.

Examples:
- Table row skeletons
- Card skeletons
- Detail panel skeletons

Use spinners only for short actions.

Buttons should show:

```text
Saving...
Scanning...
Approving...
```

---

# 26. Modals and Confirmation

Use modals only when the action requires focused confirmation.

Examples:
- Delete token
- Disable rule
- Approve finding
- Change automation behavior

Confirmation copy should state the consequence.

Example:

```text
Approve finding?

This will allow the flagging worker to create a GitHub issue
using an available authorized token.

[Cancel] [Approve & Flag]
```

---

# 27. Icons

Use a consistent icon library.

Recommended:
**Lucide**

Icon rules:
- 16px for inline controls
- 18px for navigation
- 20–24px for prominent actions
- Icons should reinforce text, not replace it unnecessarily

Avoid mixing multiple icon styles.

---

# 28. Data Visualization

Charts should remain understated.

Recommended:
- Line charts for scan activity
- Bar charts for findings by rule
- Donut/pie only when genuinely useful
- Worker queue metrics
- Rate-limit utilization

Do not use excessive gradients or 3D charts.

---

# 29. Marketing Site

The marketing site can be more spacious than the authenticated application.

Recommended pages:

```text
/
 /pricing
 /how-it-works
```

These routes are part of the architecture. fileciteturn0file0L173-L180

Marketing visual language:
- GitHub-inspired
- More whitespace
- Larger typography
- Product screenshots
- Clear security messaging
- Blue primary CTA

Do not make the marketing site look like a separate brand.

---

# 30. Responsive Rules

## Desktop
- Sidebar visible
- Multi-column dashboards
- Full data tables
- Detail panels can use split layouts

## Tablet
- Sidebar can collapse
- Cards become 2-column
- Tables remain scrollable
- Secondary controls move into menus

## Mobile
- Drawer navigation
- Single-column cards
- Horizontal table scrolling
- Stacked finding details
- Full-width primary actions
- Reduced padding

Minimum interactive target:
```text
44px
```

---

# 31. Accessibility

Requirements:
- WCAG AA contrast target
- Visible keyboard focus
- Semantic HTML
- Labels for every input
- Buttons must have accessible names
- Do not rely on color alone
- Tables require proper headers
- Modals must trap focus
- Escape closes dismissible overlays
- Respect reduced-motion preferences

---

# 32. Motion

Motion should be subtle.

Use:
- 100–200ms transitions
- Fade/slide for dropdowns
- Skeleton loading
- Small status transitions

Avoid:
- Large page animations
- Continuous glowing effects
- Excessive parallax
- Animated backgrounds

Security tooling should feel fast and stable.

---

# 33. Component Inventory

The initial design system should include:

### Foundations
- Colors
- Typography
- Spacing
- Radius
- Borders
- Shadows
- Icons

### Navigation
- App header
- Sidebar
- Breadcrumbs
- Tabs
- Pagination

### Actions
- Button
- Icon button
- Dropdown
- Command/search input

### Forms
- Input
- Password/token input
- Textarea
- Select
- Checkbox
- Switch
- Radio
- Form validation

### Data
- Table
- Badge
- Avatar
- Tooltip
- Code block
- Statistic card
- Timeline

### Feedback
- Alert
- Toast
- Modal
- Confirmation dialog
- Skeleton
- Empty state

### Product-specific
- Finding card
- Finding detail
- Review queue item
- Worker status
- Queue status
- Scan rule editor
- Message template editor
- GitHub repository reference
- Secret redaction display

---

# 34. Screen-Specific Rules

## Marketing

Prioritize:
1. Value proposition
2. How scanning works
3. Security/trust
4. GitHub integration
5. CTA

## User Dashboard

Prioritize:
1. Scan status
2. Findings
3. Flag history
4. Token/account status
5. Scan configuration

The dashboard architecture specifically includes token submission, flagged repositories and scan-rule controls. fileciteturn0file0L40-L46

## Admin Dashboard

Prioritize:
1. Pending review
2. System health
3. Findings
4. Users
5. Rules
6. Templates
7. Worker queues

---

# 35. Design Don'ts

Do NOT:
- Use neon cyberpunk styling
- Make every card floating
- Use excessive gradients
- Use giant rounded containers
- Use terminal text everywhere
- Hide important information behind animations
- Display raw secrets
- Use color alone for statuses
- Make tables unnecessarily large
- Create decorative UI that doesn't improve security workflows

---

# 36. Figma Rules

When implementing this system in Figma:

### Frames
Use normal Figma frames.

Do NOT use Figma Sections for application screens.

### Screen placement
Every screen must have its own clearly separated frame.

Never place frames on top of one another.

Recommended spacing:
```text
Horizontal gap: 120px
Vertical gap:   120px
```

### Naming

Use:

```text
[AREA] / [SCREEN] / [STATE]
```

Examples:

```text
Marketing / Landing / Default
Dashboard / Overview / Default
Dashboard / Findings / Default
Dashboard / Finding Detail / Pending
Admin / Review Queue / Default
Admin / Workers / Default
Admin / Rules / Default
```

### Components

Use reusable components for:
- Buttons
- Inputs
- Tables
- Status badges
- Cards
- Navigation
- Modals
- Alerts

Do not duplicate components manually when the UI pattern is reusable.

---

# 37. Implementation Rules for Next.js + Tailwind

Use design tokens through CSS variables.

Do not scatter raw colors across JSX.

Preferred:

```tsx
className="bg-[var(--color-canvas-default)] text-[var(--color-fg-default)]"
```

or map the variables into Tailwind theme tokens.

Components should be reusable and state-driven.

Example:

```tsx
<StatusBadge status="PENDING" />
```

rather than:

```tsx
<span className="bg-yellow-100 text-yellow-800">
  PENDING
</span>
```

The same semantic component should handle light and dark themes.

---

# 38. Final Design Direction

The product should feel like:

> **GitHub Security, but purpose-built for automated secret discovery and reporting.**

The visual hierarchy should always prioritize:

```text
Repository
    ↓
Finding
    ↓
Security rule
    ↓
Status
    ↓
Evidence
    ↓
Action
```

The interface should be recognizable to GitHub developers within seconds.

**Primary aesthetic:** GitHub Native  
**Primary theme:** Light  
**Secondary theme:** Dark  
**Primary color:** GitHub-style blue  
**Typography:** Inter + JetBrains Mono  
**Shape language:** Compact, lightly rounded  
**Surface language:** Borders over shadows  
**Interaction language:** Familiar developer tooling  
**Information density:** Medium-high  
**Motion:** Minimal  
**Overall personality:** Professional, technical, trustworthy
