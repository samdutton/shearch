/*
Copyright 2018 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/* global importScripts workbox  */

const CACHE_NAME = 'cache';

importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.0.0-rc.3/workbox-sw.js');

workbox.core.skipWaiting();
workbox.core.clientsClaim();

workbox.routing.registerRoute(
  /\//,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAME,
  })
);

workbox.routing.registerRoute(
  /.*(google-analytics\.com|googletagmanager\.com|cloudflare\.com).*/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAME,
  })
);

// workbox.routing.registerRoute(
//   /\.(|css|html|json|js|png)$/,
//   new workbox.strategies.StaleWhileRevalidate({
//     cacheName: CACHE_NAME,
//   })
// );

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// workbox.routing.setCatchHandler(({url, event, params}) => {
//   console.error('Error handled by workbox.routing.setCatchHandler():',
//     {url, event, params});
//   return Response.error();
// });

