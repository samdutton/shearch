const mz = require('mz/fs');
const recursive = require('recursive-readdir');
const validator = require('html-validator');
const {JSDOM} = require('jsdom');

const abbreviations = require('../config/filename-to-abbreviation.json');
const titles = require('../config/titles.json');

const bottom = mz.readFileSync('./html-fragments/bottom.html');
const top = mz.readFileSync('./html-fragments/top.html');

const OUTPUT_DIR = '../client/html/';
const PLAY_DIR = 'plays-bosak';
const POEM_DIR = 'poems-ps';
const TEXTS_DIR = '../texts/';

let numFilesToProcess = 0;

// Parse each file in the directory of texts
recursive(TEXTS_DIR).then(filepaths => {
  filepaths = filepaths.filter(filename => {
    return filename.match(/.+xml/); // filter out .DS_Store, etc.
  });
  numFilesToProcess = filepaths.length;
  for (const filepath of filepaths) {
    parseText(filepath);
  }
}).catch(error => console.error(`Error reading from ${TEXTS_DIR}:`, error));

function parseText(filepath) {
  console.time('Parse texts');
  JSDOM.fromFile(filepath, {contentType: 'text/xml'})
  .then(dom => {
    const filename = filepath.split('/').pop();
    const document = dom.window.document;
    if (filepath.includes(PLAY_DIR)) {
      parsePlay(filename, document);
    } else if (filepath.includes(POEM_DIR)) {
      parsePoem(filename, document);
    } else {
      console.error(`Unexpected filepath ${filepath}`);
      return;
    }
    console.log(`${numFilesToProcess} files to process`);
    if (--numFilesToProcess === 0) {
      console.timeEnd('Parse texts');
    }
  }).catch(error => {
    console.log(`Error creating DOM from ${filepath}`, error);
  });
}

// Play functions

function parsePlay(filename, document) {
    // tweak text filenames to match standard MLA Shakespeare abbreviations
  if (abbreviations[filename]) {
    filename = abbreviations[filename] + '.html';
  } else {
    console.error(`Filename ${filename} not found in ${abbreviations}`);
  }
  const title = titles[filename];
  if (!title) {
    console.error(`Title not found for ${filename}`);
  }
  // top and bottom are buffers, ${title} a placeholder for the title
  const html = ('' + top).replace('${title}', title) +
    addPreamble(document) + addActs(document) + bottom;
  // html = minify(html);
  writeFile(filename, html);
}

function addPreamble(document) {
  let html = '<section id="preamble">\n\n';
  const title = document.querySelector('TITLE').textContent;
  html += `<h1>${title}</h1>\n\n`;
  html += addPersonae(document);
  const scenedescr = document.querySelector('SCENEDESCR').textContent;
  html += `<div id="scene-description">${scenedescr}</div>\n\n`;
  html += '</section>\n\n';
  return html;
}

function addPersonae(document) {
  let html = '<section id="dramatis-personae">';
  html += '<h2>Dramatis Personae</h2>\n\n';
  const children = document.querySelector('PERSONAE').children;
  for (const child of children) {
    switch (child.nodeName) {
    case 'PGROUP': {
      const grpdescr = child.querySelector('GRPDESCR').textContent;
      html += `<ol class="persona-group" data-description="${grpdescr}">\n`;
      const personas = child.querySelectorAll('PERSONA');
      for (const persona of personas) {
        html += '  <li>' + persona.textContent.trim() + '</li>\n';
      }
      html += '</ol>\n\n';
      break;
    }
    case 'PERSONA': // Some PERSONA elements are not in PGROUP elements :/
      if (child.previousElementSibling.nodeName !== 'PERSONA') {
        html += '<ol class="persona-group">\n';
      }
      html += `  <li>${child.textContent}</li>\n`;
      // this persona element may be the last sibling
      if (!child.nextElementSibling ||
        child.nextElementSibling.nodeName !== 'PERSONA') {
        html += '</ol>\n\n';
      }
      break;
    case 'TITLE':
      break;
    default:
      console.error(`${play(child)}: unexpected child ${child.nodeName}`);
    }
  }
  html += '</section>\n\n';
  return html;
}

function addActs(document) {
  let html = '';
  const acts = document.querySelectorAll('ACT');
  for (const act of acts) {
    html += '<section class="act">\n\n';
    const title = act.querySelector('TITLE').textContent;
    html += `<h2>${title}</h2>\n\n`;
    const scenes = act.querySelectorAll('SCENE');
    for (const scene of scenes) {
      html += addScene(scene);
    }
    html += '</section>\n\n';
  }
  return fix(html);
}

