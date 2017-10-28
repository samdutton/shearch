const mz = require('mz/fs');
const {JSDOM} = require('jsdom');

const abbreviations = require('./data/abbreviations.json');

const INPUT_DIR = '../../originals/';
const OUTPUT_DIR = 'htmlout/';

var docNum = 0;

mz.readdir(INPUT_DIR).then(filenames => {
  filenames = filenames.filter(filename => {
    return filename.match(/.+xml/);
  });
  for (const filename of filenames) {
    createDocs(filename);
  }
}).catch(error => console.error(`Error reading from ${INPUT_DIR}:`, error));


function createDocs(filename) {
  JSDOM.fromFile(filename, {contentType: 'text/xml'})
  .then(dom => {
    const play = dom.window.document.querySelectorAll('PLAY');
    const playAbbreviation = abbreviations[filename];
    let docs = [];
    const acts = play.querySelectorAll('ACT');
    for (let actNum = 1; actNum <= acts.length; ++actNum) {
      const act = acts[actNum -1];
      const scenes = act.querySelectorAll('SCENE');
      for (let sceneNum = 1; sceneNum <= scenes.length; ++sceneNum) {
        const scene = scenes[sceneNum - 1];
        const location = playAbbreviation + '.' + actNum + '.' + sceneNum;
        const sceneTitle = scene.querySelector('TITLE').textContent;
        docs.push({
          n: docNum++,
          l: location,
          t: sceneTitle
        });
        const stagedirs = scene.querySelectorAll('div.stage-direction');
        for (const stagedir of stagedirs) {
          docs.push({
            n: docNum++,
            l: location,
            t: stagedir.textContent
          });
        }
        const speeches = scene.querySelectorAll('ol.speech');
        for (const speech of speeches) {
          const speaker = speech.querySelector('li.speaker').textContent;
          const lines = speech.querySelectorAll('li:not(.speaker)');
          for (const line of lines) {
            docs.push({
              n: docNum++,
              l: location,
              s: speaker,
              t: line.textContent
            });
          }
        }
      }
    }
  });
}


  // indexDocs(playAbbreviation, docs);

  // writeFile('output.json', JSON.stringify(docs));

// writeFile('output.json', JSON.stringify(docs));


function writeFile(filepath, string) {
  fs.writeFile(filepath, string, error => {
    if(error) {
      return console.error(error);
    }
    console.log(`The file ${filepath} was saved!`);
  });
}

