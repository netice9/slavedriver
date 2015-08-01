'use strict';

var fs = require("fs");
var application = require('./application');
var express = require('express');
var bodyParser = require('body-parser')
var _ = require('lodash');
var auth = require('./http-auth');

var applications = {};
var app = express();
var docker = require('./docker');

var applications = {};

if (process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD) {
  app.use(auth(process.env.AUTH_USERNAME, process.env.AUTH_PASSWORD, 'Slavedriver'));
}


app.post('/build_and_push', function(req,res) {
  var buildUsername = req.query.build_registry_username;
  var buildPassword = req.query.build_registry_password;
  var buildAuthConfig = null;
  if (buildUsername && buildPassword) {
    buildAuthConfig = {username: buildUsername, password: buildPassword}
  }

  var pushUsername = req.query.push_registry_username;
  var pushPassword = req.query.push_registry_password;
  var pushAuthConfig = null;
  if (pushUsername && pushPassword) {
    pushAuthConfig = {username: pushUsername, password: pushPassword}
  }

  var tag = req.query.tag;

  var opts = {
    t: tag,
    nocache: true,
    rm: true,
    memory: req.query.memory,
    memswap: req.query.memswap,
    cpushares: req.query.cpushares,
    cpusetcpus: req.query.cpusetcpus,
    authconfig: buildAuthConfig
  }

  docker.buildImage(req, opts, function(err, stream) {
    if (err) {
      console.log("build failed %j",{message: err.message, back: err.back});
      res.status(500).json({message: err.message, back: err.back});
      return;
    } else {
      console.log("building ...");
      res.status(200);
      stream.pipe(res,{end: false});
      docker.modem.followProgress(stream, function onFinished(err, output) {
        if (err) {
          res.end();
        } else  {
          var image = docker.getImage(tag);
          image.push({}, function(err, output) {
            if (err) {
              res.json({errorDetail: {"code": 127, message: err.back}, error: err.message});
            } else {
              output.pipe(res);
            }
          }, pushAuthConfig);
        }
      }, function onProgress() {});



    }
  }, buildAuthConfig);
});

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
    res.json({status: app.status()});
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
