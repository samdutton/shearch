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

const genderInput = document.getElementById('gender');
const infoElement = document.getElementById('info');
const matchesList = document.getElementById('matches');
const queryInfoElement = document.getElementById('query-info');
const queryInput = document.getElementById('query');
const speakerInput = document.getElementById('speaker');
const speakersDatalist = document.getElementById('speakers');
const textDiv = document.getElementById('text');
const titleInput = document.getElementById('title');
const titlesDatalist = document.getElementById('titles');

const SEARCH_OPTIONS = {
  fields: {
    t: {},
  },
  bool: 'AND',
  expand: false, // true means matches are not whole-word-only
};


/* globals elasticlunr */

let index;

const ABBREVIATIONS_FILE = '/data/abbreviation-to-title.json';
const DATALISTS_FILE = '/data/datalists.json';
const HTML_DIR = '/html/';
const INDEX_FILE = '/data/index.json';

let abbreviations;
let datalists;
let matches;
let startTime;
let timeout = null;
const DEBOUNCE_DELAY = 300;

// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

window.onpopstate = (event) => {
  if (event.state && event.state.type === 'results') {
    hide(textDiv);
    show(infoElement);
    show(matchesList);
    show(queryInfoElement);
    // queryInput.value = event.state.query;
  } else if (event.state && event.state.type === 'text') {
    hide(infoElement);
    hide(matchesList);
    hide(queryInfoElement);
    show(textDiv);
  } else {
    hide(infoElement);
    hide(matchesList);
    hide(queryInfoElement);
  }
};

window.onhashchange = function(event) {
  handleHashValue();
};

// window.onbeforeunload = function(event) {
//   console.log('beforeunload event', event);
// };

// Get and load index data
console.log('Fetching index...');
console.time('Fetch index');
fetch(INDEX_FILE).then((response) => {
  return response.json();
}).then((json) => {
  console.timeEnd('Fetch index');
  // elasticlunr.clearStopWords = function() {
  //   elasticlunr.stopWordFilter.stopWords = {};
  // };
  console.log('Loading index...');
  console.time('Load index');
  index = elasticlunr.Index.load(json);
  console.timeEnd('Load index');
  queryInput.disabled = false;
  // If the location has a hash value, either do a search or load a text,
  // depending on the value, e.g. shearch.me#brazen or shearch.me#ado.3.2.1
  if (location.hash) {
    handleHashValue();
  } else {
    queryInput.placeholder = 'Enter search text';
  }
  queryInput.focus();
}).catch((error) => {
  console.error(`Error fetching ${INDEX_FILE}: ${error}`);
});

fetch(DATALISTS_FILE).then((response) => {
  return response.json();
}).then((json) => {
  datalists = json;
  for (const speaker of datalists.speakers) {
    const option = document.createElement('option');
    option.value = speaker.name;
    speakersDatalist.appendChild(option);
  }
  const titles = datalists.titles;
  for (const title of titles) {
    const option = document.createElement('option');
    option.value = title;
    titlesDatalist.appendChild(option);
  }
}).catch((error) => {
  console.error(`Error fetching ${DATALISTS_FILE}: ${error}`);
});

fetch(ABBREVIATIONS_FILE).then((response) => {
  return response.json();
}).then((json) => {
  abbreviations = json;
}).catch((error) => {
  console.error(`Error fetching ${ABBREVIATIONS_FILE}: ${error}`);
});

// Search whenever query or other input changes, with debounce delay
queryInput.oninput = () => {
  const query = queryInput.value;
  if (query.length > 2) {
    // debounce text entry
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      doSearch(query);
    }, DEBOUNCE_DELAY);
  }
};

// Filter matches, if displayed.
titleInput.oninput = speakerInput.oninput = genderInput.oninput = () => {
  if (matches && matches.length > 0) {
    displayMatches();
  }
};

// Handle URLs with a hash value: load a search result or text. For example:
// • shearch.me#brazen      Search for 'brazen'
// • shearch.me#ado         Load Much Ado About Nothing
// • shearch.me#ado.3.2.1   Load Much Ado About Nothing, act 3, scene 2, line 1
function handleHashValue() {
  // If the hash value is just the name of a text, or abbreviation, open it.
  const hashValue = decodeURI(location.hash.slice(1));
  const test = (item) => item.toLowerCase() === hashValue.toLowerCase();
  const abbreviationIndex = Object.keys(abbreviations).findIndex(test);
  const titleIndex = Object.values(abbreviations).findIndex(test);
  if (abbreviationIndex !== -1 || titleIndex !== -1) {
    console.log('>>> open text:', hashValue);
    const fileName = abbreviationIndex !== -1 ?
      Object.keys(abbreviations)[abbreviationIndex] :
      Object.keys(abbreviations)[titleIndex];
    fetch(`${HTML_DIR}${fileName}.html`).then((response) => {
      return response.text();
    }).then((html) => {
      textDiv.innerHTML = html;
      textDiv.onmouseover = addWordSearch;
      show(textDiv);
      queryInput.placeholder = 'Enter search text';
      // highlightMatch(match, location);
    });
  } else {
    queryInput.value = hashValue;
    doSearch(hashValue);
  }
}

