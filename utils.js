var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , plist = require('plist')
  , util = require('util')
  , http = require('http')
  , url = require('url')
  , path = require('path')
  , events = require('events')
  , exec = require('child_process').exec;

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
    pattern: "^(.+?)[ \\._\\-]([0-9]+)of[ \\._\\-]?\\d+(?:[\\._ -]|$|[^\\/]*$)" 
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

var trimCommaSpaceTheOrA=function(name){
  var exact_name = name.split(', The');
  if (exact_name.length > 1) {
    exact_name = 'The ' + exact_name[0];
  } else {
    // it did not split b/c it was not found at end
    exact_name = exact_name[0];
    // retry with trying to find A at the end
    // TODO: check for ', An' at end
    exact_name = exact_name.split(', A');
    if (exact_name.length > 1) {
      exact_name = 'A ' + exact_name[0];
    } else {
      // again, it was not found so reset 
      exact_name = exact_name[0];
    }
  }

  // trim spaces
  exact_name = exact_name.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

  lookForTheAtEnd = exact_name.match(/ The$/);
  if (lookForTheAtEnd) {
    exact_name = "The " + exact_name.substr(0, exact_name.length - 4);
  }
  return exact_name;
};

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

var downloadTorrent = function(callback, downloadfile, dir) {
  // http://stackoverflow.com/questions/4771614/download-large-file-with-node-js-avoiding-high-memory-consumption
  var host = url.parse(downloadfile).hostname;

  if (host === "www.bt-chat.com") {
    return callback("bt-chat.com is banned");
  }
  var filename = url.parse(downloadfile).pathname.split("/").pop();

  var theurl = http.createClient(80, host);
  var requestUrl = downloadfile;
  //console.log("Downloading file: " + filename);
  //console.log("Before download request");
  var request = theurl.request('GET', requestUrl, {"host": host});
  request.end();

  // We actually want the file to be stored in memory and then
  // written to disk for .torrent files. otherwise the watched
  // folder for transmission might go bonkers trying to open
  // incomplete torrent files.
  request.addListener('response', function (response) {
    response.setEncoding('binary');
    //console.log("Status Code: " + response.statusCode);
    //console.log("HEADERS: " + JSON.stringify(response.headers));
    //console.log("File size: " + response.headers['content-length'] + " bytes.");
    var fileSize = response.headers['content-length'];
    if ( !fileSize ) {
      return callback("No Content Length");
    }
    var body = '';
    response.addListener('data', function (chunk) {
      body += chunk;
    });
    response.addListener("end", function() {
      fs.writeFileSync(dir + "/" + filename, body, 'binary');
      //console.log("Downloaded file: " + filename);
      return callback(null, "Downloaded file: " + filename);
    });
    response.addListener('error', function (e) {
      return callback(e);
    });
    response.addListener('close', function (e) {
      return callback(e);
    });
  });

};

