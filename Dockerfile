FROM node:0.12.1-slim
MAINTAINER Dragan Milic <dragan@netice9.com>
WORKDIR app
ADD . .
RUN npm install
EXPOSE 3456
ENTRYPOINT ["bin/www"]