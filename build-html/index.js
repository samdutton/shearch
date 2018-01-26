const mz = require('mz/fs');
const recursive = require('recursive-readdir');
const validator = require('html-validator');
const {JSDOM} = require('jsdom');

const abbreviations = require('../config/filename-to-abbreviation.json');
const titles = require('../config/abbreviated-filename-to-title.json');

const bottom = mz.readFileSync('./html-fragments/bottom.html');
const top = mz.readFileSync('./html-fragments/top.html');

const DONT_BOTHER_VALIDATING = true;
const IS_STANDALONE = false;
const OUTPUT_DIR = '../client/html/';
const PLAY_DIR = 'plays-bosak';
const POEM_DIR = 'poems-ps';
const TEXTS_DIR = '../texts/';

const stageDirRegEx = /<STAGEDIR>(\w+)<\/STAGEDIR>/gi;

// Some opening tags in poem sections have attributes to remove, some don't.
const coupletOpenRegex = /<couplet>/gi;
const coupletCloseRegex = /<\/couplet>/gi;
const finisRegex = /<finis>.+<\/finis>/gsi; // only one of these, in FE.html...
const lineOpenRegex = /<line [^>]+>/gi;
const lineCloseRegex = /<\/line>/gi;
const quatrainOpenRegex = /<quatrain[^>]*>/gi; // some quatrains have atrributes
const quatrainCloseRegex = /<\/quatrain>/gi;
const stanzaOpenRegex = /<stanza [^>]+>/gi; // NB space: avoid stanzasmall match
const stanzaCloseRegex = /<\/stanza>/gi;
const stanzanumOpenRegex = /<stanzanum [^>]+>/gi;
const stanzanumCloseRegex = /<\/stanzanum>/gi;
const stanzasmallOpenRegex = /<stanzasmall>/gi;
const stanzasmallCloseRegex = /<\/stanzasmall>/gi;
const subtitleOpenRegex = /<subtitle>/gi;
const subtitleCloseRegex = /<\/subtitle>/gi;
const tercetOpenRegex = /<tercet>/gi;
const tercetCloseRegex = /<\/tercet>/gi;

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
      console.log('filename', filename);
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

// **************
// Play functions

function parsePlay(filename, document) {
  // change filename to match standard MLA Shakespeare abbreviation
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
  const html = IS_STANDALONE ? ('' + top).replace('${title}', title) +
      addPreamble(document) + addActs(document) + bottom : addActs(document);
  // html = minify(html);
  writeFile(filename, html);
}

function addPreamble(document) {
  let html = '<section id="preamble">\n\n';
  const title = document.getElementsByTagName('TITLE')[0].textContent;
  html += `<h1>${title}</h1>\n\n`;
  html += addPersonae(document);
  const scndescr = document.getElementsByTagName('SCNDESCR')[0].textContent;
  html += `<div id="scene-description">${scndescr}</div>\n\n`;
  html += '</section>\n\n';
  return html;
}

