var Grailbird = {};
var Templates = {};
var CalendarMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var hasUrlChanged = false;
var baseFolder = (Config.useCleanUrl ? Config.baseUrl + '/' : '');

// Set up search index web worker
var IndexWorker = new Worker(Config.baseUrl + '/js/simplebird.index.js');
// Set up listener for log events
IndexWorker.addEventListener('message', function(e) {
	if (e.data.msg == 'log') {
		console.log('Worker Log:', e.data.options);
	}
});

// Set up search index worker as a jQuery Promise
$.SearchIndex = function(args) {
	var def = $.Deferred(function(dfd) {
        IndexWorker.addEventListener('message', function(e) {
            if (e.data.action == args.action) {
            	if (e.data.msg == 'complete') {
		            dfd.resolve(e.data.data); 
            	}
            	else if (e.data.msg == 'error') {
            		dfd.reject(e); 
            	}
            }
        });

        IndexWorker.addEventListener('error', function(e) {
            dfd.reject(e); 
        });

        IndexWorker.postMessage({action: args.action, options: args.options});
    });
 
    return def.promise(); 
};

//Load app data
$.when(
	$.getScript(baseFolder + 'data/js/payload_details.js'),
	$.getScript(baseFolder + 'data/js/user_details.js'),
	$.getScript(baseFolder + 'data/js/tweet_index.js')
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

					var url = data.var_name.split('tweets_').join('');
					data.url = Config.useCleanUrl ? Config.baseUrl + '/' + url : '?data=' + url;

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

	GrailbirdSearch = {
		hasPrev: false,
		hasNext: false,
		date: '',
		tweet_count: ''
	};

	//Set page title
	var start_month = CalendarMonths[Grailbird.tweet_index[Grailbird.tweet_index.length - 1].month - 1] + ' ' + Grailbird.tweet_index[Grailbird.tweet_index.length - 1].year;
	var end_month = CalendarMonths[Grailbird.tweet_index[0].month - 1] + ' ' + Grailbird.tweet_index[0].year;
	document.title = "Tweets for " + Grailbird.user_details.full_name + " (@" + Grailbird.user_details.screen_name + "), " + start_month + '—' + end_month;

	//Render header
	$('header').html(tmpl('tmpl_header', Grailbird.user_details));
	$('.newtweet_btn').on('click', openTweetActionInWindow);
	$('.search_btn').on('click', toggleSearch);
	$('.search_header').on('submit', onSearchSubmit);
	$('input[type=search]').on('submit', onSearchSubmit);

	//Render tweets
	var url_var_name = getTweetVarFromUrl();
	//If there's a deep link URL, load that
	if (url_var_name) {
		loadHistoryFromVarName(url_var_name);
	}
	//Otherwise load the first page of tweets
	else {
		refresh();
	}

	//Defer menu rendering until after tweets have rendered
	setTimeout(function() {
		//Render history
		$('#tweet_history').html(tmpl('tmpl_history', Grailbird));

		drawTweetHistory();
		refreshActiveHistory();
	}, 10);

	// Listen for url change events
    History.Adapter.bind(window, 'statechange', onUrlChange);
}

