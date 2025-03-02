const express = require('express');
const { body, query } = require('express-validator');
const projectController = require('../controllers/project.controller');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { checkProjectAccess } = require('../middleware/project');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const projectValidation = [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('description').optional().trim(),
  body('settings').optional().isObject(),
  body('metadata').optional().isObject()
];

const collaboratorValidation = [
  body('action').isIn(['add', 'remove', 'update']),
  body('userId').isMongoId(),
  body('role').optional().isIn(['viewer', 'editor', 'admin'])
];

const queryValidation = [
  query('status').optional().isIn(['active', 'archived', 'deleted']),
  query('sort').optional().matches(/^[a-zA-Z]+:(asc|desc)$/),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

// Project routes
router.post('/',
  projectValidation,
  validateRequest,
  projectController.create
);

router.get('/',
  queryValidation,
  validateRequest,
  projectController.getAllProjects
);

router.get('/:id',
  checkProjectAccess('viewer'),
  projectController.getProject
);

router.put('/:id',
  checkProjectAccess('editor'),
  projectValidation,
  validateRequest,
  projectController.updateProject
);

router.delete('/:id',
  checkProjectAccess('admin'),
  projectController.deleteProject
);

// Collaborator management
router.post('/:id/collaborators',
  checkProjectAccess('admin'),
  collaboratorValidation,
  validateRequest,
  projectController.manageCollaborators
);

// Statistics
router.get('/:id/statistics',
  checkProjectAccess('viewer'),
  projectController.getStatistics
);

module.exports = router;
