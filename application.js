'use strict';

var docker = require('./docker');
var Stately = require('stately.js');
var async = require('async');
var _ = require('lodash');
var DepGraph = require('dependency-graph').DepGraph;

var dateFormat = require('dateformat');

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


  var images = _.values(config.containers).map(function(container) { return container.image; });


  var that = this;

  this.logger = new Logger();

  this.containers = {};

  this.machine = Stately.machine({

    INITIAL: {
      start: function() {
        return this.FETCHING_IMAGES;
      }
    },

    FETCHING_IMAGES: {
    },

    CREATING_CONTAINERS: {
    },

    STARTING_CONTAINERS: {

    },

    RUNNING: {

    },

    SHUTTING_DOWN: {

    },

    TERMINATED: {

    },

    ERROR: {

    }


  });


  this.machine.onFETCHING_IMAGES = function() {

    that.logger.info("fetching images");

    async.each(images, function(image, callback) {
      that.logger.info("pulling "+image);
      docker.pull(image, callback);
    }, function(err) {
      if (err) {
        that.logger.error(err);
        return this.setMachineState(this.SHUTTING_DOWN);
      } else {
        this.setMachineState(this.CREATING_CONTAINERS);
      }
    }.bind(this));

    return this.FETCHING_IMAGES;
  };

  this.machine.onCREATING_CONTAINERS = function() {
    that.logger.info("creating containers");

    var graph = new DepGraph();

    _.keys(config.containers).forEach(function(containerName){ graph.addNode(containerName); });

    _.pairs(config.containers).forEach(function(name, container) {
      var deps = (container.links || []).map(function(link){return link.split(/:/)[0]});

      deps.forEach(function(dep) { graph.addDependency(name, dep); });

    });

    that.logger.info("start order: "+JSON.stringify(graph.overallOrder()));

    async.mapSeries(graph.overallOrder(), function(containerToStart, callback) {
      var container = config.containers[containerToStart];
      var containerName = config.name + "." + containerToStart;

      var links = (container.links || []).map(function(link){ return config.name + "." + link});


      var environment = _.pairs(container.environment || {}).map(function(pair){return pair.join('=');});

      var volumesFrom = (container.volumes_from || []).map(function(v) {return config.name+"."+v});

      var portBindings = {};

      _.pairs(container.tcp_port_bindings || {}).forEach(function(pair) {
        var key =  pair[0]+"/tcp"
        var value = [{"HostPort": pair[1]}]
        portBindings[key] = value;
      });

      _.pairs(container.udp_port_bindings || {}).forEach(function(pair) {
        var key =  pair[0]+"/udp"
        var value = [{"HostPort": pair[1]}]
        portBindings[key] = value;
      });

      var createContainerConfig = {
        name: containerName,
        'Hostname': '',
        'User': '',
        'AttachStdin': false,
        'AttachStdout': true,
        'AttachStderr': true,
        'Tty': true,
        'OpenStdin': false,
        'StdinOnce': false,
        'Env': environment,
        'Cmd': container.command,
        'Image': container.image,
        'Volumes': {},

        'HostConfig': {
          'PortBindings': portBindings,
          'Links': links,
          'VolumesFrom': volumesFrom,
        }
      };
      that.logger.info("createOptions options: " + JSON.stringify(createContainerConfig));
      docker.createContainer(createContainerConfig, function(err, container) {
        if (!err) {
          that.containers[containerName] = container;
        }
        callback(err, container);
      });
    }.bind(this), function(err, containers) {
      if (err) {
        that.logger.error(err);
        return this.setMachineState(this.SHUTTING_DOWN);
      } else {
        return this.setMachineState(this.STARTING_CONTAINERS);
      }
    }.bind(this));

  };

  this.machine.onSTARTING_CONTAINERS = function() {
    that.logger.info("starting containers");
    async.eachSeries(_.values(that.containers), function(container, callback) {
      that.logger.info("starting container " + container.id);
      container.start(callback);
    }, function(err) {
      if (err) {
        that.logger.error(err);
        return this.setMachineState(this.SHUTTING_DOWN);
      } else {
        return this.setMachineState(this.RUNNING);
      }
    }.bind(this));
  };

  this.machine.onRUNNING = function() {
    that.logger.info("containers are running");
  }

  this.machine.onSHUTTING_DOWN = function() {
    that.logger.info("shutting down")
    async.each(_.values(that.containers), function(container, callback) {
      container.remove({force: true}, callback);
    }.bind(this), function(err) {
      if (err) {
        return this.setMachineState(this.ERROR);
      }
      that.containers = [];
      this.setMachineState(this.TERMINATED);
    }.bind(this));
  }

  this.machine.start();

}


module.exports = function(applicationConfig) {
  return new Application(applicationConfig);
};
