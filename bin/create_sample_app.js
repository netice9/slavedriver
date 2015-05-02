#!/usr/bin/env node

var rest = require('restler');

rest.putJson('http://localhost:3456/applications/app1', {
  "pg": {
    "image": "postgres:9.2",

    "tcp_port_bindings": {
      "5432" : "5432"
    },

    "upd_port_bindings": {
      "1234" : "1234"
    }

  },
  "sleeper_1": {
    "image": "ubuntu",
    "command": ["sleep","31337"],
    "links": ["pg:db"],
    "environment": {
      "X": "test"
    },
    "volumes_from": ["pg"]
  },
}).on('complete', function(data, response) {
  if (response.statusCode == 200) {
    console.log('ok');
  } else {
    console.log('not ok %j', response.statusCode);
  }
});


