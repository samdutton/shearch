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

/* global elasticlunr */

const queryInput = document.getElementById('query');
// Search for products whenever query input text changes
queryInput.oninput = doSearch;
const resultsList = document.getElementById('results');
const playIframe = document.querySelector('iframe');

const SEARCH_OPTIONS = {
  fields: {
    t: {}
  },
  bool: 'AND',
  expand: true // true: do not require whole-word matches only
};

var index;

const INDEX_FILE = 'data/index.json';
const PLAYS_DIR = '../plays/';

var timeout = null;
const DEBOUNCE_DELAY = 200;


// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

// Get index data and load index
console.log('Fetching index...');
console.time('Fetch index');
fetch(INDEX_FILE).then(response => {
  return response.json();
}).then(json => {
  console.timeEnd('Fetch index');
  // elasticlunr.clearStopWords = function() {
  //   elasticlunr.stopWordFilter.stopWords = {};
  // };
  console.log('Loading index...');
  console.time('Load index');
  index = elasticlunr.Index.load(json);
  console.timeEnd('Load index');
  queryInput.disabled = false;
  queryInput.focus();
});


function doSearch() {
  resultsList.textContent = '';
  const query = queryInput.value;
  if (query.length < 2) {
    return;
  }
  clearTimeout(timeout);
  timeout = setTimeout(function() {
    console.time(`Do search for ${query}`);
    const results = index.search(query, SEARCH_OPTIONS);
    if (results.length > 0) {
      hide(playIframe);
      show(resultsList);
      displayMatches(results, query);
    }
    console.timeEnd(`Do search for ${query}`);
  }, DEBOUNCE_DELAY);
}

function displayMatches(results, query) {
  const exactPhrase = new RegExp(query, 'i');
  // keep exact matches only
  // results = results.filter(function(result) {
  //   return exactPhrase.test(result.doc.t);
  // });
  // prefer exact matches
  results = results.sort((a, b) => {
    return exactPhrase.test(a.doc.t) ? -1 : exactPhrase.test(b.doc.t) ? 1 : 0;
  });
  // sort not necessary
  // results = results.sort((a, b) =>
  // a.doc.l.localeCompare(b.doc.l, {numeric: true}));
  for (const result of results) {
    addResult(result.doc);
  }
}

function addResult(match) {
  const resultElement = document.createElement('li');
  resultElement.classList.add('match');
  resultElement.dataset.location = match.l;
  const html = match.s ? match.t : `<em>${match.t}</em>`;
  resultElement.innerHTML = html;
  resultElement.onclick = function() {
    showPlay(match.l);
  };
  resultsList.appendChild(resultElement);
}

function showPlay(location) {
  const split = location.split('.');
  const playFilepath = PLAYS_DIR + split[0] + '.html';
  const actIndex = split[1] - 1;
  const sceneIndex = split[2] - 1;
  const itemNum = split.length === 4 ? split[3] : undefined;
  // line: itemNum is one-based line number (5th lines are given class 'number')
  // stage direction: itemNum is zero-based index of item within a scene
  // scene description: no itemNum (only one per scene)
  console.log(playFilepath, actIndex, sceneIndex, itemNum);
  hide(resultsList);
  show(playIframe);
  playIframe.src = playFilepath;
  playIframe.onload = function() {
    const playIframeDoc = playIframe.contentWindow.document;
    const act = playIframeDoc.querySelectorAll('section.act')[actIndex];
    const scene = act.querySelectorAll('section.scene')[sceneIndex];
    const lineSelector = 'ol.speech li:not(.speaker):not(.stage-direction)';
    // line number is human-readable one-based
    const line = scene.querySelectorAll(lineSelector)[itemNum - 1];
    line.classList.add('highlight');
    line.scrollIntoView({inline: 'center'});
    console.log('line', line);
    console.log('playIframeDoc.querySelector', scene);
  };
}

function hide(element) {
  element.classList.add('hidden');
}

function show(element) {
  element.classList.remove('hidden');
}