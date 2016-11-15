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

const host = 'http://localhost';
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

var compendium_id = null;

describe('Image download', function () {
    //before(function () {
    // running this in a before function means that the request is not done before actual tests get called
    describe('POST new compendium and remember ID', function () {
        it('Should respond without error and ID in response body', (done) => {
            let formData = {
                'content_type': 'compendium_v1',
                'compendium': {
                    value: fs.createReadStream('./test/step_image_execute.zip'),
                    options: {
                        contentType: 'application/zip'
                    }
                }
            };
            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                formData: formData,
                timeout: 1000
            }, (err, res, body) => {
                assert.ifError(err);
                compendium_id = JSON.parse(body).id;
                done();
            });
        });
    });

    describe('POST a new job for the new compendium and wait a bit', function () {
        it('Should respond without error and ID in response body', (done) => {
            let formData = {
                'compendium_id': compendium_id
            };
            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/job',
                method: 'POST',
                jar: j,
                formData: formData,
                timeout: 1000
            }, (err, res, body) => {
                assert.ifError(err);
                done();
            });
        });
    });

    describe('Compendium download', function () {
        let secs = 10;
        it('should wait a ' + secs + 'seconds for the job to finish...', (done) => {
            sleep.sleep(secs);
            done();
        }).timeout(secs * 1000);
        it('contains a tarball of Docker image in .zip archive', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = host + '/api/v1/compendium/' + compendium_id + '.zip';
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
                    done();
                });
        });
        it('contains a tarball of Docker image in gzipped .tar archive', (done) => {
            var url = host + '/api/v1/compendium/' + compendium_id + '.tar?gzip';
            var filenames = [];

            var parser = targz().createParseStream();
            parser.on('entry', function (entry) {
                filenames.push(entry.path);
            });
            parser.on('end', function () {
                assert.oneOf('data/dockerimage.tar', filenames);
                done();
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(parser);
        }).timeout(1000);
        it('contains a tarball of Docker image when explicitly asking for it', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip?image=true';
            var url = host + '/api/v1/compendium/' + compendium_id + '.zip';
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
                    done();
                });
        });
        it('does not contain a tarball of Docker image when explicitly not asking for it', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = host + '/api/v1/compendium/' + compendium_id + '.zip?image=false';
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
                    assert.notInclude(filenames, 'data/dockerimage.tar');
                    done();
                });
        });
        it('contains tarball with expected files', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = host + '/api/v1/compendium/' + compendium_id + '.zip';
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
});