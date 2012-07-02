//
// Setup and Config
//
var async = require('async')
  , fs = require('fs')
  , handlebars = require('handlebars')
  , request = require('request')
  , _ = require('underscore')
  , sys = require('sys')
  , argv = require('optimist').argv;

// Read in options from the command line
var opts = parseOptions();



//
// Main
//

explain(); // split out the config to stdout

var counties = slotArrays(1,2, "top");

async.map(counties, mapper, reducer);

//
// The Core Functions
//

function slotArrays() {
  var slots = [];
  for (var i = 0; i < tn_counties.length; i++) {
    slots.push({
      "id": i,
      "county": tn_counties[i].name
    });
  }
  return slots;
}

//
// the job of the mapper is to take a slot id, 
// get the shelf id, go out to a service, 
// and pass on an object in the form of
// 
//  slot: <slotid>       // slotIds are 1,2,...n
//  shelf: <shelfid>     // shelfIds are used in the call to getShelves api
//  item: <itemid>
//  img: <imageurl>
// 
function mapper(slot, callback) {
  // slotIds are 0,1,2,...n
  var county_name = slot.county.replace(/ /g, '%20');
  var urlRoot = "http://api.sba.gov/geodata/all_links_for_county_of/" + county_name + "/tn.json";

  var options = {
    url:urlRoot,
    json:true
  };

  if (opts.proxy) {
    options.proxy = "http://" + opts.proxy;
  }

  request(options, function(error, response, json) {
    if (!error && response.statusCode == 200) {
        callback(null, massage(json, slot));
    } else {
      verbose("Bad data from shelf service, so returning starter shelf");
      process.stderr.write("ERROR: got HTML back for " + slot.county + "\n");
      //callback(null, starterShelf(slot));
    }
  })
}

//
// Take the array of results and go through them, saving off to the context
//
function reducer(err, results) {
  if (err) {
    process.stderr.write("Unable to reduce myself: " + err + "\n");
    return;
  }

  var counties = _.clone(tn_counties);
  for (var i = 0; i < results.length; i++) {
    var county = results[i]; 

    for (var j = 0; j < county.length; j++) {
      var city = county[j];
      var id = city.countyId;
      delete city.countyId;

      counties[id].cities = counties[id].cities || [];
      counties[id].cities.push(city);
    }
  }
  //console.dir(counties);
  render(counties);
}

//
// Helpers
//

// run the data through the template and render it to disk
function render(context) {
  fs.readFile(opts.template, "utf8", function(err, source) {
    var template = handlebars.compile(source);
    fs.writeFile(opts.output, template(context), function (err) {
      if (err) throw err;
      console.log('successfully saved file to ' + opts.output);
    });
  })
}

// take the shelf from the JSON response and massage it to be what saveToContext wants
function massage(items, slot) {
  items = items || [];
  var retval = [];

  if (!items.length) {
    console.log("County doesn't have any cities: " + slot.county);
  }

  for (var i=0; i < items.length; i++) {
    var item = items[i];

    if (item) {
      delete item['description'];
      delete item['county_name'];
      delete item['feat_class'];
      delete item['feature_id'];
      delete item['fips_class'];
      delete item['fips_county_cd'];
      delete item['full_county_name'];
      delete item['link_title'];
      delete item['primary_latitude'];
      delete item['primary_longitude'];
      delete item['state_abbreviation'];
      delete item['state_name'];

      item.id = item.name.toLowerCase().replace(/ /g, '-');
      item.countyId = slot.id;
    }

    if (i == items.length-1) {
      item.isLast = true;
    }

    retval.push(item);
  }

  return retval;
}

// parse command line and return user options
function parseOptions() {
  var opts = {
    help: argv.h
  }

  return opts;
}

// print back out to the command line info about the run
function explain() {
  console.log("Help message");
  if (opts.help) {
    console.log("Exiting before running, due to presence '-h' help option.");
    process.exit();
  }
}

// If you want me to speak up, just ask me to be verbose
function verbose() {
  if (opts.verbose) console.log.apply(null, arguments);
}
