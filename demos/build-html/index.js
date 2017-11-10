// const fs = require('fs');
const mz = require('mz/fs');
const {JSDOM} = require('jsdom');
// var minify = require('html-minifier').minify;
const validator = require('html-validator');

const titles = require('./data/titles.json');
const convertNames = require('./data/convert-names.json');
const top = mz.readFileSync('./html-fragments/top.html');
const bottom = mz.readFileSync('./html-fragments/bottom.html');
const INPUT_DIR = '../../originals/';
const OUTPUT_DIR = '../client/plays/';

mz.readdir(INPUT_DIR).then(filenames => {
  filenames = filenames.filter(filename => {
    return filename.match(/.+xml/);
  });
  for (const filename of filenames) {
    convertXMLtoHTML(filename);
  }
}).catch(error => console.error(`Error reading from ${INPUT_DIR}:`, error));


function convertXMLtoHTML(filename) {
  JSDOM.fromFile(INPUT_DIR + filename, {contentType: 'text/xml'})
  .then(dom => {
    // tweak Jon Bosak XML filenames to match standard Shakespeare abbreviations
    if (convertNames[filename]) {
      filename = convertNames[filename];
    } else {
      console.error(`Filename ${filename} not found in nametweaks.json`);
    }
    const title = titles[filename];
    if (title === '') {
      console.error(`Title not found for ${filename}`);
    }
    let html = ('' + top).replace('${title}', title) + // top is a buffer
      addPreamble(dom) + addActs(dom) + bottom;
    // html = minify(html);
    if (isValid(filename, html)) {
      console.log(`HTML validated, writing file ${filename}`);
      writeFile(OUTPUT_DIR + filename, html);
    }
  });
}

function addPreamble(dom) {
  let html = '<section id="preamble">\n\n';
  html += `<h1>${text(dom, 'TITLE')}</h1>\n\n`;
//  html += `<h2 class="subtitle">${text(dom, 'PLAYSUBT')}</h2>\n\n`;
  html += addPersonae(dom);
  html += `<div id="scene-description">${text(dom, 'SCNDESCR')}</div>\n\n`;
  html += '</section>\n\n';
  return html;
}

function addPersonae(dom) {
  let html = '<section id="dramatis-personae">';
  html += '<h2>Dramatis Personae</h2>\n\n';
  const children = $(dom, 'PERSONAE').children;
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

function addActs(dom) {
  let html = '';
  const acts = dom.window.document.querySelectorAll('ACT');
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
  return doMinorFixes(html);
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

function isValid(filename, html) {
  const options = {
    data: html,
    format: 'text' /* ,
    validator: 'https://html5.validator.nu' */
  };
  validator(options).then(data => {
//    console.log(`${filename}:`, data);
    return false;
  })
  .catch(error => {
    console.error(`Error validating ${filename}:`, error);
    return false;
  });
  return true;
}

function addLineNumberMarkup(scene) {
  const lines = scene.querySelectorAll('LINE');
  for (let i = 0; i !== lines.length; ++i) {
    let line = lines[i];
    if ((i + 1) % 5 === 0 && i !== 0) {
      line.setAttribute('number', true);
    }
//    console.log(i + 1, line.outerHTML);
  }
}

function doMinorFixes(html) {
  return html.
    replace('&c', 'etc.').
    replace(/,--/g, ' — ').
    replace(/--/g, ' — ').
    replace(/, —/g, ' — ');
}

function writeFile(filepath, string) {
  mz.writeFile(filepath, string).
    catch(error => console.error(`Error writing ${filepath}:`, error));
}

function $(dom, selector) {
  return dom.window.document.querySelector(selector);
}

function text(dom, selector) {
  return dom.window.document.querySelector(selector).textContent;
}

function play(element) {
  return element.ownerDocument.querySelector('TITLE').textContent;
}