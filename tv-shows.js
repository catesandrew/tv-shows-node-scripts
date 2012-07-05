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

var show_id_re = new RegExp("\\/ep\\/([0-9]+)\\/.*");
var size_re = new RegExp(".*\\(([0-9]+?[.][0-9]+?) MB\\)$");
var scrapeEZTV = function(_callback) {
  var methods = {
    input:false,
    run:function() {
      var self = this;
      this.getHtml('http://eztv.it/sort/50/', function(err, $) {
        var episodes = [], href, matches, show_id, 
            id_matches, downloads, anchor, td, torrent, 
            i, l, size_matches, size, torrents;
        $("tr.forum_header_border").each(function(tr) {
          anchor = $('.forum_thread_post .epinfo', tr);
          // show id
          id_matches = anchor.attribs.href.match(show_id_re);
          if (id_matches && id_matches.length > 0) {
            show_id = id_matches[1];
          }
          
          // size 
          size_matches = anchor.attribs.title.match(size_re);
          if (size_matches && size_matches.length > 0) {
            size = size_matches[1];
          }

          // torrent download links
          torrents = [];
          td = $('td', tr);
          if (td && td.length > 1) {
            td = td[2];
            downloads = $('a', td);
            for(i = 0, l = downloads.length; i < l; i++) {
              var download = downloads[i];
              torrent = download.attribs.href || "";
              if (torrent.indexOf("magnet") === 0) {
                continue;
              }
              torrents.push(torrent);
            }
          }

          episodes.push({
            href: anchor.attribs.href,
            text: anchor.fulltext,
            showid: show_id,
            size: size,
            torrents: torrents
          });
        });
        this.emit(episodes);
      });
    },
    reduce:function(episodes) {
      var emits = [];
      episodes.forEach(function(episode) {
        utils.parseFile(function(err, episode_info) {
          if (err) { 
            console.log(err);
            //_callback(err); 
          }
          else {
            episode_info.showid = episode.showid;
            episode_info.size = episode.size;
            episode_info.torrents = episode.torrents;
            emits.push(episode_info);
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
    console.log("ShowId: " + episode.showid + ", Size: " + episode.size + " MB");
    console.log(episode.torrents);
    //console.log(episode.getepdata());
  });
  
  //{ showId: '297', title: 'Worst Week', name: 'worst-week' },
  //{ showId: '518', title: 'X Factor (US), The', name: 'the-x-factor-us' },
  //{ showId: '298', title: 'X Factor, The', name: 'the-x-factor' },
  //
  //{ ExactName: '10+Items+or+Less', HumanName: '10 Items or Less', Subscribed: false, Type: '' }
  //{ ExactName: '10+O+Clock+Live', HumanName: '10 O Clock Live', Subscribed: false, Type: '' }
  //{ ExactName: '10+OClock+Live', HumanName: '10 OClock Live', Subscribed: false, Type: '' }
  
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

