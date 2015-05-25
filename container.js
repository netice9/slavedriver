'use strict';

var docker = require('./docker');
var async = require('async');
var _ = require('lodash');
var util = require('util');
var events = require("events");
var fs = require('fs');

function Container(name, config, fileName) {

  events.EventEmitter.call(this);

  this.name = name;
  this.config = config;
  this.fileName = fileName;


  this.state = "not running";


  this.delete = function(callback) {
    var container = docker.getContainer(this.containerId);
    container.remove({force: true}, function(err) {
      if (err) {
        return callback(err);
      }
      fs.unlink(this.fileName, callback);
    }.bind(this));
  }

  this.fetchImage = function(callback) {

    if (!callback) {
      callback = function(){};
    }

    this.state = "fetching image";

    async.series([
      function(cb) {
        fs.readFile(this.fileName, function(err, data) {
          if (err) {
            this.containerId = null;
            console.log("no container id");
          } else {
            this.containerId = data.toString();
          }
          cb();
        }.bind(this));
      }.bind(this),
      function(cb) {
        if (this.containerId) {
          var container = docker.getContainer(this.containerId);
          container.inspect(function(err, data) {
            if (err) {
              this.containerId = null;
            }
            cb();
          }.bind(this));
        } else {
          cb();
        }
      }.bind(this),
      function(cb) {
        if (this.containerId) {
          cb();
        } else {
          docker.listImages(function(err,data) {
            if (err) {
              this.emit('failure', 'fetchImage', this.name, err);
              cb(err);
            } else {
              var tags = {}
              data.forEach(function(image) {
                (image.RepoTags || []).forEach(function(tag) {
                  tags[tag] = true;
                });
              });

              if (!tags[config.image]) {
                docker.pull(config.image, {authconfig: config.authconfig}, function(err, stream) {
                  if (err) {
                    this.emit('failure', 'fetchImage', this.name, err);
                    cb(err);
                  } else {
                    docker.modem.followProgress(stream, function(err) {
                      if (err) {
                        this.emit('failure', 'fetchImage', this.name, err);
                        cb(err);
                      } else {
                        this.emit('imageFetched',this.name);
                        cb();
                      }
                    }.bind(this), function(event) {
                    });
                  }
                }.bind(this));
              } else {
                cb();
              }
            }
          }.bind(this));
        }
      }.bind(this)
    ],
    function(err) {
      if (!err) {
        this.state = "fetch image failed";
      } else {
        this.state = "image fetched";
      }

      callback(err);

    }.bind(this));
  }


  this.start = function(callback) {

    if (!callback) {
      callback = function(){};
    }

    this.state = "starting";

    async.series([
      function(cb) {

        if (!this.containerId) {

          var links = (config.links || []);

          var environment = _.pairs(config.environment || {}).map(function(pair){return pair.join('=');});

          var volumesFrom = (config.volumes_from || []);
          var volumes = config.volumes || [];

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
            'Hostname': config.hostname,
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
              'Binds': volumes,
              'PortBindings': portBindings,
              'Links': links,
              'VolumesFrom': volumesFrom,
            }
          };

          docker.createContainer(createContainerConfig, function(err, container) {
            if (err) {
              this.emit('failure', 'createDockerContainer',this.name, err);
              return cb(err);
            } else {
              this.containerId = container.id;
              fs.writeFileSync(this.fileName,container.id);
              this.emit('dockerContainerCreated',this.name);
              return cb();
            }
          }.bind(this)
          );
        } else {
          cb();
        }
      }.bind(this),
      function(cb) {
        var container = docker.getContainer(this.containerId);

        container.inspect(function(err, data) {
          if (err) {
            return cb(err);
          } else {

            if (!data.State.Running) {
              container.start(function(err) {
                if (err) {
                  this.emit('failure', 'startContainer', this.name, err);
                  return cb(err);
                } else {
                  this.emit('started',this.name);
                  return cb();
                }
              }.bind(this))

            } else {
              return cb();
            }
          }
        }.bind(this));
      }.bind(this)
    ], function(err) {
      if (err) {
        this.state = "start failed";
      } else {
        this.state = "running";
      }
      callback(err);
    }.bind(this));
  }

}

util.inherits(Container, events.EventEmitter);

module.exports = {
  Container: Container
};