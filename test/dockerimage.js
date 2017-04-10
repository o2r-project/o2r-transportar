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
const chai = require('chai');
const assert = chai.assert;
const request = require('request');
const fs = require('fs');
const tmp = require('tmp');
const AdmZip = require('adm-zip');
const sleep = require('sleep');
const tar = require('tar');
const targz = require('tar.gz');
const stream = require('stream');
const Bag = require('bagit');
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;

require("./setup")
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';


describe('Image download', function () {
    var compendium_id = null;


    before(function (done) {
        this.timeout(20000);

        let req = createCompendiumPostRequest('./test/step_image_execute', cookie);

        request(req, (err, res, body) => {
            assert.ifError(err);
            compendium_id = JSON.parse(body).id;

            console.log('\tTesting using compendium ' + compendium_id);// POST a new job for the new compendium and wait a bit so that there is an image to download
            let formData = {
                'compendium_id': compendium_id
            };
            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host_muncher);

            request({
                uri: global.test_host_muncher + '/api/v1/job',
                method: 'POST',
                jar: j,
                formData: formData,
                timeout: 10000
            }, (err, res, body) => {
                assert.ifError(err);
                let jobId = JSON.parse(body).job_id;
                assert.ok(jobId);

                console.log('\tStarted a job on the compendium, job id: ' + jobId);
                done();
            });
        });
    });

    let secs = 10;

    describe('compendium download', function () {
        it('waits ' + secs + 'seconds for the job to finish...', (done) => {
            sleep.sleep(secs);
            done();
        }).timeout(secs * 1000 * 2);

        it('contains a tarball of Docker image in zip archive by default', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);
                    var zipEntries = zip.getEntries();

                    var filenames = [];
                    zipEntries.forEach(function (entry) {
                        filenames.push(entry.entryName);
                    });
                    assert.oneOf('bagit.txt', filenames);
                    assert.oneOf('data/dockerimage.tar', filenames);
                    assert.lengthOf(filenames, 9);
                    done();
                });
        }).timeout(secs * 1000);
        it('contains a tarball of Docker image in gzipped .tar archive', (done) => {
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip';
            let filenames = [];

            var parser = targz().createParseStream();
            parser.on('entry', function (entry) {
                filenames.push(entry.path);
            });
            parser.on('end', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.oneOf('data/dockerimage.tar', filenames);
                assert.lengthOf(filenames, 9);
                done();
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(parser);
        }).timeout(secs * 1000);

        it('contains a tarball of Docker image in zip archive when explicitly asking for it', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=true';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);
                    var zipEntries = zip.getEntries();

                    var filenames = [];
                    zipEntries.forEach(function (entry) {
                        filenames.push(entry.entryName);
                    });
                    assert.oneOf('data/dockerimage.tar', filenames);
                    assert.lengthOf(filenames, 9);
                    done();
                });
        }).timeout(secs * 1000);
        it('contains a tarball of Docker image in tar.gz archive when explicitly asking for it', (done) => {
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=true';
            let filenames = [];
            var parser = targz().createParseStream();
            parser.on('entry', function (entry) {
                filenames.push(entry.path);
            });
            parser.on('end', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.oneOf('data/dockerimage.tar', filenames);
                assert.lengthOf(filenames, 9);
                done();
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(parser);
        }).timeout(secs * 1000);

        it('does not put a tarball of Docker image in zip archive when explicitly not asking for it', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=false';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);
                    var zipEntries = zip.getEntries();

                    var filenames = [];
                    zipEntries.forEach(function (entry) {
                        filenames.push(entry.entryName);
                    });
                    assert.oneOf('bagit.txt', filenames);
                    assert.notInclude(filenames, 'data/dockerimage.tar');
                    assert.lengthOf(filenames, 8);
                    done();
                });
        }).timeout(secs * 1000);
        it('does not put a tarball of Docker image in tar.gz archive when explicitly not asking for it', (done) => {
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar.gz?image=false';
            let filenames = [];
            var parser = targz().createParseStream();
            parser.on('entry', function (entry) {
                filenames.push(entry.path);
            });
            parser.on('end', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.notInclude(filenames, 'data/dockerimage.tar');
                assert.lengthOf(filenames, 8);
                done();
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(parser);
        }).timeout(secs * 1000);
        it('does not put a tarball of Docker image in gzipped tar archive when explicitly not asking for it', (done) => {
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?image=false&gzip';
            let filenames = [];
            var parser = targz().createParseStream();
            parser.on('entry', function (entry) {
                filenames.push(entry.path);
            });
            parser.on('end', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.notInclude(filenames, 'data/dockerimage.tar');
                assert.lengthOf(filenames, 8);
                done();
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(parser);
        }).timeout(secs * 1000);

        it('contains image tarball which has expected files', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);
                    var tmpdir = tmp.dirSync().name;

                    zip.getEntries().forEach(function (entry) {
                        if (entry.entryName === 'data/dockerimage.tar') {
                            var extractor = tar.Extract({ path: tmpdir })
                                .on('error', (err) => {
                                    done(err);
                                })
                                .on('end', () => {
                                    fs.readdir(tmpdir, (err, files) => {
                                        assert.oneOf('manifest.json', files);
                                        assert.oneOf('repositories', files);
                                        assert.lengthOf(files, 4);

                                        fs.readFile(tmpdir + '/manifest.json', (err, data) => {
                                            if (err) {
                                                done(err);
                                            }
                                            else {
                                                assert.property(JSON.parse(data)[0], 'RepoTags', 'bagtainer:' + compendium_id);
                                                done();
                                            }
                                        });
                                    })
                                });

                            var bufferStream = new stream.PassThrough();
                            bufferStream.end(new Buffer(entry.getData()));
                            bufferStream.pipe(extractor);
                        }
                    });
                });
        });
    });

    describe('compendium download with validation _without_ image', function () {
        it('is a valid Bag', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var tmpdir = tmp.dirSync().name;
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=false';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);
                    zip.extractAllTo(tmpdir, false);

                    this.bag = new Bag(tmpdir);
                    this.bag
                        .validate()
                        .then(res => {
                            done(res);
                        }).catch(err => {
                            done(err);
                        });
                });
        }).timeout(secs * 1000);
    });

    describe.skip('compendium download with validation _with_ image', function () {
        it('is a valid Bag', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var tmpdir = tmp.dirSync().name;
            var url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=true';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);
                    zip.extractAllTo(tmpdir, false);

                    this.bag = new Bag(tmpdir);
                    this.bag
                        .validate()
                        .then(res => {
                            done(res);
                        }).catch(err => {
                            done(err);
                        });
                });
        }).timeout(secs * 1000);

    });
});