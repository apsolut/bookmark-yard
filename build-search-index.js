/**
 * Build script to generate search-index.json from all HTML files
 * Run: node build-search-index.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'search-index.json');

// Simple HTML entity decoder
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Extract bookmark data from HTML content
function extractBookmarks(html, filePath) {
  const bookmarks = [];
  const cardRegex = /<article class="bookmark-card"[^>]*data-title="([^"]*)"[^>]*data-domain="([^"]*)"[^>]*data-tags="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g;

  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const [, dataTitle, dataDomain, dataTags, cardContent] = match;

    // Extract the actual link and display title
    const linkMatch = cardContent.match(/<h3><a href="([^"]*)"[^>]*>([^<]*)<\/a><\/h3>/);
    const excerptMatch = cardContent.match(/<p class="excerpt">([^<]*)<\/p>/);
    const collectionMatch = cardContent.match(/<a href="([^"]*)" class="collection-link">([^<]*)<\/a>/);
    const dateMatch = cardContent.match(/<span class="date">([^<]*)<\/span>/);
    const isFavorite = cardContent.includes('class="favorite"');
    const imgMatch = cardContent.match(/<img src="([^"]*)"[^>]*class="bookmark-cover"/);

    if (linkMatch) {
      bookmarks.push({
        title: decodeEntities(linkMatch[2]),
        url: linkMatch[1],
        domain: dataDomain,
        tags: dataTags ? dataTags.split(' ').filter(t => t) : [],
        excerpt: excerptMatch ? decodeEntities(excerptMatch[1]) : '',
        collection: collectionMatch ? collectionMatch[2] : '',
        collectionUrl: collectionMatch ? collectionMatch[1] : '',
        date: dateMatch ? dateMatch[1] : '',
        favorite: isFavorite,
        image: imgMatch ? imgMatch[1] : '',
        page: filePath.replace(ROOT_DIR, '').replace(/\\/g, '/').replace(/^\//, '')
      });
    }
  }

  return bookmarks;
}

// Recursively find all HTML files
function findHtmlFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
      findHtmlFiles(fullPath, files);
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main build function
function buildSearchIndex() {
  console.log('Building search index...');

  const htmlFiles = findHtmlFiles(ROOT_DIR);
  console.log(`Found ${htmlFiles.length} HTML files`);

  const allBookmarks = [];
  const seen = new Set();

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf-8');
    const bookmarks = extractBookmarks(html, file);

    for (const bookmark of bookmarks) {
      // Deduplicate by URL
      if (!seen.has(bookmark.url)) {
        seen.add(bookmark.url);
        allBookmarks.push(bookmark);
      }
    }
  }

  console.log(`Extracted ${allBookmarks.length} unique bookmarks`);

  // Sort by date (newest first)
  allBookmarks.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  // Write the index
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allBookmarks, null, 2));
  console.log(`Written to ${OUTPUT_FILE}`);

  // Also create a minified version for production
  const minFile = path.join(ROOT_DIR, 'search-index.min.json');
  fs.writeFileSync(minFile, JSON.stringify(allBookmarks));
  console.log(`Written minified to ${minFile}`);
}

buildSearchIndex();
