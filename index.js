'use strict';

var fs = require("fs");
var application = require('./application');
var express = require('express');
var bodyParser = require('body-parser')
var _ = require('lodash');
var auth = require('./http-auth');

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
  app = application(req.params.applicationName);
  app.create(applicationDescriptor);
  applications[req.params.applicationName] = app;
  res.status(201).json({})
});

app.get('/applications', function(req,res) {
  res.json(_.pairs(applications).map(function(kv) {
    return kv[0];
  }));
});

app.get('/applications/:applicationId', function(req,res) {
  var app = applications[req.params.applicationId];
  if (app) {
    res.json({state: app.machine.getMachineState()});
  } else {
    res.sendStatus(404);
  }
});


app.delete('/applications/:applicationId', function(req,res) {
  var app = applications[req.params.applicationId];
  if (delete applications[req.params.applicationId]) {
    app.delete(function(err) {
      if (err) {
        res.sendStatus(500);
      } else {
        res.sendStatus(204);
      }
    });
  } else {
    res.sendStatus(404);
  }
});

app.get('/applications/:applicationId/logs', function(req,res) {
  var app = applications[req.params.applicationId];
  if (app) {
    res.json(app.logger.entries);
  } else {
    res.sendStatus(404);
  }
});

if (! fs.existsSync("applications")) {
  fs.mkdirSync("applications");
} else {
  fs.readdirSync("applications").forEach(function(applicationName) {
    var app = application(applicationName);
    applications[applicationName] = app;
    app.load();
  });
}


module.exports = app;
