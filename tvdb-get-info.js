var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io')
  , plist = require('plist')
  , program = require('commander')
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
      var incoming = ["daring the backstroke", "shit highway", "cankles", "allosaurus crush castle"];
      async.forEachSeries(incoming, function(title, next) {
        var levs = [], str_nears, obj_nears;

        // calculate all the levenshtein
        _.each(result.episodes, function(episode) {
          var left = ( episode.EpisodeName || "" ).toLowerCase(),
              right = ( title || "" ).toLowerCase(),
              lev = utils.levenshtein(left, right);
          if (typeof(lev) !== 'undefined') {
            levs.push({
              'lev':lev,
              'episode':episode
            });
          }
        });
        // sort all the levenshtein
        levs = _.sortBy(levs, function(obj) {
          return obj.lev;
        });

        // make your choice
        if (levs.length > 0) {
          // get the closest one
          var lev_val = levs[0].lev; 
          str_nears = [];
          obj_nears = [];

          _.each(levs, function(obj) {
            if ( Math.abs(obj.lev - lev_val) < 6) {
              str_nears.push("Lev: " + obj.lev + ", Name: " + obj.episode.EpisodeName);
              obj_nears.push(obj);
            }
          });

          console.log('Choose the closest match: [ "' + title + '" ]');
          program.choose(str_nears, function(i) {
            console.log('you chose %d "%s"', i, obj_nears[i].episode.EpisodeName);
            // TODO: rename the incoming title now
            next();
          });
        } else {
          next();
        }
      },
      function(data) {
        console.log('all done');
        process.stdin.destroy();
      });
    }
  }, showId);

}                      

//thetvdb.com/api/0629B785CE550C8D/series/74845/all/en.zip
//thetvdb.com/api/0629B785CE550C8D/episodes/295369/en.xml
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
