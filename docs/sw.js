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

importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.0.0-rc.2/workbox-sw.js');

// if (workbox) {
//   console.log(`Yay! Workbox is loaded 🎉`);
// } else {
//   console.log(`Boo! Workbox didn't load 😬`);
// }

// workbox.routing.registerRoute(
//   /^localhost|shearch\.me$/,
//   // Use cache but update in the background ASAP
//   new workbox.strategies.StaleWhileRevalidate({
//     cacheName: CACHE_NAME,
//   })
// );

workbox.routing.registerRoute(
  /\/$/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAME,
  })
);

workbox.routing.registerRoute(
  /\.(|css|html|json|js|png)$/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAME,
  })
);

workbox.routing.registerRoute(
  /.*(google-analytics\.com|googletagmanager\.com|cloudflare\.com).*/,
  workbox.strategies.staleWhileRevalidate({
    cacheName: CACHE_NAME,
  })
);

// workbox.routing.setCatchHandler(({url, event, params}) => {
//   console.error('Error handled by workbox.routing.setCatchHandler():',
//     {url, event, params});
//   return Response.error();
// });

