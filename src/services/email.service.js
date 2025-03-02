const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Initialize template cache
    this.templateCache = new Map();
  }

  // Load and cache email template
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(__dirname, '../templates/email', `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    this.templateCache.set(templateName, template);
    return template;
  }

  // Send email using template
  async sendEmail({ to, subject, template, context }) {
    try {
      const compiledTemplate = await this.loadTemplate(template);
      const html = compiledTemplate(context);

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Failed to send email');
    }
  }

  // Send verification email
  async sendVerificationEmail(user, verificationToken) {
    return this.sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      template: 'verification',
      context: {
        name: user.name,
        verificationUrl: `${process.env.FRONTEND_URL}/verify/${verificationToken}`
      }
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    return this.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      template: 'resetPassword',
      context: {
        name: user.name,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
      }
    });
  }

  // Send project invitation email
  async sendProjectInvitation(user, project, invitedBy) {
    return this.sendEmail({
      to: user.email,
      subject: `You've been invited to collaborate on ${project.name}`,
      template: 'projectInvitation',
      context: {
        name: user.name,
        projectName: project.name,
        invitedByName: invitedBy.name,
        acceptUrl: `${process.env.FRONTEND_URL}/projects/${project._id}/accept-invitation`
      }
    });
  }

  // Send project update notification
  async sendProjectUpdateNotification(user, project, update) {
    return this.sendEmail({
      to: user.email,
      subject: `Update in project ${project.name}`,
      template: 'projectUpdate',
      context: {
        name: user.name,
        projectName: project.name,
        updateType: update.type,
        updateDetails: update.details,
        projectUrl: `${process.env.FRONTEND_URL}/projects/${project._id}`
      }
    });
  }

  // Send AI suggestion notification
  async sendAISuggestionNotification(user, component, suggestions) {
    return this.sendEmail({
      to: user.email,
      subject: 'New AI Suggestions Available',
      template: 'aiSuggestions',
      context: {
        name: user.name,
        componentName: component.name,
        suggestions: suggestions.map(s => ({
          type: s.type,
          improvement: s.improvement
        })),
        componentUrl: `${process.env.FRONTEND_URL}/components/${component._id}`
      }
    });
  }

  // Send weekly project digest
  async sendWeeklyDigest(user, projectStats) {
    return this.sendEmail({
      to: user.email,
      subject: 'Your Weekly Project Digest',
      template: 'weeklyDigest',
      context: {
        name: user.name,
        stats: projectStats,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
      }
    });
  }
}

module.exports = {
  emailService: new EmailService()
};
