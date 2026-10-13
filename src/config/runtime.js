const stripTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '');

export const API_ORIGIN = stripTrailingSlashes(
  process.env.REACT_APP_API_BASE || 'http://localhost:8080'
);

// Public deal360 website (blog "View on website" links).
export const WEBSITE_BASE_URL = stripTrailingSlashes(
  process.env.REACT_APP_WEBSITE_URL || 'https://www.thedeal360.com'
);

export const STOREFRONT_BASE_URL = stripTrailingSlashes(
  process.env.REACT_APP_STOREFRONT_BASE_URL || 'http://localhost:3001'
);
