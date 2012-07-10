var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io')
  , plist = require('plist')
  , util = require('util');

var utils = require('./utils.js').utils;

var args = process.argv.slice(2);
if (args && args.length > 0) {
  var seriesName = args[0];

  utils.findTvShow(function(err, tvshows) {
    if (err) { 
      console.log(err);
    }
    else {
      console.log(tvshows);
    }
  }, seriesName);
}
