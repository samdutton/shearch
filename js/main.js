/* global lunr */

const documents = [{
  'name': 'Lunr',
  'text': 'Like Solr, but much smaller, and not as bright.'
}, {
  'name': 'React',
  'text': 'A JavaScript library for building user interfaces.'
}, {
  'name': 'Lodash',
  'text': 'A modern JavaScript Lunr utility delivering modularity and extras.'
}];

const idx = lunr(function() {
  this.ref('name');
  this.field('name');
  this.field('text');
  documents.forEach(function(doc) {
    this.add(doc);
  }, this);
});

console.log(idx.search('*right'));
