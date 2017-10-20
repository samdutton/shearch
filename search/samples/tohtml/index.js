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
    let html = '';
    html += addDiv(dom, 'TITLE', 'title');
    html += addDiv(dom, 'PLAYSUBT', 'playSubitle');
    html += addPersonae(dom);
    html += addDiv(dom, 'SCNDESCR', 'sceneDescription');
    html += addActs(dom);
    console.log(html);
  });
}

function addDiv(dom, elementName, className) {
  const element = dom.window.document.querySelector(elementName);
  return `<div class="${className}">${element.textContent}</div>\n\n`;
}

function addPersonae(dom) {
  let html = '';
  html += '<div class="dramatisPersonae">Dramatis Personae</div>\n\n';
  const nodes = dom.window.document.querySelector('PERSONAE').childNodes;
  for (const node of nodes) {
    switch (node.nodeName) {
    case '#text':
    case 'TITLE':
      break;
    case 'PGROUP': {
      const grpdescr = node.querySelector('GRPDESCR').textContent;
      html += `<ol class="personaGroup" data-description="${grpdescr}">\n`;
      const personas = node.querySelectorAll('PERSONA');
      for (const persona of personas) {
        html += '<li>' + persona.textContent + '</li>\n';
      }
      html += '</ol>\n\n';
      break;
    }
    case 'PERSONA': // Some PERSONA elements are not in PGROUP elements :/
      // previousSibling is #text
      if (node.previousElementSibling.nodeName !== 'PERSONA') {
        html += '<ol class="personaGroup">\n';
      }
      html += `<li>${node.textContent}</li>\n`;
      // nextSibling is #text, but this persona element may be the last sibling
      if (!node.nextElementSibling ||
          node.nextElementSibling.nodeName !== 'PERSONA') {
        html += '</ol>\n\n';
      }
      break;
    default:
      console.error(`Unexpected element: ${node.nodeName}`);
    }
  }

  return html;
}

function addActs(dom) {
  let html = '';
  const acts = dom.window.document.querySelectorAll('ACT');
  for (const act of acts) {
    const title = act.querySelector('TITLE').textContent;
    html += `<div class="actTitle">${title}</div>\n`;
    const scenes = act.querySelectorAll('SCENE');
    for (const scene of scenes) {
      html += addScene(scene);
    }
  }
  return html;
}

function addScene(scene) {
  let html = '';
  const nodes = scene.childNodes;
  for (const node of nodes) {
    switch(node.nodeName) {
    case '#text':
      break;
    case 'SPEECH':
      html += '***speech\n';
      // html += addSpeech(node);
      break;
    case 'TITLE':
      html += `<div class="actTitle">${node.textContent}</div>\n`;
      break;
    case 'STAGEDIR':
      html += `<div class="stageDirection">${node.textContent}</div>\n`;
      break;
    default:
      console.error(`Unexpected element: ${node.nodeName}`);
    }
  }
  return html;
}

function addSpeech(speech) {
  console.log('speech\n');
  const speaker = speech.querySelector('SPEAKER');
  return `<ul class="speech" data-speaker="${speaker}">\n`;
}