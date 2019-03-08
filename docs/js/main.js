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

/* globals elasticlunr */

const DATALISTS_FILE = '/data/datalists.json';
const HTML_DIR = '/html/';
const INDEX_FILE = '/data/index.json';

const CACHE_NAME = 'cache';
const DEBOUNCE_DELAY = 300;
const SEARCH_OPTIONS = {
  fields: {
    t: {}, // search t field, no special options
  },
  bool: 'AND',
  expand: false, // true means matches are not whole-word-only
};

const QUERY_INPUT_PLACEHOLDER = 'Search for a word or phrase';

const creditElement = document.getElementById('credit');
const genderInput = document.getElementById('gender');
const infoElement = document.getElementById('info');
const matchesList = document.getElementById('matches');
const typePlayCheckbox = document.getElementById('type-play');
const queryInfoElement = document.getElementById('query-info');
const queryInput = document.getElementById('query');
const speakerInput = document.getElementById('speaker');
const speakersDatalist = document.getElementById('speakers');
const textDiv = document.getElementById('text');
const titleInput = document.getElementById('title');
const titlesDatalist = document.getElementById('titles');

let datalists;
let index;
let matches;
let startTime;
let texts;
let timeout = null;

// Handle navigation between search results and text display.
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

// Respond to URL hash changes.
// A hash value is either a search query, text name/abbreviation or citation.
// For example: shearch.me#brazen, shearch.me#hamlet, shearch.me#ham.3.1.56
window.onhashchange = handleHashValue;

window.onload = () => {
  registerServiceWorker();
  getSearchIndex();
};

function getSearchIndex() {
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
    // Get and parse data for texts and speaker names from datalists.json.
    // Run here to ensure that (for performance) index data is retrieved first.
    window.setTimeout(fetchDatalists, 100);
  }).catch((error) => {
    displayInfo('There was a problem downloading data.<br>' +
      'Check that you\'re online, or try refreshing the page.<br><br>');
    console.error(`Error fetching ${INDEX_FILE}: ${error}`);
  });
}

// Fetch and parse data for speaker names and text titles and abbreviations.
function fetchDatalists() {
  fetch(DATALISTS_FILE).then((response) => {
    return response.json();
  }).then((json) => {
    datalists = json;
    for (const speaker of datalists.speakers) {
      const option = document.createElement('option');
      option.value = speaker.n;
      speakersDatalist.appendChild(option);
    }
    texts = datalists.texts;
    const titles = datalists.titles;
    for (const title of titles) {
      const option = document.createElement('option');
      option.value = title;
      titlesDatalist.appendChild(option);
    }
    // NB: handleHashValue() called in checkHashValue()
    // depends on data in DATALISTS_FILE
    window.setTimeout(checkHashValue, 100);
  }).catch((error) => {
    displayInfo('There was a problem downloading data.<br><br>' +
      'Please check that you\'re online or try refreshing the page.');
    console.error(`Error fetching ${DATALISTS_FILE}: ${error}`);
  });
}

// If the location has a hash value, either do a search or load a text,
// depending on the value. For example: shearch.me#brazen,
// shearch.me#Hamlet, shearch.me#ham or shearch.me#ham.3.1.56
// NB: this function uses data fetched in fetchDatalists()
function checkHashValue() {
  if (location.hash) {
    handleHashValue();
  } else {
    queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
  }
  queryInput.focus();
}

