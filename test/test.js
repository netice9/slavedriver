/*global describe, it */
'use strict';
var assert = require('assert');
var dockerTug = require('../');

describe('docker-tug node module', function () {
  it('must have at least one test', function () {
    dockerTug();
    assert(false, 'I was too lazy to write any tests. Shame on me.');
  });
});