var Utils = function(){
};
Utils.prototype = {
  formatEpisodeNumbers:function(episodenumbers){
    // Format episode number(s) into string, using configured values
    var epno;
    if (episodenumbers.length === 1){ 
      epno = ('00' + episodenumbers[0]).slice(-2);
    } else {
      var copy = _.map(episodenumbers, function(num) {
        return ('00' + num).slice(-2);
      });
      return copy.join('-');
    }

    return epno;
  },
  formatEpisodeName:function(names, join_with){
    //Takes a list of episode names, formats them into a string.
    //If two names are supplied, such as "Pilot (1)" and "Pilot (2)", the
    //returned string will be "Pilot (1-2)"

    //If two different episode names are found, such as "The first", and
    //"Something else" it will return "The first, Something else"
    if (names.length === 1){
      return names[0];
    }

    var found_names = [],
        number, numbers = [];

    _.each(names, function(cname){
      number = cname.match(/(.*) \(?:([0-9]+)\)$/);
      if ( number ) {
        var epname = number[1], 
            epno = number[2];
        if (( found_names.length > 0 ) && ( _.indexOf(found_names, epname) < 0 )) {
          return join_with.join(names);
        }
        found_names.push(epname);
        numbers.push(parseInt(epno, 10));
      }
      else {
        // An episode didn't match
        return join_with.join(names);
      }
    });

    var retval_names = [];
    var start = Math.min(numbers),
        end = Math.max(numbers);

    retval_names.push(""+found_names[0]+" ("+start +"-"+end+")");

    return join_with.join(retval_names);
  },
  handleYear:function(year) {
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
  },
  cleanRegexedSeriesName:function(seriesname) {
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
  },
  parseFile:function(callback, file) {
    // https://github.com/dbr/tvnamer/blob/master/tvnamer/config_defaults.py
    // http://www.diveintojavascript.com/articles/javascript-regular-expressions
    var i, l, j, ll, matches, obj;
    for (i=0,l=filename_patterns.length; i<l; i++) {
      obj = filename_patterns[i];
      if (!obj.regex) {
        obj.regex = new RegExp(obj.pattern);
      }
      var matchnames = obj.matchnames;

      file = file || "";
      matches = file.match(obj.regex);
      if (matches) { 

        var episode_numbers, series_name, year, month, day,
          i_name = _.indexOf(matchnames, "seriesname"),
          i_season = _.indexOf(matchnames, "seasonnumber"),
          i_group = _.indexOf(matchnames, "group"),
          i_start = _.indexOf(matchnames, "episodenumberstart"),
          i_end = _.indexOf(matchnames, "episodenumberend"),
          i_ep = _.indexOf(matchnames, "episodenumber"),
          i_year = _.indexOf(matchnames, "year"),
          i_month = _.indexOf(matchnames, "month"),
          i_day = _.indexOf(matchnames, "day");

        year = null;
        month = null;
        day = null;

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
            return callback("Date-based regex must contain groups 'year', 'month' and 'day'");
          }

          year = utils.handleYear(matches[i_year+1]);
          month = parseInt(matches[i_month+1], 10);
          day = parseInt(matches[i_day+1], 10);
          episode_numbers = [new Date(year, month-1, day)];
        }
        else {
          return callback(
            "Regex does not contain episode number group, should "+
            "contain episodenumber, episodenumber1-9, or "+
            "episodenumberstart and episodenumberend.\n\nPattern was: " + obj.pattern);
        }

        if (i_name >= 0) {
          series_name = matches[i_name+1];
        } else {
          return callback("Regex must contain seriesname. Pattern was: " + obj.pattern);
        }

        if (series_name) {
          series_name = utils.cleanRegexedSeriesName(series_name);
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
            filename: file
          });
        }
        else if ( (i_year >= 0) && (i_month >= 0) && (i_day >= 0) ) {
          episode = new DatedEpisodeInfo({
            seriesname: series_name,
            episodenumbers: episode_numbers,
            year: year,
            month: month,
            day: day,
            filename: file
          });
        }
        else if ( i_group >= 0) {
          var group = matches[i_group+1];
          episode = new AnimeEpisodeInfo({
            seriesname: series_name,
            episodenumbers: episode_numbers,
            group: group,
            filename: file
          });
        }
        else {
          episode = new NoSeasonEpisodeInfo({
            seriesname: series_name,
            episodenumbers: episode_numbers,
            filename: file
          });
        }
        return callback(null, episode);
      }
    }
    return callback("Cannot parse " + file, null);
  },
  parseShow:function(callback, show) {
    var episode_numbers, episode, series_name,
        year, month, day;

    year = null;
    month = null;
    day = null;

    if (!show.HumanName) {
      return callback("Show must contain seriesname.");
    } 

    if (show.Episode) {
      episode_numbers = [parseInt(show.Episode, 10)];
    }
    else if ( show.Year || show.Month || show.Day ) {
      if (!(show.Year && show.Month && show.Day)) {
        return callback("Date-based show must contain 'year', 'month' and 'day'");
      }

      year = utils.handleYear(show.Year);
      month = parseInt(show.Month, 10);
      day = parseInt(show.Day, 10);
      episode_numbers = [new Date(year, month-1, day)];
    }
    else {
      episode = new NoEpisodeInfo({
        exactname: show.ExactName,
        status: show.Status,
        subscribed: show.Subscribed,
        showId: show.ShowId,
        seriesname: show.HumanName
      });
      return callback(null, episode);
    }

    if (show.Season) {
      episode = new EpisodeInfo({
        exactname: show.ExactName,
        status: show.Status,
        subscribed: show.Subscribed,
        showId: show.ShowId,
        seriesname: show.HumanName,
        seasonnumber: parseInt(show.Season, 10),
        episodenumbers: episode_numbers
      });
    }
    else if (show.Year && show.Month && show.Day) {
      episode = new DatedEpisodeInfo({
        exactname: show.ExactName,
        status: show.Status,
        subscribed: show.Subscribed,
        showId: show.ShowId,
        seriesname: show.HumanName,
        episodenumbers: episode_numbers,
        year: year,
        month: month,
        day: day
      });
    }
    else if (show.Group) {
      episode = new AnimeEpisodeInfo({
        exactname: show.ExactName,
        status: show.Status,
        subscribed: show.Subscribed,
        showId: show.ShowId,
        seriesname: show.HumanName,
        episodenumbers: episode_numbers,
        group: show.Group
      });
    }
    else {
      episode = new NoSeasonEpisodeInfo({
        exactname: show.ExactName,
        status: show.Status,
        subscribed: show.Subscribed,
        showId: show.ShowId,
        seriesname: show.HumanName,
        episodenumbers: episode_numbers
      });
    }
    return callback(null, episode);
  },
  buildExactNameForBackwardsCompatibility:function(name) {
    name = name || "";
    name = trimCommaSpaceTheOrA(name);

    name = name
      .replace(/\(/g,'')
      .replace(/\)/g,'')
      .replace(/\'/g,'')
      .replace(/\//g,'-')
      .replace(/#/g,'')
      .replace(/:/g,'')
      .replace(/!/g,'')
      .replace(/\./g,'')
      .replace(/\?/g,'')
      .replace(/ /g, '+');

    return name;
  },
  buildUniqueIdName:function(name) {
    name = name || "";
    name = trimCommaSpaceTheOrA(name);

    name = name
      .toLowerCase()
      .replace(/ /g,'-')
      .replace(/\(/g,'')
      .replace(/\)/g,'')
      .replace(/\'/g,'')
      .replace(/\//g,'-')
      .replace(/#/g,'')
      .replace(/:/g,'')
      .replace(/!/g,'')
      .replace(/\./g,'')
      .replace(/\?/g,'');

    return name;
  },
  readPlists:function(callback) {
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
              data = data[0];
            } 
            
            // We will use showId(s) from eztv if all the subscribed shows
            // have showId(s) and all the scrubbed episodes from eztv have them.
            var shows = data.Shows || [],
                parsed_shows = [];

            // Go through each Show from Shows and 
            // instantiate it into an Episode derivative
            shows.forEach(function(show) {
              utils.parseShow(function(err, episode) {
                if (err) { console.log(err); }
                else {
                  parsed_shows.push(episode);
                }
              }, show);
            });
            data.Shows = parsed_shows;
            callback(null, data);
          }
        }, tv_shows_db);
      }
    }, 
    function(err, results) {
      if (err) { callback(err); }
      callback(null, results);
    });
  },
  writePlist:function(callback, obj, output) {
    var data = utils.exportToPlist(obj);
    fs.writeFile(output, data, function (err) {
      if (err) { callback(err); }
      callback(null, 'successfully saved file to ' + output);
    });
  },
  exportToPlist:function(obj) {
    var headers = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">'
    ];

    var data = 
      headers.join('\n') +
      plist.stringify(obj) + 
      "\n</plist>";

    return data;
  },
  isEpisodeInfo:function(obj) {
    return obj instanceof EpisodeInfo;
  },
  isNoSeasonEpisodeInfo:function(obj) {
    return obj instanceof NoSeasonEpisodeInfo;
  },
  isDatedEpisodeInfo:function(obj) {
    return obj instanceof DatedEpisodeInfo;
  },
  isAnimeEpisodeInfo:function(obj) {
    return obj instanceof AnimeEpisodeInfo;
  }, 
  isNoEpisodeInfo:function(obj) {
    return obj instanceof NoEpisodeInfo;
  },
  expandHomeDir:function(dir){
    dir = dir || "";
    if (dir.indexOf("~") === 0) {
      var home = process.env.HOME;
      var splits = dir.split("~");

      if (splits.length > 0){
        dir = home + splits[1];
      } else {
        dir = home;
      }
    }
    return dir;
  },
  downloadTorrents:function(callback, torrents, dir) {
    dir = utils.expandHomeDir(dir);

    async.forEachSeries(torrents, function(torrent, cb) {
      downloadTorrent(function(err, data) {
        // try the next torrent file
        if (err) { 
          cb(); 
        } else {
          // if successful then make sure the file size is not 0 bytes
          // break out of loop
          cb({
            error: false,
            msg:data
          }); 
        }
      }, torrent, dir);
    }, 
    function(data) {
      // called after all the torrents have finished, or an error has occurred
      if (data) {
        if (data.error) {
          callback(msg);
        } else {
          callback(null, data.msg);
        }
      } else {
        //callback(null);
        callback('Something went wrong with: ' + torrents);
      }
    });
    
  }
};
var utils = new Utils();
exports.utils = utils;

