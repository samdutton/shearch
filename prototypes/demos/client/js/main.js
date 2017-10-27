/*
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/* global  */

const PLAYS = 'data/plays.json';
const button = $('button');
button.onclick = getPlay;
const playEl = $('div#play');
const iframe = $('iframe');

// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

function fetchPlayList() {
  startPerf();
  fetch(PLAYS).then(response => {
    endPerf();
    logPerf('Fetching list of plays');
    return response.json();
  }).then(plays => {
    fetchPlays(plays);
  }).catch(error => {});
}

fetchPlayList();

function fetchPlays(plays) {
  for (const play of plays) {
    fetch(`plays/${play}`).then(response => {
      return response.text();
    }).then(text => {
      startPerf();
//      console.log(text.slice(1000, 1100));
      // do something
      // queryInput.disabled = false;
      // queryInput.focus();
    });
  }
  endPerf();
  logPerf('Fetching play texts');
}

function getPlay() {
  const play = 'Ant.html';
  iframe.src = `plays/${play}`;
}

// function getPlay(play) {
//   fetch(`plays/${play}`).then(response => {
//     return response.text();
//   }).then(html => {
//     startPerf();
//     playEl.innerHTML = html;
//     endPerf();
//     logPerf(`Getting ${play}`);
//   });
// }

// Search for products whenever query input text changes
// queryInput.oninput = doSearch;

// Utility functions

function $(selector) {
  return document.querySelector(selector);
}

// function show(element) {
//   element.classList.remove('hidden');
// }

// function hide(element) {
//   element.classList.add('hidden');
// }

// window.performance utilities

function startPerf() {
  window.performance.mark('start');
}

function endPerf() {
  window.performance.mark('end');
}

function logPerf(message) {
  window.performance.clearMeasures();
  window.performance.measure('duration', 'start', 'end');
  const duration =
  performance.getEntriesByName('duration')[0].duration.toPrecision(4);
  console.log(`${message} took ${duration} ms`);
}
