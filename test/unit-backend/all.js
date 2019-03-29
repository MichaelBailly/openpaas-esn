'use strict';

var mockery = require('mockery'),
    chai = require('chai'),
    path = require('path'),
    fs = require('fs-extra'),
    helpers = require('../helpers');
var testConfig = require('../config/servers-conf.js');

before(function() {
  chai.use(require('chai-shallow-deep-equal'));
  chai.use(require('sinon-chai'));
  chai.use(require('chai-as-promised'));
  var basePath = path.resolve(__dirname + '/../..');
  var tmpPath = path.resolve(basePath, testConfig.tmp);
  this.testEnv = {
    basePath: basePath,
    tmp: tmpPath,
    fixtures: path.resolve(__dirname + '/fixtures'),
    initCore: function(callback) {
      var core = require(basePath + '/backend/core');
      core.init();
      if (callback) {
        callback();
      }
      return core;
    }
  };
  this.helpers = {};
  helpers(this.helpers, this.testEnv);

  this.helpers.objectIdMock = function(stringId) {
    return {
      value: function() {
        return stringId;
      },
      equals: function(otherObjectId) {
        return stringId === otherObjectId.value();
      }
    };
  };

  process.env.NODE_CONFIG = this.testEnv.tmp;
  process.env.NODE_ENV = 'test';
  fs.copySync(__dirname + '/default.test.json', this.testEnv.tmp + '/default.json');
});

after(function() {
  delete process.env.NODE_CONFIG;
  fs.unlinkSync(this.testEnv.tmp + '/default.json');
});

// https://github.com/mfncooper/mockery/issues/34
before(function() {
  require('canvas');
});

beforeEach(function() {
  mockery.enable({warnOnReplace: false, warnOnUnregistered: false, useCleanCache: true});
  mockery.registerMock('winston', {
    createLogger: () => ({
      stream: {},
      ...this.helpers.requireFixture('logger-noop')()
    }),
    transports: {},
    format: {
      printf: () => {},
      splat: () => {},
      combine: () => {},
      colorize: () => {},
      timestamp: () => {}
    },
    Transport: require('winston-transport'),
    version: '3.0.0'
  });
});

afterEach(function() {
  mockery.resetCache();
  mockery.deregisterAll();
  mockery.disable();
});