function strcmp ( str1, str2 ) {
  // http://kevin.vanzonneveld.net
  // +   original by: Waldo Malqui Silva
  // +      input by: Steve Hilder
  // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +    revised by: gorthaur
  // *     example 1: strcmp( 'waldo', 'owald' );
  // *     returns 1: 1
  // *     example 2: strcmp( 'owald', 'waldo' );
  // *     returns 2: -1

  return ( ( str1 == str2 ) ? 0 : ( ( str1 > str2 ) ? 1 : -1 ) );
}

function EpisodeInfo(opts) {
  opts = opts || {};
  _.extend(this, opts);

  return this;
}
EpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname + 
      ", S: " + 
      ('00' + this.seasonnumber).slice(-2) +
      ", E: " +
      utils.formatEpisodeNumbers(this.episodenumbers);
  },
  equals:function(episodeInfo) {
    return this.seriesname === episodeInfo.seriesname &&
      this.seasonnumber === episodeInfo.seasonnumber &&
      _.isEqual(this.episodenumbers, episodeInfo.episodenumbers);
  },
  compare:function(episodeInfo) {
    if (!utils.isEpisodeInfo(episodeInfo)) {
      console.log("Not the same types");
      return;
    }
    return strcmp(this.toString(), episodeInfo.toString());
  },
  updateTo:function(episodeInfo) {
    if (!utils.isEpisodeInfo(episodeInfo)) {
      console.log("Not the same types");
      return;
    }
    this.episodenumbers = episodeInfo.episodenumbers;
    this.seasonnumber = episodeInfo.seasonnumber;
  },
  toPlist:function(additional_optionals) {
    // Format episode number into string, or a list
    var epno = utils.formatEpisodeNumbers(this.episodenumbers);
    var optionals = [
      ["ExactName", "exactname"],
      ["Status", "status"],
      ["Subscribed", "subscribed"],
      ["ShowId", "showId"]
    ];
    _.extend(optionals, additional_optionals);
    var obj = {}, that = this;
    _.each(optionals, function(optional, index) {
      if ( typeof(that[optional[1]]) !== "undefined" ) {
        obj[optional[0]] = that[optional[1]];
      }
    });

    var lastSeen = "S: " + 
      ('00' + this.seasonnumber).slice(-2) +
      ", E: " +
      utils.formatEpisodeNumbers(this.episodenumbers);

    return _.extend({
      HumanName: this.seriesname,
      Episode: epno,
      Season: this.seasonnumber,
      LastSeen: lastSeen
    }, obj);
  },
  populateFromTvDb:function(tvdb, forceName, seriesId) {
    // Queries the node-tvdb instance for episode name and corrected series
    // name.
    //
    // If series cannot be found, it will warn the user. If the episode is not
    // found, it will use the corrected show name and not set an episode name.
    // If the site is unreachable, it will warn the user. If the user aborts it
    // will catch node-tvdb user abort error and raise an exception
    tvdb.findTvShow(this.seriesname, function(err, tvshows) {
    
    });
  },
  getepdata:function() {
    // Uses the following config options:
    // filename_with_episode # Filename when episode name is found
    // filename_without_episode # Filename when no episode can be found
    // episode_single # formatting for a single episode number
    // episode_separator # used to join multiple episode numbers

    // Format episode number into string, or a list
    var epno = utils.formatEpisodeNumbers(this.episodenumbers);

    // Data made available to config'd output file format
    var epdata = {
      'seriesname': this.seriesname,
      'seasonnumber': this.seasonnumber,
      'episode': epno,
      'episodename': this.episodename,
    };

    return epdata;
  }
};

