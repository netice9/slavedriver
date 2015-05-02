FROM node:0.12.1-slim
WORKDIR app
ADD . .
RUN npm install
ENTRYPOINT ["bin/www"]