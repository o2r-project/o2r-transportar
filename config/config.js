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
var c = {};
c.version = {};
c.net = {};
c.mongo = {};
c.fs = {};
var env = process.env;

// Information about muncher
c.version.major = 0;
c.version.minor = 1;
c.version.bug = 0;
c.version.api = 1;

// network & database
c.net.port = env.TRANSPORTAR_PORT || 8086;
c.mongo.location = env.TRANSPORTAR_MONGODB || 'mongodb://localhost/';
c.mongo.database = env.TRANSPORTAR_MONGODB_DATABASE || 'muncher';
c.mongo.inital_connection_attempts = 30;
c.mongo.inital_connection_max_delay = 5000;
c.mongo.inital_connection_initial_delay = 10;

// fix mongo location if trailing slash was omitted
if (c.mongo.location[c.mongo.location.length-1] !== '/') {
  c.mongo.location += '/';
}

// fs paths
c.fs.base       = env.TRANSPORTAR_BASEPATH || '/tmp/o2r/';
c.fs.incoming   = c.fs.base + 'incoming/';
c.fs.compendium = c.fs.base + 'compendium/';
c.fs.job        = c.fs.base + 'job/';
c.fs.tmp     = c.fs.base + 'imgtmp/';
c.fs.delete_inc = true;

// session secret
c.sessionsecret = env.SESSION_SECRET || 'o2r';

// authentication levels
c.user = {};
c.user.level = {};
c.user.level.view_status = 500;

c.download = {};
c.download.defaults = {};
c.download.defaults.statConcurrency = 4; // archiver.js default is '4'
c.download.defaults.tar = {};
c.download.defaults.tar.gzipOptions = {}; // https://nodejs.org/api/zlib.html#zlib_class_options
module.exports = c;
