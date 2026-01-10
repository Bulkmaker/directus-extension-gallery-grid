# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Directus bundle extension containing:
- **gallery-grid** — Interface for managing M2M file relations as a grid gallery with drag-and-drop reordering and cover image selection
- **gallery-grid-cover** — Display for showing cover image from gallery grid in table views

## Build & Deploy Commands

```bash
npm install
npm run build          # Production build to dist/
npm run dev            # Watch mode for development
./deploy.sh            # Local deployment (ignored from git)
```

**IMPORTANT:** `deploy.sh` is ignored by git but can be used for local development to build, copy to extensions, and restart Directus.

## Architecture

```
src/
├── interface/
│   ├── index.ts        # Interface definition (defineInterface)
│   └── interface.vue   # Interface Vue component
└── display/
    ├── index.ts        # Display definition (defineDisplay)
    └── display.vue     # Display Vue component
```

---

## Interface: gallery-grid

### Extension Registration (`src/interface/index.ts`)

- **id:** `gallery-grid`
- **types:** `['alias']` — virtual field, no database column
- **localTypes:** `['files']` — works with M2M file relations
- **group:** `relational`

**Options:**
- `folder` — default upload folder (UUID)
- `columns` — grid columns count (1-8, default: 4)
- `quickTags` — predefined tags for quick selection (JSON array of strings)

### Component Logic (`src/interface/interface.vue`)

**Props:**
- `value: any[] | null` — array of junction table records or IDs
- `collection: string` — parent collection name
- `field: string` — field name (used to find relation)
- `disabled?: boolean` — read-only mode
- `folder?: string` — upload folder UUID
- `columns?: number` — grid columns
- `quickTags?: string[]` — predefined tags for quick selection

**Internal State:**
```typescript
fileItems: Array<{
  $uid: string,              // Vue key (generated)
  id: number,                // Junction table record ID
  file: DirectusFile,        // File object from directus_files
  is_cover: boolean,         // Cover flag
  sort: number,              // Sort order
  tags: string[]             // Tags array
}>
```

**Emit Format:**
```typescript
[{
  id: number,                // Junction record ID (undefined for new)
  directus_files_id: string, // File UUID
  sort: number,              // Position (1-based)
  is_cover: boolean,         // Cover flag
  tags: string[]             // Tags array
}]
```

### Key Functions

| Function | Description |
|----------|-------------|
| `buildEmitValue()` | Converts `fileItems` to emit format |
| `onUpload(files)` | Handles new file uploads, creates junction items |
| `toggleCover(index)` | Sets/unsets cover (only one allowed) |
| `onSortEnd()` | Emits after drag-and-drop reorder |
| `confirmRemove()` | Unlinks file (keeps file in storage) |
| `confirmDelete()` | Deletes file from storage via API |
| `toggleTag(index, tag)` | Adds or removes a tag from an item |
| `addCustomTag(index)` | Adds a custom tag from input |
| `removeTag(index, tag)` | Removes a specific tag |

### Watch Behavior

The `watch` on `props.value`:
1. If junction IDs present — fetches full data from API
2. Maps server data preserving `is_cover` from props (unsaved changes priority)
3. If no IDs — treats as new unsaved items with embedded file data

Uses `skipNextWatch` flag to prevent re-fetching after own emit.

---

## Display: gallery-grid-cover

### Extension Registration (`src/display/index.ts`)

- **id:** `gallery-grid-cover`
- **types:** `['alias']`
- **localTypes:** `['files']`

**Options:**
- `circle` — boolean, render as circle (default: false)
- `size` — integer, width in pixels (40-400, default: 200)

**Fields Function:**
```typescript
fields: (options, { field }) => [
  `${field}.id`,
  `${field}.is_cover`,
  `${field}.directus_files_id.id`,
  `${field}.directus_files_id.type`,
  `${field}.directus_files_id.title`,
]
```
This tells Directus which nested fields to fetch for the display.

### Component Logic (`src/display/display.vue`)

**Props:**
- `value: any[] | null` — junction table records or IDs
- `collection: string` — parent collection
- `field: string` — field name
- `circle?: boolean` — circle mode
- `size?: number` — width in pixels

**Cover Selection Logic:**
1. Extract junction IDs from `props.value`
2. Fetch junction items with `is_cover` and file field
3. Find item where `is_cover === true`
4. Fallback to first item if no cover set
5. Display file preview or placeholder

**States:**
- Loading spinner while fetching
- Image preview when cover found
- Placeholder icon if files exist but no image
- Dash `—` if no files

### Image URL

```
/assets/${coverFileId}?width=400&quality=80&fit=contain
```

Uses Directus asset transformation for optimized thumbnails.

---

## Relation Discovery

Both interface and display use the same pattern:
1. Find junction relation via `relationsStore`
2. Extract `junctionCollection` and `fileField`
3. Query junction table for data

## Database Requirements

Junction table must have:
- `id` — primary key (auto-increment)
- `sort` — integer for ordering
- `is_cover` — boolean for cover selection
- `tags` — JSON array for image tags (optional)
- Foreign key to parent collection
- Foreign key to `directus_files`

## Dependencies

- `vuedraggable@^4.1.0` — drag-and-drop grid
- `@directus/extensions-sdk` — Directus API and stores
