var attempt = Date.now(), reminder = {};

var db;
var log = console.log.bind(console);

var index = lunr();

function getTokenStream(text) {
  return index.pipeline.run(lunr.tokenizer(text));
}

function search(query) {
  var docs = [];
  return db.transaction('r', db.cards, function () {
    db.cards.where("tokens").equals(query).each(function (doc) {
      docs.push(doc);
    });
  }).then(function () {
    return docs;
  });
}

Promise.resolve()
    .then(start('Attempt ' + attempt, 'group'))
    .then(start('Destroying database'))
    .then(function() {
      return new Promise(function (resolve, reject) {
        var req = indexedDB.deleteDatabase('test');
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    })
    .then(stop())
    .then(start('Creating database'))
    .then(function() {
      return new Promise(function (resolve, reject) {
        db = new Dexie("test");
        db.version(1).stores({cards: "&name,text,*tokens"});
        db.open();
        resolve();
      });
    })
    .then(stop())
    .then(start('Downloading cards'))
    .then(function(db) {
        return new Promise(function(resolve, reject) {
            window.mtgjsoncallback = function(cards) {
                resolve({ db: db, cards: cards });
            };
            var script = document.createElement('script');
            script.src = 'http://mtgjson.com/json/AllCards.jsonp';
            script.onload = function() {
                script.parentNode.removeChild(script);
            };
            document.body.appendChild(script);
        });
    })
    .then(stop())
    .then(start('Transforming object to array'))
    .then(function(result) {
      result.cards = Object.keys(result.cards).map(function(name) {
          return result.cards[name];
      });
      return result;
    })
    .then(stop())
    .then(start('Inserting data'))
    .then(function(result) {
      return db.transaction("rw", db.cards, function () {
        result.cards.forEach(function (card) {
          var tokenStream = getTokenStream(card.text);
          var cardToInsert = {
            name: card.name,
            text: card.text,
            tokens: tokenStream
          };
          db.cards.add(cardToInsert);
        });
      });
    })
    .then(stop())
    .then(start('Searching for "jeskai"'))
    .then(function() {
        return search('jeskai').then(log);
    })
    .then(stop())
    .then(start('Searching for "counter"'))
    .then(function() {
      return search('counter').then(log);
    })
    .then(stop())
    .then(start('Searching for "target"'))
    .then(function() {
      return search('target').then(log);
    })
    .then(stop())
    .catch(console.error.bind(console))
    .then(console.log.bind(console, 'Done!'))
    .then(stop('group'), stop('group'));

// Helpers
function start(label, type) {
    return function(result) {
        reminder[type] = label;
        if(type !== 'group') console.log(label);
        console[type || 'time'](label);
        return result;
    };
}

function stop(type) {
    return function(result) {
        console[(type || 'time') + 'End'](reminder[type]);
        return result;
    };
}
