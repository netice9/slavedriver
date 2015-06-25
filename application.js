'use strict';

var docker = require('./docker');
var async = require('async');
var _ = require('lodash');
var DepGraph = require('dependency-graph').DepGraph;

var dateFormat = require('dateformat');
var util = require('util');
var events = require("events");
var container = require("./container");
var mkdirp = require('mkdirp');
var fs = require('fs');
var rmrf = require('rmrf');

function Logger() {

  this.entries = [];

  this.log = function(serverity, message) {
    var time = new Date();
    this.entries.push([time, serverity, message]);
    console.log("%s %s: %s", dateFormat(time), serverity, message);
  }

  this.info = this.log.bind(this,"info");
  this.error = this.log.bind(this,"error");
}


function Application(name) {

  this.name = name;

  this.applicationDir = "applications/"+name;

  var that = this;

  this.logger = new Logger();

  this.containers = {};


  this.load = function() {
    this.config = JSON.parse(fs.readFileSync(this.applicationDir+"/config.json", "utf8"));
    this.start();
  }


  this.status = function() {
    var status = {};
    _.pairs(this.containers).forEach(function(kv) {
      status[kv[0]]={
        state: kv[1].state,
        container_id: kv[1].containerId
      };
    });
    return status;
  }


  this.start = function() {

    var config = this.config;

    var prefixApplicationName = function(name) {
      return this.name + "." + name;
    }.bind(this);

    _.pairs(config.containers).forEach(function(kv) {
      var containerName = prefixApplicationName(kv[0]);
      var containerConfig = JSON.parse(JSON.stringify(kv[1]));
      containerConfig.volumes_from = (containerConfig.volumes_from || []).map(prefixApplicationName);
      containerConfig.links = (containerConfig.links || []).map(prefixApplicationName);
      var fileName = this.applicationDir+"/containers/"+containerName + ".id";


      var c = new container.Container(containerName, containerConfig, fileName);

      c.on('failure', function(operation, containerName, err) {
        console.log("container %s error operation: %s: %j", containerName, operation, err);
      });

      this.containers[kv[0]] = c;

    }.bind(this));


    async.series([
      function(cb) {
        async.each(_.values(this.containers), function(container, cb2) {
          container.fetchImage(cb2);
        }, cb);
      }.bind(this),
      function(cb) {
        var graph = new DepGraph();
        _.keys(config.containers).forEach(function(containerName){ graph.addNode(containerName); });

        _.pairs(config.containers).forEach(function(p) {
          var name = p[0];
          var container = p[1];
          var deps = (container.links || []).map(function(link){return link.split(/:/)[0]});
          deps.forEach(function(dep) { graph.addDependency(name, dep); });
        });

        this.overallOrder = graph.overallOrder();

        async.eachSeries(this.overallOrder, function(containerName, cb2) {
          this.containers[containerName].start(cb2);
        }.bind(this), cb);
      }.bind(this)
    ]);

  };

  this.create = function(config) {

    mkdirp.sync(this.applicationDir);
    mkdirp.sync(this.applicationDir+"/containers");
    fs.writeFileSync(this.applicationDir+"/config.json", JSON.stringify(config, null, 2));

    this.config = config;

    this.start();

  };


  this.delete = function(callback) {
    async.eachSeries(this.overallOrder, function(containerName, cb) {
      this.containers[containerName].delete(cb);
    }.bind(this), function(err) {
      if (err) {
        return callback(err);
      }
      rmrf(this.applicationDir);
      callback();
    }.bind(this));

  }
}

module.exports = function(applicationConfig) {
  return new Application(applicationConfig);
};
