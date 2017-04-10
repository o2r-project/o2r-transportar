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
const mongojs = require('mongojs');
const exec = require('child_process').exec;
const yn = require('yn');
const Docker = require('dockerode');
const Stream = require('stream');
const sleep = require('sleep');
var debugContainer = require('debug')('helper_containers');

// test parameters for local session authentication directly via fixed database entries
var orcid = '0000-0001-6021-1617';
var sessionId = 'C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo';

const env = process.env;
const config = require('../config/config');
global.test_host = env.TEST_HOST || 'http://localhost:' + config.net.port;
global.test_host_loader = 'http://localhost:8088';
global.test_host_muncher = 'http://localhost:8080';
console.log('Testing endpoint at ' + global.test_host);

before(function (done) {
    this.timeout(20000);

    var db = mongojs('localhost/muncher', ['users', 'sessions']);

    var session = {
        '_id': sessionId,
        'session': {
            'cookie': {
                'originalMaxAge': null,
                'expires': null,
                'secure': null,
                'httpOnly': true,
                'domain': null,
                'path': '/'
            },
            'passport': {
                'user': orcid
            }
        }
    }
    db.sessions.save(session, function (err, doc) {
        if (err) throw err;
    });
    var o2ruser = {
        '_id': '57dc171b8760d15dc1864044',
        'orcid': orcid,
        'level': 100,
        'name': 'o2r-testuser'
    };
    db.users.save(o2ruser, function (err, doc) {
        if (err) throw err;
    });

    if (env.HELPER_CONTAINERS && !yn(env.HELPER_CONTAINERS)) {
        debugContainer('Not starting container, found env var LOADER_CONTAINER="%s"', env.HELPER_CONTAINERS);
        done();
    } else {
        debugContainer('Starting Docker containers to handle the ERC and job creation');

        var docker = new Docker();
        // create stream that logs container stdout
        let container_stream = Stream.Writable();
        container_stream._write = function (chunk, enc, next) {
            debugContainer(chunk.toString('utf8'));
            next();
        };

        // loader for ERC upload
        var loader = new Promise(function (fulfill, reject) {
            docker.createContainer({
                Image: 'o2rproject/o2r-loader',
                name: 'loader_for_testing',
                AttachStdin: false,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true,
                Cmd: [],
                Env: [
                    "DEBUG=loader,loader:*",
                    "LOADER_MONGODB=mongodb://172.17.0.1/" // Docker default host IP
                ],
                Volumes: {
                    '/tmp/o2r': {}
                },
                HostConfig: {
                    Binds: [
                        '/tmp/o2r:/tmp/o2r'
                    ],
                    PortBindings: { '8088/tcp': [{ 'HostPort': '8088' }] }
                },
                ExposedPorts: { '8088/tcp': {} }
            }).then(function (container) {
                container.start({}, (err, data) => {
                    if (err) {
                        debugContainer('ERROR %s', JSON.stringify(err));
                        reject();
                    } else {
                        debugContainer('Started loader container with id %s at port 8088', container.id);
                        fulfill();
                    }
                });
            })
        });

        // muncher for job starting
        var muncher = new Promise(function (fulfill, reject) {
            docker.createContainer({
                Image: 'o2rproject/o2r-muncher',
                name: 'muncher_for_testing',
                AttachStdin: false,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true,
                Cmd: [],
                Env: [
                    "DEBUG=muncher,muncher:*",
                    "MUNCHER_MONGODB=mongodb://172.17.0.1/" // Docker default host IP
                ],
                Volumes: {
                    '/tmp/o2r': {}
                },
                HostConfig: {
                    Binds: [
                        '/tmp/o2r:/tmp/o2r'
                    ],
                    PortBindings: { '8080/tcp': [{ 'HostPort': '8080' }] }
                },
                ExposedPorts: { '8080/tcp': {} }
            }).then(function (container) {
                container.start({}, (err, data) => {
                    if (err) {
                        debugContainer('ERROR %s', JSON.stringify(err));
                        reject();
                    } else {
                        debugContainer('Started muncher container with id %s at port 8080', container.id);
                        fulfill();
                    }
                });
            });
        });

        Promise.all([loader, muncher]).then(() => {
            sleep.sleep(5);
            debugContainer('Containers started.');
            done();
        });
    }
});

after(function (done) {
    if (!(env.HELPER_CONTAINERS && !yn(env.HELPER_CONTAINERS))) {
        exec('docker rm -f loader_for_testing muncher_for_testing', (error, stdout, stderr) => {
            if (error || stderr) {
                debugContainer(error, stderr, stdout);
            } else {
                debugContainer('Removed containers: %s', stdout);
            }
            done();
        });
    } else {
        done();
    }
});
