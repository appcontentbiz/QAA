const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ['image', 'video', 'audio', 'document', 'other']
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    url: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    metadata: {
      size: Number,
      mimeType: String,
      dimensions: {
        width: Number,
        height: Number
      },
      duration: Number, // for video/audio
      thumbnail: String
    },
    usage: [{
      component: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Component'
      },
      usageType: {
        type: String,
        enum: ['background', 'content', 'icon', 'other']
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    tags: [String],
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active'
    },
    accessibility: {
      altText: String,
      description: String,
      caption: String
    },
    optimization: {
      compressed: {
        type: Boolean,
        default: false
      },
      formats: [{
        type: String,
        url: String,
        size: Number
      }],
      quality: {
        type: Number,
        min: 1,
        max: 100
      }
    }
  },
  {
    timestamps: true
  }
);

// Middleware to handle file deletion
assetSchema.pre('remove', async function(next) {
  try {
    // Remove file from storage
    await fs.unlink(this.path);
    
    // Remove thumbnails if they exist
    if (this.metadata.thumbnail) {
      await fs.unlink(this.metadata.thumbnail);
    }
    
    // Remove optimized versions
    for (const format of this.optimization.formats) {
      await fs.unlink(format.url);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to add usage
assetSchema.methods.addUsage = function(componentId, usageType) {
  if (!this.usage.some(u => u.component.equals(componentId))) {
    this.usage.push({
      component: componentId,
      usageType
    });
  }
};

// Method to remove usage
assetSchema.methods.removeUsage = function(componentId) {
  this.usage = this.usage.filter(u => !u.component.equals(componentId));
};

// Method to update accessibility
assetSchema.methods.updateAccessibility = function(altText, description, caption) {
  this.accessibility = {
    altText,
    description,
    caption
  };
};

// Method to add optimized format
assetSchema.methods.addOptimizedFormat = function(type, url, size) {
  this.optimization.formats.push({
    type,
    url,
    size
  });
  this.optimization.compressed = true;
};

const Asset = mongoose.model('Asset', assetSchema);

module.exports = Asset;
