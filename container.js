'use strict';

var docker = require('./docker');
var async = require('async');
var _ = require('lodash');
var util = require('util');
var events = require("events");

function Container(name, config) {

  events.EventEmitter.call(this);

  this.name = name;
  this.config = config;

  this.fetchImage = function(callback) {

    if (!callback) {
      callback = function(){};
    }

    docker.pull(config.image, {authconfig: config.authconfig}, function(err, stream) {
      if (err) {
        this.emit('failure', 'fetchImage', this.name, err);
        callback(err);
      } else {
        docker.modem.followProgress(stream, function(err) {
          if (err) {
            this.emit('failure', 'fetchImage', this.name, err);
            callback(err);
          } else {
            this.emit('imageFetched',this.name);
            callback();
          }
        }.bind(this), function(event) {
        });
      }
    }.bind(this));

  }

  this.createDockerContainer = function(callback) {

    if (!callback) {
      callback = function(){};
    }

    var links = (config.links || []);

    var environment = _.pairs(config.environment || {}).map(function(pair){return pair.join('=');});

    var volumesFrom = (config.volumes_from || []);

    var portBindings = {};

    _.pairs(config.tcp_port_bindings || {}).forEach(function(pair) {
      var key =  pair[0]+"/tcp"
      var value = [{"HostPort": pair[1]}]
      portBindings[key] = value;
    });

    _.pairs(config.udp_port_bindings || {}).forEach(function(pair) {
      var key =  pair[0]+"/udp"
      var value = [{"HostPort": pair[1]}]
      portBindings[key] = value;
    });

    var createContainerConfig = {
      name: name,
      'Hostname': '',
      'User': '',
      'AttachStdin': false,
      'AttachStdout': true,
      'AttachStderr': true,
      'Tty': true,
      'OpenStdin': false,
      'StdinOnce': false,
      'Env': environment,
      'Cmd': config.command,
      'Image': config.image,
      'Volumes': {},

      'HostConfig': {
        'PortBindings': portBindings,
        'Links': links,
        'VolumesFrom': volumesFrom,
      }
    };

    docker.createContainer(createContainerConfig, function(err, container) {
      if (err) {
        this.emit('failure', 'createDockerContainer',this.name, err);
        callback(err);
      } else {
        this.container = container;
        this.emit('dockerContainerCreated',this.name);
        callback();
      }
    }.bind(this));
  };

  this.start = function(callback) {

    if (!callback) {
      callback = function(){};
    }

    this.container.start(function(err) {
      if (err) {
        this.emit('failure', 'startContainer', this.name, err);
        callback(err);
      } else {
        this.emit('started',this.name);
        callback();
      }
    }.bind(this));
  }

}


util.inherits(Container, events.EventEmitter);



module.exports = {
  Container: Container
};