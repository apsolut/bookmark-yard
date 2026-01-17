# Bookmark Yard

A searchable, static archive of your [Raindrop.io](https://raindrop.io) bookmarks — hosted free on GitHub Pages.

**[View Live Demo](https://yourusername.github.io/bookmark-yard)**

---

## Features

- **Instant Search** — Filter bookmarks across your entire collection in real-time
- **Tag Filtering** — Click any tag to filter bookmarks instantly
- **Favorites View** — Quick access to your starred bookmarks
- **Organized Collections** — Browse by categories with collapsible navigation
- **100% Static** — No server required, runs entirely on GitHub Pages
- **Responsive Design** — Works on desktop, tablet, and mobile

---

## How It Works

```
Raindrop.io → raindrop-mapping (JSON) → Custom Build → GitHub Pages
```

1. Export bookmarks to JSON using [raindrop-mapping](https://github.com/apsolut/raindrop-mapping)
2. Build static HTML pages from the JSON data
3. Deploy to GitHub Pages

---

## Project Structure

```
├── index.html          # Main page with all bookmarks
├── favorites.html      # Starred bookmarks
├── tags.html           # Browse by tags
├── collection/         # Organized bookmark pages by category
│   ├── ai/
│   ├── webdev/
│   └── ...
├── search-index.json   # Pre-built search index for fast lookups
├── app.js              # Client-side search & filtering logic
└── styles.css          # Styling
```

---

## Tech Stack

- **Data Source** — [raindrop-mapping](https://github.com/apsolut/raindrop-mapping) for JSON export
- **Frontend** — Vanilla JS, no frameworks
- **Hosting** — GitHub Pages (static files only)
- **Search** — Client-side filtering with pre-built JSON index

---

## License

MIT