function NoSeasonEpisodeInfo(opts) {
  opts = opts || {};
  _.extend(this, opts);

  return this;
}
NoSeasonEpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname + 
      ", E: " +
      utils.formatEpisodeNumbers(this.episodenumbers);
  },
  equals:function(noSeasonEpisodeInfo) {
    return this.seriesname === noSeasonEpisodeInfo.seriesname &&
      _.isEqual(this.episodenumbers, noSeasonEpisodeInfo.episodenumbers);
  },
  compare:function(noSeasonEpisodeInfo) {
    if (!utils.isSeasonEpisodeInfo(noSeasonEpisodeInfo)) {
      console.log("Not the same types");
      return;
    }
    return strcmp(this.toString(), noSeasonEpisodeInfo.toString());
  },
  updateTo:function(noSeasonEpisodeInfo) {
    if (!utils.isSeasonEpisodeInfo(noSeasonEpisodeInfo)) {
      console.log("Not the same types");
      return;
    }
    this.episodenumbers = noSeasonEpisodeInfo.episodenumbers;
  },
  toPlist:function(additional_optionals) {
    // Format episode number into string, or a list
    var epno = utils.formatEpisodeNumbers(this.episodenumbers);
    var optionals = [
      ["ExactName", "exactname"],
      ["Status", "status"],
      ["Subscribed", "subscribed"],
      ["ShowId", "showId"]
    ];
    _.extend(optionals, additional_optionals);
    var obj = {}, that = this;
    _.each(optionals, function(optional, index) {
      if ( typeof(that[optional[1]]) !== "undefined" ) {
        obj[optional[0]] = that[optional[1]];
      }
    });

    var lastSeen = "E: " +
        utils.formatEpisodeNumbers(this.episodenumbers);

    return _.extend({
      HumanName: this.seriesname,
      Episode: epno,
      LastSeen: lastSeen
    }, obj);
  },
  populateFromTvDb:function(tvdb, forceName, seriesId) {
    // Queries the node-tvdb instance for episode name and corrected series
    // name.
    //
    // If series cannot be found, it will warn the user. If the episode is not
    // found, it will use the corrected show name and not set an episode name.
    // If the site is unreachable, it will warn the user. If the user aborts it
    // will catch node-tvdb user abort error and raise an exception
    tvdb.findTvShow(this.seriesname, function(err, tvshows) {
    
    });
  },
  getepdata:function() {
    var epno = utils.formatEpisodeNumbers(this.episodenumbers);

    var epdata = {
      'seriesname': this.seriesname,
      'episode': epno
    };

    return epdata;
  }
};

