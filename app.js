var leveldb = require('level'),
    http = require('http'),
    conf = require('./config'),
    qs = require('querystring'),
    fs = require('fs'),
    express = require('express'),
    URI = require('uri-js');

var db = leveldb('./urldb');

var app = express();

app.use(express.bodyParser());
app.use(express.static(__dirname + "/public"));

app.listen(3000);

function generateShortUrl(len) {
  //http://tools.ietf.org/html/rfc3986 all valid characters
  var allowedCharacters = 'abcdefghijklmnopqrstuvwxyABCDEFGHIJKLMNOPQRSTUVWXY-_~';
  var out = "";
  for(var i=0;i<len;i++) {
    out += allowedCharacters[Math.floor(Math.random()*allowedCharacters.length)];
  }
  return out;
}

function limitedRunGetUnused(limit, len, cb) {
  if(limit === 0) return cb("Error, could not generate short url");
  var s = generateShortUrl(len);
  db.get(s, function(err, value) {
    if(err && err.notFound) return cb(false,s);
    else limitedRunGetUnused(limit - 1, len, cb);
  });
}

function getUnusedShortUrl(len, cb) {
  limitedRunGetUnused(10, len, cb);
}

// Todo, anything more than add http to relative urls
function validateUrl(url) {
  var parsed = URI.parse(url);
  //Ignore errors, we can tank on.
  if(parsed.scheme === 'undefined' || parsed.reference === 'relative') {
    // Probably missing http://
    return 'http://' + url;
  }

  return url;
}

app.post('/api/shorten', function(req, res) {
  var url = req.body.url.trim();
  url = validateUrl(url);
  if(conf.disallowedUrlRegex.test(url) || url.length === 0) {
    return res.json({error: "Invalid url to shorten"});
  }
  var short = generateShortUrl(4);
  getUnusedShortUrl(4, function(err1, short) {
    if(err1) return res.json({error: err1});
    db.put(short, url, function(err) {
      if(err) res.json({error: err});
      else res.json({success: 1, shortUrl: conf.baseUrl + short});
    });
  });
});

app.post('/api/shorten2', function(req, res) {
  var url = req.body.url.trim();
  url = validateUrl(url);
  var short = req.body.short.trim();
  var auth = req.body.auth.trim();
  if(auth !== conf.adminkey) return res.json({error: "Invalid auth"});
  db.get(short, function(err1, val) {
    if(err1 && err1.notFound) {
      db.put(short, url, function(err) {
        if(err) res.json({error: err});
        else res.json({success: 1, shortUrl: conf.baseUrl + short});
      });
    } else if(err1) {
      res.json({error: err1});
    } else {
      res.json({error: "Short url already points to " + val});
    }
  });
});

app.get('/:id', function(req, res) {
  var id = req.params.id;
  db.get(id, function(err, value) {
    if(err) {
      if(err.notFound) {
        res.status(404).send("No such short url. <a href='/'>Go home</a>");
      } else {
        console.log(err);
        res.status(500).send("Unknown error occured. Go <a href='/'>home</a>");
      }
    } else {
      res.redirect(302,  value);
    }
  });
});


app.get('/api/info/:id', function(req, res) {
  var id = req.params.id;
  db.get(id, function(err, value) {
    if(err && err.notFound) return res.json({error: "No such short url"});
    if(err) {
      console.log(err);
      return res.status(500).json({error: "An unknown error occured"});
    }
    res.json({success: 1, longUrl: value});
  });
});
