const express = require('express');
const { body } = require('express-validator');
const componentController = require('../controllers/component.controller');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { checkProjectAccess } = require('../middleware/project');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const componentValidation = [
  body('name').trim().notEmpty().withMessage('Component name is required'),
  body('type').isIn([
    'container',
    'text',
    'image',
    'button',
    'form',
    'custom',
    'ai-generated'
  ]),
  body('projectId').isMongoId(),
  body('content').optional().isObject(),
  body('position').optional().isObject(),
  body('dimensions').optional().isObject(),
  body('styles').optional().isObject()
];

const interactionValidation = [
  body('event').notEmpty(),
  body('action').notEmpty(),
  body('targetId').optional().isMongoId(),
  body('parameters').optional().isObject()
];

// Component routes
router.post('/',
  componentValidation,
  validateRequest,
  componentController.create
);

router.get('/:id',
  componentController.getComponent
);

router.put('/:id',
  componentValidation,
  validateRequest,
  componentController.updateComponent
);

router.delete('/:id',
  componentController.deleteComponent
);

// Version control
router.get('/:id/versions',
  componentController.getVersionHistory
);

router.post('/:id/revert/:versionNumber',
  componentController.revertToVersion
);

// Interactions
router.post('/:id/interactions',
  interactionValidation,
  validateRequest,
  componentController.addInteraction
);

// AI suggestions
router.get('/:id/suggestions',
  componentController.getAISuggestions
);

module.exports = router;
