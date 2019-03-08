const path = require('path');

module.exports = {
  clientsClaim: true,
  globDirectory: 'docs',
  globIgnores: ['data/*.json', 'html/*.html', 'CNAME', 'default.profraw'],
  globPatterns: ['**'],
  offlineGoogleAnalytics: true,
  runtimeCaching: [{
    urlPattern: new RegExp('/data/.*\.json'),
    handler: 'CacheFirst',
    options: {
      cacheName: 'json-data',
      expiration: {
        maxAgeSeconds: 60 * 60 * 24 * 30,
      },
    },
  }, {
    urlPattern: new RegExp('/html/.*\.html'),
    handler: 'CacheFirst',
    options: {
      cacheName: 'html-data',
      expiration: {
        maxAgeSeconds: 60 * 60 * 24 * 30,
      },
    },
  }],
  skipWaiting: true,
  swDest: path.join('docs', 'sw.js'),
};
