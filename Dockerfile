FROM node:8.4

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ENV TINI_VERSION v0.16.1
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

COPY ./LICENSE ./package.json ./yarn.lock ./app.js ./
COPY ./public/ ./public/
RUN yarn install

CMD ["node", "app.js"]
