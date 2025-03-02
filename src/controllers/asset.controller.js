const Asset = require('../models/asset');
const Project = require('../models/project');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { aiService } = require('../services/ai.service');

class AssetController {
  // Upload new asset
  async upload(req, res) {
    try {
      const { projectId } = req.body;
      const userId = req.user.id;
      const file = req.file;

      // Check project access
      const project = await Project.findById(projectId);
      if (!project.hasAccess(userId, 'editor')) {
        await fs.unlink(file.path); // Clean up uploaded file
        return res.status(403).json({ message: 'Access denied' });
      }

      // Determine asset type
      const type = this.getAssetType(file.mimetype);
      const assetId = uuidv4();
      const extension = path.extname(file.originalname);
      const fileName = `${assetId}${extension}`;

      // Create asset paths
      const assetDir = path.join(process.env.UPLOAD_PATH, projectId);
      await fs.mkdir(assetDir, { recursive: true });
      const assetPath = path.join(assetDir, fileName);

      // Move uploaded file to final location
      await fs.rename(file.path, assetPath);

      // Process asset based on type
      const metadata = await this.processAsset(type, assetPath, file);

      // Create asset record
      const asset = new Asset({
        name: file.originalname,
        type,
        project: projectId,
        uploader: userId,
        url: `/assets/${projectId}/${fileName}`,
        path: assetPath,
        metadata
      });

      // If it's an image, generate optimized versions
      if (type === 'image') {
        const optimizedVersions = await this.generateOptimizedVersions(assetPath, assetDir, assetId);
        asset.optimization = {
          compressed: true,
          formats: optimizedVersions,
          quality: 80
        };
      }

      // Get AI-generated accessibility suggestions
      if (['image', 'video'].includes(type)) {
        const aiSuggestions = await aiService.getAccessibilitySuggestions({
          type,
          name: file.originalname,
          metadata
        });

        asset.accessibility = {
          altText: aiSuggestions.altText,
          description: aiSuggestions.description,
          caption: aiSuggestions.caption
        };
      }

      await asset.save();

      // Update project
      project.assets.push(asset._id);
      await project.save();

      // Emit socket event
      req.io.to(`project_${projectId}`).emit('asset_uploaded', {
        projectId,
        asset: {
          id: asset._id,
          name: asset.name,
          type: asset.type,
          url: asset.url
        }
      });

      res.status(201).json({ asset });
    } catch (error) {
      console.error('Asset upload error:', error);
      // Clean up uploaded file if it exists
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ message: 'Server error during asset upload' });
    }
  }

  // Get asset
  async getAsset(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const asset = await Asset.findById(id)
        .populate('uploader', 'name email')
        .populate('usage.component', 'name type');

      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      // Check project access
      const project = await Project.findById(asset.project);
      if (!project.hasAccess(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ asset });
    } catch (error) {
      console.error('Get asset error:', error);
      res.status(500).json({ message: 'Server error while fetching asset' });
    }
  }

  // Update asset metadata
  async updateAsset(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.id;

      const asset = await Asset.findById(id);
      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      // Check project access
      const project = await Project.findById(asset.project);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update allowed fields
      ['name', 'accessibility', 'tags'].forEach(field => {
        if (updates[field]) {
          asset[field] = updates[field];
        }
      });

      await asset.save();

      // Emit socket event
      req.io.to(`project_${asset.project}`).emit('asset_updated', {
        projectId: asset.project,
        assetId: id,
        updates
      });

      res.json({ asset });
    } catch (error) {
      console.error('Update asset error:', error);
      res.status(500).json({ message: 'Server error while updating asset' });
    }
  }

  // Delete asset
  async deleteAsset(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const asset = await Asset.findById(id);
      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      // Check project access
      const project = await Project.findById(asset.project);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Remove asset from project
      project.assets = project.assets.filter(a => !a.equals(id));
      await project.save();

      // Remove asset and its files
      await asset.remove(); // This triggers the pre-remove middleware

      // Emit socket event
      req.io.to(`project_${asset.project}`).emit('asset_deleted', {
        projectId: asset.project,
        assetId: id
      });

      res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
      console.error('Delete asset error:', error);
      res.status(500).json({ message: 'Server error while deleting asset' });
    }
  }

  // Helper methods
  getAssetType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.includes('pdf') || mimetype.includes('document')) return 'document';
    return 'other';
  }

  async processAsset(type, filePath, file) {
    const metadata = {
      size: file.size,
      mimeType: file.mimetype
    };

    switch (type) {
      case 'image':
        const imageInfo = await sharp(filePath).metadata();
        metadata.dimensions = {
          width: imageInfo.width,
          height: imageInfo.height
        };
        // Generate thumbnail
        const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
        await sharp(filePath)
          .resize(200, 200, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
        metadata.thumbnail = thumbnailPath;
        break;

      case 'video':
        // Here you would use a video processing library like fluent-ffmpeg
        // to extract video metadata and generate thumbnail
        break;

      case 'audio':
        // Here you would use an audio processing library to extract
        // duration and other metadata
        break;
    }

    return metadata;
  }

  async generateOptimizedVersions(originalPath, directory, assetId) {
    const optimizedVersions = [];

    // Generate WebP version
    const webpPath = path.join(directory, `${assetId}.webp`);
    await sharp(originalPath)
      .webp({ quality: 80 })
      .toFile(webpPath);
    optimizedVersions.push({
      type: 'webp',
      url: webpPath,
      size: (await fs.stat(webpPath)).size
    });

    // Generate AVIF version
    const avifPath = path.join(directory, `${assetId}.avif`);
    await sharp(originalPath)
      .avif({ quality: 80 })
      .toFile(avifPath);
    optimizedVersions.push({
      type: 'avif',
      url: avifPath,
      size: (await fs.stat(avifPath)).size
    });

    // Generate responsive sizes
    const sizes = [320, 640, 1280];
    for (const width of sizes) {
      const responsivePath = path.join(directory, `${assetId}_${width}.jpg`);
      await sharp(originalPath)
        .resize(width, null, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(responsivePath);
      optimizedVersions.push({
        type: 'responsive',
        width,
        url: responsivePath,
        size: (await fs.stat(responsivePath)).size
      });
    }

    return optimizedVersions;
  }
}

module.exports = new AssetController();
