const fs = require('fs');
const mz = require('mz/fs');
const {JSDOM} = require('jsdom');

// const abbreviations = require('./data/abbreviations.json');
const INPUT_DIR = '../../originals/';
// const OUTPUT_DIR = 'htmlout/';

mz.readdir(INPUT_DIR).then(filenames => {
  filenames = filenames.filter(filename => {
    return filename.match(/^a_.+/); // .+xml
  });
  for (const filename of filenames) {
    processFile(filename);
  }
}).catch(error => console.error(`Error reading from ${INPUT_DIR}:`, error));


function processFile(filename) {
  JSDOM.fromFile(INPUT_DIR + filename, {contentType: 'text/xml'})
  .then(dom => {
    // let htmldoc = '';
    const play = dom.window.document.querySelector('PLAY');
    const childNodes = play.childNodes;
    for (const node of childNodes) {
      console.log('childNode.nodeName', node.nodeName);
      switch(node.nodeName) {
      case 'TITLE':
        console.log(node.textContent);
        break;
      case 'FM':
        console.log(node.textContent);
        break;
      case 'PERSONAE':
        console.log(node.childNodes.length);
        break;
      case 'SCNDESCR':
        console.log(node.textContent);
        break;
      case 'PLAYSUBT':
        console.log(node.textContent);
        break;
      case 'ACT':
        console.log(node.childNodes.length);
        break;
      case '#text':
        console.log(node.textContent);
        break;
      default:
        console.error(`Node not found: ${node.nodeName}`);
      }
    }
  });
}

// function writeFile(filepath, string) {
//   mz.writeFile(filepath, string).then(() => {
//     console.log(`Success creating ${filepath}`);
//   }).catch(error => console.error(`Error writing to ${filepath}:`, error));
// }

// Utility functions

// Return a nodeList of elements for ancestor element and selector
// function $(ancestor, selector) {
//   return ancestor.constructor.name === 'JSDOM' ?
//     ancestor.window.document.querySelectorAll(selector) :
//     ancestor.querySelectorAll(selector);
// }

// [...components].slice(0,50).forEach(function(component) {
//   console.log(`${playTitle} component`, component.nodeName);
// });