// Handle URLs with a hash value: load a search result or text. For example:
// • shearch.me#brazen      Search for 'brazen'
// • shearch.me#ham         Load Hamlet
// • shearch.me#Hamlet      Load Hamlet
// • shearch.me#ham.3.1.56   Load Hamlet, act 3, scene 2, line 1
function handleHashValue() {
  // Decode if necessary and replace non-alpha characters with a space
  const hashValue = decodeURI(location.hash.slice(1)).replace(/[^\w.]+/g, ' ');
  // Check if hashValue is an abbreviation of a text name, e.g. ham
  // The texts object, from texts.json, is keyed by text name abbreviations.
  const abbreviationIndex =
    Object.keys(texts).findIndex((item) =>
      item.toLowerCase() === hashValue.toLowerCase());
  // Check if hashValue is the full name of a text, e.g. Hamlet
  const titleIndex =
    Object.values(texts).findIndex((item) =>
      item.title.toLowerCase() === hashValue.toLowerCase());
  // If the whole hash value is the name of a text or an abbreviation, open it.
  // For example: shearch.me#ham or shearch.me#hamlet
  if (abbreviationIndex !== -1 || titleIndex !== -1) {
    queryInput.value = '';
    hide(creditElement);
    hide(matchesList);
    const abbreviation = abbreviationIndex !== -1 ?
      Object.keys(texts)[abbreviationIndex] :
      Object.keys(texts)[titleIndex];
    // TODO: factor text fetch out to a function
    fetch(`${HTML_DIR}${abbreviation}.html`).then((response) => {
      return response.text();
    }).then((html) => {
      textDiv.innerHTML = html;
      textDiv.onmouseover = addWordSearch;
      show(creditElement);
      show(textDiv);
      queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
    }).catch((error) => {
      console.error(`Error or timeout fetching ${abbreviation}.html: ${error}`);
      displayInfo(`There was a problem downloading ` +
        `<em>${texts[abbreviation].title}.</em><br>` +
        'Check that you\'re online, or try refreshing the page.<br>' +
        'You can download texts when you\'re online by selecting the <br>' +
        '<strong>Download all</strong> checkboxes from ' +
        '<strong>Search&nbsp;options</strong');
    });
    // Otherwise test if the hash value is a citation,
    // e.g. shearch.me#ham.3.1.56.
  } else if (hashValue.indexOf('.') !== -1) {
    const abbreviation = hashValue.split('.')[0].toLowerCase();
    const test = (item) => item.toLowerCase() === abbreviation;
    const abbreviationIndex = Object.keys(texts).findIndex(test);
    // If the text abbreviation in the hash value is found,
    // open text and attempt to set location
    if (abbreviationIndex !== -1) {
      queryInput.value = '';
      hide(creditElement);
      hide(matchesList);
      // Display text and set location from hash value
      // URLs are case sensitive on remote server :/.
      fetch(`${HTML_DIR}${Object.keys(texts)[abbreviationIndex]}.html`).
        then((response) => {
          return response.text();
        }).then((html) => {
          textDiv.innerHTML = html;
          textDiv.onmouseover = addWordSearch;
          show(textDiv);
          show(creditElement);
          queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
          highlightCitation(hashValue);
        }).catch((error) => {
          console.error(`Error or timeout fetching ${abbreviation}: ${error}`);
          displayInfo(`There was a problem downloading ` +
            `<em>${texts[abbreviation].title}.</em><br>` +
            'Check that you\'re online, or try refreshing the page.<br><br>' +
            'You can download texts when you\'re online by selecting the <br>' +
            '<strong>Download all</strong> checkboxes from ' +
            '<strong>Search options</strong');
        });
    } else {
      console.error(`Citation ${hashValue} not found`);
      displayInfo(`Citation ${hashValue} not found`);
    }
  } else {
    // Otherwise treat the hash value as a query, e.g. shearch.me#brazen
    queryInput.value = hashValue;
    doSearch(hashValue);
  }
}

// Search whenever query input changes, with debounce delay
queryInput.oninput = handleQueryInput;

// Do a search if user presses enter/return key
queryInput.onkeydown = () => {
  if (event.key === 'Enter' || event.key === 'Tab') {
    handleQueryInput();
  }
};

// Search whenever query input changes, with debounce delay
function handleQueryInput() {
  const value = queryInput.value;
  if (value.length > 2) {
    // debounce text entry
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      doSearch(value);
    }, DEBOUNCE_DELAY);
  }
}

// Filter matches, if displayed.
titleInput.oninput = speakerInput.oninput = genderInput.oninput = () => {
  if (matches && matches.length > 0) {
    displayMatches();
  }
};

const typeCheckboxes = document.querySelectorAll('div#type input');
for (const typeCheckbox of typeCheckboxes) {
  typeCheckbox.onchange = () => {
    speakerInput.disabled = genderInput.disabled =
      !typePlayCheckbox.checked;
    if (matches && matches.length > 0) {
      displayMatches();
    }
  };
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
  // matches = matches.sort((a, b) => {
  //   return a.doc.l.localeCompare(b.doc.l);
  // });

  // prefer exact matches — already done if SEARCH_OPTIONS expand is false
  // matches = matches.sort((a, b) => {
  //   if (a.doc.t.includes(query) && b.doc.t.includes(query)) {
  //     return 0;
  //   } else if (a.doc.t.includes(query)) {
  //     return -1;
  //   } else if (b.doc.t.includes(query)) {
  //     return 1;
  //   } else {
  //     return 0;
  //   }
  // });

  // Scroll back to top — for example, if user is searching from a text.
  window.scroll(0, 0);

  const message = `Found ${matches.length} match(es) in ${elapsed} seconds`;

  displayInfo(message);
  queryInfoElement.textContent = 'Click on a match to view text';
  displayMatches(query);
}

