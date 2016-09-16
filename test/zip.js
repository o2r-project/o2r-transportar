/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const config = require('../config/config');
const fs = require('fs');
var mongojs = require('mongojs');

const host = 'http://localhost';
const cookie = "s:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY";
var orcid = "0000-0001-6021-1617";
var sessionId = "C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo";

var db = mongojs('localhost/muncher', ["users", "sessions"]);

var session = {
    "_id": sessionId,
    "session": {
        "cookie": {
            "originalMaxAge": null,
            "expires": null,
            "secure": null,
            "httpOnly": true,
            "domain": null,
            "path": "/"
        },
        "passport": {
            "user": orcid
        }
    }
}
db.sessions.save(session, function (err, doc) {
    //console.log(doc);
    if (err) throw err;
});
var o2ruser = {
    "_id": "57dc171b8760d15dc1864044",
    "orcid": orcid,
    "level": 101,
    "name": "o2r-testuser"
};
db.users.save(o2ruser, function (err, doc) {
    //console.log(doc);
    if (err) throw err;
});

let compendium_id = '';

describe("ZIP downloader", function () {
    describe("GET non-existing compendium", function () {
        it('should respond with HTTP 404 error', (done) => {
            request(host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message', (done) => {
            request(host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.include(JSON.parse(body).error, "no compendium");
                done();
            });
        });
    });

    describe("insert test user and session", function () {
        it('session should exist and have the correct level', (done) => {
            db.sessions.findOne({
                _id: sessionId
            }, function (err, doc) {
                assert.equal(doc._id.toString(), sessionId);
                done();
            })
        });
        it('user should exist', (done) => {
            db.users.findOne({
                'orcid': orcid
            }, function (err, doc) {
                assert.equal(doc.orcid, orcid);
                assert.equal(doc.level, 101);
                done();
            })
        });
    });

    describe('POST test compendium', () => {
        it('should respond with HTTP 200 OK and new ID', (done) => {
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
                method: "POST",
                jar: j,
                formData: formData,
                timeout: 1000
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        });
    });

    describe("Downlad example compendium", function () {
        it('should respond with HTTP 200', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
        it('content-type should be zip', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.headers['content-type'], 'application/zip');
                done();
            });
        });
        it('content disposition is set to file name attachment', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.headers['content-disposition'], "attachment; filename=\"" + compendium_id + ".zip\"");
                done();
            });
        });
        it('downloaded file is a zip (can be extracted, files exist)', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal("not", "implemented");
                done();
            });
        });
        it('zip file comment is correct', (done) => {
            request(host + '/api/v1/compendium/' + compendium_id + '.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal("not", "implemented");
                done();
            });
        });
    });
});





// download as zip


// check comment


// validate contents as bagit