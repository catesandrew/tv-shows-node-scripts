var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io');

var constants = require('./tv-shows-constants.js').constants;
var utils = require('./utils.js').utils;

var scrapeEZTV = function(_callback, showId) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/shows/' + showId + "/", function(err, $) {
          var episodes = [], href, matches;
          $(".forum_header_noborder tr[name]").each(function(tr) {
            var anchor = $('.forum_thread_post .epinfo', tr);
            episodes.push({
              href:anchor.attribs.href,
              text:anchor.fulltext
            });
          });
          this.emit(episodes);
      });
    },
    reduce:function(episodes) {
      var emit = [];
      episodes.forEach(function(episode) {
        utils.parseFile(function(err, episode) {
          if (err) { _callback(err); }
          emit.push(episode);
        }, episode.text);
      });
      this.emit(emit);
    },
    complete: function(callback) {
      callback();
    }
  };

  var job = new nodeio.Job({auto_retry:true, timeout:10, retries:3}, methods);
  nodeio.start(job, {}, function(err, data) {
    if (err) { callback(err); }
    _callback(null, data);
  }, true);
};

var readPlistsAndScrapeEZTV = function(callback, showId) {
  async.parallel({
      plists: function(callback) {
        utils.readPlists(function(err, plist) {
          if (err) { callback(err); }
          callback(null, plist);
        });
      },
      episodes: function(callback) {
        scrapeEZTV(function(err, episodes) {
          if (err) { callback(err); }
          callback(null, episodes);
        }, showId);
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
};

var args = process.argv.slice(2);
if (args && args.length > 0) {
  var showId = args[0];

  readPlistsAndScrapeEZTV(function(err, data) {
    if (err) { console.log(err); }

    //_.each(data.episodes, function(episode) {
      //console.log(episode.toString());
      //console.log(episode.getepdata());
    //});

    var maxSeason = 0, maxEpisode = 0;
    var seasonNo, episodeNo, epData;
    _.each(data.episodes, function(episode) {
      epData = episode.getepdata();
      seasonNo = epData.seasonnumber;
      episodeNo = epData.episode;

      if ( (maxSeason === seasonNo && maxEpisode < episodeNo) || (maxSeason < seasonNo)) {
        maxSeason = seasonNo;
        maxEpisode = episodeNo;
      }

    });

    console.log("#{"+maxSeason+"}-#{"+maxEpisode+"}");
  }, showId);
}
