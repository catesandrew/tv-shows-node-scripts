var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , plist = require('plist')
  , nodeio = require('node.io')
  , exec = require('child_process').exec;

var constants = require('./tv-shows-constants.js').constants;
var utils = require('./utils.js').utils;

var readPlist = function(callback, path) {
  async.series([
    function(callback){
      path = path || "";
      var safe_path = path.replace(' ', '\\ ');

      try {
        // Query the entry
        var stats = fs.lstatSync(path);

        if (stats.isFile()) {
          exec('plutil -convert xml1 ' + safe_path, 
            function (err, stdout, stderr) {
              if (err) { callback(err); }
              callback(null);
          });
        }
      } 
      catch (e) {
        callback(e);
      }
    },
    function(callback){
      plist.parseFile(path, function(err, obj) {
        if (err) { callback(err); }
        callback(null, obj);
      });
    },
  ],
  function(err, results){
    if (err) { callback(err); }
    if (results.length > 1) {
      callback(null, results[1]);
    }
  });
};

var readPlists = function(callback) {
  async.parallel({
      userPrefs: function(callback) {
        var home = process.env.HOME;
        var user_prefs_file = home + "/Library/Preferences/net.sourceforge.tvshows.plist";
        readPlist(function(err, data) {
          //if (err) { callback(err); }
          if (err) {
            callback(null, {});
          } 
          else if (data) {
            if (data.length > 0) {
              callback(null, data[0]);
            } else {
              callback(null, data);
            }
          }
        }, user_prefs_file);
      },
      showDb: function(callback) {
        var home = process.env.HOME;
        var tv_shows_db = home + "/Library/Application Support/TVShows/TVShows.plist";
        readPlist(function(err, data) {
          //if (err) { callback(err); }
          if (err) {
            callback(null, {});
          } 
          else if (data) {
            if (data.length > 0) {
              callback(null, data[0]);
            } else {
              callback(null, data);
            }
          }
        }, tv_shows_db);
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
};

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

  var job = new nodeio.Job({timeout:10, retries:3}, methods);
  nodeio.start(job, {}, function(err, data) {
    if (err) { callback(err); }
    _callback(null, data);
  }, true);
};

var readPlistsAndScrapeEZTV = function(callback, showId) {
  async.parallel({
      plists: function(callback) {
        readPlists(function(err, plist) {
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

    console.log(data);

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
