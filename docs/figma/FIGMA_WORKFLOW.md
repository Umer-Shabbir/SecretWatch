# Figma MCP Workflow

## Goal

Build the complete SecretWatch Figma system incrementally while keeping Figma structured enough for later code generation and maintenance.

Figma is not a screenshot repository. Build native structure.

## File structure

Use one main Figma Design file unless the project explicitly requires multiple files.

Recommended top-level organization using normal frames:

```text
00 — Cover / Product Map
01 — Foundations
02 — Components
03 — Marketing
04 — Dashboard
05 — Admin
06 — Flows / States
07 — Archive
```

Do not use Figma Sections for application screens.

## Foundation pass

Create:

- color variables
- semantic color variables
- typography styles
- spacing references
- radius references
- component primitives
- light/dark modes where supported

## Component pass

Create reusable components:

- Button
- Icon Button
- Input
- Token Input
- Textarea
- Select
- Checkbox
- Switch
- Badge
- Alert
- Modal
- Confirmation Dialog
- Table
- Statistic Card
- Breadcrumbs
- Tabs
- Sidebar
- Header
- Pagination
- Skeleton
- Empty State
- Finding Card
- Finding Detail
- Review Queue Item
- Worker Status
- Queue Status
- Scan Rule Editor
- Message Template Editor
- Repository Reference
- Secret Redaction

## Screen pass

Each screen must be a normal frame.

Naming:

`[AREA] / [SCREEN] / [STATE]`

Examples:

```text
Marketing / Landing / Default
Marketing / Pricing / Default
Marketing / How It Works / Default
Dashboard / Overview / Default
Dashboard / Findings / Default
Dashboard / Finding Detail / Pending
Dashboard / Flags / Default
Dashboard / Tokens / Default
Dashboard / Scan Rules / Default
Admin / Overview / Default
Admin / Review Queue / Default
Admin / Users / Default
Admin / Rules / Default
Admin / Templates / Default
Admin / Workers / Default
```

## Placement

Never overlap frames.

Recommended:

- 120px horizontal gap
- 120px vertical gap

Place related screens in a readable grid.

## States

Design meaningful states:

- default
- loading
- empty
- error
- success
- disabled
- pending
- approved
- flagged
- ignored
- failed
- confirmation modal
- mobile

Do not create fake states that are not supported by the product.

## Figma-to-code handoff

For each completed screen, record:

- Figma URL
- frame/node ID
- components used
- variables used
- responsive behavior
- special interaction behavior
- state list

The frontend agent must use the selected frame/node as design context through Figma MCP.

## Code-to-Figma verification

When possible, capture the running UI into Figma and compare:

- spacing
- typography
- dimensions
- hierarchy
- state behavior
- responsive behavior
- component reuse

Fix the code or design intentionally; never silently drift.