function doSearch(query) {
  matchesList.textContent = '';
  startTime = window.performance.now();

  console.time(`Do search for ${query}`);
  matches = index.search(query, SEARCH_OPTIONS); // elasticlunr
  console.timeEnd(`Do search for ${query}`);

  const elapsed = Math.round(window.performance.now() - startTime) / 1000;
  hide(textDiv); // hide the div for displaying play or poem text
  show(matchesList); // show search results (matches)

  // sort by play or poem name: doc.l is location
  matches = matches.sort((a, b) => {
    return a.doc.l.localeCompare(b.doc.l);
  });

  // prefer exact matches — already done if SEARCH_OPTIONS expand is false
  matches = matches.sort((a, b) => {
    if (a.doc.t.includes(query) && b.doc.t.includes(query)) {
      return 0;
    } else if (a.doc.t.includes(query)) {
      return -1;
    } else if (b.doc.t.includes(query)) {
      return 1;
    } else {
      return 0;
    }
  });

  const message = `Found ${matches.length} match(es) in ${elapsed} seconds`;

  displayInfo(message);
  queryInfoElement.textContent = 'Click on a match to view text';
  displayMatches(query);
}

// Display a list of matched lines, stage directions and scene descriptions
function displayMatches() {
  hide(infoElement);
  hide(matchesList);
  matchesList.textContent = '';
  hide(queryInfoElement);
  hide(textDiv);
  const filteredMatches = getFilteredMatches();
  if (filteredMatches.length > 0) {
    const query = queryInput.value;
    history.pushState({type: 'results', query}, null,
      `${window.location.origin}#${query}`);
    document.title = `Shakespeare: ${query}`;
    show(infoElement);
    show(matchesList);
    show(queryInfoElement);
    // const exactPhrase = new RegExp(`\b${query}\b`, 'i');
    // keep exact matches only
    // matches = matches.filter(function(match) {
    //   return exactPhrase.test(match.doc.t);
    // });
    //
    for (const match of filteredMatches) {
      addMatch(match.doc);
    }
  } else {
    displayInfo('No matches :^\\');
    queryInfoElement.textContent = '';
  }
}

function getFilteredMatches() {
  let filteredMatches = matches;
  // if a speaker is specified, filter out non-matches
  if (speakerInput.value) {
    filteredMatches = matches.filter((match) => {
      return match.doc.s &&
        match.doc.s.toLowerCase().includes(speakerInput.value.toLowerCase());
    });
  }
  // if gender is specified, filter out non-matches
  if (genderInput.value) {
    filteredMatches = filteredMatches.filter((match) => {
      return match.doc.g && match.doc.g === genderInput.value;
    });
  }
  // if a title is specified, filter out non-matches
  if (titleInput.value) {
    filteredMatches = filteredMatches.filter((match) => {
      // check if full play name includes text entered in titleInput
      const playAbbreviation = match.doc.l.split('.')[0];
      return abbreviations[playAbbreviation].toLowerCase().
        includes(titleInput.value.toLowerCase());
    });
  }
  const message = `Found ${filteredMatches.length} match(es)`;
  displayInfo(message);
  return filteredMatches;
}

// Add an individual match element to the list of matches
function addMatch(match) {
  const matchElement = document.createElement('li');
  matchElement.dataset.location = match.l; // location used to find match
  matchElement.dataset.citation = formatCitation(match); // displayed location
  if (match.i) {
    // stage direction matches have an index
    matchElement.dataset.index = match.i;
  } else if (match.s) {
    // add speaker name and gender, as used for search options
    matchElement.dataset.speaker = match.s;
    matchElement.dataset.gender = match.g;
  } else if (match.r && match.r === 's') {
    // add classes for stage directions and scene titles (just for text styling)
    matchElement.classList.add('stage-direction');
  } else if (match.r && match.r === 't') {
    matchElement.classList.add('scene-title');
  }
  matchElement.innerHTML = match.t;
  matchElement.onclick = () => {
    displayText(match);
  };
  matchesList.appendChild(matchElement);
}

function displayInfo(message) {
  infoElement.textContent = message;
}