function onUrlChange() {
	hasUrlChanged = true;
	loadHistoryFromVarName(getTweetVarFromUrl());
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

function loadHistoryFromVarName(var_name) {
	if (!var_name) {return;}
	
	var index = 0;
	$.each(Grailbird.tweet_index, function(i, data) {
		if (!index && data.var_name == var_name) {
			index = i;
		}
	});

	loadPage(index);
}

function openTweetActionInWindow(e) {
	e.preventDefault();

	var w_width = 520;
    var w_height = 360;
	var popup_options = 'menubar=no,toolbar=no,width='+w_width+',height='+w_height+',left=' + (window.screenX + $('body').width()/2 - w_width/2) + ', top='+(window.screenY + 80);
	window.open(e.target.getAttribute('href'), '', popup_options);
}

function toggleSearch() {
	if ($(document.body).hasClass('search')) {
		hideSearch();
	}
	else {
		showSearch();
	}
}

function showSearch() {
	$('input[type=search]').focus();
	setTimeout(function() {
		$(document.body).addClass('search');
	}, 50);
}

function hideSearch() {
	$(document.body).removeClass('search').removeClass('searching').removeClass('more').removeClass('searched');
	setTimeout(function() {
		refresh();
	}, 250);
}

function onSearchSubmit(e) {
	e.preventDefault();
	var term = $('input[type=search]').val();
	search(term);
}

function toggleTweetHistory(e, open) {
	e.preventDefault();

    var $targ = $('#main');
    var open = open === undefined ? !$targ.hasClass('menu_open') : open;
    
    if (open) {
    	scrollTo('#main', 150);
    	setTimeout(function() {
	        $targ.addClass('menu_open');
	        
	        var height = Math.min(parseInt($('#tweet_history').css('height')), parseInt($('#tweet_history').css('max-height')));

	        $('#main').css('height', $('#main').height() + height + 'px');
	        $('.menu_open section').css({
	        	'-webkit-transform': 'translateY(' + height + 'px)',
	        	'-moz-transform': 'translateY(' + height + 'px)',
	        	'-ms-transform': 'translateY(' + height + 'px)',
	        	'transform': 'translateY(' + height + 'px)'
	        });
    	}, 150);
    }
    else {
    	$('#main').css('height', '');
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
	$('#toggle_history').show().on('click', toggleTweetHistory);

	refreshActiveHistory();
	loadTweets(tweet_index[Grailbird.cur_page]);
	updateUrl();
}

function search(term) {
	function promiseIndexInit() {
		return $.SearchIndex({action: 'init', options: [Config.baseUrl]});
	}

	function promiseTweetIndex() {
		// Get the list of var_names of tweets that have been loaded
		var var_names = $.grep(Grailbird.tweet_index, function(index) {
			return !!Grailbird.data[index.var_name];
		}).map(function(index) {
			return index.var_name;
		});

		return $.SearchIndex({action: 'indexAll', options: [Grailbird.data, var_names]});
	}

	function promiseSearchResults() {
		return $.SearchIndex({action: 'search', options: [term]});
	}

	function promiseUncachedTweetsLoad() {
		var tweetFiles = [];
		var unIndexed = [];
		$.each(Grailbird.tweet_index, function(index, tweet_index) {
			if (!Grailbird.data[tweet_index.var_name]) {
				tweetFiles.push($.getScript(baseFolder + tweet_index.file_name));
				unIndexed.push(tweet_index.var_name);
			}
		});

		return $.when.apply(null, tweetFiles);
	}

	function getTweetsFromResults(results) {
		return $.map(results, function(result, result_index) {
			var result_id = result.ref.split('/');
			var var_name = result_id[0];
			var tweet_id = result_id[1];

			return $.grep(Grailbird.data[var_name], function(tweet, index) {
				tweet = tweet.retweeted_status || tweet;
				return tweet.id_str == tweet_id;
			});
		});
	}

	//Refresh view immediately
	$(document.body).addClass('searching');
	showSearchResults(term);

	$.when(promiseIndexInit(), promiseTweetIndex(), promiseSearchResults()).done(function(initResult, indexResults, searchReults) {
		$(document.body).addClass('more');
		// Pre-cached tweets index, search based on current index
		showSearchResults(term, getTweetsFromResults(searchReults));
	}).then(function() {
		$.when(promiseUncachedTweetsLoad()).done(function(loadResults) {
			// Tweet backlog loaded
		}).then(function() {
			$.when(promiseTweetIndex(), promiseSearchResults()).done(function(indexResults, searchReults) {
				// Tweets re-index and search re-done for new index
				$(document.body).removeClass('searching').removeClass('more').addClass('searched');
				showSearchResults(term, getTweetsFromResults(searchReults));
			});
		});
	});
}

function showSearchResults(term, results) {
	$('input[type=search]').blur();

	//Render nav
	GrailbirdSearch.date = '“' + term + '”';
	GrailbirdSearch.tweet_count = results ? results.length : null;
	$('nav').html(tmpl('tmpl_nav', GrailbirdSearch));

	setTimeout(function() {
		drawTweets(results || []);
	}, 10);
}

function updateUrl() {
	if (!hasUrlChanged) {
		var var_name = Grailbird.cur_page !== 0 ? tweet_index[Grailbird.cur_page].var_name : '';
		var url = getUrlFromTweetVar(var_name);

		//If simply switching from ?date= format to clean format, replace state instead of pushing
		if (Config.useCleanUrl && History.getState().hash.indexOf('date=') > -1) {
			History.replaceState(null, null, url);
		}
		else if (var_name) {
			History.pushState(null, null, url);
		}
	}

	hasUrlChanged = false;
}

function drawTweetHistory() {
	var max = parseInt($('#tweet_history ol.tweet_months').data('max-tweet-count'));
	$('#tweet_history a .count_bar').each(function(index, bar) {
		var val = parseInt($(bar).data('tweet-count'))/max;
		$(bar).height((100 - (val * 100)) + '%');
	});

	$('#tweet_history .bar a').on('click', function(e) {
		e.preventDefault();

		var href = $(e.target).attr('href') || $(e.target).parents('a').attr('href');
		loadHistoryFromVarName(getTweetVarFromUrl(href));
	});
}

function refreshActiveHistory() {
	//Set active state on history
	$('#tweet_history .active').removeClass('active')
		.parents('.tweet_year').removeClass('active');
	$('#tweet_history .bar[data-var-name=' + (Grailbird.tweet_index[Grailbird.cur_page].var_name) + ']').addClass('active')
		.parents('.tweet_year').addClass('active');
}

function loadTweets(tweet_data) {
	var tweets = Grailbird.data[tweet_data.var_name];
	if (tweets) {
		drawTweets(tweets, tweet_data.var_name);
	}
	else {
		$.getScript(baseFolder + tweet_data.file_name, function() {
			drawTweets(Grailbird.data[tweet_data.var_name], tweet_data.var_name);
		});
	}
}

function drawTweets(tweets, var_name) {
	var render = '';
	var curTweet;

	//Tweet Content
	$.each(tweets, function(index, tweet) {
		curTweet = tweet.retweeted_status || tweet;

		tweet.formatted_content = curTweet.formatted_content = tweet.formatted_content || getFormattedTweetContent(curTweet);
		tweet.formatted_date = curTweet.formatted_date = tweet.formatted_date || getFormattedDate(curTweet.created_at);

		if (tweet.retweeted_status) {
			curTweet.retweeter = tweet.user.screen_name;
		}

		tweet.indexed = true;

		render += tmpl('tmpl_tweet', curTweet);
	});

	//If searching, append a searching row at the bottom
	if ($(document.body).hasClass('searching')) {
		var data = {more: $(document.body).hasClass('more')};
		console.log('data', data);
		render += tmpl('tmpl_searching', data);
	}

	//Defer drawing to next paint cycle
	setTimeout(function() {
		$('#main').css('height', '');
		$('#tweet_list').html(render).removeClass('hidden');
		$('.tweet_actions a').on('click', openTweetActionInWindow);
	}, 1);
}

function scrollTo(element, duration, complete) {
	$('html, body').animate({
	     scrollTop: $(element).offset().top
	 }, duration, 'swing', complete);
}

function getTweetVarFromUrl(url) {
	url = url || History.getState().hash;
	var date;

	//Using date?= format
	if (url.split('?date=').length > 1) {
		date = url.split('?date=')[1].split('&')[0]
	}
	//Using clean URL format
	else if (Config.useCleanUrl && url.split(Config.baseUrl).length > 1) {
		date = url.split(Config.baseUrl)[1].split('/').join('');
	}
	
	return date ? 'tweets_' + date : null;
}

function getUrlFromTweetVar(var_name) {
	if (Config.useCleanUrl) {
		return Config.baseUrl + '/' + var_name.split('tweets_').join('');
	}
	else {
		return '?date=' + var_name.split('tweets_').join('');
	}
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