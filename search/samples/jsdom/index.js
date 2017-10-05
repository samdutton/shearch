const fs = require('fs');

const {JSDOM} = require('jsdom');

JSDOM.fromFile('../../originals/a_and_c.xml', {contentType: 'text/xml'})
.then(dom => {
  // const playTitle = $(dom, 'PLAY > TITLE').textContent;
  // const playSubtitle = $('PLAYSUBT').textContent;
  let docs = [];
  const acts = $(dom, 'ACT');
  let actNum = 0;
  for (let act of acts) {
    actNum++;
    const scenes = $(act, 'SCENE');
    // console.log(playTitle, actTitle, scenes.length);
    let sceneNum = 0;
    for (let scene of scenes) {
      sceneNum++;
      const stagedirs = $(scene, 'STAGEDIR');
      for (let stagedir of stagedirs) {
        docs.push({
          l: actNum + '.' + sceneNum,
          t: stagedir.textContent
        });
      }
      console.log(docs);
    }
  }
  // for each scene
  // for each speech
  // for each line or stagedir
  // add id

//  const output = dom.serialize();
  writeFile('output.json', JSON.stringify(docs));
});

function writeFile(filepath, string) {
  fs.writeFile(filepath, string, error => {
    if(error) {
      return console.error(error);
    }
    console.log(`The file ${filepath} was saved!`);
  });
}

// Utility functions

function $(obj, selector) {
  var results = obj.constructor.name === 'JSDOM' ?
    obj.window.document.querySelectorAll(selector) :
    obj.querySelectorAll(selector);
  return results.length === 1 ? results[0] : results;
}

