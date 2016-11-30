/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const host = 'http://localhost';

describe('API basics', function () {
    describe('GET non-existing compendium at tar endpoint', function () {
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

    describe('GET non-existing compendium at zip endpoint', function () {
        it('should respond with HTTP 404 error at .zip', (done) => {
            request(host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message at .zip', (done) => {
            request(host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.include(JSON.parse(body).error, 'no compendium');
                done();
            });
        });
    });
});