var leveldb = require('level'),
    http = require('http'),
    conf = require('./config'),
    qs = require('querystring'),
    fs = require('fs'),
    express = require('express');

var db = leveldb('./urldb');

var app = express();

app.use(express.bodyParser());
app.use(express.static(__dirname + "/public"));

app.listen(3000)

function generateShortUrl(len) {
  //http://tools.ietf.org/html/rfc3986 all valid characters
  var allowedCharacters = 'abcdefghijklmnopqrstuvwxyABCDEFGHIJKLMNOPQRSTUVWXY-._~';
  var out = "";
  for(var i=0;i<len;i++) {
    out += allowedCharacters[Math.floor(Math.random()*allowedCharacters.length)];
  }
  return out;
}

function limitedRunGetUnused(limit, len, cb) {
  if(limit == 0) return cb("Error, could not generate short url");
  var s = generateShortUrl(len);
  db.get(s, function(err, value) {
    if(err && err.notFound) return cb(false,s);
    else limitedRunGetUnused(limit - 1, len, cb);
  });
}

function getUnusedShortUrl(len, cb) {
  limitedRunGetUnused(10, len, cb);
}

app.post('/api/shorten', function(req, res) {
  var url = req.body.url.trim();
  if(conf.disallowedUrlRegex.test(url) || url.length == 0) {
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
    if(err) console.log(err);
    if(err && err.notFound) return res.write("No such short url. <a href='/'>Go home</a>");
    res.redirect(302,  value);
  });
});


app.get('/api/info/:id', function(req, res) {
  var id = req.params.id;
  db.get(id, function(err, value) {
    if(err) console.log(err);
    if(err && err.notFound) return res.json({error: "No such short url"});
    res.json({success: 1, longUrl: value});
  });
});
