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

/* global idbKeyval */

const queryInput = document.getElementById('query');
// Search for products whenever query input text changes
queryInput.oninput = doSearch;
const resultsList = document.getElementById('results');

const DOCS_FILE = 'data/docs.json';
const PLAYS_DIR = 'plays/';

// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

// Fetch and load docs
console.log('Fetching docs...');
console.time('Fetch docs');
fetch(DOCS_FILE).then(response => {
  return response.json();
}).then(docs => {
  console.timeEnd('Fetch docs');
  docs = docs.slice(0, 20000);
  console.log(`Adding ${docs.length} docs to database...`);
  console.time(`Add ${docs.length} docs to database`);
  idbKeyval.clear();
  let numSet = 0;
  for (const doc of docs) {
    idbKeyval.set(doc.id, doc)
    .then(() => {
      numSet++;
      if (numSet === docs.length) {
        console.timeEnd(`Add ${docs.length} docs to database`);
        console.time('Getting keys...');
        console.time('Get keys');
        idbKeyval.keys().then(keys => {
          console.timeEnd('Get keys');
          console.log('keys.length', keys.length, keys);
        });
      }
    })
    .catch(error => console.error('Error storing doc:', doc, error));
  }
});

// Search for products whenever query input text changes
queryInput.oninput = doSearch;
var timeout = null;
const DEBOUNCE_DELAY = 200;

function doSearch() {
  resultsList.textContent = '';
  const query = queryInput.value;
  if (query.length < 2) {
    return;
  }
  clearTimeout(timeout);
  timeout = setTimeout(function() {
    console.time(`Do search for ${query}`);
    const results = find(query);
    // if (results.length > 0) {
    //   displayMatches(results, query);
    // }
    console.timeEnd(`Do search for ${query}`);
  }, DEBOUNCE_DELAY);
}

function find(query) {
  console.log('Query:', query);
  // const values = [];
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
  const play = PLAYS_DIR + split[0] + '.xml';
  const act = split[1];
  const scene = split[2];
  // a line has a line number, stage direction index, scene description nothing
  const occurrence = split.length === 4 ? split[3] : undefined;
  console.log(play, act, scene, occurrence);

  // hide results div
  // show play div
  // location looks like this: R2.2.3.123
  // find element
  // scrollIntoView(element)
}

// (function() {
//   const oldTimeEnd = console.timeEnd;
//   console.timeEnd = function() {
//     oldTimeEnd.apply(console, arguments);
//   };
// })();

// function toSeconds(ms) {
//   return (ms / 1000).toFixed(2);
// }
