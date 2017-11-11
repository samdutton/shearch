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

// Fetch and load docs
console.log('Fetching docs...');
console.time('Fetch docs');
fetch(DOCS_FILE).then(response => {
  return response.json();
}).then(docs => {
  console.timeEnd('Fetch docs');
  console.log('Adding docs to database...');
  console.time(`Add ${docs.length} docs to database`);
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
  db.createIndex({
    index: {fields: ['t']}
  }).then(result => {
    console.timeEnd('Create index');
    queryInput.disabled = false;
    queryInput.focus();
  }).catch(error => {
    console.error('Error creating index: ', error);
  });
}

// Search for products whenever query input text changes
queryInput.oninput = doSearch;
var timeout = null;
const DEBOUNCE_DELAY = 200;

function doSearch() {
  resultsList.textContent = '';
  console.clear();
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
 // fyi: can't use on-disk indexing with regex selector :/
  db.find({selector: {t: {$regex: new RegExp('.*' + query + '.*', 'i')}}}).
  then(function(result) {
    const matches = result.docs;
    if (matches.length === 0) {
      // display no-matches warning
      return;
    } else {
      displayMatches(matches, query);
    }
    console.timeEnd(`Do search for ${query}`);
  }).catch(function(error) {
    console.error('find error:', error);
  });
}

function displayMatches(matches, query) {
  resultsList.textContent = '';
//  console.log('matches', matches);
  let results = [];
  const re = new RegExp(query, 'i');
  for (const match of matches) {
    results.push(match);
  }
  results = results.filter(function(result) {
    return re.test(result.t);
  });
  // results.sort((x, y) => {
  //   return re.test(x.t) ? -1 : re.test(query) ? 1 : 0;
  // });
  // Sort results alphanumerically by location: Ant.1.2.34 before JC.1.1.1
  results.sort((a, b) => a.l.localeCompare(b.l, {numeric: true}));
  for (const result of results) {
    addResult(result);
  }
}

function addResult(match) {
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