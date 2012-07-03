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

var writePlist = function(callback, obj, output) {

  var headers = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">'
  ];
      
  var data = 
    headers.join('\n') +
    plist.stringify(obj) + 
    "\n</plist>";

  fs.writeFile(output, data, function (err) {
    if (err) { callback(err); }
    callback(null, 'successfully saved file to ' + output);
  });
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

//readPlists(function(err, plist) {
  //if (err) { 
    //console.log(err);
    //process.exit();
  //}
  
//});

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
      var emit = [], href, matches;
      shows.forEach(function(show) {
        matches = show.href.match(/\/shows\/([0-9]+)\/([0-9a-zA-Z\-]+)/);
        emit.push({
          showId: matches[1],
          title: show.text,
          Status: show.status,
          name:matches[2]
        });
      });
      this.emit(emit);
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

//scrapeEZTV(function(err, shows) {
  //if (err) { 
    //console.log(err);
    //process.exit();
  //}
  //console.log("found " + shows.length + " shows.");
//});

var readPlistsAndScrapeEZTV = function(callback) {
  async.parallel({
      shows: function(callback) {
        scrapeEZTV(function(err, shows) {
          if (err) { callback(err); }

          //console.log("found " + shows.length + " shows.");
          callback(null, shows);
        });
      },
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

  //console.log(data.plists.showDb.Shows[1]);
  //console.log(data.plists.showDb.Shows[2]);
  // 
  //{ showId: '297', title: 'Worst Week', name: 'worst-week' },
  //{ showId: '518', title: 'X Factor (US), The', name: 'the-x-factor-us' },
  //{ showId: '298', title: 'X Factor, The', name: 'the-x-factor' },
  //
  //{ ExactName: '10+Items+or+Less', HumanName: '10 Items or Less', Subscribed: false, Type: '' }
  //{ ExactName: '10+O+Clock+Live', HumanName: '10 O Clock Live', Subscribed: false, Type: '' }
  //{ ExactName: '10+OClock+Live', HumanName: '10 OClock Live', Subscribed: false, Type: '' }

  var incoming_shows = {}, i, l;
  var shows = data.shows || []; 
  for( i=0, l= shows.length; i<l; i++) {
    var show = shows[i];
    var human_name = show.title;
    show.Subscribed = false;
    show.HumanName = human_name;
    delete show.title;
    delete show.name;
    var exact_name = human_name.split(', The');
    if (exact_name.length > 1) {
      exact_name = 'The ' + exact_name[0];
    } else {
      exact_name = exact_name[0];

      exact_name = human_name.split(', A');
      if (exact_name.length > 1) {
        exact_name = 'A ' + exact_name[0];
      } else {
        exact_name = exact_name[0];
      }
    }

    // trim spaces
    exact_name = exact_name.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

    var lookForTheAtEnd = exact_name.match(/ The$/);
    if (lookForTheAtEnd) {
      exact_name = "The " + exact_name.substr(0, exact_name.length - 4);
    }

    exact_name = exact_name
      .replace(/\(/g,'')
      .replace(/\)/g,'')
      .replace(/\'/g,'')
      .replace(/\//g,'-')
      .replace(/#/g,'')
      .replace(/:/g,'')
      .replace(/!/g,'')
      .replace(/\./g,'')
      .replace(/\?/g,'');

    show.ExactName = exact_name.replace(/ /g, '+');
    exact_name = exact_name
      .toLowerCase()
      .replace(/ /g,'-');

    //if(exact_name !== show.name) {
      //console.log( exact_name + " != " + show.name);
    //}

    incoming_shows[exact_name]= show;
  }

  var known_shows = {};
  var Shows = data.plists.showDb.Shows || [];
  for( i=0, l=Shows.length; i<l; i++) {
    var Show = Shows[i];
    exact_name = Show.HumanName.split(', The');
    if (exact_name.length > 1) {
      exact_name = 'The ' + exact_name[0];
    } else {
      exact_name = exact_name[0];

      exact_name = Show.HumanName.split(', A');
      if (exact_name.length > 1) {
        exact_name = 'A ' + exact_name[0];
      } else {
        exact_name = exact_name[0];
      }
    }

    // trim spaces
    exact_name = exact_name.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

    lookForTheAtEnd = exact_name.match(/ The$/);
    if (lookForTheAtEnd) {
      exact_name = "The " + exact_name.substr(0, exact_name.length - 4);
    }

    exact_name = exact_name
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

    known_shows[exact_name]= Show;
  }

  // walk through incoming_shows and known_shows to see if any of
  // incoming_show's entries match ones from known_shows. 
  if (_.size(known_shows) > 0) {
    var shows_to_add = [];
    var keys = _.keys(incoming_shows);
    for( i=0, l=keys.length; i<l; i++) {
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
    for( i=0, l=shows_to_add.length; i<l; i++) {
      known_shows.push(shows_to_add[i]);
    } 
    // set shows to known_shows
    shows = known_shows;
  }

  var save_these_shows = {
    "Shows": [],
    "Version": "1"
  };

  shows = _.sortBy(shows, function(show) {
    return show.HumanName;
  });

  save_these_shows.Shows = shows;
  var home = process.env.HOME;
  var tv_shows_db = home + "/Library/Application Support/TVShows/TVShows.plist";
  writePlist(function(err, obj) {
    if (err) { console.log(err); }
    //console.log(obj);
    
    }, save_these_shows, tv_shows_db
  );

});
