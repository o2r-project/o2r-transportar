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
var Job = require('../lib/model/job');
var archiver = require('archiver');
var Timer = require('timer-machine');
var Docker = require('dockerode');
const path = require('path');

function saveImage(outputStream, id, res, callback) {
  var docker = new Docker();
  debug('[%s] Docker client set up: %s', this.jobId, JSON.stringify(docker));

  var filter = { compendium_id: id };
  // include the image created for the compendium using the last updated job
  // FIMXE need to filter for "overall success" jobs
  Job.find(filter).select('id').limit(1).sort({ updatedAt: 'desc' }).exec((err, jobs) => {
    if (err) {
      res.status(500).send(JSON.stringify({ error: 'error finding last job for compendium' }));
    } else {
      if (jobs.length <= 0) {
        debug('Error: No job for %s found, cannot add image.', id);
        res.status(500).send(JSON.stringify({ error: 'no job found for this compendium, run a job before downloading with image' }));
      } else {
        let job = jobs[0];
        let imageTag = config.bagtainer.imageNamePrefix + job.id;
        debug('Found latest job %s for compendium %s and will include image', job.id, id, imageTag);

        let image = docker.getImage(imageTag);
        debug('Found image: %s', JSON.stringify(image));
        image.inspect((err, data) => {
          if (err) {
            debug('Error inspecting image: %s', err);
          }
          else {
            debug('Image tags (a.k.a.s): %s', JSON.stringify(data.RepoTags));
          }
        });

        debug('Getting image %s ...', image.Id);
        image.get((err, imageStream) => {
          if (err) {
            debug('Error while handling image stream: %s', err.message);
          }
          else {
            debug('Saving image stream to provided stream: %s > %s', JSON.stringify(imageStream), JSON.stringify(outputStream));
            //archive.append(stream, { name: config.bagtainer.imageTarballFile, date: new Date() });
            imageStream.pipe(outputStream);

            outputStream.on('finish', function () {
              debug('Image saved to provided stream for %s', id);
              callback(null);
            });
            outputStream.on('error', (err) => {
              debug('Error saving image to provided stream: %s', err);
              callback(err);
            })
          }
        });
      }
    }
  });
}

function imageTarballFileExists(bagtainerPath) {
  let p = path.join(bagtainerPath, config.bagtainer.imageTarballFile);
  try {
    fs.accessSync(p);
    debug('Tarball file for already exists at %s', p);
    return true;
  } catch (err) {
    debug('Tarball file at %s does not exist (or other file system error): %s', p, err);
    return false;
  }
}

function archiveBagtainer(archive, bagtainerPath, ignoreImage) {
  var glob = '**';
  let options = {};
  options.cwd = bagtainerPath;
  if (ignoreImage) {
    options.ignore = [config.bagtainer.imageTarballFile];
  }

  debug('Putting "%s" into archive with options %s', glob, JSON.stringify(options));
  archive.glob(glob, options);
  archive.finalize();
}

// based on https://github.com/archiverjs/node-archiver/blob/master/examples/express.js
exports.downloadZip = (req, res) => {
  var requestPath = req.params.path;
  debug(requestPath);
  var includeImage = config.download.defaults.includeImage;
  if (req.query.image) {
    includeImage = (req.query.image === "true");
  }
  var id = req.params.id;
  var originalUrl = req.protocol + '://' + req.hostname + req.path;

  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      var localpath = path.join(config.fs.compendium, id);

      var timer = new Timer();
      timer.start();

      try {
        debug('Going to zip %s (image: %s)', localpath, includeImage);
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

        if (includeImage) {
          if (!imageTarballFileExists(localpath)) {
            // this breaks the streaming magic, but simplest way to update bag is to save the tarball as a file
            var stream = fs.createWriteStream(path.join(localpath, config.bagtainer.imageTarballFile));

            saveImage(stream, id, res, (err) => {
              if(err) {
                debug('Error saving image for %s: %s', id, JSON.stringify(err));
                res.status(500).send({ error: 'internal error', err: err });
                return;
              }
              debug('Image saved for %s', id);

              if (!res.headersSent) {
                archiveBagtainer(archive, localpath, false);
              } else {
                debug('Image written to file but headers already sent!');
              }
            });
          } else {
            archiveBagtainer(archive, localpath, false);
          }
        } else {
          archiveBagtainer(archive, localpath, true);
        }
      } catch (e) {
        debug(e);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send({ error: 'internal error', e: e });
        return;
      } finally {
        timer.stop();
      }
    }
  });
};


exports.downloadTar = (req, res) => {
  var requestPath = req.params.path;
  debug(requestPath);
  var includeImage = config.download.defaults.includeImage;
  if (req.query.image) {
    includeImage = (req.query.image === "true");
  }
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
        debug('Going to tar %s (image: %s, gzip: %s)', localpath, includeImage, gzip);
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

        if (includeImage) {
          if (!imageTarballFileExists(localpath)) {
            // this breaks the streaming magic, but simplest way to update bag is to save the tarball as a file
            var stream = fs.createWriteStream(path.join(localpath, config.bagtainer.imageTarballFile));

            saveImage(stream, id, res, (err) => {
              if(err) {
                debug('Error saving image for %s: %s', id, JSON.stringify(err));
                res.status(500).send({ error: 'internal error', err: err });
                return;
              }
              debug('Image saved for %s', id);

              if (!res.headersSent) {
                archiveBagtainer(archive, localpath, false);
              } else {
                debug('Image written to file but headers already sent!');
              }
            });
          } else {
            archiveBagtainer(archive, localpath, false);
          }
        } else {
          archiveBagtainer(archive, localpath, true);
        }
      } catch (e) {
        debug(e);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send({ error: 'internal error', e: e });
        return;
      } finally {
        timer.stop();
      }
    }
  });
};
