const assetController = require('../../src/controllers/asset.controller');
const Project = require('../../src/models/project');
const Asset = require('../../src/models/asset');
const { aiService } = require('../../src/services/ai.service');
const fs = require('fs').promises;
const path = require('path');

jest.mock('../../src/services/ai.service', () => ({
  aiService: {
    getAccessibilitySuggestions: jest.fn()
  }
}));

describe('Asset Controller', () => {
  let mockReq;
  let mockRes;
  let testUser;
  let testProject;

  beforeEach(async () => {
    testUser = await createTestUser();
    testProject = await createTestProject({
      owner: testUser._id,
      collaborators: [{
        user: testUser._id,
        role: 'editor'
      }]
    });

    mockReq = {
      user: { id: testUser._id },
      file: {
        originalname: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      },
      body: {
        projectId: testProject._id
      },
      io: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock AI service response
    aiService.getAccessibilitySuggestions.mockResolvedValue({
      altText: 'Test alt text',
      description: 'Test description',
      caption: 'Test caption'
    });
  });

  describe('upload', () => {
    it('should successfully upload an image asset', async () => {
      await assetController.upload(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: expect.objectContaining({
            name: 'test-image.jpg',
            type: 'image',
            project: testProject._id.toString()
          })
        })
      );

      // Verify project was updated
      const updatedProject = await Project.findById(testProject._id);
      expect(updatedProject.assets).toHaveLength(1);

      // Verify socket event was emitted
      expect(mockReq.io.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockReq.io.emit).toHaveBeenCalledWith('asset_uploaded', expect.any(Object));
    });

    it('should handle upload without project access', async () => {
      // Create a project where user is not a collaborator
      const otherProject = await createTestProject();
      mockReq.body.projectId = otherProject._id;

      await assetController.upload(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Access denied'
      });

      // Verify file was cleaned up
      expect(fs.unlink).toHaveBeenCalledWith(mockReq.file.path);
    });

    it('should handle invalid file type', async () => {
      mockReq.file.mimetype = 'application/exe';

      await assetController.upload(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid file type'
      });
    });

    it('should generate optimized versions for images', async () => {
      await assetController.upload(mockReq, mockRes);

      const asset = await Asset.findOne({ name: 'test-image.jpg' });
      expect(asset.optimization).toBeDefined();
      expect(asset.optimization.formats).toHaveLength(5); // Original + WebP + AVIF + 3 responsive sizes
    });

    it('should get AI accessibility suggestions for media', async () => {
      await assetController.upload(mockReq, mockRes);

      expect(aiService.getAccessibilitySuggestions).toHaveBeenCalled();
      const asset = await Asset.findOne({ name: 'test-image.jpg' });
      expect(asset.accessibility).toEqual({
        altText: 'Test alt text',
        description: 'Test description',
        caption: 'Test caption'
      });
    });
  });

  describe('getAsset', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = await createTestAsset({
        project: testProject._id,
        uploader: testUser._id
      });
    });

    it('should successfully retrieve an asset', async () => {
      mockReq.params = { id: testAsset._id };

      await assetController.getAsset(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        asset: expect.objectContaining({
          name: testAsset.name,
          type: testAsset.type
        })
      });
    });

    it('should handle non-existent asset', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };

      await assetController.getAsset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Asset not found'
      });
    });

    it('should handle access denied', async () => {
      // Create asset in a different project
      const otherProject = await createTestProject();
      testAsset.project = otherProject._id;
      await testAsset.save();

      mockReq.params = { id: testAsset._id };

      await assetController.getAsset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Access denied'
      });
    });
  });

  describe('updateAsset', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = await createTestAsset({
        project: testProject._id,
        uploader: testUser._id
      });
    });

    it('should successfully update asset metadata', async () => {
      mockReq.params = { id: testAsset._id };
      mockReq.body = {
        name: 'updated-image.jpg',
        accessibility: {
          altText: 'Updated alt text'
        },
        tags: ['test', 'image']
      };

      await assetController.updateAsset(mockReq, mockRes);

      const updatedAsset = await Asset.findById(testAsset._id);
      expect(updatedAsset.name).toBe('updated-image.jpg');
      expect(updatedAsset.accessibility.altText).toBe('Updated alt text');
      expect(updatedAsset.tags).toEqual(['test', 'image']);

      // Verify socket event
      expect(mockReq.io.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockReq.io.emit).toHaveBeenCalledWith('asset_updated', expect.any(Object));
    });

    it('should handle non-existent asset', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.body = { name: 'updated-image.jpg' };

      await assetController.updateAsset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Asset not found'
      });
    });

    it('should handle access denied', async () => {
      // Remove user's editor role
      testProject.collaborators[0].role = 'viewer';
      await testProject.save();

      mockReq.params = { id: testAsset._id };
      mockReq.body = { name: 'updated-image.jpg' };

      await assetController.updateAsset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Access denied'
      });
    });
  });

  describe('deleteAsset', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = await createTestAsset({
        project: testProject._id,
        uploader: testUser._id
      });
    });

    it('should successfully delete an asset', async () => {
      mockReq.params = { id: testAsset._id };

      await assetController.deleteAsset(mockReq, mockRes);

      // Verify asset was deleted
      const deletedAsset = await Asset.findById(testAsset._id);
      expect(deletedAsset).toBeNull();

      // Verify project was updated
      const updatedProject = await Project.findById(testProject._id);
      expect(updatedProject.assets).toHaveLength(0);

      // Verify socket event
      expect(mockReq.io.to).toHaveBeenCalledWith(`project_${testProject._id}`);
      expect(mockReq.io.emit).toHaveBeenCalledWith('asset_deleted', expect.any(Object));
    });

    it('should handle non-existent asset', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };

      await assetController.deleteAsset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Asset not found'
      });
    });

    it('should handle access denied', async () => {
      // Remove user's editor role
      testProject.collaborators[0].role = 'viewer';
      await testProject.save();

      mockReq.params = { id: testAsset._id };

      await assetController.deleteAsset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Access denied'
      });
    });
  });
});
