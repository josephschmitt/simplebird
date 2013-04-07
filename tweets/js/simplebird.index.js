var SearchIndex;

// Set up console.log as a message that gets passed
var console =  {
    log: function(msg) {
        self.postMessage({msg: 'log', options: msg});
    }
};

self.addEventListener('message', function(e) {
  var data = e.data;
  var action = data.action;

  if (self[action]) {
    self[action].apply(null, data.options);
  }

}, false);

self.init = function(url) {
    importScripts(url + '/js/lunr.min.js');
    self.initIndex();
    self.postMessage({action: 'init', msg: 'complete'});
};

self.initIndex = function() {
    SearchIndex = lunr(function() {
        this.ref('id');
        this.field('screen_name');
        this.field('full_name');
        this.field('tweet_body', {boost: 10});
    });
};

self.index = function(tweet, var_name) {
    function addToIndex(tweet) {
        SearchIndex.add({
            id: var_name + '/' + tweet.id_str,
            screen_name: tweet.user.screen_name,
            full_name: tweet.user.name,
            tweet_body: tweet.text
        });
    }

    var tweetList = tweet.length ? tweet : [tweet];
    var curTweet;
    for (var i = tweetList.length - 1; i >= 0; i--) {
        curTweet = tweetList[i].retweeted_status || tweetList[i];
        addToIndex(curTweet);
    }

    self.postMessage({action: 'index', msg: 'complete'});
};

self.indexAll = function(tweet_index, var_names) {
    for (var i = var_names.length - 1; i >= 0; i--) {
        if (tweet_index[var_names[i]]) {
            self.index(tweet_index[var_names[i]], var_names[i]);
        }
    }

    self.postMessage({action: 'indexAll', msg: 'complete'});
};

self.search = function(term) {
    var results = SearchIndex.search(term);
    self.postMessage({action: 'search', msg: 'complete', data: results});
};