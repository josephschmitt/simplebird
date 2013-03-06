var Grailbird = {};
var Templates = {};
var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

$.when(
	$.getScript('data/js/payload_details.js'),
	$.getScript('data/js/user_details.js'),
	$.getScript('data/js/tweet_index.js')
).then(init);

function tmpl(name, data) {
	Templates[name] = Templates[name] || Hogan.compile($('#'+name).html());
	return Templates[name].render(data);
}

function init() {
	Grailbird = {
		cur_page: 0,
		payload_details: payload_details,
		user_details: user_details,
		tweet_index: tweet_index,
		data: {},
		date: function() {
			var cur_index = this.tweet_index[this.cur_page];
			var month = cur_index.month || 0;
			var year = cur_index.year;
			return months[month - 1] + ' ' + year;
		},
		tweet_count: function() {
			var cur_index = this.tweet_index[this.cur_page];
			return cur_index.tweet_count;
		},
		hasPrev: function() {
			return !!this.cur_page != this.tweet_index.length - 1;	
		},
		hasNext: function() {
			return !!this.cur_page != 0;
		}
	};

	//Render header
	$('header').html(tmpl('tmpl_header', Grailbird.user_details));

	$('.newtweet').click(function(e) {
		e.preventDefault();
		window.open(e.target.getAttribute('href'), '', 'width=520,height=257,menubar=no,toolbar=no');
	});

	//Render tweets
	refresh();
}

function prev() {
	$('#tweet_list').addClass('hidden');

	//Defer heavy processing
	setTimeout(function() {
		Grailbird.cur_page = Math.min(Grailbird.tweet_index.length - 1, Grailbird.cur_page + 1);
		refresh();
	}, 10);
}

function next() {
	$('#tweet_list').addClass('hidden');

	//Defer heavy processing
	setTimeout(function() {
		Grailbird.cur_page = Math.max(0, Grailbird.cur_page - 1);
		refresh();
	}, 10);
}

function refresh() {
	//Render nav
	$('nav').html(tmpl('tmpl_nav', Grailbird));

	$('#prev').click(prev);
	$('#next').click(next);

	loadTweets(tweet_index[Grailbird.cur_page]);
}

function loadTweets(tweet_data) {
	var tweets = Grailbird.data[tweet_data.var_name];
	if (tweets) {
		drawTweets(tweets);
	}
	else {
		$.getScript(tweet_data.file_name, function() {
			drawTweets(Grailbird.data[tweet_data.var_name]);
		});
	}
}

function drawTweets(tweets) {
	var render = '';
	var curTweet;
	dataset = tweets;

	//Tweet Content
	$.each(tweets, function(index, tweet) {
		curTweet = tweet.retweeted_status || tweet;
		
		tweet.formatted_content = curTweet.formatted_content = tweet.formatted_content || getFormattedTweetContent(curTweet);
		tweet.formatted_date = curTweet.formatted_date = tweet.formatted_date || getFormattedDate(curTweet.created_at);

		if (tweet.retweeted_status) {
			curTweet.retweeter = tweet.user.screen_name;
		}
		
		render += tmpl('tmpl_tweet', curTweet);
	});

	//Defer drawing to next paint cycle
	setTimeout(function() {
		$('#tweet_list').html(render).removeClass('hidden');
	}, 1);
}

function getFormattedTweetContent(tweet) {
	var markup = tweet.text;
	var entities = tweet.entities;

	$.each(entities.hashtags, function(hashtag) {
		markup = markup.replace(new RegExp('#' + hashtag.text, 'g'), '<a href="http://twitter.com/search/' + escape(hashtag.text) + '">#' + hashtag.text + '</a>');
	});

	$.each(entities.urls, function(index, url) {
		markup = markup.replace(new RegExp(url.url, 'g'), '<a href="' + url.expanded_url + '">' + url.expanded_url + '</a>');
	});

	$.each(entities.user_mentions, function(index, mention) {
		markup = markup.replace(new RegExp('@' + mention.screen_name, 'g'), '<a class="atname" href="http://twitter.com/' + mention.screen_name + '">' + mention.screen_name + '</a>');
	});

	return markup;
}

function getFormattedDate(created_at) {
	return new Date(created_at).toDateString();
}