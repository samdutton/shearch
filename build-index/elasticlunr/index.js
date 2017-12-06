const mz = require('mz/fs');
const recursive = require('recursive-readdir');

const {JSDOM} = require('jsdom');
const elasticlunr = require('elasticlunr');

const abbreviations = require('../../config/filename-to-abbreviation.json');
const titles = require('../../config/titles.json');

const PLAY_DIR = 'plays-bosak';
const POEM_DIR = 'poems-ps';
const TEXTS_DIR = '../../texts/';
const INDEX_FILE = '../../client/elasticlunr/data/index.json';
const DATALISTS_FILE = '../../config/datalists.json';

let docs = [];
var docNum = 0;
let numFilesToProcess = 0;
let speakers = new Set();

// Parse each XML file in the directories containing play and poem texts
recursive(TEXTS_DIR).then(filepaths => {
  filepaths = filepaths.filter(filename => {
    return filename.match(/.+xml/); // filter out .DS_Store, etc.
  });
  numFilesToProcess = filepaths.length;
  for (const filepath of filepaths) {
    addDocs(filepath);
  }
}).catch(error => console.error(`Error reading from ${TEXTS_DIR}:`, error));

function addDocs(filepath) {
  console.time('Parse texts');
  JSDOM.fromFile(filepath, {contentType: 'text/xml'})
  .then(dom => {
    const filename = filepath.split('/').pop();
    const document = dom.window.document;
    if (filepath.includes(PLAY_DIR)) {
      addPlay(filename, document);
    } else if (filepath.includes(POEM_DIR)) {
      addPoem(filename, document);
    } else {
      console.error(`Unexpected filepath ${filepath}`);
      return;
    }
    console.log(`${numFilesToProcess} files to process`);
    if (--numFilesToProcess === 0) {
      console.timeEnd('Parse texts');
      console.time(`Index ${docs.length} docs`);
      createIndex(docs);
      createDatalists();
      console.timeEnd(`Index ${docs.length} docs`);
    }
  }).catch(error => {
    console.log(`Error creating DOM from ${filepath}`, error);
  });
}

function addPlay(filename, document) {
  const play = document.querySelector('PLAY');
  const playAbbreviation = abbreviations[filename];
  const acts = play.querySelectorAll('ACT');
  for (let actIndex = 0; actIndex !== acts.length; ++actIndex) {
    const act = acts[actIndex];
    const scenes = act.querySelectorAll('SCENE');
    for (let sceneIndex = 0; sceneIndex !== scenes.length; ++sceneIndex) {
      let lineIndex = 0;
      let stagedirIndex = 0; // index for finding stage direction within scene
      const scene = scenes[sceneIndex];
      const location = `${playAbbreviation}.${actIndex}.${sceneIndex}`;
      const sceneTitle = scene.querySelector('TITLE');
      // r signifies 'role', 't' signifies scene title (only one, so no index)
      addDoc(location, sceneTitle.textContent, {r: 't'});
      const stagedirs = scene.querySelectorAll('STAGEDIR');
      for (const stagedir of stagedirs) {
        // r signifies 'role', 's' signifies stage direction, i is index
        addDoc(location, stagedir.textContent, {r: 's', i: stagedirIndex++});
      }
      const speeches = scene.querySelectorAll('SPEECH');
      for (const speech of speeches) {
        const speaker = speech.querySelector('SPEAKER').textContent;
        speakers.add(toTitleCase(speaker, location)); // some names are capitalized
        const lines = speech.querySelectorAll('LINE');
        // stage directions are added separately above, even if within a speech
        for (const line of lines) {
          addDoc(location + '.' + lineIndex++,
              fix(line.textContent), {s: speaker});
        }
      }
    }
  }
}

function addPoem(filename, document) {
  const poemAbbreviation = abbreviations[filename];
  if (poemAbbreviation === 'Son') {
    // sonnet file includes multiple poems
    addSonnets(document);
  } else {
    addSinglePoem(document, poemAbbreviation);
  }
}

function addSinglePoem(document, poemAbbreviation) {
  const lines = document.querySelectorAll('line');
  for (let i = 0; i !== lines.length; ++i) {
    addDoc(`${poemAbbreviation}.${i + 1}`, fix(lines[i].textContent));
  }
}

function addSonnets(document) {
  const sonnets = document.querySelectorAll('sonnet');
  for (let i = 0; i !== sonnets.length; ++i) {
    const sonnet = sonnets[i];
    const lines = sonnet.querySelectorAll('line');
    for (let j = 0; j !== lines.length; ++j) {
      addDoc(`Son.${i + 1}.${j + 1}`, lines[j].textContent);
    }
  }
}

function addDoc(location, text, options) {
  let doc = {
    n: (docNum++).toString(36), // to minimise length/storage of n
    l: location,
    t: text
  };
  if (options) {
    for (const key in options) {
      doc[key] = options[key];
    }
  }
  docs.push(doc);
}

function createIndex() {
  const index = elasticlunr(function() {
    // this.addField('l'); // e.g. Ant.1.2.34
    // this.addField('s'); // speaker name
    this.addField('t'); // text of line, stage direction or scene title
    this.setRef('n'); // index of indexed item
    // Include data with index
    this.saveDocument(true);
    for (let doc of docs) {
      this.addDoc(doc);
    }
  });
  writeFile(INDEX_FILE, JSON.stringify(index));
}

function createDatalists() {
  const datalists = {
    titles: titles,
    speakers: [...speakers].sort()
  };
  writeFile(DATALISTS_FILE, JSON.stringify(datalists));
}

function writeFile(filepath, string) {
  mz.writeFile(filepath, string, error => {
    if(error) {
      return console.error(error);
    }
    console.log(`The file ${filepath} was saved!`);
  });
}

function fix(text) {
  return text.
    replace('&c', 'etc.').
    replace(/,--/g, ' — ').
    replace(/--/g, ' — ').
    replace(/, —/g, ' — ').
    replace(/'/g, '’'); // all straight single quotes should be apostrophes
}

function toTitleCase(string, location) {
  return string.toLowerCase().split(' ').map(function(item) {
    if (!item[0]) {
      console.log('>>>>>', location, string);
    }
    return item.replace(item[0], item[0].toUpperCase());
  }).join(' ');
}