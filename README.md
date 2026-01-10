# Directus Extension: Gallery Grid

A Directus bundle extension for managing file galleries with drag-and-drop reordering, cover image selection, and optimized display.

![Directus 10.10+](https://img.shields.io/badge/Directus-10.10%2B-purple)
![License MIT](https://img.shields.io/badge/License-MIT-green)

## Features

- **Grid Layout** — Display files in a customizable grid (1-8 columns)
- **Drag & Drop** — Reorder images with intuitive drag-and-drop
- **Cover Image** — Mark any image as cover for the gallery
- **Quick Tags** — Add predefined tags to images for quick categorization
- **Cover Display** — Show cover image in table/list views
- **File Upload** — Upload new files directly from the interface

## Installation

### NPM

```bash
npm install directus-extension-gallery-grid
```

### Manual

1. Download the latest release
2. Extract to `extensions/directus-extension-gallery-grid/`
3. Restart Directus

## Usage

### 1. Create Junction Table

Create a junction collection (e.g., `articles_files`) with fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer (Auto-increment) | Primary key |
| `sort` | Integer | Sort order |
| `is_cover` | Boolean | Cover image flag |
| `tags` | JSON | Tags array (optional) |
| Foreign key | UUID | Link to parent collection |
| `directus_files_id` | UUID | Link to directus_files |

### 2. Configure Field

1. Add a new field to your collection
2. Choose type: **Alias**
3. Choose interface: **Gallery Grid**
4. Configure the M2M relation to your junction table

### 3. Interface Options

| Option | Description | Default |
|--------|-------------|---------|
| Folder | Default upload folder | — |
| Columns | Number of grid columns | 4 |
| Quick Tags | Predefined tags for fast selection | [] |

### 4. Display Options

Use **Gallery Cover** display to show cover image in lists:

| Option | Description | Default |
|--------|-------------|---------|
| Circle | Render as circle | false |
| Width | Image width in pixels | 200 |

## Bundle Contents

This extension includes:

- **Interface: `gallery-grid`** — Full gallery editor
- **Display: `gallery-grid-cover`** — Cover image preview for lists

## Screenshots

*Coming soon*

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

Miša ([@bulkmaker](https://github.com/bulkmaker))

## Links

- [Directus](https://directus.io)
- [Report Issues](https://github.com/bulkmaker/directus-extension-gallery-grid/issues)
