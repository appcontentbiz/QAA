const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../services/email.service');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      user = new User({
        email,
        password,
        name,
        verificationToken
      });

      await user.save();

      // Send verification email
      await sendEmail({
        to: email,
        subject: 'Verify your email',
        template: 'verification',
        context: {
          name,
          verificationUrl: `${process.env.FRONTEND_URL}/verify/${verificationToken}`
        }
      });

      // Generate JWT
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
      );

      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
      );

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          preferences: user.preferences,
          aiSettings: user.aiSettings,
          isVerified: user.isVerified
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      const user = await User.findOne({ verificationToken: token });
      if (!user) {
        return res.status(400).json({ message: 'Invalid verification token' });
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Server error during email verification' });
    }
  }

  // Request password reset
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Send reset email
      await sendEmail({
        to: email,
        subject: 'Reset your password',
        template: 'resetPassword',
        context: {
          name: user.name,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
        }
      });

      res.json({ message: 'Password reset email sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error during password reset request' });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      const user = await User.findOne({
        resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error during password reset' });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { name, preferences, aiSettings } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (name) user.name = name;
      if (preferences) user.preferences = { ...user.preferences, ...preferences };
      if (aiSettings) user.aiSettings = { ...user.aiSettings, ...aiSettings };

      await user.save();

      res.json({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          preferences: user.preferences,
          aiSettings: user.aiSettings
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Server error during profile update' });
    }
  }

  // OAuth callbacks
  async googleCallback(req, res) {
    try {
      const { token } = req.body;
      // Verify Google token and get user info
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();

      let user = await User.findOne({ googleId: payload.sub });
      if (!user) {
        user = new User({
          email: payload.email,
          name: payload.name,
          googleId: payload.sub,
          isVerified: true,
          password: crypto.randomBytes(32).toString('hex')
        });
        await user.save();
      }

      const jwtToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
      );

      res.json({
        token: jwtToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Google callback error:', error);
      res.status(500).json({ message: 'Server error during Google authentication' });
    }
  }

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id).select('-password');
      res.json({ user });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: 'Server error while fetching user data' });
    }
  }
}

module.exports = new AuthController();