function DatedEpisodeInfo(opts) {
  opts = opts || {};
  _.extend(this, opts);

  return this;
}
DatedEpisodeInfo.prototype = {
  toString:function() {
    //var months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];        
    //var copy = _.map(this.episodenumbers, function(date) {
      //return months[date.getMonth()] +
        //" " + 
        //('00' + date.getDate()).slice(-2) +
        //", " +
        //date.getFullYear();
    //});
    //var episodenumbers = copy.join(', ');

    var copy = _.map(this.episodenumbers, function(date) {
      return ('00' + (date.getMonth()+1)).slice(-2) +
        "-" + 
        ('00' + date.getDate()).slice(-2) +
        "-" + 
        date.getFullYear();
    });

    return this.seriesname + 
      ", E: " +
      copy.join(', ');
  },
  equals:function(datedEpisodeInfo) {
    return this.seriesname === datedEpisodeInfo.seriesname &&
      _.isEqual(this.episodenumbers, datedEpisodeInfo.episodenumbers);
  },
  compare:function(datedEpisodeInfo) {
    if (!utils.isDatedEpisodeInfo(datedEpisodeInfo)) {
      console.log("Not the same types");
      return;
    }
    return strcmp(this.toString(), datedEpisodeInfo.toString());
  },
  updateTo:function(datedEpisodeInfo) {
    if (!utils.isDatedEpisodeInfo(datedEpisodeInfo)) {
      console.log("Not the same types");
      return;
    }
    this.year = datedEpisodeInfo.year;
    this.month = datedEpisodeInfo.month;
    this.day = datedEpisodeInfo.day;
    this.episodenumbers = datedEpisodeInfo.episodenumbers;
  },
  toPlist:function(additional_optionals) {
    var optionals = [
      ["ExactName", "exactname"],
      ["Status", "status"],
      ["Subscribed", "subscribed"],
      ["ShowId", "showId"]
    ];
    _.extend(optionals, additional_optionals);
    var obj = {}, that = this;
    _.each(optionals, function(optional, index) {
      if ( typeof(that[optional[1]]) !== "undefined" ) {
        obj[optional[0]] = that[optional[1]];
      }
    });

    var copy = _.map(this.episodenumbers, function(date) {
      return ('00' + (date.getMonth()+1)).slice(-2) +
        "-" + 
        ('00' + date.getDate()).slice(-2) +
        "-" + 
        date.getFullYear();
    });
    var lastSeen = "E: " + copy.join(', ');

    return _.extend({
      HumanName: this.seriesname,
      Year: this.year,
      Month: this.month,
      Day: this.day,
      LastSeen: lastSeen
    }, obj);
  },
  populateFromTvDb:function(tvdb, forceName, seriesId) {
    // Queries the node-tvdb instance for episode name and corrected series
    // name.
    //
    // If series cannot be found, it will warn the user. If the episode is not
    // found, it will use the corrected show name and not set an episode name.
    // If the site is unreachable, it will warn the user. If the user aborts it
    // will catch node-tvdb user abort error and raise an exception
    tvdb.findTvShow(this.seriesname, function(err, tvshows) {
    
    });
  },
  getepdata:function() {
    // Format episode number into string, or a list
    var dates = "" + this.episodenumbers[0];

    var epdata = {
      'seriesname': this.seriesname,
      'episode': dates
    };

    return epdata;
  }
};

