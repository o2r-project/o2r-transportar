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

const config = require('./config/config');
const debug = require('debug')('transportar');
const mongoose = require('mongoose');
const backoff = require('backoff');

// check fs & create dirs if necessary
const fse = require('fs-extra');
fse.mkdirsSync(config.fs.tmp);

const dbURI = config.mongo.location + config.mongo.database;
mongoose.connect(dbURI);
mongoose.connection.on('error', (err) => {
  debug('Could not connect to MongoDB @ %s: %s', dbURI, err);
});

// Express modules and tools
const express = require('express');
const app = express();
const responseTime = require('response-time')

app.use((req, res, next) => {
  debug(req.method + ' ' + req.path);
  next();
});
app.use(responseTime());

const url = require('url');

// Passport & session modules for authenticating users.
const User = require('./lib/model/user');
const passport = require('passport');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

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
  User.findOne({ orcid: id }, (err, user) => {
    if (err) cb(err);
    cb(null, user);
  });
});

function initApp(callback) {
  debug('Initialize application');

  try {
    // configure express-session, stores reference to authdetails in cookie.
    // authdetails themselves are stored in MongoDBStore
    var mongoStore = new MongoDBStore({
      uri: config.mongo.location + config.mongo.database,
      collection: 'sessions'
    }, err => {
      if (err) {
        debug('Error starting MongoStore: %s', err);
      }
    });

    mongoStore.on('error', err => {
      debug('Error with MongoStore: %s', err);
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
    app.get('/api/v1/compendium/:id.tar.gz', function (req, res) {
      var redirectUrl = req.path.replace('.tar.gz', '.tar?gzip');
      if (Object.keys(req.query).length !== 0) {
        redirectUrl += '&' + url.parse(req.url).query;
      }
      debug('Redirecting from %s with query %s  to  %s', req.path, JSON.stringify(req.query), redirectUrl)
      res.redirect(redirectUrl);
    });

    app.get('/status', function (req, res) {
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

    app.listen(config.net.port, () => {
      debug('transportar %s with API version %s waiting for requests on port %s',
        config.version,
        config.api_version,
        config.net.port);
    });
  } catch (err) {
    callback(err);
  }

  callback(null);
}

var dbBackoff = backoff.fibonacci({
  randomisationFactor: 0,
  initialDelay: config.mongo.inital_connection_initial_delay,
  maxDelay: config.mongo.inital_connection_max_delay
});

dbBackoff.failAfter(config.mongo.inital_connection_attempts);
dbBackoff.on('backoff', function (number, delay) {
  debug('Trying to connect to MongoDB (#%s) in %sms', number, delay);
});
dbBackoff.on('ready', function (number, delay) {
  debug('Connect to MongoDB (#%s)', number, delay);
  mongoose.createConnection(dbURI, (err) => {
    if (err) {
      debug('Error during connect: %s', err);
      mongoose.disconnect(() => {
        debug('Mongoose: Disconnected all connections.');
      });
      dbBackoff.backoff();
    } else {
      // delay app startup to when MongoDB is available
      debug('Initial connection open to %s: %s', dbURI, mongoose.connection.readyState);
      initApp((err) => {
        if (err) {
          debug('Error during init!\n%s', err);
          mongoose.disconnect(() => {
            debug('Mongoose: Disconnected all connections.');
          });
          dbBackoff.backoff();
        }
        debug('Started application.');
      });
    }
  });
});
dbBackoff.on('fail', function () {
  debug('Eventually giving up to connect to MongoDB');
  process.exit(1);
});

dbBackoff.backoff();
