const Project = require('../models/project');
const Component = require('../models/component');
const Asset = require('../models/asset');
const { aiService } = require('../services/ai.service');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const projectFileService = require('../services/project-file.service');

class ProjectController {
  // Create new project
  async create(req, res) {
    try {
      const { name, description, settings, metadata, template } = req.body;
      const userId = req.user.id;

      // Create project in database
      const project = await Project.create({
        name,
        description,
        owner: userId,
        settings,
        metadata
      });

      // Initialize project files and structure
      const projectFiles = await projectFileService.initializeProject({
        userId,
        projectId: project._id,
        projectName: name,
        description,
        template
      });

      project.localPath = projectFiles.projectPath;
      await project.save();

      // If AI assistance is enabled, get AI suggestions
      if (settings?.aiAssistance?.enabled) {
        const aiSuggestions = await aiService.getProjectSuggestions({
          name,
          description,
          metadata
        });
        project.aiSuggestions = aiSuggestions;
      }

      await project.save();

      // Emit socket event for real-time updates
      req.io.emit('project_created', {
        projectId: project._id,
        name: project.name,
        owner: userId
      });

      res.status(201).json({ project });
    } catch (error) {
      console.error('Project creation error:', error);
      res.status(500).json({ message: 'Server error during project creation' });
    }
  }

  // Get all projects for user
  async getAllProjects(req, res) {
    try {
      const userId = req.user.id;
      const { status, sort, page = 1, limit = 10 } = req.query;

      const query = {
        $or: [
          { owner: userId },
          { 'collaborators.user': userId },
          { 'settings.visibility': 'public' }
        ]
      };

      if (status) {
        query.status = status;
      }

      const sortOptions = {};
      if (sort) {
        const [field, order] = sort.split(':');
        sortOptions[field] = order === 'desc' ? -1 : 1;
      } else {
        sortOptions.createdAt = -1;
      }

      const projects = await Project.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('owner', 'name email')
        .populate('collaborators.user', 'name email')
        .lean();

      const total = await Project.countDocuments(query);

      res.json({
        projects,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ message: 'Server error while fetching projects' });
    }
  }

  // Get single project
  async getProject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const project = await Project.findById(id)
        .populate('owner', 'name email')
        .populate('collaborators.user', 'name email')
        .populate({
          path: 'components',
          populate: {
            path: 'creator',
            select: 'name email'
          }
        })
        .populate('assets');

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Check access
      if (!project.hasAccess(userId) && project.settings.visibility !== 'public') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update statistics
      project.statistics.views += 1;
      project.statistics.lastAccessed = new Date();
      await project.save();

      res.json({ project });
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ message: 'Server error while fetching project' });
    }
  }

  // Update project
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Check permissions
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Apply updates
      Object.keys(updates).forEach(key => {
        if (key !== '_id' && key !== 'owner') {
          project[key] = updates[key];
        }
      });

      // If AI assistance is enabled, get updated suggestions
      if (project.settings?.aiAssistance?.enabled) {
        const aiSuggestions = await aiService.getProjectSuggestions({
          name: project.name,
          description: project.description,
          metadata: project.metadata
        });
        project.aiSuggestions = aiSuggestions;
      }

      await project.save();

      // Emit socket event
      req.io.to(`project_${id}`).emit('project_updated', {
        projectId: id,
        updates
      });

      res.json({ project });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ message: 'Server error while updating project' });
    }
  }

  // Delete project
  async deleteProject(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const userId = req.user.id;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Check ownership
      if (!project.owner.equals(userId)) {
        return res.status(403).json({ message: 'Only project owner can delete' });
      }

      // Delete associated components
      await Component.deleteMany({ project: id }, { session });

      // Delete associated assets
      const assets = await Asset.find({ project: id });
      for (const asset of assets) {
        await asset.remove({ session }); // This triggers the pre-remove middleware
      }

      await Project.findByIdAndDelete(id, { session });

      await session.commitTransaction();

      // Emit socket event
      req.io.emit('project_deleted', { projectId: id });

      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      await session.abortTransaction();
      console.error('Delete project error:', error);
      res.status(500).json({ message: 'Server error while deleting project' });
    } finally {
      session.endSession();
    }
  }

  // Manage collaborators
  async manageCollaborators(req, res) {
    try {
      const { id } = req.params;
      const { action, userId, role } = req.body;
      const currentUserId = req.user.id;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Check permissions
      if (!project.owner.equals(currentUserId)) {
        return res.status(403).json({ message: 'Only project owner can manage collaborators' });
      }

      switch (action) {
        case 'add':
          project.addCollaborator(userId, role);
          break;
        case 'remove':
          project.removeCollaborator(userId);
          break;
        case 'update':
          project.updateCollaboratorRole(userId, role);
          break;
        default:
          return res.status(400).json({ message: 'Invalid action' });
      }

      await project.save();

      // Emit socket event
      req.io.to(`project_${id}`).emit('collaborator_updated', {
        projectId: id,
        action,
        userId,
        role
      });

      res.json({ project });
    } catch (error) {
      console.error('Manage collaborators error:', error);
      res.status(500).json({ message: 'Server error while managing collaborators' });
    }
  }

  // Get project statistics
  async getStatistics(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Check access
      if (!project.hasAccess(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const stats = {
        views: project.statistics.views,
        components: project.statistics.totalComponents,
        aiInteractions: project.statistics.aiInteractions,
        lastAccessed: project.statistics.lastAccessed,
        collaborators: project.collaborators.length,
        assets: (await Asset.countDocuments({ project: id })),
        activityTimeline: await getProjectActivity(id)
      };

      res.json({ statistics: stats });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ message: 'Server error while fetching statistics' });
    }
  }

  // Deploy project
  async deployProject(req, res) {
    try {
      const { projectId } = req.params;
      const { platform, config } = req.body;
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      let deploymentResult;

      switch (platform) {
        case 'github':
          deploymentResult = await projectFileService.deployToGitHub(
            project.localPath,
            config
          );
          break;
        case 'netlify':
          deploymentResult = await projectFileService.deployToNetlify(
            project.localPath,
            config
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Unsupported deployment platform'
          });
      }

      // Update project with deployment info
      project.deployments = project.deployments || [];
      project.deployments.push({
        platform,
        url: deploymentResult.url,
        deployedAt: new Date()
      });
      await project.save();

      res.json({
        success: true,
        deployment: deploymentResult
      });
    } catch (error) {
      console.error('Deploy project error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deploy project'
      });
    }
  }

  // Helper function to get project activity
  async getProjectActivity(projectId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const components = await Component.find({
      project: projectId,
      updatedAt: { $gte: oneWeekAgo }
    }).select('updatedAt version');

    const assets = await Asset.find({
      project: projectId,
      updatedAt: { $gte: oneWeekAgo }
    }).select('updatedAt');

    return {
      components: components.map(c => ({
        date: c.updatedAt,
        type: 'component',
        version: c.version.current
      })),
      assets: assets.map(a => ({
        date: a.updatedAt,
        type: 'asset'
      }))
    };
  }
}

module.exports = new ProjectController();
