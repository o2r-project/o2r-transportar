# (C) Copyright 2016 The o2r project. https://o2r.info
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
#
FROM alpine:3.4
MAINTAINER o2r-project, https://o2r.info

RUN apk add --no-cache \
    nodejs \
    git \
    ca-certificates \
    wget \
  && update-ca-certificates \
  && git clone --depth 1 -b master https://github.com/o2r-project/o2r-transportar /transportar \
  && wget -O /sbin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.1.3/dumb-init_1.1.3_amd64 \
  && chmod +x /sbin/dumb-init \
  && apk del \
    git \
    wget \
    ca-certificates \
  && rm -rf /var/cache

WORKDIR /transportar
RUN npm install --production

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["npm", "start" ]
