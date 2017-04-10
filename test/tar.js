/*
 * (C) Copyright 2017 o2r project
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

/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const fs = require('fs');
const tmp = require('tmp');
const tar = require('tar');
const targz = require('tar.gz');
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;

require("./setup")
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';


describe('TAR downloader', function() {
    var compendium_id = null;
    before(function (done) {
        this.timeout(20000);

        let req = createCompendiumPostRequest('./test/step_validate_compendium', cookie);

        request(req, (err, res, body) => {
            compendium_id = JSON.parse(body).id;

            console.log('\tTesting using compendium ' + compendium_id);
            done();
        });
    });

    describe('Downlad compendium using .tar', function() {
        it('should respond with HTTP 200', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be tar', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/x-tar');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.tar"');
                done();
            });
        });
        it('downloadeded file is a tar archive (can be extracted, files exist)', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.tar';
            var tmpdir = tmp.dirSync().name;
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?image=false';

            request.get(url)
                .on('error', function(err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function() {
                    var extractor = tar.Extract({ path: tmpdir })
                        .on('error', function(err) {
                            done(err);
                        })
                        .on('end', function() {
                            var filenames = fs.readdirSync(tmpdir);
                            assert.oneOf('data', filenames);

                            filenames = fs.readdirSync(tmpdir + '/data');
                            assert.oneOf('bagtainer.yml', filenames);
                            assert.oneOf('test.txt', filenames);

                            done();
                        });

                    fs.createReadStream(tmpfile)
                        .on('error', function(err) {
                            done(err);
                        })
                        .pipe(extractor);
                });
        });
    });

    describe('Downlad compendium using .tar with gzip', function() {
        it('should respond with HTTP 200 for .gz', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar.gz?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('should respond with HTTP 200 for ?gzip', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be tar gz', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/octet-stream');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.tar.gz"');
                done();
            });
        });
        it('downloaded file is a gzipped tar archive (can be extracted, files exist)', (done) => {
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false';

            var filenames = [];
            var parser = targz().createParseStream();
            parser.on('entry', function(entry) {
                filenames.push(entry.path);
            });
            parser.on('end', function() {
                assert.oneOf('data/bagtainer.yml', filenames);
                assert.oneOf('data/test.txt', filenames);
                done();
            });

            request.get(url)
                .on('error', function(err) {
                    done(err);
                })
                .pipe(parser);
        });
    });
});