function addPersonae(document) {
  let html = '<section id="dramatis-personae">';
  html += '<h2>Dramatis Personae</h2>\n\n';
  const children = document.getElementsByTagName('PERSONAE')[0].children;
  for (const child of children) {
    switch (child.nodeName) {
    case 'PGROUP': {
      const grpdescr = child.getElementsByTagName('GRPDESCR')[0].textContent;
      html += `<ol class="persona-group" data-description="${grpdescr}">\n`;
      const personas = child.getElementsByTagName('PERSONA');
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
  const acts = document.getElementsByTagName('ACT');
  for (const act of acts) {
    html += '<section class="act">\n\n';
    const title = act.getElementsByTagName('TITLE')[0].textContent;
    html += `<h2>${title}</h2>\n\n`;
    const scenes = act.getElementsByTagName('SCENE');
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
  const children = speech.children;
  let html = '';
  let number;
  let speakers = [];
  for (const child of children) {
    switch(child.nodeName) {
    case 'LINE':
      // addLineNumberMarkup() adds number attribute to every fifth line element
      number = child.hasAttribute('number') ? ' class="number"' : '';
      // stage directions are sometimes inline
      var line = child.innerHTML.
        replace(stageDirRegEx, '<span class="stage-direction">$1</span>');
      html += `  <li${number}>${line}</li>\n`;
      break;
    case 'SPEAKER':
      // speeches occasionally have more than one speaker
      speakers.push(child.textContent);
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
  return `<ol data-speaker="${speakers.join(', ')}">\n` + html + '</ol>\n\n';
}

// **************
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
  const sonnets = document.getElementsByTagName('sonnet');
  for (let i = 0; i !== sonnets.length; ++i) {
    const sonnet = sonnets[i];
    html += '<section class="poem">\n';
    html += `  <h2>Sonnet ${roman(i + 1)}</h2>\n`;
    html += '  <ol>\n';
    const lines = sonnet.getElementsByTagName('line');
    for (let j = 0; j !== lines.length; ++j) {
      // add class="number" if this line should be numbered
      const isNumbered = (j + 1) % 5 === 0 && j !== 0;
      const number = isNumbered ? ' class="number"' : '';
      html += `    <li${number}>${lines[j].textContent}</li>\n`;
    }
    html += '</ol>\n';
    html += '</section>\n\n';
  }
  if (IS_STANDALONE) {
  // top and bottom are buffers, ${title} a placeholder for the title
    html = ('' + top).replace('${title}', 'Sonnets') + fix(html) + bottom;
  }
  // html = minify(html);
  writeFile('Son.html', html);
}

function addSinglePoem(document, poemAbbreviation) {
  const title = document.getElementsByTagName('title')[0].textContent;
  let html = `<h1>${title}</h1>\n\n`;
  const poemintro = document.getElementsByTagName('poemintro')[0];
  if (poemintro) {
    html +=
      `<section class="poemintro">\n${poemintro.textContent}\n</section>\n`;
  }
  html += getPoemBody(document);
  if (IS_STANDALONE) {
    // top and bottom are buffers, ${title} a placeholder for the title
    html = ('' + top).replace('${title}', title) + html + bottom;
  }
  // html = minify(html);
  writeFile(`${poemAbbreviation}.html`, html);
}

function getPoemBody(document) {
  const poembody = document.getElementsByTagName('poembody')[0].innerHTML;
  return poembody.
    replace(coupletOpenRegex, '<section class="couplet">').
    replace(coupletCloseRegex, '</section>').
    replace('<dedication>', '<section class="dedication">').
    replace('</dedication>', '</section>').
    replace(finisRegex, '<h2 class="finis">FINIS.</h2>').
    replace(lineOpenRegex, '  <p>').
    replace(lineCloseRegex, '</p>').
    replace(quatrainOpenRegex, '<section class="quatrain">').
    replace(quatrainCloseRegex, '</section>').
    replace(stanzaOpenRegex, '<section class="stanza">').
    replace(stanzaCloseRegex, '</section>').
    replace(stanzanumOpenRegex, '<h2 class="stanzanum">').
    replace(stanzanumCloseRegex, '</h2>').
    replace(stanzasmallOpenRegex, '<section class="stanzasmall">').
    replace(stanzasmallCloseRegex, '</section>').
    replace(subtitleOpenRegex, '<h2 class="subtitle">').
    replace(subtitleCloseRegex, '</h2>').
    replace(tercetOpenRegex, '<h2 class="subtitle">').
    replace(tercetCloseRegex, '</h2>');
}

// *****************
// Utility functions

// Check that a file contains valid HTML
function isValid(filename, html) {
  if (DONT_BOTHER_VALIDATING) {
    return true;
  }
  const options = {
    data: html,
    format: 'text',
    validator: 'https://html5.validator.nu'
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
  const lines = scene.getElementsByTagName('LINE');
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
  return element.ownerDocument.getElementsByTagName('TITLE')[0].textContent;
}

function roman(integer) {
  const romanNumeral = integer;
  return romanNumeral;
}