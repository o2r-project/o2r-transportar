/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const fs = require('fs');
const tmp = require('tmp');
const tar = require('tar');
const targz = require('tar.gz');

const host = 'http://localhost';
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

var compendium_id = null;

describe('TAR downloader', function() {
    //before(function () {
    // running this in a before function means that the request is not done before actual tests get called
    describe('POST new compendium and remember ID', function() {
        it('Should respond without error and ID in response body', (done) => {
            let formData = {
                'content_type': 'compendium_v1',
                'compendium': {
                    value: fs.createReadStream('./test/step_validate_compendium.zip'),
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
                timeout: 10000
            }, (err, res, body) => {
                assert.ifError(err);
                compendium_id = JSON.parse(body).id;
                done();
            });
        });
    }).timeout(10000);

    describe('Downlad compendium using .tar', function() {
        it('should respond with HTTP 200', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be tar', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/x-tar');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.tar"');
                done();
            });
        });
        it('downloadeded file is a tar archive (can be extracted, files exist)', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.tar';
            var tmpdir = tmp.dirSync().name;
            var url = host + '/api/v1/compendium/' + compendium_id + '.tar?image=false';

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
            request(host + '/api/v1/compendium/' + compendium_id + '.tar.gz?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('should respond with HTTP 200 for ?gzip', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be tar gz', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/octet-stream');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.tar.gz"');
                done();
            });
        });
        it('downloaded file is a gzipped tar archive (can be extracted, files exist)', (done) => {
            var url = host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=false';

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
