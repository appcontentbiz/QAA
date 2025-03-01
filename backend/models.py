from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), default='beginner')  # beginner or advanced
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    github_token = db.Column(db.String(256), nullable=True)
    daily_edits = db.Column(db.Integer, default=0)
    last_edit_date = db.Column(db.Date, nullable=True)
    
    # Relationships
    projects = db.relationship('Project', backref='owner', lazy=True)
    templates = db.relationship('Template', backref='creator', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_edit_limit(self):
        return 25 if self.role == 'advanced' else 10

class Project(db.Model):
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    project_type = db.Column(db.String(20))  # website, mobile, or hybrid
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('templates.id'), nullable=True)
    github_repo = db.Column(db.String(200))
    is_public = db.Column(db.Boolean, default=False)
    
    # Project content
    html_content = db.Column(db.Text)
    css_content = db.Column(db.Text)
    js_content = db.Column(db.Text)
    
    # Relationships
    components = db.relationship('Component', backref='project', lazy=True)
    collaborators = db.relationship('ProjectCollaborator', backref='project', lazy=True)

class Template(db.Model):
    __tablename__ = 'templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50))
    preview_image = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_premium = db.Column(db.Boolean, default=False)
    
    # Template content
    html_content = db.Column(db.Text)
    css_content = db.Column(db.Text)
    js_content = db.Column(db.Text)

class Component(db.Model):
    __tablename__ = 'components'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    component_type = db.Column(db.String(50))  # button, form, nav, etc.
    content = db.Column(db.Text)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    position_x = db.Column(db.Float)
    position_y = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ProjectCollaborator(db.Model):
    __tablename__ = 'project_collaborators'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20))  # viewer, editor, admin
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

class Asset(db.Model):
    __tablename__ = 'assets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    asset_type = db.Column(db.String(20))  # image, video, font, etc.
    url = db.Column(db.String(200), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    metadata = db.Column(db.JSON)  # Store additional metadata like dimensions, format, etc.
