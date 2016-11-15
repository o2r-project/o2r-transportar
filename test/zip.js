/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const fs = require('fs');
const tmp = require('tmp');
const AdmZip = require('adm-zip');

const host = 'http://localhost';
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

var compendium_id = null;

describe('ZIP downloader', function () {
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
        it('should respond with HTTP 404 error', (done) => {
            request(host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message', (done) => {
            request(host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.include(JSON.parse(body).error, 'no compendium');
                done();
            });
        });
    });

    describe('Downlad compendium', function () {
        it('should respond with HTTP 200', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be zip', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/zip');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip?image=false', (err, res) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], 'attachment; filename="' + compendium_id + '.zip"');
                done();
            });
        });
        it('downloaded file is a zip (can be extracted, files exist)', (done) => {
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
                    assert.oneOf('data/Bagtainer.R', filenames);
                    assert.oneOf('data/Bagtainer.yml', filenames);
                    assert.oneOf('data/container/Dockerfile', filenames);
                    assert.oneOf('data/container/apt-installed.txt', filenames);
                    assert.oneOf('data/container/dpkg-list.txt', filenames);
                    assert.oneOf('data/wd/meteo.RData', filenames);
                    done();
                });
        });
        it('zip file comment is correct', (done) => {
            var tmpfile = tmp.tmpNameSync() + '.zip';
            var url = host + '/api/v1/compendium/' + compendium_id + '.zip';
            request.get(url + '?image=false') // parameters are not used in download URL
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    var zip = new AdmZip(tmpfile);

                    assert.equal(zip.getZipComment(), 'Created by o2r [' + url + ']');
                    done();
                });
        });
    });
});