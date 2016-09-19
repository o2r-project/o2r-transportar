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
var config = require('../config/config');
var debug = require('debug')('transportar');
var fs = require('fs');
var Compendium = require('../lib/model/compendium');
var archiver = require('archiver');
var Timer = require('timer-machine')

// based on https://github.com/archiverjs/node-archiver/blob/master/examples/express.js
exports.downloadZip = (req, res) => {

  var path = req.params.path;
  debug(path);
  //var size = req.query.size || null;
  var id = req.params.id;
  var originalUrl = req.protocol + '://' + req.hostname + req.path;

  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      var localpath = config.fs.compendium + id;

      var timer = new Timer();
      timer.start();

      try {
        debug('Going to zip %s', localpath);
        fs.accessSync(localpath); //throws if does not exist

        var archive = archiver('zip', {
          comment: 'Created by o2r [' + originalUrl + ']',
          statConcurrency: config.download.defaults.statConcurrency
        });

        archive.on('error', function (err) {
          res.setHeader('Content-Type', 'application/json');
          res.status(500).send({ error: err.message });
        });

        archive.on('end', function () {
          timer.stop();
          debug('Archive wrote %d bytes in %s ms', archive.pointer(), timer.time());
        });

        //set the archive name
        res.attachment(id + '.zip');

        //this is the streaming magic
        archive.pipe(res);

        // all all files
        archive.directory(localpath, '/');

        archive.finalize();
      } catch (e) {
        debug(e);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send({ error: 'internal error', e });
        return;
      } finally {
        timer.stop();
      }
    }
  });
};


exports.downloadTar = (req, res) => {
  var path = req.params.path;
  debug(path);
  //var size = req.query.size || null;
  var id = req.params.id;
  var gzip = false;
  if (req.query.gzip !== undefined) {
    gzip = true;
  }

  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      var localpath = config.fs.compendium + id;

      var timer = new Timer();
      timer.start();

      try {
        debug('Going to tar %s with gzip: %s', localpath, gzip);
        fs.accessSync(localpath); //throws if does not exist

        var archive = archiver('tar', {
          gzip: gzip,
          gzipOptions: config.download.defaults.tar.gzipOptions,
          statConcurrency: config.download.defaults.statConcurrency
        });

        archive.on('error', function (err) {
          res.setHeader('Content-Type', 'application/json');
          res.status(500).send({ error: err.message });
        });

        //on stream closed we can end the request
        archive.on('end', function () {
          timer.stop();
          debug('Archive wrote %d bytes in %s ms', archive.pointer(), timer.time());
        });

        //set the archive name
        var filename = id + '.tar';
        if (gzip) {
          filename = filename + '.gz';
          //res.setHeader('Content-Type', 'application/gzip'); // archiver correctly sets to 'application/x-tar' if not gzipped
        }
        res.attachment(filename);

        //this is the streaming magic
        archive.pipe(res);

        archive.directory(localpath, '/');

        archive.finalize();
      } catch (e) {
        debug(e);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send({ error: 'internal error', e });
        return;
      } finally {
        timer.stop();
      }
    }
  });
};
