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

/* global PouchDB */
const db = new PouchDB('shearch');

const queryInput = document.getElementById('query');
// Search for products whenever query input text changes
queryInput.oninput = doSearch;
const resultsList = document.getElementById('results');

const DOCS_FILE = 'data/docs.json';

// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

// Fetch and load index
console.log('Fetching docs...');
console.time('Fetch docs');
fetch(DOCS_FILE).then(response => {
  return response.json();
}).then(docs => {
  console.timeEnd('Fetch docs');
  console.log('Adding docs to database...');
  console.time(`Add ${docs.length} docs to database`);
  // docs = docs.slice(0,99);
  // let obj = {};
  // for (const doc of docs) {
  //   obj[doc._id] = obj[doc._id] === undefined ? 1: obj[doc._id] +=1;
  // }
  // console.log(obj);
  // console.log(Object.entries(obj).filter(function(item) {
  //   return item[1] > 1;
  // }));
  db.bulkDocs(docs).then((result) => {
    console.timeEnd(`Add ${docs.length} docs to database`);
    createIndex();
  }).catch(error => {
    console.error('Error putting doc', error);
  });
});

function createIndex() {
  console.log('Creating index...');
  console.time('Create index');
  db.search({
    fields: ['t'],
    build: true
  }).then(function(info) {
    console.timeEnd('Create index');
    console.log('Index info:', info);
    queryInput.disabled = false;
    queryInput.focus();
  }).catch(function(error) {
    console.error('Error creating index: ', error);
  });
}

// Search for products whenever query input text changes
queryInput.oninput = doSearch;
var timeout = null;
const DEBOUNCE_DELAY = 500;

function doSearch() {
  resultsList.textContent = '';
  const query = queryInput.value;
  if (query.length < 3) {
    return;
  }
  // debounce typing
  clearTimeout(timeout);
  timeout = setTimeout(function() {
    find(query);
  }, DEBOUNCE_DELAY);
}

function find(query) {
  console.time(`Do search for ${query}`);
  db.search({
    'query': query,
    'fields': ['t'],
    'include_docs': true
  }).then(function(results) {
    if (results.length === 0) {
      // display no-matches warning
      return;
    } else {
      displayMatches(results, query);
    }
    console.timeEnd(`Do search for ${query}`);
  }).catch(function(error) {
    console.error('db.search error:', error);
  });
}

function displayMatches(matches, query) {
  resultsList.textContent = '';
  let results = matches.rows.map(match => {
    return match.doc;
  });
  const exactPhrase = new RegExp(query, 'i');
  // keep exact matches only
  // results = results.filter(function(result) {
  //   return exactPhrase.test(result.doc.t);
  // });
  // prefer exact matches
  results = results.sort((a, b) => {
    return exactPhrase.test(a.t) ? -1 : exactPhrase.test(b.t) ? 1 : 0;
  });
  // sort not necessary
  // results = results.sort((a, b) =>
  // a.doc.l.localeCompare(b.doc.l, {numeric: true}));

  for (const result of results) {
    addMatch(result);
  }
}

function addMatch(match) {
  const resultElement = document.createElement('li');
  resultElement.classList.add('match');
  resultElement.dataset.location = match.l;
  const text = match.s ? match.t : `<em>${match.t}</em>`;
  resultElement.innerHTML = text;
  resultElement.onclick = function() {
    console.log(match.id);
  };
  resultsList.appendChild(resultElement);
}