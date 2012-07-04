var _ = require('underscore');

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

          var year = utils.handleYear(matches[i_year+1]);
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
  }
};
var utils = new Utils();

var EpisodeInfo = function(opts) {
  opts = opts || {};
  _.extend(this, opts);
  this.extra = this.extra || {};

  return this;
};
EpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname + 
      ", Season: " + 
      this.seasonnumber + 
      ", Episode: " +
      this.episodenumbers.join(", ");
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

var NoSeasonEpisodeInfo = function(opts) {
  opts = opts || {};
  _.extend(this, opts);
  this.extra = this.extra || {};

  return this;
};
NoSeasonEpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname + 
      ", Episode: " +
      this.episodenumbers.join(", ");
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
      'episode': epno,
      'episodename': self.episodename,
    };

    return epdata;
  }
};

var DatedEpisodeInfo = function(opts) {
  opts = opts || {};
  _.extend(this, opts);
  this.extra = this.extra || {};

  return this;
};
DatedEpisodeInfo.prototype = {
  toString:function() {
    return this.seriesname + 
      ", Episode: " +
      this.episodenumbers.join(", ");
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
    var dates = "" + this.episodenumbers[0],
      prep_episodename;

    if ( _.isArray(this.episodename) ) {
      prep_episodename = utils.formatEpisodeName(this.episodename, ", ");
    }
    else{
      prep_episodename = this.episodename;
    }

    var epdata = {
      'seriesname': this.seriesname,
      'episode': dates,
      'episodename': prep_episodename,
    };

    return epdata;
  }

};

var AnimeEpisodeInfo = function(opts) {
  opts = opts || {};
  _.extend(this, opts);
  this.extra = this.extra || {};

  return this;
};
AnimeEpisodeInfo.prototype = {

};

exports.utils = utils;
