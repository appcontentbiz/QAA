const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ['container', 'text', 'image', 'button', 'form', 'custom', 'ai-generated']
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      html: String,
      css: String,
      javascript: String,
      assets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
      }]
    },
    position: {
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      },
      z: {
        type: Number,
        default: 0
      }
    },
    dimensions: {
      width: {
        type: String,
        default: 'auto'
      },
      height: {
        type: String,
        default: 'auto'
      }
    },
    styles: {
      type: Map,
      of: String,
      default: {}
    },
    interactions: [{
      event: String,
      action: String,
      target: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Component'
      },
      parameters: mongoose.Schema.Types.Mixed
    }],
    aiMetadata: {
      generated: {
        type: Boolean,
        default: false
      },
      prompt: String,
      model: String,
      confidence: Number,
      suggestions: [{
        type: String,
        improvement: String,
        confidence: Number
      }]
    },
    version: {
      current: {
        type: Number,
        default: 1
      },
      history: [{
        number: Number,
        changes: mongoose.Schema.Types.Mixed,
        timestamp: Date,
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }]
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    dependencies: [{
      component: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Component'
      },
      type: {
        type: String,
        enum: ['parent', 'child', 'sibling', 'reference']
      }
    }]
  },
  {
    timestamps: true
  }
);

// Middleware to handle version control
componentSchema.pre('save', function(next) {
  if (this.isModified('content') || this.isModified('styles')) {
    const currentVersion = this.version.current;
    this.version.history.push({
      number: currentVersion,
      changes: {
        content: this.content,
        styles: this.styles
      },
      timestamp: new Date(),
      author: this.creator
    });
    this.version.current += 1;
  }
  next();
});

// Method to get specific version
componentSchema.methods.getVersion = function(versionNumber) {
  const version = this.version.history.find(v => v.number === versionNumber);
  if (!version) {
    throw new Error('Version not found');
  }
  return version;
};

// Method to revert to version
componentSchema.methods.revertToVersion = function(versionNumber) {
  const version = this.getVersion(versionNumber);
  this.content = version.changes.content;
  this.styles = version.changes.styles;
  this.version.current += 1;
};

// Method to add interaction
componentSchema.methods.addInteraction = function(event, action, target, parameters = {}) {
  this.interactions.push({
    event,
    action,
    target,
    parameters
  });
};

// Method to update AI metadata
componentSchema.methods.updateAIMetadata = function(prompt, model, confidence) {
  this.aiMetadata = {
    ...this.aiMetadata,
    generated: true,
    prompt,
    model,
    confidence
  };
};

// Method to add AI suggestion
componentSchema.methods.addAISuggestion = function(type, improvement, confidence) {
  this.aiMetadata.suggestions.push({
    type,
    improvement,
    confidence
  });
};

const Component = mongoose.model('Component', componentSchema);

module.exports = Component;