// Display the appropriate text and location when a user taps/clicks on a match
function displayText(match) {
  hide(infoElement);
  hide(matchesList);
  hide(queryInfoElement);
  // match.l is a citation within a play or poem, e.g. Ham.3.3.2, Son.4.11, Ven.140
  // scene title matches only have act and scene number, e.g. Ham.3.3
  console.log('match', match);
  history.pushState({type: 'text'}, null,
    `${window.location.origin}#${formatCitation(match)}`);
  document.title =
    `Search Shakespeare: ${formatCitation(match)}`;
  const location = match.l.split('.');
  const text = location[0];
  fetch(`${HTML_DIR}${text}.html`).then((response) => {
    return response.text();
  }).then((html) => {
    textDiv.innerHTML = html;
    textDiv.onmouseover = addWordSearch;
    show(textDiv);
    highlightMatch(match, location);
  });
}

// When the user hovers over a line, wrap a span around each word in the line
// so they can click on a word to search for it.
function addWordSearch(hoverEvent) {
  const el = hoverEvent.target;
  // hover events are also fired by the parent
  // plays and sonnets use <li> for each line; poems use <p>
  if (el.nodeName === 'LI' || el.nodeName === 'P') {
    el.innerHTML = el.innerText.replace(/([\w]+)/g, '<span>$1</span>');
    el.onclick = (spanClickEvent) => {
      const word = spanClickEvent.target.textContent;
      queryInput.value = word;
      doSearch(word);
      window.scrollTo(0, 0);
    };
  }
}

function highlightMatch(match, location) {
  // matches with either s (speaker) or r (role) properties are plays
  if (match.s || match.r) {
    const actIndex = location[1];
    const sceneIndex = location[2];
    const act = textDiv.querySelectorAll('.act')[actIndex];
    const scene = act.querySelectorAll('section.scene')[sceneIndex];
    // text matches are lines, scene titles or stage directions
    if (match.s) { // if the match has a speaker (match.s) it's a spoken line
      const lineIndex = location[3];
      // some list items in speeches are stage directions
      highlightLine(scene, 'li:not(.stage-direction)', lineIndex);
    } else if (match.r === 's') { // match is a stage direction
      highlightLine(scene, '.stage-direction', match.i);
    } else if (match.r === 't') { // match is a scene title, only ever one
      highlightLine(scene, '.scene-description', 0);
    }
  } else { // match is a sonnet or other poem
    // location for sonnets has three parts, e.g. Son.4.11
    // location for other poems only has two parts, e.g. Ven.140
    // Son.html contains all the sonnets; other poems each have their own file
    const isSonnet = location.length === 3;
    const poemElement = isSonnet ?
      textDiv.querySelectorAll('section')[location[1]] : textDiv;
    const lineIndex = isSonnet ? location[2] : location[1];
    // sonnets are each an <ol> with an <li> per line, whereas poems use <p>
    highlightLine(poemElement, 'li, p', lineIndex);
  }
  show(textDiv);
}

// Highlight a match in a play scene or in a poem
function highlightLine(parent, selector, elementIndex) {
  const element = parent.querySelectorAll(selector)[elementIndex];
  element.classList.add('highlight');
  element.scrollIntoView({block: 'center'});
}

// Format location for display to the right of each match
function formatCitation(match) {
  // matches with r (role) or s (speaker) properties are plays, otherwise poems
  const location = match.l.split('.');
  const text = location[0];
  if (match.s || match.r) {
    const actIndex = location[1];
    const actNum = +actIndex + 1; // use + to make integer
    const sceneIndex = location[2];
    const sceneNum = +sceneIndex + 1;
    // const lineIndex = location[3]; // undef for stage dirs and scene titles
    // TODO: add line numbers to index data. These are different from lineIndex,
    // which is the index of the line within the HTML. In the meantime,
    // for plays just display the text name, scene and act number :(.
    return `${text}.${actNum}.${sceneNum}`;
    // return lineIndex ? `${text}.${actNum}.${sceneNum}.${+lineIndex + 1}` :
    //  `${text}.${actNum}.${sceneNum}`;
  } else {
    // location for sonnets has three parts, e.g. Son.4.11
    // location for other poems only has two parts, e.g. Ven.140
    // Son.html contains all the sonnets; other poems each have their own file.
    const isSonnet = location.length === 3;
    return isSonnet ? `${text}.${+location[1] + 1}.${+location[2] + 1}` :
      `${text}.${+location[1] + 1}`; // use + to make integer
  }
}

// Utility functions

function hide(element) {
  element.classList.add('hidden');
}

function show(element) {
  element.classList.remove('hidden');
}