function addScene(scene) {
  addLineNumberMarkup(scene); // temporary hack: not possible in pure CSS :(
  let html = '<section class="scene">\n\n';
  const children = scene.children;
  for (const child of children) {
    switch(child.nodeName) {
    case 'SPEECH':
      html += addSpeech(child);
      break;
    case 'STAGEDIR':
      html += `<div class="stage-direction">${child.textContent}</div>\n\n`;
      break;
    case 'TITLE':
      html += `<h3>${child.textContent}</h3>\n\n`;
      break;
    case 'SUBHEAD':
      html += `<h4 class="scene-subhead">${child.textContent}</h4>\n\n`;
      break;
    default:
      console.error(`${play(scene)}: weird scene element ${child.nodeName}`);
    }
  }
  html += '</section>\n\n';
  return html;
}

function addSpeech(speech) {
  let html = '<ol class="speech">\n';
  const children = speech.children;
  let number;
  for (const child of children) {
    switch(child.nodeName) {
    case 'LINE':
      number = child.hasAttribute('number') ? ' class="number"' : '';
      html += `  <li${number}>${child.textContent}</li>\n`;
      break;
    case 'SPEAKER':
      // there may be more than one speaker
      html += `  <li class="speaker">${child.textContent}</li>\n`;
      break;
    case 'STAGEDIR':
      html += `  <li class="stage-direction">${child.textContent}</li>\n`;
      break;
    case 'SUBHEAD':
      html += `  <li class="subhead">${child.textContent}</li>\n`;
      break;
    default:
      console.error(`${play(speech)}: weird speech element ${child.nodeName}`);
    }
  }
  html += '</ol>\n\n';
  return html;
}

// Poem functions

function parsePoem(filename, document) {
  const poemAbbreviation = abbreviations[filename];
  if (poemAbbreviation === 'Son') {
    // sonnet file includes multiple poems
    addSonnets(document);
  } else {
    addSinglePoem(document, poemAbbreviation);
  }
}

function addSonnets(document) {
  let html = '<h1>Sonnets</h1>\n\n';
  const sonnets = document.querySelectorAll('sonnet');
  for (let i = 0; i !== sonnets.length; ++i) {
    const sonnet = sonnets[i];
    html += '<section class="poem">\n';
    html += `  <h2>Sonnet ${roman(i + 1)}</h2>\n`;
    html += '  <ol>\n';
    const lines = sonnet.querySelectorAll('line');
    for (let j = 0; j !== lines.length; ++j) {
      // add class="number" if this line should be numbered
      const isNumbered = (j + 1) % 5 === 0 && j !== 0;
      const number = isNumbered ? ' class="number"' : '';
      html += `    <li${number}>${lines[j].textContent}</li>\n`;
    }
    html += '</ol>\n';
    html += '</section>\n\n';
  }
  // top and bottom are buffers, ${title} a placeholder for the title
  html = ('' + top).replace('${title}', 'Sonnets') + fix(html) + bottom;
  // html = minify(html);
  writeFile('Son.html', html);
}

function addSinglePoem(document, poemAbbreviation) {
  const title = document.querySelector('title').textContent;
  let html = `<h1>${title}</h1>\n\n`;
  html += '  <ol>\n';
  const lines = document.querySelectorAll('line');
  for (let i = 0; i !== lines.length; ++i) {
    // add class="number" if this line should be numbered
    const isNumbered = (i + 1) % 5 === 0 && i !== 0;
    const number = isNumbered ? ' class="number"' : '';
    html += `    <li${number}>${lines[i].textContent}</li>\n`;
  }
  html += '</ol>\n';

  // top and bottom are buffers, ${title} a placeholder for the title
  html = ('' + top).replace('${title}', title) + html + bottom;
  // html = minify(html);
  writeFile(`${poemAbbreviation}.html`, html);
}

// Utility functions

// Check that a file contains valid HTML
function isValid(filename, html) {
  const options = {
    data: html,
    format: 'text' /* ,
    validator: 'https://html5.validator.nu' */
  };
  validator(options).then(data => {
    return false;
  })
  .catch(error => {
    console.error(`Error validating ${filename}:`, error);
    return false;
  });
  return true;
}

// Add number attribute to every fifth line, so line number is displayed
// TODO: code to cope with lines that span two displayed lines :^/
function addLineNumberMarkup(scene) {
  const lines = scene.querySelectorAll('LINE');
  for (let i = 0; i !== lines.length; ++i) {
    let line = lines[i];
    if ((i + 1) % 5 === 0 && i !== 0) {
      line.setAttribute('number', true);
    }
  }
}

function fix(html) {
  return html.
    replace('&c', 'etc.').
    replace(/,--/g, ' — ').
    replace(/--/g, ' — ').
    replace(/, —/g, ' — ').
    replace(/'/g, '’');
    // replace(/&#8217;/g, '’')
}

function writeFile(filename, html) {
  if (isValid(filename, html)) {
    console.log(`HTML validated, writing file ${filename}`);
    mz.writeFile(OUTPUT_DIR + filename, html).
      catch(error => console.error(`Error writing ${filename}:`, error));
  }
}

function play(element) {
  return element.ownerDocument.querySelector('TITLE').textContent;
}

function roman(integer) {
  const romanNumeral = integer;
  return romanNumeral;
}