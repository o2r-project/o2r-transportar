# o2r-transportar __DEPRECATED__ [o2r-transporter](https://github.com/o2r-project/o2r-transporter)

![Travis CI](https://api.travis-ci.org/o2r-project/o2r-transportar.svg)

Node.js implementation to package complete compendia for downloading, i.e. the [o2r web api](http://o2r.info/o2r-web-api) routes `/api/v1/compendium/:id.zip` and `/api/v1/compendium/:id.tar.gz`.

## Requirements

- Node.js (`>= 6.x`)
- bagit-python (`bagit.py`)

## Configuration

The configuration can be done via environment variables.

- `TRANSPORTAR_PORT`
  Define on which Port muncher should listen. Defaults to `8086`.
- `TRANSPORTAR_MONGODB` __Required__
  Location for the mongo db. Defaults to `mongodb://localhost/`. You will very likely need to change this.
- `TRANSPORTAR_MONGODB_DATABASE`
  Which database inside the mongo db should be used. Defaults to `muncher`.
- `TRANSPORTAR_BASEPATH`
  The local path where compendia are stored. Defaults to `/tmp/o2r/`.
- `SESSION_SECRET`
  String used to sign the session ID cookie, must match other microservices.

## Run locally

```bash
npm install
npm start
```

Open the application at http://localhost:8086/api/v1/compendium/1234/test

To show logs in the console, replace the last command with `DEBUG=* npm start`. There you can also see if requests are handled while not having any real data yet.

To add some content to your local database, use [o2r-muncher](https://github.com/o2r-project/o2r-muncher).

Inspect your local MongoDB with [adminMongo](https://mrvautin.com/adminmongo/).

## Debug locally

```bash
npm run-script debug
```

The start statement in this script sets the DEBUG variable for the [debug library](https://www.npmjs.com/package/debug) to `*` (show all logs).
Direct the log into a file using `DEBUG=* npm start > log.txt`.

## Test

```bash
# start a MongoDB
# start a muncher
# start a loader

npm test

# you can also run the tests towards a manually specified host and enable prototypical containers for muncher and loader
HELPER_CONTAINERS=y TEST_HOST=http://localhost npm test
```

## Dockerfile

The file `Dockerfile` describes the Docker image published at [Docker Hub](https://hub.docker.com/r/o2rproject/o2r-transportar/).

## License

o2r transportar is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2016 - o2r project.
