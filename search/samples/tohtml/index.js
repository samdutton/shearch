const fs = require('fs');
const mz = require('mz/fs');
const {JSDOM} = require('jsdom');

const abbreviations = require('./data/abbreviations.json');
const INPUT_DIR = '../../originals/';
const OUTPUT_DIR = 'jsonout/';

mz.readdir(INPUT_DIR).then(filenames => {
  filenames = filenames.filter(filename => {
    return filename.match(/.+xml/);
  });
  for (const filename of filenames) {
    processFile(filename);
  }
}).catch(error => console.error(`Error reading from ${INPUT_DIR}:`, error));


function processFile(filename) {
  JSDOM.fromFile(INPUT_DIR + filename, {contentType: 'text/xml'})
  .then(dom => {
    //  const playTitle = $(dom, 'PLAY > TITLE')[0].textContent;
    const playSubtitle = $(dom, 'PLAY > PLAYSUBT')[0].textContent;
    const playAbbreviation = abbreviations[playSubtitle];
    let docs = [];
    const acts = $(dom, 'ACT');
    let actNum = 0;
    for (const act of acts) {
//      console.log(act.innerHTML.match(/<stagedir>/g[0]));
      actNum++;
      const scenes = $(act, 'SCENE');
      // const actTitle = $(act, 'TITLE')[0].textContent;
      let sceneNum = 0;
      for (const scene of scenes) {
        // const sceneTitle = $(scene, 'TITLE'); // must be searchable
        sceneNum++;
        const location = playAbbreviation + '.' + actNum + '.' + sceneNum;
        const stagedirs = $(scene, 'STAGEDIR');
        for (let stagedir of stagedirs) {
          docs.push({
            l: location,
            t: stagedir.textContent
          });
        }
        const speeches = $(scene, 'SPEECH');
        for (const speech of speeches) {
          const speaker = $(speech, 'SPEAKER')[0];
          const lines = [...$(speech, 'LINE')].map(line => line.textContent);
          docs.push({
            l: location,
            s: speaker.textContent,
            t: lines.join('\n')
          });
          // for (const line of lines) {
          //   docs.push({
          //     l: actNum + '.' + sceneNum,
          //     s: speaker.textContent,
          //     t: line.textContent
          //   });
          // }
        }
      }
    }
  //  const output = dom.serialize();
    const outputPath = OUTPUT_DIR + filename.replace('xml', 'json');
    console.log('Outputing file: ', outputPath);
    writeFile(outputPath, JSON.stringify(docs));
  });
}

function writeFile(filepath, string) {
  fs.writeFile(filepath, string, error => {
    if(error) {
      return console.error(error);
    }
    console.log(`The file ${filepath} was saved!`);
  });
}

// Utility functions

// Return a nodeList of elements for ancestor element and selector
function $(ancestor, selector) {
  return ancestor.constructor.name === 'JSDOM' ?
    ancestor.window.document.querySelectorAll(selector) :
    ancestor.querySelectorAll(selector);
}