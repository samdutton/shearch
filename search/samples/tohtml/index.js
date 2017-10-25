// const fs = require('fs');
const mz = require('mz/fs');
const {JSDOM} = require('jsdom');
var minify = require('html-minifier').minify;
const validator = require('html-validator');

const nameTweaks = require('./data/nametweaks.json');
const top = mz.readFileSync('./html-fragments/top.html');
const bottom = mz.readFileSync('./html-fragments/bottom.html');
const INPUT_DIR = '../../originals/';
// const OUTPUT_DIR = 'htmlout/';

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
    let isValid = true;
    // tweak Jon Bosak XML filenames to match standard Shakespeare abbreviations
    filename = nameTweaks[filename];
    filename = filename.replace('.xml', '.html');
    let html = top + addPreamble(dom) + addActs(dom) + bottom;
    html = minify(html);
    const options = {
      data: html,
      format: 'text'
    };
    validator(options).then(data => {
      isValid = false;
      console.log(`${filename}:`, data);
    })
    .catch(error => {
      console.error(`Error validating ${filename}:`, error);
    });
    if (isValid) {
      console.log(`Writing file ${filename}`);
    }
    writeFile('htmlout/' + filename, html);
  });
}

function addPreamble(dom) {
  let html = '<section class="preamble">\n\n';
  html += `<h1>${text(dom, 'TITLE')}</h1>\n\n`;
  html += `<h2>${text(dom, 'PLAYSUBT')}</h2>\n\n`;
  html += addPersonae(dom);
  html += `<div class="sceneDescription">${text(dom, 'SCNDESCR')}</div>\n\n`;
  html += '</section>\n\n';
  return html;
}

function addPersonae(dom) {
  let html = '<section class="dramatisPersonae">';
  html += '<h2>Dramatis Personae</h2>\n\n';
  const children = $(dom, 'PERSONAE').children;
  for (const child of children) {
    switch (child.nodeName) {
    case 'PGROUP': {
      const grpdescr = child.querySelector('GRPDESCR').textContent;
      html += `<ol class="personaGroup" data-description="${grpdescr}">\n`;
      const personas = child.querySelectorAll('PERSONA');
      for (const persona of personas) {
        html += '  <li>' + persona.textContent + '</li>\n';
      }
      html += '</ol>\n\n';
      break;
    }
    case 'PERSONA': // Some PERSONA elements are not in PGROUP elements :/
      if (child.previousElementSibling.nodeName !== 'PERSONA') {
        html += '<ol class="personaGroup">\n';
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
  return html;
}

function addScene(scene) {
  let html = '<section class="scene">\n\n';
  const children = scene.children;
  for (const child of children) {
    switch(child.nodeName) {
    case 'SPEECH':
      html += addSpeech(child);
      break;
    case 'STAGEDIR':
      html += `<div class="stageDirection">${child.textContent}</div>\n\n`;
      break;
    case 'TITLE':
      html += `<h3>${child.textContent}</h3>\n\n`;
      break;
    case 'SUBHEAD':
      html += `<h3>${child.textContent}</h3>\n\n`;
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
  for (const child of children) {
    switch(child.nodeName) {
    case 'LINE':
      html += `  <li>${child.textContent}</li>\n`;
      break;
    case 'SPEAKER':
      // there may be more than one speaker
      html += `<li class="speaker">${child.textContent}</li>\n`;
      break;
    case 'STAGEDIR':
      html += `  <li class="stageDirection">${child.textContent}</li>\n`;
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