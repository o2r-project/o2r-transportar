/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const fs = require('fs');
const tmp = require('tmp');
var tar = require('tar');
var targz = require('tar.gz');

const host = 'http://localhost';
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

var compendium_id = null;

describe('TAR downloader', function () {
    //before(function () {
    // running this in a before function means that the request is not done before actual tests get called
    describe('POST new compendium and remember ID', function () {
        it('Should respond without error and ID in response body', (done) => {
            let formData = {
                'content_type': 'compendium_v1',
                'compendium': {
                    value: fs.createReadStream('./test/compendium01.zip'),
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

    describe('GET non-existing compendium', function () {
        it('should respond with HTTP 404 error at .tar', (done) => {
            request(host + '/api/v1/compendium/1234.tar', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should respond with HTTP 404 error at tar.gz', (done) => {
            request(host + '/api/v1/compendium/1234.tar.gz', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message at .tar', (done) => {
            request(host + '/api/v1/compendium/1234.tar', (err, res, body) => {
                assert.include(JSON.parse(body).error, 'no compendium');
                done();
            });
            it('should mention "no compendium" in the error message at .tar.gz', (done) => {
                request(host + '/api/v1/compendium/1234.tar.gz', (err, res, body) => {
                    assert.include(JSON.parse(body).error, 'no compendium');
                    done();
                });
            });
        });
    });

    describe('Downlad compendium using .tar', function () {
        it('should respond with HTTP 200', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be tar', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/x-tar');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.tar"');
                done();
            });
        });
        it('downloadeded file is a tar archive (can be extracted, files exist)', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.tar';
            var tmpdir = tmp.dirSync().name;
            var url = host + '/api/v1/compendium/' + compendium_id + '.tar';

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var extractor = tar.Extract({ path: tmpdir })
                        .on('error', function (err) {
                            done(err);
                        })
                        .on('end', function () {
                            var filenames = fs.readdirSync(tmpdir);
                            assert.oneOf('data', filenames);

                            filenames = fs.readdirSync(tmpdir + '/data');
                            assert.oneOf('Bagtainer.yml', filenames);
                            assert.oneOf('Bagtainer.R', filenames);
                            assert.oneOf('wd', filenames);

                            filenames = fs.readdirSync(tmpdir + '/data/container');
                            assert.oneOf('Dockerfile', filenames);
                            assert.oneOf('apt-installed.txt', filenames);
                            assert.oneOf('dpkg-list.txt', filenames);
                            done();
                        });
                        
                    fs.createReadStream(tmpfile)
                        .on('error', function (err) {
                            done(err);
                        })
                        .pipe(extractor);
                });
        });
    });

    describe('Downlad compendium using .tar with gzip', function () {
        it('should respond with HTTP 200 for .gz', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar.gz', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('should respond with HTTP 200 for ?gzip', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?gzip', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be tar gz', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?gzip', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/octet-stream');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?gzip', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.tar.gz"');
                done();
            });
        });
        it('downloadeded file is a gzipped tar archive (can be extracted, files exist)', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.tar.gz';
            var tmpdir = tmp.dirSync().name;
            var url = host + '/api/v1/compendium/' + compendium_id + '.tar?gzip';

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    targz().extract(tmpfile, tmpdir)
                        .then(function () {
                            var filenames = fs.readdirSync(tmpdir);
                            assert.oneOf('data', filenames);

                            filenames = fs.readdirSync(tmpdir + '/data');
                            assert.oneOf('Bagtainer.yml', filenames);
                            assert.oneOf('Bagtainer.R', filenames);
                            assert.oneOf('wd', filenames);

                            filenames = fs.readdirSync(tmpdir + '/data/container');
                            assert.oneOf('Dockerfile', filenames);
                            assert.oneOf('apt-installed.txt', filenames);
                            assert.oneOf('dpkg-list.txt', filenames);
                            done();
                        })
                        .catch(function (err) {
                            done(err);
                        });
                });
        });
    });
});