// Display a list of matched lines, stage directions,
// scene locations and scene descriptions
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
      return texts[playAbbreviation].title.toLowerCase().
        includes(titleInput.value.toLowerCase());
    });
  }
  filteredMatches = filteredMatches.filter((match) => {
  // check if full play name includes text entered in titleInput
    const playAbbreviation = match.doc.l.split('.')[0];
    const type = texts[playAbbreviation].type;
    const checkedTypes =
      [...document.querySelectorAll('div#type input:checked')];
    return checkedTypes.map((item) => item.value).includes(type);
  });
  const message = `Found ${filteredMatches.length} match(es)`;
  displayInfo(message);
  return filteredMatches;
}

// Add an individual match element to the list of matches
function addMatch(match) {
  const matchElement = document.createElement('li');
  matchElement.dataset.location = match.l; // location used to find match
  matchElement.dataset.citation = formatCitation(match); // displayed location
  if (match.x) {
    // stage directions and scene location matches have an 'extras'index
    matchElement.dataset.extra = match.x;
  } else if (match.s) {
    // add speaker name and gender, as used for search options
    matchElement.dataset.speaker = match.s;
    matchElement.dataset.gender = match.g;
  } else if (match.r && match.r === 's') {
    // add classe for stage directions and scene locations
    matchElement.classList.add('direction-location');
  } else if (match.r && match.r === 't') {
    matchElement.classList.add('scene-title');
  }
  matchElement.innerHTML = match.t;
  matchElement.onclick = () => {
    displayText(match);
  };
  matchesList.appendChild(matchElement);
}

