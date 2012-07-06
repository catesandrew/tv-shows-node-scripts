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

var show_id_re = new RegExp("\\/shows\\/(?:add\\/)?([0-9]+)\\/.*");
var size_re = new RegExp(".*\\(([0-9]+?[.][0-9]+? [MG]B)\\)$");
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
          // reset vars
          torrents = []; 
          show_id = null;
          size = null;

          // show id
          td = $('td', tr);
          if (td && td.length > 0) {
            td = td[0];
            anchor = $('a', td);
            if (anchor.length > 0) {
              anchor = anchor[0];
            }
            id_matches = anchor.attribs.href.match(show_id_re);
            if (id_matches && id_matches.length > 0) {
              show_id = id_matches[1];
            }
          }
          
          // torrent download links
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

          anchor = $('.forum_thread_post .epinfo', tr);
          // size 
          size_matches = anchor.attribs.title.match(size_re);
          if (size_matches && size_matches.length > 0) {
            size = size_matches[1];
          }
          
          episodes.push({
            href: anchor.attribs.href,
            text: anchor.fulltext,
            showId: show_id,
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
            episode_info.showId = episode.showId;
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

var useShowIds = function(shows, episodes) { 
  shows = shows || [];
  episodes = episodes || [];
  var use_show_ids = true;
  var show, i, l, episode;
  for (i=0, l=shows.length; i<l; i++) {
    show = shows[i];
    if (!show.subscribed) {
      continue;
    }
    if (!show.showId) {
      use_show_ids = false;
      break;
    }
  }
  if (use_show_ids) {
    for(i=0, l=episodes.length; i<l; i++) {
      episode = episodes[i];
      if (!episode.showId) {
        use_show_ids = false;
        break;
      }
    }
  }
  return use_show_ids;
};

readPlistsAndScrapeEZTV(function(err, data) {
  if (err) { console.log(err); }

  //_.each(data.episodes, function(episode) {
    //console.log(episode.toString());
    //console.log("ShowId: " + episode.showId + ", Size: " + episode.size);
    //console.log(episode.torrents);
    //console.log(episode.getepdata());
  //});
  
  // We will use showId(s) from eztv if all the subscribed shows
  // have showId(s) and all the scrubbed episodes from eztv have them.
  var shows = data.plists.showDb.Shows || [];

  // Go through each Show from Shows and 
  // instantiate it into an Episode derivative
  var parsed_shows = [];
  shows.forEach(function(show) {
    utils.parseShow(function(err, episode) {
      if (err) { 
        console.log(err);
      }
      else {
        parsed_shows.push(episode);
      }
    }, show);
  });
  shows = parsed_shows;
  //console.log(shows);

  var use_show_ids = useShowIds(shows, data.episodes);
  //console.log("Use show ids: " + use_show_ids);

  // use show ids
  // 1) build table of showId to subscribed shows
  var subscribed_shows = {};
  _.each(shows, function(show, index) {
    var key = show.showId;
    if (show.Subscribed) {
      subscribed_shows[key] = show;
    }
  });
  //console.log(subscribed_shows);

  // 2) group all similar eipsodes by 
  //   seriesname, seasonnumber, episodenumbers OR
  //   seriesnname, episodenumbers OR
  //   seriesname, episodenumbers OR
  var grouped_episodes = _.groupBy(data.episodes, function(episode) {
    return episode.toString();
  });
  
  // 3) Group all show ids from episodes. Now for any given showId 
  // we will have a list of list of episodes, or loloepisodes.
  // This is because we can multiple episodes for a showId, and 
  // each of those can have multiple qualities.
  //  
  // ShowId: 433
  // [ [ { seriesname: 'Episodes',
  //       seasonnumber: 2,
  //       episodenumbers: [7],
  //       filename: 'Episodes S02E07 CONVERT HDTV x264-TLA',
  //       showId: '433',
  //       size: '136.06 MB',
  //       torrents: [...] },
  //     { seriesname: 'Episodes',
  //       seasonnumber: 2,
  //       episodenumbers: [7],
  //       filename: 'Episodes S02E07 720p EZTV-UK',
  //       showId: '433',
  //       size: '836.06 MB',
  //       torrents: [...] } ],
  //   [ { seriesname: 'Episodes',
  //       seasonnumber: 2,
  //       episodenumbers: [8],
  //       filename: 'Episodes S02E08 CONVERT HDTV x264-TLA',
  //       showId: '433',
  //       size: '132.33 MB',
  //       torrents: [...] } ] ]
  //   
  var loloepisodes = _.groupBy(grouped_episodes, function(group) {
    return group[0].showId;
  });
  //var keys = _.keys(loloepisodes);
  //_.each(keys, function(key, index) {
    //console.log("ShowId: " + key);
    //console.log(loloepisodes[key]);
  //});
  
  // 4) Go through all episodes, using showId of
  // the episode and see if its in the subscribed 
  // shows table. 
  var keys = _.keys(subscribed_shows);
  _.each(keys, function(key, index) {
    var loloepisode = loloepisodes[key];
    if (loloepisode) {
      // Do the magic here. We found a possible 
      // show to download that has been subscribed to.
      console.log('Found show ' + key + ', in lolo episodes');

      
    }
  });

  

  
  // use unique names
  // build table of unique-name to subscribed shows,
  // go through all episodes, build unique name
  // for the episode's seriesname, and then use that
  // to check to see if its in the subscribed shows
  // table. 
  // -- 
  // group all similar eipsodes by 
  //   seriesname, seasonnumber, episodenumbers OR
  //   seriesnname, episodenumbers OR
  //   seriesname, episodenumbers OR
  // this is because a parsed episode can have multiple qualties
  // group all unique-names from episodes

});

