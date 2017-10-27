/*
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/* global  */

const PLAYNAMES = 'data/play-names.json';
const button = $('button');
button.onclick = getPlay;
// const playEl = $('div#play');
const iframe = $('iframe');
const parser = new DOMParser();

// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

function fetchPlayNames() {
  startPerf();
  fetch(PLAYNAMES).then(response => {
    endPerf();
    logPerf('Fetch play names');
    return response.json();
  }).then(playNames => {
    fetchPlays(playNames);
  }).catch(error => {});
}

fetchPlayNames();

function fetchPlays(playNames) {
  startPerf();
  for (const playName of playNames) {
    fetch(`plays/${playName}.html`).then(response => {
      return response.text();
    }).then(text => {
      indexPlay(playName, text);
    });
  }
  endPerf();
  logPerf('Fetch play texts');
}

function indexPlay(playName, html) {
  startPerf();
  const play = parser.parseFromString(html, 'text/html');
  let docs = [];
  const acts = play.querySelectorAll('section.act');
  for (let actNum = 1; actNum <= acts.length; ++actNum) {
    const act = acts[actNum -1];
    const scenes = act.querySelectorAll('section.scene');
    for (let sceneNum = 1; sceneNum <= scenes.length; ++sceneNum) {
      const scene = scenes[sceneNum - 1];
      const location = playName + '.' + actNum + '.' + sceneNum;
      const sceneTitle = scene.querySelector('h3').textContent;
      docs.push({
        l: location,
        t: sceneTitle
      });
      const stagedirs = scene.querySelectorAll('div.stage-direction');
      for (const stagedir of stagedirs) {
        docs.push({
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
            l: location,
            s: speaker,
            t: line.textContent
          });
        }
      }
    }
  }
  endPerf();
  logPerf('Parse play');
//  console.log(docs);
}

function getPlay() {
  const play = 'Ant.html';
  iframe.src = `plays/${play}`;
}

// function getPlay(play) {
//   fetch(`plays/${play}`).then(response => {
//     return response.text();
//   }).then(html => {
//     startPerf();
//     playEl.innerHTML = html;
//     endPerf();
//     logPerf(`Getting ${play}`);
//   });
// }

// Search for products whenever query input text changes
// queryInput.oninput = doSearch;

// Utility functions

function $(selector) {
  return document.querySelector(selector);
}

// function show(element) {
//   element.classList.remove('hidden');
// }

// function hide(element) {
//   element.classList.add('hidden');
// }

// window.performance utilities

function startPerf() {
  window.performance.mark('start');
}

function endPerf() {
  window.performance.mark('end');
}

function logPerf(message) {
  window.performance.clearMeasures();
  window.performance.measure('duration', 'start', 'end');
  const duration =
    performance.getEntriesByName('duration')[0].duration.toPrecision(4);
  console.log(`${message}: ${duration} ms`);
}