function AnimeEpisodeInfo(opts) {
  opts = opts || {};
  _.extend(this, opts);

  return this;
}
AnimeEpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname + 
      ", E: " +
      utils.formatEpisodeNumbers(this.episodenumbers);
  },
  toPlist:function(additional_optionals) {
    var optionals = [
      ["ExactName", "exactname"],
      ["Status", "status"],
      ["Subscribed", "subscribed"],
      ["ShowId", "showId"]
    ];
    _.extend(optionals, additional_optionals);
    var obj = {}, that = this;
    _.each(optionals, function(optional, index) {
      if ( typeof(that[optional[1]]) !== "undefined" ) {
        obj[optional[0]] = that[optional[1]];
      }
    });
    
    // Format episode number into string, or a list
    var epno = utils.formatEpisodeNumbers(this.episodenumbers);
    if (epno) {
      obj.Episode = epno;
    }

    var lastSeen = "E: " +
      utils.formatEpisodeNumbers(this.episodenumbers);

    return _.extend({
      HumanName: this.seriesname,
      Group: this.group,
      LastSeen: lastSeen
    }, obj);
  },
  equals:function(animeEpisodeInfo) {
    return this.seriesname === animeEpisodeInfo.seriesname &&
      _.isEqual(this.episodenumbers, animeEpisodeInfo.episodenumbers);
  },
  compare:function(animeEpisodeInfo) {
    if (!utils.isAnimeEpisodeInfo(animeEpisodeInfo)) {
      console.log("Not the same types");
      return;
    }
    return strcmp(this.toString(), animeEpisodeInfo.toString());
  },
  updateTo:function(animeEpisodeInfo) {
    if (!utils.isAnimeEpisodeInfo(animeEpisodeInfo)) {
      console.log("Not the same types");
      return;
    }
    this.episodenumbers = animeEpisodeInfo.episodenumbers;
  }
};

function NoEpisodeInfo(opts) {
  opts = opts || {};
  _.extend(this, opts);
  return this;
}
NoEpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname;
  },
  equals:function(noEpisodeInfo) {
    return this.seriesname === noEpisodeInfo.seriesname;
  },
  toPlist:function(additional_optionals) {
    var optionals = [
      ["ExactName", "exactname"],
      ["Status", "status"],
      ["Subscribed", "subscribed"],
      ["ShowId", "showId"]
    ];
    _.extend(optionals, additional_optionals);
    var obj = {}, that = this;
    _.each(optionals, function(optional, index) {
      if ( typeof(that[optional[1]]) !== "undefined" ) {
        obj[optional[0]] = that[optional[1]];
      }
    });

    return _.extend({
      HumanName: this.seriesname
    }, obj);
  },
  populateFromTvDb:function(tvdb, forceName, seriesId) {
    // Queries the node-tvdb instance for episode name and corrected series
    // name.
    //
    // If series cannot be found, it will warn the user. If the episode is not
    // found, it will use the corrected show name and not set an episode name.
    // If the site is unreachable, it will warn the user. If the user aborts it
    // will catch node-tvdb user abort error and raise an exception
    tvdb.findTvShow(this.seriesname, function(err, tvshows) {
    
    });
  },
  getepdata:function() {
    var epno = utils.formatEpisodeNumbers(this.episodenumbers);

    var epdata = {
      'seriesname': this.seriesname,
      'episode': epno
    };

    return epdata;
  }
};
