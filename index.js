'use strict';
// module.exports = function (str) {
//   console.log(str || 'Rainbow');
// };

var fs = require("fs");
var application = require('./application');
var express = require('express');
var bodyParser = require('body-parser')
var _ = require('lodash');
var auth = require('./http-auth');

var applicationsFile = "applications.json";
var applications = {};
var app = express();

var applications = {};

if (process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD) {
  app.use(auth(process.env.AUTH_USERNAME, process.env.AUTH_PASSWORD, 'Slavedriver'));
}

app.put('/applications/:applicationName', bodyParser.json(), function(req, res) {
  var applicationDescriptor = {
    containers: req.body,
    name: req.params.applicationName
  }
  console.log('created: %j', applicationDescriptor);
  applications[req.params.applicationName] = application(applicationDescriptor);
  res.status(201).json({})
});

app.get('/applications', function(req,res) {
  res.json(_.pairs(applications).map(function(kv) {
    return kv[0];
  }));
});

module.exports = app;
