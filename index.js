/*
 * (C) Copyright 2016 o2r project.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var config = require('./config/config');
var debug = require('debug')('transportar');
var mongoose = require('mongoose');

// check fs & create dirs if necessary
var fse = require('fs-extra');
fse.mkdirsSync(config.fs.tmp);

mongoose.connect(config.mongo.location + config.mongo.database);
mongoose.connection.on('error', () => {
  console.log('could not connect to mongodb on ' + config.mongo.location + config.mongo.database +', ABORT');
  process.exit(2);
});

// Express modules and tools
var express = require('express');
var app = express();
var responseTime = require('response-time')

app.use((req, res, next) => {
  debug(req.method + ' ' + req.path);
  next();
});
app.use(responseTime())

var url = require('url');

// Passport & session modules for authenticating users.
var User = require('./lib/model/user');
var passport = require('passport');
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);

// load controllers
var controllers = {};
controllers.download = require('./controllers/download');

/*
 *  Authentication & Authorization
 *  This is be needed in every service that wants to check if a user is authenticated.
 */

// minimal serialize/deserialize to make authdetails cookie-compatible.
passport.serializeUser((user, cb) => {
  cb(null, user.orcid);
});
passport.deserializeUser((id, cb) => {
  debug("Deserialize for %s", id);
  User.findOne({orcid: id}, (err, user) => {
    if (err) cb(err);
    cb(null, user);
  });
});

// configure express-session, stores reference to authdetails in cookie.
// authdetails themselves are stored in MongoDBStore
var mongoStore = new MongoDBStore({
  uri: config.mongo.location + config.mongo.database,
  collection: 'sessions'
});

mongoStore.on('error', err => {
  debug(err);
});

app.use(session({
  secret: config.sessionsecret,
  resave: true,
  saveUninitialized: true,
  maxAge: 60 * 60 * 24 * 7, // cookies become invalid after one week
  store: mongoStore
}));

app.use(passport.initialize());
app.use(passport.session());

/*
 * configure routes
 */
app.get('/api/v1/compendium/:id.zip', controllers.download.downloadZip);
app.get('/api/v1/compendium/:id.tar', controllers.download.downloadTar);
app.get('/api/v1/compendium/:id.tar.gz', function(req, res) {
  var redirectUrl = req.path.replace('.tar.gz', '.tar?gzip');
  if(Object.keys(req.query).length !== 0) {
    redirectUrl += '&' + url.parse(req.url).query;
  }
  debug('Redirecting from %s with query %s  to  %s', req.path, JSON.stringify(req.query), redirectUrl)
  res.redirect(redirectUrl);
});

app.listen(config.net.port, () => {
  debug('transportar '+  config.version.major + '.' + config.version.minor + '.' +
      config.version.bug + ' with api version ' + config.version.api +
      ' waiting for requests on port ' + config.net.port);
});

app.get('/status', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (!req.isAuthenticated() || req.user.level < config.user.level.view_status) {
    res.status(401).send('{"error":"not authenticated or not allowed"}');
    return;
  }

  var response = {
    service: "transportar",
    version: config.version,
    levels: config.user.level,
    mongodb: config.mongo,
    filesystem: config.fs
  };
  res.send(response);
});
