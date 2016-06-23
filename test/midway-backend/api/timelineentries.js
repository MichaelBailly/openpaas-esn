'use strict';

var expect = require('chai').expect;
var request = require('supertest');
var q = require('q');

describe('The timelineentries API', function() {

  var ENDPOINT = '/api/timelineentries';
  var user, user2, userId, message, message2, community, email, webserver, helpers;

  beforeEach(function(done) {
    var self = this;

    helpers = this.helpers;
    this.mongoose = require('mongoose');
    this.testEnv.initRedisConfiguration(this.mongoose, this.helpers.callbacks.noErrorAnd(function() {
      self.testEnv.initCore(function() {
        webserver = helpers.requireBackend('webserver').webserver;
        var Whatsup = self.helpers.requireBackend('core/db/mongo/models/whatsup');

        function saveMessage(message) {
          var defer = q.defer();
          message.save(function(err, saved) {
            if (err) {
              return defer.reject(err);
            }
            if (saved) {
              message._id = saved._id;
            }
            defer.resolve(saved);
          });
          return defer.promise;
        }

        self.helpers.api.applyDomainDeployment('linagora_IT', function(err, models) {
          if (err) {
            return done(err);
          }
          user = models.users[0];
          user2 = models.users[1];
          userId = user._id;
          community = models.communities[0];
          email = user.emails[0];

          message = new Whatsup({
            author: user._id,
            content: 'This is my message',
            objectType: 'whatsup',
            shares: [{
              objectType: 'activitystream',
              id: community.activity_stream.uuid
            }]
          });

          message2 = new Whatsup({
            author: user2._id,
            content: 'This is another message',
            objectType: 'whatsup',
            shares: [{
              objectType: 'activitystream',
              id: community.activity_stream.uuid
            }]
          });

          q.all([saveMessage(message), saveMessage(message2)]).then(function() {
            done();
          }, done);
        });
      });
    }));
  });

  afterEach(function(done) {
    this.mongoose.connection.db.dropDatabase();
    this.mongoose.disconnect(done);
  });

  describe('GET /api/user/timelineentries', function() {

    beforeEach(function() {
      var asModule = this.helpers.requireBackend('core/activitystreams');
      this.createTimelineEntry = function(entry) {
        return q.denodeify(asModule.addTimelineEntry)(entry);
      };
    });

    it('should send back 401 when not logged in', function(done) {
      helpers.api.requireLogin(webserver.application, 'get', ENDPOINT, done);
    });

    it('should send back the current user timeline entries', function(done) {
      var self = this;
      function check() {
        self.helpers.api.loginAsUser(webserver.application, email, 'secret', self.helpers.callbacks.noErrorAnd(function(loggedInAsUser) {
          loggedInAsUser(request(webserver.application)
            .get(ENDPOINT))
            .query()
            .expect(200)
            .end(helpers.callbacks.noErrorAnd(function(res) {
              expect(res.body).to.shallowDeepEqual([
                {
                  verb: 'follow',
                  actor: {
                    _id: String(user._id),
                    objectType: 'user'
                  },
                  object: {
                    _id: String(user2._id),
                    objectType: 'user'
                  }
                },
                {
                  verb: 'like',
                  actor: {
                    _id: String(user._id),
                    objectType: 'user'
                  },
                  object: {
                    _id: String(message2._id),
                    objectType: message2.objectType
                  }
                },
                {
                  verb: 'post',
                  actor: {
                    _id: String(user._id),
                    objectType: 'user'
                  },
                  object: {
                    _id: String(message._id),
                    objectType: message.objectType
                  }
                }
              ]);
              done();
            }));
        }));
      }

      var date = new Date();

      q.all([
        self.createTimelineEntry({published: new Date(date.setSeconds(10)), verb: 'post', actor: {objectType: 'user', _id: String(user._id)}, object: {objectType: 'whatsup', _id: String(message._id)}}),
        self.createTimelineEntry({published: new Date(date.setSeconds(15)), verb: 'like', actor: {objectType: 'user', _id: String(user._id)}, object: {objectType: 'whatsup', _id: String(message2._id)}}),
        self.createTimelineEntry({published: new Date(date.setSeconds(20)), verb: 'like', actor: {objectType: 'user', _id: String(user2._id)}, object: {objectType: 'whatsup', _id: String(message._id)}}),
        self.createTimelineEntry({published: new Date(date.setSeconds(25)), verb: 'follow', actor: {objectType: 'user', _id: String(user._id)}, object: {objectType: 'user', _id: String(user2._id)}}),
        self.createTimelineEntry({published: new Date(date.setSeconds(30)), verb: 'foo', actor: {objectType: 'user', _id: String(user2._id)}, object: {objectType: 'user', _id: String(user2._id)}}),
        self.createTimelineEntry({published: new Date(date.setSeconds(35)), verb: 'bar', actor: {objectType: 'user', _id: String(user2._id)}, object: {objectType: 'user', _id: String(user2._id)}})
      ]).then(check, done);

    });

    describe('When liking messages', function() {

      beforeEach(function() {
        var likeModule = this.helpers.requireBackend('core/like');
        this.likeMessage = function(user, message) {
          return likeModule.like({objectType: 'user', id: String(user._id)}, {objectType: 'esn.message', id: String(message._id)});
        };
      });

      it('should send back the timelineentries containing the messages liked by a user', function(done) {
        var self = this;
        var verb = 'like';

        function check() {

          process.nextTick(function() {
            self.helpers.api.loginAsUser(webserver.application, email, 'secret', self.helpers.callbacks.noErrorAnd(function(loggedInAsUser) {
              loggedInAsUser(request(webserver.application)
                .get(ENDPOINT))
                .query({verb: verb})
                .expect(200)
                .end(helpers.callbacks.noErrorAnd(function(res) {
                  expect(res.body).to.shallowDeepEqual([
                    {
                      verb: verb,
                      actor: {
                        _id: String(user._id),
                        objectType: 'user'
                      },
                      object: {
                        _id: String(message2._id),
                        objectType: message2.objectType
                      }
                    },
                    {
                      verb: verb,
                      actor: {
                        _id: String(user._id),
                        objectType: 'user'
                      },
                      object: {
                        _id: String(message._id),
                        objectType: message.objectType
                      }
                    }
                  ]);
                  done();
                }));
            }));
          });
        }

        self.likeMessage(user, message)
          .then(function() {
            return self.likeMessage(user, message2);
          })
          .then(function() {
            return self.likeMessage(user2, message2);
          })
          .then(check)
          .catch(done);
      });
    });
  });
});
