var Grailbird = {};
var Templates = {};
var CalendarMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
			return CalendarMonths[month - 1] + ' ' + year;
		},
		tweet_count: function() {
			var cur_index = this.tweet_index[this.cur_page];
			return cur_index.tweet_count;
		},
		tweet_history: function() {
			var tweet_history = [];
			var max_tweet_count = 0;
			var cur_year = Grailbird.tweet_index[0].year;
			var results = 1;

			//Subtract a year until there are no more years in history
			while(results != 0) {
				//Gather all months belonging to the same year in a single array
				var months = $.grep(Grailbird.tweet_index, function(data, index) {
					max_tweet_count = Math.max(max_tweet_count, data.tweet_count);
					data.calendar_month = CalendarMonths[data.month - 1];
					return data.year == cur_year;
				});
				months.reverse();

				results = months.length;
				if (results == 0) {break;}

				//If not a complete year, fill it out
				var initial_month = months[0].month;
				while (months.length > 0 && months.length < 12) {
					//Fill in through end of year
					if (initial_month == 1) {
						months.push({
							year: cur_year,
						    tweet_count: 0,
						    month: months.length + 1,
						    calendar_month: CalendarMonths[months.length]
						});
					}
					//Fill in beginning of year
					else {
						months.unshift({
							year: cur_year,
						    tweet_count: 0,
						    month: initial_month,
						    calendar_month: CalendarMonths[initial_month]
						});

						initial_month += 1;
					}
				}

				tweet_history.push({
					year: cur_year,
					months: months,
					max_tweet_count: max_tweet_count
				});
				
				cur_year--;
			}

			return tweet_history;
		},
		hasPrev: function() {
			return !!(this.cur_page < this.tweet_index.length - 1);
		},
		hasNext: function() {
			return !!(this.cur_page != 0);
		}
	};

	//Render header
	$('header').html(tmpl('tmpl_header', Grailbird.user_details));
	$('.newtweet').on('click', openTweetActionInWindow);
	
	//Render tweets
	refresh();

	//Defer menu rendering until after tweets have rendered
	setTimeout(function() {
		//Render history
		$('#tweet_history').html(tmpl('tmpl_history', Grailbird));

		drawTweetHistory();
		refreshActiveHistory();
	}, 10);
}

function prev() {
	$('#prev').off('click');
	loadPage(Math.min(Grailbird.tweet_index.length - 1, Grailbird.cur_page + 1));
}

function next() {
	$('#next').off('click');
	loadPage(Math.max(0, Grailbird.cur_page - 1));
}

function loadPage(page) {
	$('#tweet_list').addClass('hidden');

	scrollTo('#main', 150);

	//Defer heavy processing
	setTimeout(function() {
		Grailbird.cur_page = page;
		refresh();
	}, 150);
}

function openTweetActionInWindow(e) {
	e.preventDefault();
	window.open(e.target.getAttribute('href'), '', 'width=520,height=360,menubar=no,toolbar=no');
}

function toggleTweetHistory(e, open) {
	e.preventDefault();

    var $targ = $('#main');
    var open = open === undefined ? !$targ.hasClass('menu_open') : open;
    if (open) {
    	scrollTo('#main', 150, function() {
	        $targ.addClass('menu_open');
	        
	        var height = Math.min(parseInt($('#tweet_history').css('height')), parseInt($('#tweet_history').css('max-height')));
	        $('.menu_open section').css({
	        	'-webkit-transform': 'translateY(' + height + 'px)',
	        	'-moz-transform': 'translateY(' + height + 'px)',
	        	'-ms-transform': 'translateY(' + height + 'px)',
	        	'transform': 'translateY(' + height + 'px)'
	        });
    	});
    }
    else {
    	$('.menu_open section').css({
        	'-webkit-transform': '',
        	'-moz-transform': '',
        	'-ms-transform': '',
        	'transform': ''
        });

        $targ.removeClass('menu_open');
    }
}

function refresh() {
	//Render nav
	$('nav').html(tmpl('tmpl_nav', Grailbird));

	$('#prev').on('click', prev);
	$('#next').on('click', next);
	$('#toggle_history').on('click', toggleTweetHistory);

	refreshActiveHistory();

	loadTweets(tweet_index[Grailbird.cur_page], function() {

	});
}

function drawTweetHistory() {
	var max = parseInt($('#tweet_history ol.tweet_months').data('max-tweet-count'));
	$('#tweet_history a .count_bar').each(function(index, bar) {
		var val = parseInt($(bar).data('tweet-count'))/max;
		$(bar).height((100 - (val * 100)) + '%');
	});

	$('#tweet_history .bar a').on('click', function(e) {
		var var_name = $(e.target).parents('.bar').data('var-name');
		loadHistoryFromVarName(var_name);
	});
}

function refreshActiveHistory() {
	//Set active state on history
	$('#tweet_history .active').removeClass('active')
		.parents('.tweet_year').removeClass('active');
	$('#tweet_history .bar[data-var-name=' + (Grailbird.tweet_index[Grailbird.cur_page].var_name) + ']').addClass('active')
		.parents('.tweet_year').addClass('active');
}

function loadHistoryFromVarName(var_name) {
	if (!var_name) {return;}
	
	var index;
	$.each(Grailbird.tweet_index, function(i, data) {
		if (!index && data.var_name == var_name) {
			index = i;
		}
	});

	loadPage(index);
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
		$('.tweet_actions a').on('click', openTweetActionInWindow);
	}, 1);
}

function scrollTo(element, duration, complete) {
	$('html, body').animate({
	     scrollTop: $(element).offset().top
	 }, duration, 'swing', complete);
}

function getFormattedTweetContent(tweet) {
	var markup = tweet.text;
	var entities = tweet.entities;

	$.each(entities.hashtags, function(hashtag) {
		markup = markup.replace(new RegExp('#' + hashtag.text, 'g'), '<a href="http://twitter.com/search/' + escape(hashtag.text) + '">#' + hashtag.text + '</a>');
	});

	$.each(entities.urls, function(index, url) {
		markup = markup.replace(new RegExp(url.url, 'g'), '<a title="' + url.expanded_url + '" href="' + url.expanded_url + '">' + url.display_url + '</a>');
	});

	$.each(entities.user_mentions, function(index, mention) {
		markup = markup.replace(new RegExp('@' + mention.screen_name, 'g'), '<a class="atname" href="http://twitter.com/' + mention.screen_name + '">' + mention.screen_name + '</a>');
	});

	return markup;
}

function getFormattedDate(created_at) {
	return new Date(created_at).toDateString();
}