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
const AdmZip = require('adm-zip');
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;

require("./setup")
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';


describe('ZIP downloader', function () {
    var compendium_id = null;
    before(function (done) {
        this.timeout(20000);

        let req = createCompendiumPostRequest('./test/step_validate_compendium', cookie);

        request(req, (err, res, body) => {
            console.log(err);
            console.log(body);
            compendium_id = JSON.parse(body).id;

            console.log('\tTesting using compendium ' + compendium_id);
            done();
        });
    });

    describe('GET non-existing compendium', function () {
        it('should respond with HTTP 404 error', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.include(JSON.parse(body).error, 'no compendium');
                done();
            });
        });
    });

    describe('Downlad compendium', function () {
        it('should respond with HTTP 200', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be zip', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/zip');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.zip"');
                done();
            });
        });
        it('downloaded file is a zip (can be extracted, files exist)', (done) => {
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
                    assert.oneOf('data/test.txt', filenames);
                    assert.oneOf('data/bagtainer.yml', filenames);
                    done();
                });
        });
        it('zip file comment is correct', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url_path = '/api/v1/compendium/' + compendium_id + '.zip';
            var url = global.test_host + url_path;
            request.get(url + '?image=false') // parameters are not used in download URL
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);

                    assert.include(zip.getZipComment(), 'Created by o2r [');
                    assert.include(zip.getZipComment(), url_path);
                    done();
                });
        });
    });
});