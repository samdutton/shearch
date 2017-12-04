const mz = require('mz/fs');
const {JSDOM} = require('jsdom');
const lunr = require('lunr');

const abbreviations = require('../data/abbreviations.json');

const INPUT_DIR = '../../../texts/';
const OUTPUT_FILE = '../../client/lunr/data/index-and-docs.json';

var docNum = 0;
let numFilesToProcess;

mz.readdir(INPUT_DIR).then(filenames => {
  let docs = {};
  filenames = filenames.filter(filename => {
    return filename.match(/.+xml/);
  });
  numFilesToProcess = filenames.length;
  console.log('Parsing docs...');
  for (const filename of filenames) {
    addDocs(docs, filename);
  }
}).catch(error => console.error(`Error reading from ${INPUT_DIR}:`, error));

function createIndex(docs) {
  return lunr(function() {
    // this.field('l'); // e.g. Ant.1.2
    // this.field('s'); // speaker name, if spoken line
    this.field('t'); // text of line, stage direction or scene title
    for (const [key, value] of Object.entries(docs)) {
      value.id = key; // id is the default key for search matches
      this.add(value);
    }
  });
}

function addDocs(docs, filename) {
  console.time('Parse docs');
  JSDOM.fromFile(INPUT_DIR + filename, {contentType: 'text/xml'})
  .then(dom => {
    const play = dom.window.document.querySelector('PLAY');
    const playAbbreviation = abbreviations[filename];
    const acts = play.querySelectorAll('ACT');
    for (let actNum = 1; actNum <= acts.length; ++actNum) {
      const act = acts[actNum -1];
      const scenes = act.querySelectorAll('SCENE');
      for (let sceneNum = 1; sceneNum <= scenes.length; ++sceneNum) {
        let lineNum = 1;
        const scene = scenes[sceneNum - 1];
        const location = playAbbreviation + '.' + actNum + '.' + sceneNum;
        const sceneTitle = scene.querySelector('TITLE');
        // using base 36 to minimise size of key
        docs[(docNum++).toString(36)] = {
          l: location,
          t: sceneTitle.textContent
        };
        const stagedirs = scene.querySelectorAll('STAGEDIR');
        for (const stagedir of stagedirs) {
          docs[(docNum++).toString(36)] = {
            l: location,
            t: stagedir.textContent
          };
        }
        const speeches = scene.querySelectorAll('SPEECH');
        for (const speech of speeches) {
          const speaker = speech.querySelector('SPEAKER');
          const lines = speech.querySelectorAll('LINE');
          // stage directions are added
          for (const line of lines) {
            docs[(docNum++).toString(36)] = {
              // only lines have a line number and speaker
              l: location + '.' + lineNum++,
              s: speaker.textContent,
              t: fixline.textContent)
            };
          }
        }
      }
    }
    console.log(`${numFilesToProcess} files to process`);
    if (--numFilesToProcess === 0) {
      console.timeEnd('Parse docs');
      console.log('Writing data...');
      console.log('Creating index...');
      console.time(`Index ${Object.keys(docs).length} docs`);
      const index = createIndex(docs);
      console.timeEnd(`Index ${Object.keys(docs).length} docs`);
      writeIndexAndDocs(index, docs);
    }
  }).catch(error => {
    console.log(`Error creating DOM from ${filename}`, error);
  });
}

function writeIndexAndDocs(index, docs) {
  const json = {
    index: index,
    docs: docs
  };
  writeFile(OUTPUT_FILE, JSON.stringify(json));
}

function writeFile(filepath, string) {
  mz.writeFile(filepath, string, error => {
    if (error) {
      return console.error(error);
    }
    console.log(`The file ${filepath} was saved!`);
  });
}

function fixtext) {
  return text.
    replace('&c', 'etc.').
    replace(/,--/g, ' — ').
    replace(/--/g, ' — ').
    replace(/, —/g, ' — ').
    replace(/'/g, '’');
}