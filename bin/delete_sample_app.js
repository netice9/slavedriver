#!/usr/bin/env node

var rest = require('restler');

rest.del('http://localhost:3456/applications/app1').on('complete', function(data, response) {
  if (response.statusCode == 204) {
    console.log('ok');
  } else {
    console.log('not ok %j', response.statusCode);
  }
});


