'use strict';

var mockery = require('mockery'),
    chai = require('chai'),
    path = require('path'),
    fs = require('fs-extra'),
    helpers = require('../helpers'),
    apiHelpers = require('../api-helpers'),
    moduleHelpers = require('../module-helpers');
var testConfig = require('../config/servers-conf.js');

before(function() {
  chai.use(require('chai-shallow-deep-equal'));
  chai.use(require('sinon-chai'));
  chai.use(require('chai-as-promised'));
  var basePath = path.resolve(__dirname + '/../..');
  var tmpPath = path.resolve(basePath, testConfig.tmp);
  this.testEnv = {
    serversConfig: testConfig,
    basePath: basePath,
    tmp: tmpPath,
    fixtures: path.resolve(__dirname + '/fixtures'),
    mongoUrl: 'mongodb://' + testConfig.mongodb.host + ':' + testConfig.mongodb.port + '/' + testConfig.mongodb.dbname,
    redisUrl: 'redis://' + testConfig.redis.host + ':' + testConfig.redis.port,
    writeDBConfigFile: function() {
      fs.writeFileSync(tmpPath + '/db.json', JSON.stringify({connectionString: 'mongodb://' + testConfig.mongodb.host + ':' + testConfig.mongodb.port + '/' + testConfig.mongodb.dbname, connectionOptions: {auto_reconnect: false}}));
    },
    removeDBConfigFile: function() {
      if (fs.existsSync(tmpPath + '/db.json')) {
        fs.unlinkSync(tmpPath + '/db.json');
      }
    },
    initCore: function(callback) {
      var core = require(basePath + '/backend/core');
      core.init(function() {
        if (callback) {
          process.nextTick(callback);
        }
      });
      return core;
    },
    initRedisConfiguration: function(mongoose, callback) {
      var configuration = require('../../backend/core/esn-config');

      mongoose.Promise = require('q').Promise; // http://mongoosejs.com/docs/promises.html
      mongoose.connect(this.mongoUrl);
      var self = this;

      mongoose.connection.on('open', function() {
        configuration('redis').store({url: self.redisUrl}, function(err) {
          if (err) {
            console.log('Error while saving redis configuration', err);
            return callback(err);
          }

          callback();
        });
      });
    }
  };

  this.helpers = {};
  helpers(this.helpers, this.testEnv);
  moduleHelpers(this.helpers, this.testEnv);
  apiHelpers(this.helpers, this.testEnv);

  process.env.NODE_CONFIG = this.testEnv.tmp;
  process.env.NODE_ENV = 'test';

  fs.copySync(this.testEnv.fixtures + '/default.mongoAuth.json', this.testEnv.tmp + '/default.json');
});

after(function() {
  try {
    fs.unlinkSync(this.testEnv.tmp + '/default.json');
  } catch (e) {
    console.error(e);
  }
  delete process.env.NODE_CONFIG;
  delete process.env.NODE_ENV;
});

// https://github.com/mfncooper/mockery/issues/34
before(function() {
  require('canvas');
});

beforeEach(function() {
  mockery.enable({warnOnReplace: false, warnOnUnregistered: false, useCleanCache: true});
  this.testEnv.writeDBConfigFile();
});

afterEach(function(done) {
  try {
    this.helpers.requireBackend('core/db/mongo/file-watcher').clear();
    this.testEnv.removeDBConfigFile();
  } catch (e) {
    console.error(e);
  }
  mockery.resetCache();
  mockery.deregisterAll();
  mockery.disable();
  this.helpers.requireBackend('core/pubsub').global.unsetClient(done);
});
