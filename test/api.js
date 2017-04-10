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

require("./setup")

describe('API basics', function () {
    describe('GET non-existing compendium at tar endpoint', function () {
        it('should respond with HTTP 404 error at .tar', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.tar', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should respond with HTTP 404 error at tar.gz', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.tar.gz', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message at .tar', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.tar', (err, res, body) => {
                assert.include(JSON.parse(body).error, 'no compendium');
                done();
            });
            it('should mention "no compendium" in the error message at .tar.gz', (done) => {
                request(global.test_host + '/api/v1/compendium/1234.tar.gz', (err, res, body) => {
                    assert.include(JSON.parse(body).error, 'no compendium');
                    done();
                });
            });
        });
    });

    describe('GET non-existing compendium at zip endpoint', function () {
        it('should respond with HTTP 404 error at .zip', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
        it('should mention "no compendium" in the error message at .zip', (done) => {
            request(global.test_host + '/api/v1/compendium/1234.zip', (err, res, body) => {
                assert.include(JSON.parse(body).error, 'no compendium');
                done();
            });
        });
    });
});