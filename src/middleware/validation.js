const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Middleware to validate request data using express-validator
 */
exports.validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Middleware to validate MongoDB ObjectId
 */
exports.validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid ID format',
        field: paramName
      });
    }
    next();
  };
};

/**
 * Middleware to sanitize and validate pagination parameters
 */
exports.validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  
  // Enforce reasonable limits
  if (page < 1) {
    return res.status(400).json({
      message: 'Page number must be greater than 0'
    });
  }
  
  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Limit must be between 1 and 100'
    });
  }
  
  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };
  
  next();
};

/**
 * Middleware to validate and sanitize sorting parameters
 */
exports.validateSort = (allowedFields) => {
  return (req, res, next) => {
    const { sort } = req.query;
    if (!sort) {
      req.sorting = { createdAt: -1 }; // Default sort
      return next();
    }
    
    const sortFields = sort.split(',');
    const sanitizedSort = {};
    
    for (const field of sortFields) {
      const order = field.startsWith('-') ? -1 : 1;
      const fieldName = field.replace(/^-/, '');
      
      if (!allowedFields.includes(fieldName)) {
        return res.status(400).json({
          message: `Invalid sort field: ${fieldName}`,
          allowedFields
        });
      }
      
      sanitizedSort[fieldName] = order;
    }
    
    req.sorting = sanitizedSort;
    next();
  };
};

/**
 * Middleware to validate and sanitize filter parameters
 */
exports.validateFilters = (allowedFilters) => {
  return (req, res, next) => {
    const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
    const sanitizedFilters = {};
    
    for (const [key, value] of Object.entries(filters)) {
      if (!allowedFilters.includes(key)) {
        return res.status(400).json({
          message: `Invalid filter field: ${key}`,
          allowedFilters
        });
      }
      
      // Handle special filter types
      if (typeof value === 'object') {
        // Range filters
        if (value.$gte !== undefined || value.$lte !== undefined) {
          sanitizedFilters[key] = {};
          if (value.$gte !== undefined) sanitizedFilters[key].$gte = value.$gte;
          if (value.$lte !== undefined) sanitizedFilters[key].$lte = value.$lte;
        }
        // Array filters
        else if (value.$in !== undefined) {
          sanitizedFilters[key] = { $in: value.$in };
        }
      } else {
        sanitizedFilters[key] = value;
      }
    }
    
    req.filters = sanitizedFilters;
    next();
  };
};

/**
 * Middleware to validate file uploads
 */
exports.validateFileUpload = (allowedTypes, maxSize) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return res.status(400).json({
        message: 'No file uploaded'
      });
    }
    
    const files = req.files ? Object.values(req.files).flat() : [req.file];
    
    for (const file of files) {
      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: `Invalid file type: ${file.mimetype}`,
          allowedTypes
        });
      }
      
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          message: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
          maxSize
        });
      }
    }
    
    next();
  };
};

/**
 * Middleware to validate date ranges
 */
exports.validateDateRange = (startField = 'startDate', endField = 'endDate') => {
  return (req, res, next) => {
    const startDate = new Date(req.query[startField]);
    const endDate = new Date(req.query[endField]);
    
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({
        message: `Invalid ${startField} format`
      });
    }
    
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({
        message: `Invalid ${endField} format`
      });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({
        message: `${startField} must be before ${endField}`
      });
    }
    
    // Add validated dates to request
    req.dateRange = {
      startDate,
      endDate
    };
    
    next();
  };
};

/**
 * Middleware to validate search parameters
 */
exports.validateSearch = (searchableFields) => {
  return (req, res, next) => {
    const { q, fields } = req.query;
    
    if (!q) {
      return res.status(400).json({
        message: 'Search query is required'
      });
    }
    
    if (fields) {
      const requestedFields = fields.split(',');
      const invalidFields = requestedFields.filter(field => !searchableFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(400).json({
          message: `Invalid search fields: ${invalidFields.join(', ')}`,
          searchableFields
        });
      }
      
      req.searchFields = requestedFields;
    } else {
      req.searchFields = searchableFields;
    }
    
    req.searchQuery = q;
    next();
  };
};
