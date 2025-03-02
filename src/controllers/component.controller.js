const Component = require('../models/component');
const Project = require('../models/project');
const { aiService } = require('../services/ai.service');
const { validationResult } = require('express-validator');

class ComponentController {
  // Create component
  async create(req, res) {
    try {
      const {
        name,
        type,
        projectId,
        content,
        position,
        dimensions,
        styles
      } = req.body;
      const userId = req.user.id;

      // Check project access
      const project = await Project.findById(projectId);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const component = new Component({
        name,
        type,
        project: projectId,
        creator: userId,
        content,
        position,
        dimensions,
        styles
      });

      // If type is ai-generated, get AI assistance
      if (type === 'ai-generated') {
        const aiResponse = await aiService.generateComponent({
          name,
          type,
          content,
          projectContext: {
            name: project.name,
            description: project.description
          }
        });

        component.content = aiResponse.content;
        component.aiMetadata = {
          generated: true,
          prompt: aiResponse.prompt,
          model: aiResponse.model,
          confidence: aiResponse.confidence
        };

        // Get AI suggestions for improvement
        const suggestions = await aiService.getComponentSuggestions(component);
        component.aiMetadata.suggestions = suggestions;
      }

      await component.save();

      // Update project
      project.components.push(component._id);
      project.statistics.totalComponents += 1;
      if (type === 'ai-generated') {
        project.statistics.aiInteractions += 1;
      }
      await project.save();

      // Emit socket event
      req.io.to(`project_${projectId}`).emit('component_created', {
        projectId,
        component: {
          id: component._id,
          name: component.name,
          type: component.type
        }
      });

      res.status(201).json({ component });
    } catch (error) {
      console.error('Component creation error:', error);
      res.status(500).json({ message: 'Server error during component creation' });
    }
  }

  // Get component
  async getComponent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const component = await Component.findById(id)
        .populate('creator', 'name email')
        .populate({
          path: 'dependencies.component',
          select: 'name type'
        });

      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ component });
    } catch (error) {
      console.error('Get component error:', error);
      res.status(500).json({ message: 'Server error while fetching component' });
    }
  }

  // Update component
  async updateComponent(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.id;

      const component = await Component.findById(id);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Apply updates
      Object.keys(updates).forEach(key => {
        if (key !== '_id' && key !== 'project' && key !== 'creator') {
          component[key] = updates[key];
        }
      });

      // If content or styles changed, get new AI suggestions
      if (updates.content || updates.styles) {
        const suggestions = await aiService.getComponentSuggestions(component);
        component.aiMetadata.suggestions = suggestions;
      }

      await component.save();

      // Emit socket event
      req.io.to(`project_${component.project}`).emit('component_updated', {
        projectId: component.project,
        componentId: id,
        updates
      });

      res.json({ component });
    } catch (error) {
      console.error('Update component error:', error);
      res.status(500).json({ message: 'Server error while updating component' });
    }
  }

  // Delete component
  async deleteComponent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const component = await Component.findById(id);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Remove component from project
      project.components = project.components.filter(c => !c.equals(id));
      project.statistics.totalComponents -= 1;
      await project.save();

      // Remove component
      await component.remove();

      // Emit socket event
      req.io.to(`project_${component.project}`).emit('component_deleted', {
        projectId: component.project,
        componentId: id
      });

      res.json({ message: 'Component deleted successfully' });
    } catch (error) {
      console.error('Delete component error:', error);
      res.status(500).json({ message: 'Server error while deleting component' });
    }
  }

  // Get component version history
  async getVersionHistory(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const component = await Component.findById(id)
        .populate('version.history.author', 'name email');

      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ history: component.version.history });
    } catch (error) {
      console.error('Get version history error:', error);
      res.status(500).json({ message: 'Server error while fetching version history' });
    }
  }

  // Revert to version
  async revertToVersion(req, res) {
    try {
      const { id, versionNumber } = req.params;
      const userId = req.user.id;

      const component = await Component.findById(id);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      component.revertToVersion(parseInt(versionNumber));
      await component.save();

      // Emit socket event
      req.io.to(`project_${component.project}`).emit('component_reverted', {
        projectId: component.project,
        componentId: id,
        versionNumber
      });

      res.json({ component });
    } catch (error) {
      console.error('Revert version error:', error);
      res.status(500).json({ message: 'Server error while reverting version' });
    }
  }

  // Add interaction
  async addInteraction(req, res) {
    try {
      const { id } = req.params;
      const { event, action, targetId, parameters } = req.body;
      const userId = req.user.id;

      const component = await Component.findById(id);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId, 'editor')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      component.addInteraction(event, action, targetId, parameters);
      await component.save();

      // Emit socket event
      req.io.to(`project_${component.project}`).emit('interaction_added', {
        projectId: component.project,
        componentId: id,
        interaction: { event, action, targetId, parameters }
      });

      res.json({ component });
    } catch (error) {
      console.error('Add interaction error:', error);
      res.status(500).json({ message: 'Server error while adding interaction' });
    }
  }

  // Get AI suggestions
  async getAISuggestions(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const component = await Component.findById(id);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Check project access
      const project = await Project.findById(component.project);
      if (!project.hasAccess(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const suggestions = await aiService.getComponentSuggestions(component);
      component.aiMetadata.suggestions = suggestions;
      await component.save();

      res.json({ suggestions });
    } catch (error) {
      console.error('Get AI suggestions error:', error);
      res.status(500).json({ message: 'Server error while fetching AI suggestions' });
    }
  }
}

module.exports = new ComponentController();
