var async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , nodeio = require('node.io')
  , plist = require('plist')
  , util = require('util');

var utils = require('./utils.js').utils;

var args = process.argv.slice(2);
if (args && args.length > 0) {
  var fileName = args[0];

  utils.parseFile(function(err, episode_info) {
    if (err) { 
      console.log(err);
    }
    else {
      console.log(episode_info);
    }
  }, fileName);

}
