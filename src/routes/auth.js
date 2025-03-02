const express = require('express');
const { body } = require('express-validator');
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { validateRequest } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/\d/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter'),
  body('name').trim().notEmpty().withMessage('Name is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Auth routes
router.post('/register', registerValidation, validateRequest, authController.register);
router.post('/login', loginValidation, validateRequest, authController.login);
router.get('/verify/:token', authController.verifyEmail);
router.post('/forgot-password', body('email').isEmail(), validateRequest, authController.forgotPassword);
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword')
    .isLength({ min: 6 })
    .matches(/\d/)
    .matches(/[A-Z]/)
], validateRequest, authController.resetPassword);

// OAuth routes
router.post('/google', authController.googleCallback);

// Protected routes
router.use(requireAuth);
router.get('/me', authController.getCurrentUser);
router.put('/profile', [
  body('name').optional().trim().notEmpty(),
  body('preferences').optional().isObject(),
  body('aiSettings').optional().isObject()
], validateRequest, authController.updateProfile);

module.exports = router;
