var async = require('async')
  , fs = require('fs')
  , handlebars = require('handlebars')
  , request = require('request')
  , _ = require('underscore')
  , plist = require('plist')
  , nodeio = require('node.io')
  , argv = require('optimist').argv
  , util = require('util')
  , exec = require('child_process').exec;

var constants = require('./tv-shows-constants.js').constants;

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
          var shows = [], href, matches;
          $(".forum_header_noborder tr[name]").each(function(tr) {
            var anchor = $('.forum_thread_post .epinfo', tr);
            shows.push({
              href:anchor.attribs.href,
              text:anchor.fulltext
            });
          });
          this.emit(shows);
      });
    },
    reduce:function(episodes) {
        
      // https://github.com/dbr/tvnamer/blob/master/tvnamer/config_defaults.py
      // http://www.diveintojavascript.com/articles/javascript-regular-expressions
      var filename_patterns = [
        // python ?P<thegroupname>
        // .+?\s which translates to: "One or more of any character but as soon as a space is encountered, stop!"
        //
        // 0 [group] Show - 01-02 [crc]
        // group, seriesname, episodenumberstart, episodenumberend, ?crc
        "^\\[(.+?)\\][ ]?(.*?)[ ]?[-_][ ]?(\\d+)(?:[-_]\\d+)*[-_](\\d+)(?:.*\\[(.+?)\\])?[^\\/]*$", 
        // 1 [group] Show - 01 [crc]
        // group, seriesname, episodenumber, ?crc
        "^\\[(.+?)\\][ ]?(.*)[ ]?[-_][ ]?(\\d+)(?:.*\\[(.+?)\\])?[^\\/]*$", 
        // 2 foo s01e23 s01e24 s01e25 *
        // -- Doesn't work
        // seriesname, seasonnumber, episodenumberstart, seasonnumber, seasonnumber, episodenumberend
        "^(?:(.+?)[ \\._\\-])?[Ss]([0-9]+)[\\.\\- ]?[Ee]([0-9]+)([\\.\\- ]+[Ss](?=$2)[\\.\\- ]?[Ee][0-9]+)*([\\.\\- ]+[Ss](?=$2)[\\.\\- ]?[Ee]([0-9]+))[^\\/]*$", 
        // 3 foo.s01e23e24*
        // seriesname, seasonnumber, episodenumberstart, episodenumberend
        "^(?:(.+?)[ \\._\\-])?[Ss]([0-9]+)[\\.\\- ]?[Ee]([0-9]+)([\\.\\- ]?[Ee][0-9]+)*[\\.\\- ]?[Ee]([0-9]+)[^\\/]*$", 
        // 4 foo.1x23 1x24 1x25
        // seriesname, seasonnumber, episodenumberstart, episodenumberend
        "^(?:(.+?)[ \\._\\-])?([0-9]+)[xX]([0-9]+)([ \\._\\-]+(?=$2)[xX][0-9]+)*([ \\._\\-]+(?=$2)[xX]([0-9]+))[^\\/]*$", 
        // 5 foo.1x23x24*
        "^(?:(.+?)[ \\._\\-])?([0-9]+)[xX]([0-9]+)(?:[xX][0-9]+)*[xX]([0-9]+)[^\\/]*$", 
        // 6 foo.s01e23-24*
        // must have a separator (prevents s01e01-720p from being 720 episodes)
        "^(?:(.+?)[ \\._\\-])?[Ss]([0-9]+)[\\.\\- ]?[Ee]([0-9]+)(?:[\\-]\n[Ee]?[0-9]+)*[\\-][Ee]?([0-9]+)[\\.\\- ][^\\/]*$", 
        // 7 foo.1x23-24*
        // must have a separator (prevents 1x01-720p from being 720 episodes)
        "^(?:(.+?)[ \\._\\-])?([0-9]+)[xX]([0-9]+)(?:[\\-+][0-9]+)*[\\-+]([0-9]+)(?:[\\.\\-+ ].*|$)", 
        // 8 foo.[1x09-11]*
        "^(.+?)[ \\._\\-]\\[?([0-9]+)[xX]([0-9]+)(?:[\\-+] [0-9]+)*[\\-+]([0-9]+)\\][^\\/]*$", 
        // 9 foo - [012]
        "^(?:(.+?)[ \\._\\-])?\\[([0-9]+)\\][^\\/]*$", 
        // 10 foo.s0101, foo.0201
        "^(.+?)[ \\._\\-][Ss]([0-9]{2})[\\.\\- ]?([0-9]{2})[^0-9]*$", 
        // 11 foo.1x09*
        "^(?:(.+?)[ \\._\\-])?\\[?([0-9]+)[xX]([0-9]+)\\]?[^\\/]*$", 
        // 12 foo.s01.e01, foo.s01_e01, "foo.s01 - e01"
        // seriesname, seasonnumber, episodenumber
        "^(?:(.+?)[ \\._\\-])?\\[?[Ss]([0-9]+)[ ]?[\\._\\- ]?[ ]?[Ee]?([0-9]+)\\]?[^\\/]*$", 
        // 13 foo.2010.01.02.etc
        "^(?:(.+?)[ \\._\\-])?(\\d{4})[ \\._\\-](\\d{2})[ \\._\\-](\\d{2})[^\\/]*$", 
        // 14 foo - [01.09]
        "^(?:(.+?))[ \\._\\-]?\\[([0-9]+?)[.]([0-9]+?)\\][ \\._\\-]?[^\\/]*$", 
        // 15 Foo - S2 E 02 - etc
        // seriesname, seasonnumber, episodenumber
        "^(.+?)[ ]?[ \\._\\-][ ]?[Ss]([0-9]+)[\\.\\- ]?[Ee]?[ ]?([0-9]+)[^\\/]*$", 
        // 16 Show - Episode 9999 [S 12 - Ep 131] - etc
        "(.+)[ ]-[ ][Ee]pisode[ ]\\d+[ ]\\[[sS][ ]?(\\d+)(?:[ ]|[ ]-[ ]|-)(?:[eE]|[eE]p)[ ]?(\\d+)\\].*$", 
        // 17 show name 2 of 6 - blah
        // seriesname, episodenumber
        "^(.+?)[ \\._\\-]([0-9]+)[ \\._\\-]?\\d+(?:[\\._ -]|$|[^\\/]*$)", 
        // 18 Show.Name.Part.1.and.Part.2
        "^(.+?)[ \\._\\-](?:part|pt)?[\\._ -]([0-9]+)(?:[ \\._-](?:and|&|to)[ \\._-](?:part|pt)?[ \\._-](?:[0-9]+))*[ \\._-](?:and|&|to)[ \\._-]?(?:part|pt)?[ \\._-]([0-9]+)[\\._ -][^\\/]*$", 
        // 19 Show.Name.Part1
        "^(.+?)[ \\._\\-][Pp]art[ ]([0-9]+)[\\._ -][^\\/]*$", 
        // 20 show name Season 01 Episode 20
        "^(.+?)[ ]?[Ss]eason[ ]?([0-9]+)[ ]?[Ee]pisode[ ]?([0-9]+)[^\\/]*$", 
        // 21 foo.103* (3)
        // seriesname, seasonnumber, episodenumber
        "^(.+)[ \\._\\-]([0-9]{1})([0-9]{2})[\\._ -][^\\/]*$", 
        { // 22 
          example: "foo.0103*",
          qty: 3,
          matchnames: ["seriesname", "seasonnumber", "episodenumber" ],
          notes: "not working",
          pattern: "^(.+)[ \\._\\-]([0-9]{2})([0-9]{2,3})[\\._ -][^\\/]*$"
        }, 
        { // 23
          example: "show.name.e123.abc",
          qty: 2,
          matchnames: ["seriesname", "episodenumber"],
          pattern: "^(.+?)[ \\._\\-][Ee]([0-9]+)[\\._ -][^\\/]*$"
        }
      ]; 

      var i, l;
      var regexs = [];
      for (i=0,l=filename_patterns.length; i<l; i++) {
        regexs.push(new RegExp(filename_patterns[i]));
      }
      for (i=0,l=regexs.length; i<l; i++) {
        var matches = episodes[0].text.match(regexs[i]);
        if (matches) {
          console.log('['+i+']: ' + matches.length);
          console.log(matches);
        }
      }

      var emit = [], href, matches;
      episodes.forEach(function(episode) {
        //matches = episode.href.match(/\/shows\/([0-9]+)\/([0-9a-zA-Z\-]+)/);
        emit.push({
          name: episode.text
        });
      });
      //this.emit(emit);
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

var readPlistsAndScrapeEZTV = function(callback) {
  async.parallel({
      plists: function(callback) {
        readPlists(function(err, plist) {
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
  if (err) { console.log(err); }
 
  var showId = 1; // 24
  scrapeEZTV(function(err, episodes) {
    if (err) { console.log(err); }

    console.log(episodes);
    console.log("found " + episodes.length + " episodes.");

  }, showId);






});
