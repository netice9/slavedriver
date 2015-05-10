'use strict';

var docker = require('./docker');
var async = require('async');
var _ = require('lodash');
var DepGraph = require('dependency-graph').DepGraph;

var dateFormat = require('dateformat');
var util = require('util');
var events = require("events");
var container = require("./container");

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


function Application(config) {

  var that = this;

  this.logger = new Logger();

  this.containers = {};

  var prefixApplicationName = function(name) {
    return config.name + "." + name;
  };

  _.pairs(config.containers).forEach(function(kv) {
    var containerName = prefixApplicationName(kv[0]);
    var containerConfig = JSON.parse(JSON.stringify(kv[1]));
    containerConfig.volumes_from = (containerConfig.volumes_from || []).map(prefixApplicationName);
    containerConfig.links = (containerConfig.links || []).map(prefixApplicationName);
    var fileName = containerName + ".id";
    this.containers[kv[0]]=new container.Container(containerName, containerConfig, fileName);
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

      _.pairs(config.containers).forEach(function(name, container) {
          var deps = (container.links || []).map(function(link){return link.split(/:/)[0]});
          deps.forEach(function(dep) { graph.addDependency(name, dep); });
      });

      var overallOrder = graph.overallOrder();

      // that.logger.info("start order: "+JSON.stringify(overallOrder));
      console.log("start order: "+JSON.stringify(overallOrder));

      async.eachSeries(overallOrder, function(containerName, cb2) {
        this.containers[containerName].start(cb2);
      }.bind(this), cb);
    }.bind(this)
  ]);
}


module.exports = function(applicationConfig) {
  return new Application(applicationConfig);
};
