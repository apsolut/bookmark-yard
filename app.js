/**
 * Bookmark Yard - Client-side filtering and search
 * Works 100% on GitHub Pages (no server required)
 */

(function() {
  'use strict';

  const BASE_PATH = '/bookmark-yard';
  let searchIndex = null;
  let searchTimeout = null;

  // ============================================
  // URL Parameter Handling
  // ============================================

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      q: params.get('q') || '',
      tag: params.get('tag') || '',
      favorites: params.get('favorites') === 'true'
    };
  }

  function setUrlParams(params) {
    const url = new URL(window.location);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    window.history.replaceState({}, '', url);
  }

  // ============================================
  // Search Index Loading
  // ============================================

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;

    try {
      const response = await fetch(`${BASE_PATH}/search-index.min.json`);
      searchIndex = await response.json();
      return searchIndex;
    } catch (e) {
      console.error('Failed to load search index:', e);
      return [];
    }
  }

  // ============================================
  // Global Search
  // ============================================

  function createSearchResults(results, query) {
    const container = document.getElementById('global-search-results');
    if (!container) return;

    if (!results.length) {
      container.innerHTML = `<div class="search-no-results">No results for "${query}"</div>`;
      container.classList.add('active');
      return;
    }

    const html = results.slice(0, 20).map(item => `
      <a href="${item.url}" target="_blank" rel="noopener" class="search-result-item">
        <div class="search-result-title">${highlightMatch(item.title, query)}</div>
        <div class="search-result-meta">
          <span class="search-result-domain">${item.domain}</span>
          ${item.favorite ? '<span class="search-result-fav">★</span>' : ''}
          ${item.tags.length ? `<span class="search-result-tags">${item.tags.slice(0, 3).join(', ')}</span>` : ''}
        </div>
      </a>
    `).join('');

    container.innerHTML = `
      <div class="search-results-header">
        Found ${results.length} results ${results.length > 20 ? '(showing first 20)' : ''}
      </div>
      ${html}
    `;
    container.classList.add('active');
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function hideSearchResults() {
    const container = document.getElementById('global-search-results');
    if (container) {
      container.classList.remove('active');
    }
  }

  async function performGlobalSearch(query) {
    if (!query || query.length < 2) {
      hideSearchResults();
      return;
    }

    const index = await loadSearchIndex();
    const q = query.toLowerCase();

    const results = index.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.domain.toLowerCase().includes(q) ||
      item.tags.some(tag => tag.toLowerCase().includes(q)) ||
      item.excerpt.toLowerCase().includes(q)
    );

    createSearchResults(results, query);
  }

  // ============================================
  // Current Page Filtering
  // ============================================

  function filterCurrentPage(query, tagFilter, favoritesOnly) {
    const cards = document.querySelectorAll('.bookmark-card');

    cards.forEach(card => {
      const title = card.dataset.title || '';
      const domain = card.dataset.domain || '';
      const tags = card.dataset.tags || '';
      const isFavorite = card.querySelector('.favorite') !== null;

      let show = true;

      // Text search
      if (query) {
        const q = query.toLowerCase();
        show = title.includes(q) || domain.includes(q) || tags.includes(q);
      }

      // Tag filter
      if (show && tagFilter) {
        show = tags.split(' ').includes(tagFilter.toLowerCase());
      }

      // Favorites filter
      if (show && favoritesOnly) {
        show = isFavorite;
      }

      card.classList.toggle('hidden', !show);
    });

    updateFilterStatus(query, tagFilter, favoritesOnly);
  }

  function updateFilterStatus(query, tagFilter, favoritesOnly) {
    let status = document.getElementById('filter-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'filter-status';
      const header = document.querySelector('.page-header');
      if (header) {
        header.appendChild(status);
      }
    }

    const filters = [];
    if (query) filters.push(`Search: "${query}"`);
    if (tagFilter) filters.push(`Tag: #${tagFilter}`);
    if (favoritesOnly) filters.push('Favorites only');

    if (filters.length) {
      const visible = document.querySelectorAll('.bookmark-card:not(.hidden)').length;
      status.innerHTML = `
        <span class="filter-info">Filtering: ${filters.join(' | ')} (${visible} shown)</span>
        <button class="clear-filters" onclick="window.clearAllFilters()">Clear filters</button>
      `;
      status.style.display = 'flex';
    } else {
      status.style.display = 'none';
    }
  }

  window.clearAllFilters = function() {
    const searchInput = document.getElementById('search');
    if (searchInput) searchInput.value = '';

    const favToggle = document.getElementById('favorites-toggle');
    if (favToggle) favToggle.classList.remove('active');

    setUrlParams({ q: '', tag: '', favorites: '' });
    filterCurrentPage('', '', false);
    filterSidebar('');
    hideSearchResults();
    updateSidebarClearButton(false);
    updateQuickFilterState('');
  };

  // ============================================
  // Sidebar Navigation Filter
  // ============================================

  function filterSidebar(query) {
    const navGroups = document.querySelectorAll('.nav-group');
    const q = query.toLowerCase();

    navGroups.forEach(group => {
      const links = group.querySelectorAll('ul li a');
      let hasMatch = false;

      links.forEach(link => {
        const text = link.textContent.toLowerCase();
        const matches = !q || text.includes(q);
        link.parentElement.style.display = matches ? '' : 'none';
        if (matches && q) hasMatch = true;
      });

      // Auto-expand groups with matches
      if (q && hasMatch) {
        group.open = true;
      }
    });
  }

  // ============================================
  // Sidebar State Persistence
  // ============================================

  function saveSidebarState() {
    const groups = document.querySelectorAll('.nav-group');
    const state = {};

    groups.forEach((group, index) => {
      const summary = group.querySelector('summary');
      const key = summary ? summary.textContent.trim() : `group-${index}`;
      state[key] = group.open;
    });

    localStorage.setItem('sidebar-state', JSON.stringify(state));
  }

  function restoreSidebarState() {
    const saved = localStorage.getItem('sidebar-state');
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      const groups = document.querySelectorAll('.nav-group');

      groups.forEach((group, index) => {
        const summary = group.querySelector('summary');
        const key = summary ? summary.textContent.trim() : `group-${index}`;
        if (key in state) {
          group.open = state[key];
        }
      });
    } catch (e) {
      console.error('Failed to restore sidebar state:', e);
    }
  }

  // ============================================
  // Favorites Toggle
  // ============================================

  function createFavoritesToggle() {
    const navList = document.querySelector('.nav-list');
    if (!navList) return;

    // Check if toggle already exists
    if (document.getElementById('favorites-toggle')) return;

    const li = document.createElement('li');
    li.innerHTML = `
      <button id="favorites-toggle" class="favorites-toggle-btn">
        <span class="fav-icon">★</span> Favorites Only
      </button>
    `;
    navList.appendChild(li);

    const btn = document.getElementById('favorites-toggle');
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const isActive = btn.classList.contains('active');
      const searchInput = document.getElementById('search');
      const query = searchInput ? searchInput.value : '';
      const params = getUrlParams();

      setUrlParams({ ...params, favorites: isActive ? 'true' : '' });
      filterCurrentPage(query, params.tag, isActive);
    });
  }

  // ============================================
  // Tag Click Filtering
  // ============================================

  function setupTagFiltering() {
    document.addEventListener('click', (e) => {
      const tagEl = e.target.closest('.tag');
      if (!tagEl) return;

      // If tag is a link (on tags page), let it navigate
      if (tagEl.tagName === 'A' && tagEl.href) return;

      e.preventDefault();

      // Get tag text without the count span
      const countSpan = tagEl.querySelector('.tag-count');
      const tag = countSpan
        ? tagEl.textContent.replace(countSpan.textContent, '').trim()
        : tagEl.textContent.trim();

      const searchInput = document.getElementById('search');
      const query = searchInput ? searchInput.value : '';
      const params = getUrlParams();

      setUrlParams({ ...params, tag });
      filterCurrentPage(query, tag, params.favorites);
    });
  }

  // ============================================
  // Quick Filter Buttons
  // ============================================

  const QUICK_FILTERS = ['ai', 'prompt', 'api', 'context', 'open source', 'security', 'inspiration'];

  function createQuickFilters() {
    const main = document.querySelector('main');
    if (!main || document.getElementById('quick-filters')) return;

    const container = document.createElement('div');
    container.id = 'quick-filters';
    container.className = 'quick-filters';

    const label = document.createElement('span');
    label.className = 'quick-filters-label';
    label.textContent = 'Quick search:';
    container.appendChild(label);

    QUICK_FILTERS.forEach(term => {
      const btn = document.createElement('button');
      btn.className = 'quick-filter-btn';
      btn.textContent = term;
      btn.dataset.term = term;
      btn.addEventListener('click', () => applyQuickFilter(term));
      container.appendChild(btn);
    });

    main.insertBefore(container, main.firstChild);
  }

  function applyQuickFilter(term) {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.value = term;
      searchInput.dispatchEvent(new Event('input'));
    }

    // Update button states
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.term === term);
    });

    // Update URL
    const params = getUrlParams();
    setUrlParams({ ...params, q: term });
  }

  function updateQuickFilterState(query) {
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.term === query.toLowerCase());
    });
  }

  // ============================================
  // Search Results Container
  // ============================================

  function createSearchResultsContainer() {
    if (document.getElementById('global-search-results')) return;

    const container = document.createElement('div');
    container.id = 'global-search-results';
    container.className = 'global-search-results';

    const searchWrapper = document.querySelector('.sidebar-search');
    if (searchWrapper) {
      searchWrapper.appendChild(container);
    }
  }

  // ============================================
  // Sidebar Clear Search Button
  // ============================================

  function updateSidebarClearButton(hasActiveSearch) {
    let clearBtn = document.getElementById('sidebar-clear-search');
    const searchWrapper = document.querySelector('.sidebar-search');

    if (!searchWrapper) return;

    if (hasActiveSearch) {
      if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.id = 'sidebar-clear-search';
        clearBtn.className = 'sidebar-clear-btn';
        clearBtn.innerHTML = '✕ Clear search';
        clearBtn.addEventListener('click', () => window.clearAllFilters());
        searchWrapper.appendChild(clearBtn);
      }
      clearBtn.style.display = 'block';
    } else if (clearBtn) {
      clearBtn.style.display = 'none';
    }
  }

  // ============================================
  // Initialize
  // ============================================

  function init() {
    // Create UI elements
    createSearchResultsContainer();
    createFavoritesToggle();
    createQuickFilters();

    // Restore sidebar state
    restoreSidebarState();

    // Setup sidebar state saving
    document.querySelectorAll('.nav-group').forEach(group => {
      group.addEventListener('toggle', saveSidebarState);
    });

    // Setup tag filtering
    setupTagFiltering();

    // Get URL parameters
    const params = getUrlParams();

    // Setup search input
    const searchInput = document.getElementById('search');
    if (searchInput) {
      // Pre-fill from URL
      if (params.q) {
        searchInput.value = params.q;
      }

      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (searchTimeout) clearTimeout(searchTimeout);

        // Debounce search
        searchTimeout = setTimeout(() => {
          // Filter current page immediately
          const urlParams = getUrlParams();
          filterCurrentPage(query, urlParams.tag, urlParams.favorites);
          filterSidebar(query);

          // Global search with slight delay
          performGlobalSearch(query);

          // Update URL
          setUrlParams({ ...urlParams, q: query });

          // Update quick filter button state
          updateQuickFilterState(query);

          // Show/hide clear button
          updateSidebarClearButton(query.length > 0 || urlParams.tag || urlParams.favorites);
        }, 150);
      });

      // Close search results when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.sidebar-search')) {
          hideSearchResults();
        }
      });
    }

    // Apply initial filters from URL
    if (params.q || params.tag || params.favorites) {
      if (params.favorites) {
        const favToggle = document.getElementById('favorites-toggle');
        if (favToggle) favToggle.classList.add('active');
      }
      filterCurrentPage(params.q, params.tag, params.favorites);
      if (params.q) {
        updateQuickFilterState(params.q);
      }
      updateSidebarClearButton(true);
    }

    // Preload search index in background
    loadSearchIndex();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
