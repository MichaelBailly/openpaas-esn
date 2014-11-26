'use strict';

var extend = require('extend');
var Schema = require('mongoose').Schema;
var Tuple = require('./tuple-schema');
var uuid = require('node-uuid');

function validateTuple(tuple) {
  if (!tuple) { return false; }
  if (! ('objectType' in tuple)) { return false; }
  if (! ('id' in tuple)) { return false; }
  if (typeof tuple.objectType !== 'string') { return false; }
  return true;
}

var collaborationBaseSchema = {
  creator: {type: Schema.ObjectId, ref: 'User'},
  domain_ids: [
  {type: Schema.ObjectId, ref: 'Domain'}
  ],
  timestamps: {
    creation: {type: Date, default: Date.now}
  },
  members: [
  {
    member: {type: Tuple.tree, required: true, validate: [validateTuple, 'Bad subject tuple']},
    status: {type: String},
    timestamps: {
      creation: {type: Date, default: Date.now}
    }
  }
  ],
  activity_stream: {
    uuid: {type: String},
    timestamps: {
      creation: {type: Date, default: Date.now}
    }
  },
  injections: [
  {
    key: {type: String, required: true},
    values: [
    {
      directive: {type: String, required: true},
      attributes:
      [{
        name: {type: String, required: true},
        value: {type: String, required: true}
      }]
    }
    ]
  }
  ],
  schemaVersion: {type: Number, default: 1}
};

function buildBaseCollaborationSchema(json) {
  var schema = extend(true, collaborationBaseSchema, json);
  var CollaborationSchema = new Schema(schema);
  CollaborationSchema.pre('save', function(next) {
    this.activity_stream = this.activity_stream || {};
    if (!this.activity_stream.uuid) {
      this.activity_stream.uuid = uuid.v4();
    }
    next();
  });

  CollaborationSchema.statics = {
    getFromActivityStreamID: function(id, cb) {
      if (!id) {
        return cb(new Error('Activity stream id can not be null'));
      }
      this.findOne({'activity_stream.uuid': id}).exec(cb);
    }
  };
  return CollaborationSchema;
}

module.exports = buildBaseCollaborationSchema;
