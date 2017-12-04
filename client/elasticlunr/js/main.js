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
const matchesList = document.getElementById('matches');
const textIframe = document.querySelector('iframe');

const SEARCH_OPTIONS = {
  fields: {
    t: {}
  },
  bool: 'AND',
  expand: true // true means matches are not whole-word-only
};

var index;

const INDEX_FILE = 'data/index.json';
const HTML_DIR = '../html/';

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
  matchesList.textContent = '';
  const query = queryInput.value;
  if (query.length < 2) {
    return;
  }
  clearTimeout(timeout);
  timeout = setTimeout(function() {
    console.time(`Do search for ${query}`);
    const matches = index.search(query, SEARCH_OPTIONS);
    if (matches.length > 0) {
      hide(textIframe);
      show(matchesList);
      displayMatches(matches, query);
    }
    console.timeEnd(`Do search for ${query}`);
  }, DEBOUNCE_DELAY);
}

function displayMatches(matches, query) {
  const exactPhrase = new RegExp(query, 'i');
  // keep exact matches only
  // matches = matches.filter(function(match) {
  //   return exactPhrase.test(match.doc.t);
  // });
  // prefer exact matches
  matches = matches.sort((a, b) => {
    return exactPhrase.test(a.doc.t) ? -1 : exactPhrase.test(b.doc.t) ? 1 : 0;
  });
  // sort not necessary
  // matches = matches.sort((a, b) =>
  // a.doc.l.localeCompare(b.doc.l, {numeric: true}));
  for (const match of matches) {
    addMatch(match.doc);
  }
}

function addMatch(match) {
  const matchElement = document.createElement('li');
  matchElement.dataset.location = match.l;
  // hack: // play locations have four parts
  const isPlay = match.l.split('.').length === 4;
  const html = isPlay ? match.t : `<em>${match.t}</em>`;
  matchElement.innerHTML = html;
  matchElement.onclick = function() {
    displayText(match);
  };
  matchesList.appendChild(matchElement);
}

function displayText(match) {
  const location = match.l.split('.'); // l represents location, e.g. Ham.3.3.2
  // first part of location is the abbreviation of the name of the play or poem
  const textFilepath = HTML_DIR + location[0] + '.html';
  textIframe.src = textFilepath;
  const actIndex = location[1];
  const sceneIndex = location[2];
  const textIframeDoc = textIframe.contentWindow.document;
  const act = textIframeDoc.querySelectorAll('section.act')[actIndex];
  const scene = act.querySelectorAll('section.scene')[sceneIndex];
  textIframe.onload = function() {
    // text matches are lines, scene titles or stage directions
    if (match.s) { // match has a speaker (match.s) so is a line
      const lineIndex = location[3];
      // select li elements that are actually lines, not speakers or stage dirs
      const lineSelector = 'ol.speech li:not(.speaker):not(.stage-direction)';
      displayMatch(scene, lineSelector, lineIndex);
    } else if (match.r === 's') { // match role is a stage direction
      const stagedirIndex = match.i;
      displayMatch(scene, '.stage-direction', stagedirIndex);
    } else if (match.r === 't') {  // match role is a scene title
      displayMatch(scene, '.stage-direction', 0);
    }
  };
  hide(matchesList);
  show(textIframe);
}

function displayMatch(scene, selector, elementIndex) {
  const element = scene.querySelectorAll(selector)[elementIndex];
  element.classList.add('highlight');
  element.scrollIntoView({inline: 'center'});
}

function hide(element) {
  element.classList.add('hidden');
}

function show(element) {
  element.classList.remove('hidden');
}