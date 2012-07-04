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

// .+?\s which translates to: "One or more of any character 
// but as soon as a space is encountered, stop!"
var filename_patterns = [
  { // 0
    example: "[group] Show - 01-02 [crc]",
    qty: 4,
    matchnames: ["group", "seriesname", "episodenumberstart", "episodenumberend", "crc"],
    pattern:"^\\[(.+?)\\][ ]?(.*?)[ ]?[-_][ ]?(\\d+)(?:[-_]\\d+)*[-_](\\d+)(?:.*\\[(.+?)\\])?[^\\/]*$" 
  }, 
  { // 1
    example: "[group] Show - 01 [crc]",
    qty: 4,
    matchnames: ["group", "seriesname", "episodenumber", "crc"],
    pattern:"^\\[(.+?)\\][ ]?(.*)[ ]?[-_][ ]?(\\d+)(?:.*\\[(.+?)\\])?[^\\/]*$" 
  }, 
  { // 2
    example: "foo s01e23 s01e24 s01e25 *",
    qty: 4,
    notes: "does not work",
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    pattern:"^(?:(.+?)[ \\._\\-])?[Ss]([0-9]+)[\\.\\- ]?[Ee]([0-9]+)([\\.\\- ]+[Ss](?=$2)[\\.\\- ]?[Ee][0-9]+)*([\\.\\- ]+[Ss](?=$2)[\\.\\- ]?[Ee]([0-9]+))[^\\/]*$" 
  }, 
  { // 3
    example: "foo.s01e23e24*",
    qty: 4,
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    pattern:"^(?:(.+?)[ \\._\\-])?[Ss]([0-9]+)[\\.\\- ]?[Ee]([0-9]+)([\\.\\- ]?[Ee][0-9]+)*[\\.\\- ]?[Ee]([0-9]+)[^\\/]*$" 
  }, 
  { // 4
    example: "foo.1x23 1x24 1x25",
    qty: 4,
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    pattern:"^(?:(.+?)[ \\._\\-])?([0-9]+)[xX]([0-9]+)([ \\._\\-]+(?=$2)[xX][0-9]+)*([ \\._\\-]+(?=$2)[xX]([0-9]+))[^\\/]*$" 
  }, 
  { // 5 
    example: "foo.1x23x24*",
    qty: 4,
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    pattern:"^(?:(.+?)[ \\._\\-])?([0-9]+)[xX]([0-9]+)(?:[xX][0-9]+)*[xX]([0-9]+)[^\\/]*$" 
  }, 
  { // 6
    example: "foo.s01e23-24*",
    qty: 4,
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    notes: "must have a separator (prevents 1x01-720p from being 720 episodes)",
    pattern:"^(?:(.+?)[ \\._\\-])?[Ss]([0-9]+)[\\.\\- ]?[Ee]([0-9]+)(?:[\\-]\n[Ee]?[0-9]+)*[\\-][Ee]?([0-9]+)[\\.\\- ][^\\/]*$" 
  }, 
  { // 7
    example: "foo.1x23-24*",
    qty: 4,
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    notes: "must have a separator (prevents 1x01-720p from being 720 episodes)",
    pattern:"^(?:(.+?)[ \\._\\-])?([0-9]+)[xX]([0-9]+)(?:[\\-+][0-9]+)*[\\-+]([0-9]+)(?:[\\.\\-+ ].*|$)" 
  }, 
  { // 8
    example: "foo.[1x09-11]*",
    qty: 4,
    matchnames: ["seriesname", "seasonnumber", "episodenumberstart", "episodenumberend"],
    pattern:"^(.+?)[ \\._\\-]\\[?([0-9]+)[xX]([0-9]+)(?:[\\-+] [0-9]+)*[\\-+]([0-9]+)\\][^\\/]*$" 
  }, 
  { // 9
    example: "foo - [012]",
    qty: 2,
    matchnames: ["seriesname", "episodenumber"],
    pattern:"^(?:(.+?)[ \\._\\-])?\\[([0-9]+)\\][^\\/]*$" 
  }, 
  { // 10
    example: "foo.s0101, foo.0201",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern:"^(.+?)[ \\._\\-][Ss]([0-9]{2})[\\.\\- ]?([0-9]{2})[^0-9]*$" 
  }, 
  { // 11
    example: "foo.1x09*",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern:"^(?:(.+?)[ \\._\\-])?\\[?([0-9]+)[xX]([0-9]+)\\]?[^\\/]*$" 
  }, 
  { // 12
    example: "foo.s01.e01, foo.s01_e01, \"foo.s01 - e01\"",
    qty: 3,                             
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern:"^(?:(.+?)[ \\._\\-])?\\[?[Ss]([0-9]+)[ ]?[\\._\\- ]?[ ]?[Ee]?([0-9]+)\\]?[^\\/]*$" 
  }, 
  { // 13
    example: "foo.2010.01.02.etc",
    qty: 4,
    matchnames: ["seriesname", "year", "month", "day"],
    pattern:"^(?:(.+?)[ \\._\\-])?(\\d{4})[ \\._\\-](\\d{2})[ \\._\\-](\\d{2})[^\\/]*$" 
  }, 
  { // 14
    example: "foo - [01.09]",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern:"^(?:(.+?))[ \\._\\-]?\\[([0-9]+?)[.]([0-9]+?)\\][ \\._\\-]?[^\\/]*$" 
  }, 
  { // 15 
    example: "Foo - S2 E 02 - etc",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern:"^(.+?)[ ]?[ \\._\\-][ ]?[Ss]([0-9]+)[\\.\\- ]?[Ee]?[ ]?([0-9]+)[^\\/]*$" 
  }, 
  { // 16
    example: "Show - Episode 9999 [S 12 - Ep 131] - etc",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern: "(.+)[ ]-[ ][Ee]pisode[ ]\\d+[ ]\\[[sS][ ]?(\\d+)(?:[ ]|[ ]-[ ]|-)(?:[eE]|[eE]p)[ ]?(\\d+)\\].*$" 
  }, 
  { // 17
    example: "show name 2 of 6 - blah",
    qty: 2,
    matchnames: ["seriesname", "episodenumber"],
    pattern: "^(.+?)[ \\._\\-]([0-9]+)[ \\._\\-]?\\d+(?:[\\._ -]|$|[^\\/]*$)" 
  }, 
  { // 18
    example: "Show.Name.Part.1.and.Part.2",
    qty: 3,
    matchnames: ["seriesname", "episodenumberstart", "episodenumberend"],
    notes:"the (?i) in the beginning did not work",
    pattern:"^(.+?)[ \\._\\-](?:part|pt)?[\\._ -]([0-9]+)(?:[ \\._-](?:and|&|to)[ \\._-](?:part|pt)?[ \\._-](?:[0-9]+))*[ \\._-](?:and|&|to)[ \\._-]?(?:part|pt)?[ \\._-]([0-9]+)[\\._ -][^\\/]*$" 
  }, 
  { // 19
    example: "Show.Name.Part1",
    qty: 2,
    matchnames: ["seriesname", "episodenumber"],
    pattern:"^(.+?)[ \\._\\-][Pp]art[ ]([0-9]+)[\\._ -][^\\/]*$" 
  }, 
  { // 20
    example: "show name Season 01 Episode 20",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
    pattern: "^(.+?)[ ]?[Ss]eason[ ]?([0-9]+)[ ]?[Ee]pisode[ ]?([0-9]+)[^\\/]*$" 
  }, 
  { // 21
    example: "foo.103*",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"], 
    pattern:"^(.+)[ \\._\\-]([0-9]{1})([0-9]{2})[\\._ -][^\\/]*$" 
  }, 
  { // 22 
    example: "foo.0103*",
    qty: 3,
    matchnames: ["seriesname", "seasonnumber", "episodenumber"],
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

var handleYear = function(year) {
  // Handle two-digit years with heuristic-ish guessing
  // Assumes 50-99 becomes 1950-1999, and 0-49 becomes 2000-2049
  // ..might need to rewrite this function in 2050, but that seems like
  // a reasonable limitation
  year = parseInt(year, 10);

  // No need to guess with 4-digit years
  if ( year > 999 ) { 
    return year;
  }
  if ( year < 50 ) { 
    return 2000 + year;
  }
  return 1900 + year;
};

var cleanRegexedSeriesName = function(seriesname) {
  // Cleans up series name by removing any . and _
  // characters, along with any trailing hyphens.

  // Is basically equivalent to replacing all _ and . with a
  // space, but handles decimal numbers in string, for example:

  // >>> cleanRegexedSeriesName("an.example.1.0.test")
  // 'an example 1.0 test'
  // >>> cleanRegexedSeriesName("an_example_1.0_test")
  // 'an example 1.0 test'
  seriesname = seriesname
    .replace(/(\D)[.](\D)/g, "$1 $2")
    .replace(/(\D)[.]/g, "$1 ")
    .replace(/[.](\D)/g, " $1")
    .replace(/_/g, " ")
    .replace(/-$/, "") 
    .replace(/^\s\s*/, '')
    .replace(/\s\s*$/, '');

  return seriesname;
};

var parseFile = function(callback, file) {
  // https://github.com/dbr/tvnamer/blob/master/tvnamer/config_defaults.py
  // http://www.diveintojavascript.com/articles/javascript-regular-expressions
  var i, l, j, ll, matches, obj;
  for (i=0,l=filename_patterns.length; i<l; i++) {
    obj = filename_patterns[i];
    obj.regex = new RegExp(obj.pattern);
    var matchnames = obj.matchnames;

    file = file || "";
    matches = file.match(obj.regex);
    if (matches) { 

      var episode_numbers, series_name,
        i_name = _.indexOf(matchnames, "seriesname"),
        i_season = _.indexOf(matchnames, "seasonnumber"),
        i_group = _.indexOf(matchnames, "group"),
        i_start = _.indexOf(matchnames, "episodenumberstart"),
        i_end = _.indexOf(matchnames, "episodenumberend"),
        i_ep = _.indexOf(matchnames, "episodenumber"),
        i_year = _.indexOf(matchnames, "year"),
        i_month = _.indexOf(matchnames, "month"),
        i_day = _.indexOf(matchnames, "day");

      if (i_start >= 0 ) {
        var start = parseInt(matches[i_start+1], 10);
        var end = parseInt(matches[i_end+1], 10);
        if (start > end) {
          // swap start and end
          var tmp = start;
          start = end;
          end = tmp;
        }
        episode_numbers = [];
        for (j=start,ll=end+1; j<ll; j++) {
          episode_numbers.push(j);
        }
      }
      else if (i_ep >= 0 ) {
        episode_numbers = [parseInt(matches[i_ep+1], 10)];
      }
      else if ( (i_year >= 0) || (i_month >= 0 ) || (i_day >= 0) ) {
        if (!((i_year >= 0) && (i_month >= 0) && (i_day >= 0))) {
          callback("Date-based regex must contain groups 'year', 'month' and 'day'");
        }

        var year = handleYear(matches[i_year+1]);
        var month = parseInt(matches[i_month+1], 10);
        var day = parseInt(matches[i_day+1], 10);
        episode_numbers = [new Date(year, month, day)];
      }
      else {
        callback(
          "Regex does not contain episode number group, should "+
          "contain episodenumber, episodenumber1-9, or "+
          "episodenumberstart and episodenumberend.\n\nPattern was: " + obj.pattern);
      }

      if (i_name >= 0) {
        series_name = matches[i_name+1];
      } else {
        callback("Regex must contain seriesname. Pattern was: " + obj.pattern);
      }

      if (series_name) {
        series_name = cleanRegexedSeriesName(series_name);
      }
      
      //if ( matches.length === ( obj.qty + 1 ) ) {
        //console.log('['+i+']: ' + matches.length);
        //console.log(matches);
        //for (j=0,ll=obj.qty; j<ll; j++) {
          //console.log(obj.matchnames[j] + " = " + matches[j+1]);
        //}
      //}

      if (i_season >= 0) {
        var seasonnumber = parseInt(matches[i_season+1], 10);
        episode = new EpisodeInfo({
          seriesname: series_name,
          seasonnumber: seasonnumber,
          episodenumbers: episode_numbers,
          filename: file,
          extra: matches
        });
      }
      else if ( (i_year >= 0) && (i_month >= 0) && (i_day >= 0) ) {
        episode = new DatedEpisodeInfo({
          seriesname: series_name,
          episodenumbers: episode_numbers,
          filename: file,
          extra: matches
        });
      }
      else if ( i_group >= 0) {
        episode = new AnimeEpisodeInfo({
          seriesname: series_name,
          episodenumbers: episode_numbers,
          filename: file,
          extra: matches
        
        });
      }
      else {
        episode = NoSeasonEpisodeInfo({
          seriesname: series_name,
          episodenumbers: episode_numbers,
          filename: file,
          extra: matches
        });
      }
      return callback(null, episode);
    }
  }
  callback("Cannot parse " + file);
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
      var emit = [];
      parseFile(function(err, episode) {
        if (err) { _callback(err); }

        emit.push(episode);
      }, episodes[0].text);
      this.emit(emit);

      //var emit = [], href, matches;
      //episodes.forEach(function(episode) {
        //emit.push({
          //name: episode.text
        //});
      //});
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

    //console.log(episodes);
    //console.log("found " + episodes.length + " episodes.");

  }, showId);

  var showId = 2; // 30 Rock
  scrapeEZTV(function(err, episodes) {
    if (err) { console.log(err); }

    //console.log(episodes);
    //console.log("found " + episodes.length + " episodes.");

  }, showId);

});

var EpisodeInfo = function(opts) {

  return this;
};
EpisodeInfo.prototype = {

};
var NoSeasonEpisodeInfo = function(opts) {
  return this;
};
NoSeasonEpisodeInfo.prototype = {
};
