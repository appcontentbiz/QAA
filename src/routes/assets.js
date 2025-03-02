const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const assetController = require('../controllers/asset.controller');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { checkProjectAccess } = require('../middleware/project');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_PATH || 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Validate file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
  }
});

// Validation schemas
const assetUpdateValidation = [
  body('name').optional().trim().notEmpty(),
  body('accessibility').optional().isObject(),
  body('tags').optional().isArray()
];

// Apply authentication middleware to all routes
router.use(requireAuth);

// Asset routes
router.post('/upload',
  upload.single('file'),
  [body('projectId').isMongoId()],
  validateRequest,
  assetController.upload
);

router.get('/:id',
  assetController.getAsset
);

router.put('/:id',
  assetUpdateValidation,
  validateRequest,
  assetController.updateAsset
);

router.delete('/:id',
  assetController.deleteAsset
);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    return res.status(400).json({ message: error.message });
  }
  
  if (error.message === 'Invalid file type') {
    return res.status(400).json({ message: 'Invalid file type' });
  }
  
  next(error);
});

module.exports = router;
