var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io');

var constants = require('./tv-shows-constants.js').constants;
var utils = require('./utils.js').utils;

var scrapeEZTV = function(_callback) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/showlist/', function(err, $) {
          var shows = [], href, matches;
          $("tr[name]").each(function(tr) {
            var anchor = $('.thread_link', tr);
            var font = $('.forum_thread_post font', tr);
            shows.push({
              href:anchor.attribs.href,
              text:anchor.fulltext,
              status:font.fulltext
            });
          });
          this.emit(shows);
      });

    },
    reduce:function(shows) {
      var emit = [], href, matches, obj;
      shows.forEach(function(show) {
        matches = show.href.match(/\/shows\/([0-9]+)\/([0-9a-zA-Z\-]+)/);
        // create a show
        obj = {
          ShowId: matches[1],
          HumanName: show.text,
          Status: show.status,
          Subscribed: false,
          ExactName: utils.buildExactNameForBackwardsCompatibility(show.text)
        };
        // parse it into an Episode derivative
        utils.parseShow(function(err, episode) {
          if (err) { console.log(err); }
          else {
            emit.push(episode);
          }
        }, obj);
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

var readPlistsAndScrapeEZTV = function(callback) {
  async.parallel({
      shows: function(callback) {
        scrapeEZTV(function(err, shows) {
          if (err) { callback(err); }

          callback(null, shows);
        });
      },
      plists: function(callback) {
        utils.readPlists(function(err, plist) {
          if (err) { callback(err); }
          callback(null, plist);
        });
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
};

readPlistsAndScrapeEZTV(function(err, data) {
  if (err) { 
    console.log(err);
    process.exit();
  }
 
  // data 
  //{ 
    //shows: [],
    //plists: { 
      //userPrefs: { 
        //AutomaticallyOpenTorrent: true,
        //CheckDelay: 1,
        //IsEnabled: false,
        //'NSWindow Frame MainWindow': '52 111 484 705 0 0 1920 1178 ',
        //Quality: -1,
        //SUEnableAutomaticChecks: true,
        //SUEnableSystemProfiling: true,
        //SUHasLaunchedBefore: true,
        //SULastCheckTime: Sun, 08 Jan 2012 15:10:53 GMT,
        //SUSendProfileInfo: false,
        //ScriptVersion: '100',
        //TorrentFolder: '~/Movies' 
      //},
      //showDb: { 
        //Shows: [], 
        //Version: '1' 
      //} 
    //} 
  //}

  var incoming_shows = {},
      known_shows = {};

  var shows = data.shows || [];
  shows.forEach(function(show) {
    key = utils.buildUniqueIdName(show.seriesname);
    incoming_shows[key] = show;
  });

  shows = data.plists.showDb.Shows || [];
  shows.forEach(function(show) {
    key = utils.buildUniqueIdName(show.seriesname);
    known_shows[key]= show;
  });

  shows = data.shows || [];

  // walk through incoming_shows and known_shows to see if any of
  // incoming_show's entries match ones from known_shows. 
  if (_.size(known_shows) > 0) {
    var shows_to_add = [];
    var keys = _.keys(incoming_shows);
    for( var i=0, l=keys.length; i<l; i++) {
      if (!known_shows[keys[i]]) {
        shows_to_add.push(incoming_shows[keys[i]]);
      } else {
        // Could add properties from incoming shows 
        // like Status to previous known_shows entry
      }
    }
    
    // drop the keys of known_shows and use it as an array
    known_shows = _.values(known_shows);

    // merge the shows_to_add to known_shows
    for( var i=0, l=shows_to_add.length; i<l; i++) {
      known_shows.push(shows_to_add[i]);
    } 
    // set shows to known_shows
    shows = known_shows;
  }

  shows = _.map(shows, function(show) {
    return show.toPlist();
  });

  shows = _.sortBy(shows, function(show) {
    return show.HumanName;
  });

  var save_these_shows = {
    "Shows": shows,
    "Version": "1"
  };
  var home = process.env.HOME;
  var tv_shows_db = home + "/Library/Application Support/TVShows/TVShows.plist";
  utils.writePlist(function(err, obj) {
    if (err) { console.log(err); }
    //console.log(obj);
    
    }, save_these_shows, tv_shows_db
  );




});
