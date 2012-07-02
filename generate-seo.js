//
// Setup and Config
//

var async = require('async')
  , fs = require('fs')
  , handlebars = require('handlebars')
  , request = require('request')
  , _ = require('underscore')
  , sys = require('sys')
  , exec = require('child_process').exec
  , generators = require('../lib/gen')
  , company_info = require('../data/company_info.js')
  , nodeio = require('node.io')
  , select = require('soupselect').select
  , argv = require('optimist').argv;


function render(template, output, context) {
  fs.readFile(template, "utf8", function(err, source) {
    var hbs = handlebars.compile(source);
    fs.writeFile(output, hbs(context), function (err) {
      if (err) { throw err; }
      console.log('successfully saved file to ' + output);
    });
  });
}

//
// Main
//



(function(){

  var states = _.keys(data);
  var i, j, k;
  for (i = 0; i < states.length; i++) {
    var state = states[i];
    // counties
    var counties = data[state];
    for (j = 0; j < counties.length; j++) {
      var county = counties[j];

      var context = {
        'state': {
          'id':state,
          'anchor':'/state/'+state,
          'name':templates.state[state].name
        },
        'county':county
      };
      context.county.anchor='/county/'+county.id;  

      var h1 = generateSentenceWithKeyword(keywords[0], 1);
      h1 = insertKeywordIntoSentence(h1, county.name, 5);
      h1 = spliceSentence(h1, 1, 7);
      h1 = [county.name, 'Private', 'Investigator'].join(' ');

      var bolded = "<b>" + keywords[0] + "</b>";
      var p1 = generateSentenceWithKeyword(bolded, 2);
      p1 = insertKeywordIntoSentence(p1, county.name, 5);
      p1 = spliceSentence(p1, 0, 8);
      p1 = p1 + ' ' + generators.english.paragraph();

      bolded = "<b>" + county.name + "</b>";
      var p2 = generateSentenceWithKeyword(keywords[0], 2);
      p2 = insertKeywordIntoSentence(p2, bolded, 5);
      p2 = spliceSentence(p2, 0, 8);
      p2 = generators.english.sentence() + ' ' + p2 + ' ' + 
        generators.english.paragraph();

      var p3 = generateSentenceWithKeyword(keywords[0], 2);
      p3 = insertKeywordIntoSentence(p3, county.name, 5);
      p3 = spliceSentence(p3, 0, 8);
      p3 = generators.english.sentence() + ' ' + p3 + ' ' + 
        generators.english.paragraph();

      _.extend(context, company_info.data);
      _.extend(context, {
        'h1':h1,
        'p1':p1,
        'p2':p2,
        'p3':p3
      });
        
      var county_file = __dirname + "/../views/county/" + county.id + ".handlebars";
      //render('./generic-county.handlebars', county_file, context);

      // cities
      var cities = county.cities;
      if (cities && cities.length) {
        for (k = 0; k < cities.length; k++) {
          var city = cities[k];
          var city_file = __dirname + "/../views/city/" + city.id + ".handlebars";
          // Use the keyword in the title tag at least once, 
          //   and possibly twice (or as a variation) if it makes 
          //   sense and sounds good (this is subjective, but 
          //   necessary). Try to keep the keyword as close to 
          //   the beginning of the title tag as possible. More 
          //   detail on title tags follows later in this section.
          // Use the keyword once in the H1 header tag of the page
          // Use the keyword at least 3X in the body copy on 
          //   the page (sometimes a few more times if there's 
          //   a lot of text content). You may find additional 
          //   value in adding the keyword more than 3X, but 
          //   in our experience, adding more instances of a 
          //   term or phrase tends to have little to no 
          //   impact on rankings.
          // Use the keyword at least once in bold. You can 
          //   use either the <strong> or <b> tag, as search 
          //   engines consider them equivalent.
          // Use the keyword at least once in the alt 
          //   attribute of an image on the page. This not 
          //   only helps with web search, but also image 
          //   search, which can occasionally bring 
          //   valuable traffic.
          // Use the keyword once in the URL. Additional 
          //   rules for URLs and keywords are discussed 
          //   later on in this section.
          // Use the keyword at least once (sometimes 2X 
          //   when it makes sense) in the meta description 
          //   tag. Note that the meta description tag 
          //   does NOT get used by the engines for 
          //   rankings, but rather helps to attract 
          //   clicks by searchers from the results 
          //   page (as it is the "snippet" of text used 
          //   by the search engines).
          context = {
            'state': {
              'id':state,
              'anchor':'/state/'+state,
              'name':templates.state[state].name
            },
            'city':city,
            'county':county
          };
          context.city.anchor='/city/'+city.id;
          context.county.anchor='/county/'+county.id;  
          context.self_link='/city/'+city.id;  

          h1 = generateSentenceWithKeyword(keywords[0], 1);
          //var cityKey = "<a href=\"" + city.url + "\">" + city.name + "</a>";
          h1 = insertKeywordIntoSentence(h1, city.name, 5);
          h1 = spliceSentence(h1, 1, 7);
          h1 = [city.name, 'Private', 'Investigator'].join(' ');

          bolded = "<b>" + keywords[0] + "</b>";
          p1 = generateSentenceWithKeyword(bolded, 2);
          p1 = insertKeywordIntoSentence(p1, city.name, 5);
          p1 = spliceSentence(p1, 0, 8);
          p1 = p1 + ' ' + generators.english.paragraph();

          bolded = "<b>" + city.name + "</b>";
          p2 = generateSentenceWithKeyword(keywords[0], 2);
          p2 = insertKeywordIntoSentence(p2, bolded, 5);
          p2 = spliceSentence(p2, 0, 8);
          p2 = generators.english.sentence() + ' ' + p2 + ' ' + 
            generators.english.paragraph();

          p3 = generateSentenceWithKeyword(keywords[0], 2);
          p3 = insertKeywordIntoSentence(p3, city.name, 5);
          p3 = spliceSentence(p3, 0, 8);
          p3 = generators.english.sentence() + ' ' + p3 + ' ' + 
            generators.english.paragraph();

          _.extend(context, company_info.data);
          _.extend(context, {
            'h1':h1,
            'p1':p1,
            'p2':p2,
            'p3':p3
          });
        
          //render('./generic-city.handlebars', city_file, context);
          //doNodeIo(city_file, h1);
          //console.log("tidy -config tidy.config -m \"" + city_file + "\"");

        }
      }
    }
  }
})();

