const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    collaborators: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['viewer', 'editor', 'admin'],
        default: 'viewer'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    components: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Component'
    }],
    assets: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset'
    }],
    settings: {
      visibility: {
        type: String,
        enum: ['private', 'public', 'team'],
        default: 'private'
      },
      aiAssistance: {
        enabled: {
          type: Boolean,
          default: true
        },
        model: {
          type: String,
          default: 'gpt-4'
        }
      },
      theme: {
        type: String,
        default: 'default'
      }
    },
    metadata: {
      tags: [String],
      category: String,
      framework: String,
      version: String
    },
    statistics: {
      views: {
        type: Number,
        default: 0
      },
      lastAccessed: Date,
      totalComponents: {
        type: Number,
        default: 0
      },
      aiInteractions: {
        type: Number,
        default: 0
      }
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Middleware to update statistics
projectSchema.pre('save', function(next) {
  if (this.components) {
    this.statistics.totalComponents = this.components.length;
  }
  next();
});

// Method to check if user has access
projectSchema.methods.hasAccess = function(userId, requiredRole = 'viewer') {
  if (this.owner.equals(userId)) return true;
  
  const collaborator = this.collaborators.find(c => c.user.equals(userId));
  if (!collaborator) return false;
  
  const roles = ['viewer', 'editor', 'admin'];
  return roles.indexOf(collaborator.role) >= roles.indexOf(requiredRole);
};

// Method to add collaborator
projectSchema.methods.addCollaborator = function(userId, role = 'viewer') {
  if (this.collaborators.some(c => c.user.equals(userId))) {
    throw new Error('User is already a collaborator');
  }
  
  this.collaborators.push({
    user: userId,
    role: role
  });
};

// Method to remove collaborator
projectSchema.methods.removeCollaborator = function(userId) {
  this.collaborators = this.collaborators.filter(c => !c.user.equals(userId));
};

// Method to update collaborator role
projectSchema.methods.updateCollaboratorRole = function(userId, newRole) {
  const collaborator = this.collaborators.find(c => c.user.equals(userId));
  if (!collaborator) {
    throw new Error('User is not a collaborator');
  }
  collaborator.role = newRole;
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
