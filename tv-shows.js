var async = require('async')
  , fs = require('fs')
  , handlebars = require('handlebars')
  , request = require('request')
  , _ = require('underscore')
  , nodeio = require('node.io')
  , util = require('util');

var constants = require('./tv-shows-constants.js').constants;
var utils = require('./utils.js').utils;

//var TVDB = require('tvdb')
  //, tvdb = new TVDB({
      //apiKey: "0629B785CE550C8D",
      //language: "en"
    //});

var scrapeEZTV = function(_callback) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/sort/50/', function(err, $) {
        var episodes = [], href, matches;
        $("tr.forum_header_border").each(function(tr) {
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
      var emits = [];
      episodes.forEach(function(episode) {
        utils.parseFile(function(err, episode) {
          if (err) { 
            console.log(err);
            //_callback(err); 
          }
          else {
            emits.push(episode);
          }
        }, episode.text);
      });
      this.emit(emits);
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
        utils.readPlists(function(err, plist) {
          if (err) { callback(err); }
          callback(null, plist);
        });
      },
      episodes: function(callback) {
        scrapeEZTV(function(err, episodes) {
          if (err) { callback(err); }
          callback(null, episodes);
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

  _.each(data.episodes, function(episode) {
    console.log(episode.toString());
    //console.log(episode.getepdata());
  });
  
  //scrapeEZTV(function(err, episodes) {
    //if (err) { console.log(err); }

    //console.log(episodes.length);
    //_.each(episodes, function(episode) {
      //console.log(episode.toString());
    //});
    //if (episodes.length) {
      ////console.log(episodes[0].toString());
      ////episodes[0].populateFromTvDb(tvdb);
    //}
  //}, showId);

});