// Display the appropriate text and location when a user taps/clicks on a match
function displayText(match) {
  hide(creditElement);
  hide(infoElement);
  hide(matchesList);
  hide(queryInfoElement);
  // match.l is a citation within a play or poem,
  // e.g. Ham.3.3.2, Son.4.11, Ven.140
  // scene title matches only have act and scene number, e.g. Ham.3.3
  history.pushState({type: 'text'}, null,
    `${window.location.origin}#${formatCitation(match)}`);
  document.title =
    `Search Shakespeare: ${formatCitation(match)}`;
  const location = match.l.split('.');
  const abbreviation = location[0];
  // TODO: Factor to a function.
  fetch(`${HTML_DIR}${abbreviation}.html`).then((response) => {
    return response.text();
  }).then((html) => {
    textDiv.innerHTML = html;
    textDiv.onmouseover = addWordSearch;
    show(textDiv);
    show(creditElement);
    highlightMatch(match, location);
  }).catch((error) => {
    console.error(`Error or timeout fetching ${abbreviation}: ${error}`);
    displayInfo(`There was a problem downloading ` +
      `<em>${texts[abbreviation].title}.</em><br><br>` +
      'Check that you\'re online, or try refreshing the page.<br><br>' +
      'You can download texts when you\'re online by selecting the ' +
      '<strong>Download all</strong> checkboxes from ' +
      '<strong>Search options</strong>.');
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

// Highlight a line within a text, given a citation.
// For example: ham.3.1.56, son.7.11, ven.126
// Play citations have an act, scene and line number;
// sonnets have a number and a line; poems only have a line number.
function highlightCitation(citation) {
  const citationArray = citation.split('.');
  const abbreviation = citationArray[0];
  let line;
  let lineNumber;
  switch (textType(abbreviation)) {
  case 'play':
  // For example: Ham.3.1.56
    const actNumber = citationArray[1];
    const sceneNumber = citationArray[2];
    lineNumber = citationArray[3];
    const act = document.querySelectorAll('.act')[actNumber - 1];
    // Citation may not be valid, so need to check for act, scene and line.
    if (act) {
      // If citation only has act, e.g. ham.3
      if (citationArray.length === 2) {
        act.scrollIntoView();
        window.scroll(0, window.scrollY - 180);
        return;
      }
      const scene = act.querySelectorAll('section.scene')[sceneNumber - 1];
      if (scene) {
        // If citation only has scene and not line, e.g. ham.3.1
        if (citationArray.length === 3) {
          scene.scrollIntoView();
          window.scroll(0, window.scrollY - 180);
          return;
        }
        line = scene.querySelector(`li[data-n$="${lineNumber}"]`);
      }
    }
    break;
  case 'poem':
  // For example: ven.126
    lineNumber = citationArray[1];
    // Poems use paragraph elements, not list items.
    // (They're often broken into many parts, so lists become unwieldy.)
    line = document.querySelector(`p[data-n$="${lineNumber}"]`);
    break;
  case 'sonnet':
  // For example: son.76.11
    const sonnetNumber = citationArray[1];
    lineNumber = citationArray[2];
    const sonnet = document.querySelectorAll('section.poem')[sonnetNumber - 1];
    if (sonnet) {
      line = sonnet.querySelector(`li[data-n$="${lineNumber}"]`);
    }
    break;
  default:
    displayInfo(`Citation <em>${citation}</em> not found.`);
    show(infoElement);
  }
  if (line) {
    line.classList.add('highlight');
    line.scrollIntoView({block: 'center'});
  } else {
    displayInfo(`Citation <em>${citation}</em> not found.`);
  }
}

function highlightMatch(match, location) {
  // Matches with either s (speaker) or r (role) properties are plays.
  if (match.s || match.r) {
    const actIndex = location[1];
    const sceneIndex = location[2];
    const act = textDiv.querySelectorAll('.act')[actIndex];
    const scene = act.querySelectorAll('section.scene')[sceneIndex];
    // Text matches are lines, scene titles or stage directions.
    if (match.s) {
      // If the match has a speaker (match.s) it's a spoken line.
      const lineIndex = location[3];
      // List items in speech may be stage direction, scene location or title.
      highlightLine(scene, 'li:not(.direction-location)', lineIndex);
    } else if (match.r === 's') {
    // The match is stage direction or scene location.
      // match.x is the index for these 'extras'
      highlightLine(scene, '.direction-location', match.x);
    } else if (match.r === 't') { // match is scene title, only ever one
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
    // Add line number (for lines rather than stage directions)
    return match.n ? `${text}.${actNum}.${sceneNum}.${match.n}` :
      `${text}.${actNum}.${sceneNum}`;
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

// Service Worker functions (using Workbox)

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant.
    navigator.serviceWorker.register('/sw.js');
  } else {
    displayInfo('This browser cant\'t store downloaded files.<br><br>' +
      'The app will work, but only when you\'re online.');
    console.error('Service worker not supported');
  }
}

async function addToCache(urls) {
  const cache = await window.caches.open(CACHE_NAME);
  await cache.addAll(urls);
  displayInfo(`Downloaded ${urls.length} file(s).`);
}

async function deleteFromCache(urls) {
  const cache = await window.caches.open(CACHE_NAME);
  for (const url of urls) {
    await cache.delete(url);
  }
  displayInfo(`Deleted ${urls.length} file(s).`);
}

const downloadCheckboxes = document.querySelectorAll('div#download input');
for (const downloadCheckbox of downloadCheckboxes) {
  downloadCheckbox.onchange = () => {
    updateCache(downloadCheckbox.value, downloadCheckbox.checked);
  };
}

// Add or remove texts from the cache.
// type is play, poem or sonnet
function updateCache(type, isRequestToCache) {
  if (isRequestToCache) {
    // datalists[type] is an array of play, poem or sonnet file paths
    addToCache(datalists[type]);
  } else {
    deleteFromCache(datalists[type]);
  }
}

// Utility functions

// From https://gist.github.com/davej/728b20518632d97eef1e5a13bf0d05c7
// function fetchWithTimeout(url, options, timeout = 5000) {
//   return Promise.race([fetch(url, options),
//     new Promise((_, reject) =>
//       setTimeout(() => reject(new Error('Timeout')), timeout))]);
// }

// Return the type of a text, given a name abbreviation, e.g. ham, Ham or Hamlet
function textType(abbreviationOrName) {
  // Check if abbreviationOrName is a text abbreviation, e.g. ham or Ham
  const abbreviationIndex =
    Object.keys(texts).findIndex((item) =>
      item.toLowerCase() === abbreviationOrName.toLowerCase());
  // Check if abbreviationOrName is a text name, e.g. Hamlet
  const titleIndex =
    Object.values(texts).findIndex((item) =>
      item.title.toLowerCase() === abbreviationOrName.toLowerCase());
  if (abbreviationIndex !== -1 || titleIndex !== -1) {
    const abbreviation = abbreviationIndex !== -1 ?
      Object.keys(texts)[abbreviationIndex] :
      Object.keys(texts)[titleIndex];
    return texts[abbreviation].type;
  } else {
    console.error(`Text type not found for ${abbreviationOrName}`);
  }
}

// Display information to the user.
function displayInfo(html) {
  infoElement.innerHTML = html;
  show(infoElement);
}

function hide(element) {
  element.classList.add('hidden');
}

function show(element) {
  element.classList.remove('hidden');
}
