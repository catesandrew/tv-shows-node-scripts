var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io')
  , plist = require('plist')
  , util = require('util');

var utils = require('./utils.js').utils;

var args = process.argv.slice(2);
if (args && args.length > 0) {
  var showId = args[0];

  utils.getSeriesInfo(function(err, result) {
    if (err) { 
      console.log(err);
    }
    else {
      //console.log(result.series);
      var levs = [];
      _.each(result.episodes, function(episode) {
        //console.log(episode.toPlist([
          //[ 'ImdbId', 'ImdbId' ],
          //[ 'SeriesId', 'TvdbSeriesId' ],
          //[ 'EpisodeId', 'TvdbEpisodeId' ],
          //[ 'Overview', 'Overview' ],
          //[ 'EpisodeName', 'EpisodeName' ],
          //[ 'Episode', 'Episode' ],
          //[ 'Director', 'Director' ],
          //[ 'Season', 'Season' ],
          //[ 'Writer', 'Writer' ],
          //[ 'Artwork', 'Artwork' ],
          //[ 'FirstAired', 'FirstAiredOn' ]
        //]));
        var lev = utils.levenshtein(episode.EpisodeName, "Allosaurus Crush Castle");
        if (typeof(lev) !== 'undefined') {
          levs.push({
            'lev':lev,
            'episode':episode
          });
        }
      });
      levs = _.sortBy(levs, function(obj) {
        return obj.lev;
      });
      _.each(levs, function(obj, index) {
        console.log("Lev: " + obj.lev + ", Name: " + obj.episode.EpisodeName);
      });
    }
  }, showId);

}                      

//thetvdb.com/api/0629B785CE550C8D/series/74845/all/en.zip
//thetvdb.com/api/0629B785CE550C8D/episodes/295369/en.xml