function doNodeIo(file, title) {
  var methods = {
    input:false,
    run:function() {
      // getHtml is just a mashup of get and parseHtml. Try this
      var self = this;
      this.read(file, function (err, data) {
        self.parseHtml(data, function (err, $) {
          var elems = $('h1');
          if (elems.each != null) {
            elems.each(function(e) {
              console.log(e.text);
            });
          }
          else {
            //elems.rawtext = "andrew cates";
            //elems.text = "andrew cates";
            //elems.fulltext = "andrew cates";
            //elems.innerHTML = "andrew cates";
            //console.log(elems);
            elems.children.first().raw = title;
            elems.children.first().data = title;
            //console.log(elems.children.first());
            //console.log(elems.rawtext);
            //console.log(elems.text);
            //console.log(elems.striptags);
            //console.log(elems.fulltext);                                                  
            //console.log(elems.innerHTML);
          }

          var html = $('article').innerHTML;

          fs.writeFile(file, html, function (err) {
            if (err) { throw err; }
            console.log('successfully saved file to ' + file);
          });

        });
      });
    } 
  };

  var job = new nodeio.Job({jsdom:false}, methods);
  nodeio.start(job);
}


// If you want me to speak up, just ask me to be verbose
function verbose() {
  console.log.apply(null, arguments);
}
