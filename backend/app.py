from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime, timedelta
import jwt
import os
from werkzeug.utils import secure_filename
from models import db, User, Project, Template, Component, ProjectCollaborator, Asset
from config import config
import openai
from authlib.integrations.flask_client import OAuth
import boto3
from PIL import Image
import io
import json

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(config['development'])

# Initialize extensions
CORS(app)
db.init_app(app)
migrate = Migrate(app, db)
oauth = OAuth(app)

# Set up OAuth providers
oauth.register(
    name='github',
    client_id=app.config['GITHUB_CLIENT_ID'],
    client_secret=app.config['GITHUB_CLIENT_SECRET'],
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'repo user'},
)

oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# Set up AWS S3
s3 = boto3.client(
    's3',
    aws_access_key_id=app.config['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=app.config['AWS_SECRET_ACCESS_KEY']
)

# OpenAI configuration
openai.api_key = app.config['OPENAI_API_KEY']

def token_required(f):
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({"error": "Token is invalid"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 400
        
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 400
    
    user = User(
        username=data['username'],
        email=data['email'],
        role='beginner'
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        "message": "Registration successful",
        "user": {
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    
    if user and user.check_password(data['password']):
        token = jwt.encode(
            {
                'user_id': user.id,
                'exp': datetime.utcnow() + timedelta(hours=24)
            },
            app.config['JWT_SECRET_KEY'],
            algorithm="HS256"
        )
        return jsonify({
            'token': token,
            'user': {
                'username': user.username,
                'email': user.email,
                'role': user.role
            }
        })
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/oauth/github')
def github_login():
    return oauth.github.authorize_redirect(redirect_uri=url_for('github_callback', _external=True))

@app.route('/oauth/github/callback')
def github_callback():
    token = oauth.github.authorize_access_token()
    resp = oauth.github.get('user', token=token)
    profile = resp.json()
    # Handle GitHub user data and create/update user
    return jsonify({"message": "GitHub authentication successful"})

@app.route('/projects', methods=['GET', 'POST'])
@token_required
def handle_projects(current_user):
    if request.method == 'GET':
        projects = Project.query.filter_by(user_id=current_user.id).all()
        return jsonify([{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'project_type': p.project_type,
            'created_at': p.created_at.isoformat()
        } for p in projects])
    
    data = request.json
    project = Project(
        name=data['name'],
        description=data.get('description', ''),
        project_type=data['project_type'],
        user_id=current_user.id,
        template_id=data.get('template_id')
    )
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'project_type': project.project_type
    }), 201

@app.route('/projects/<int:project_id>/components', methods=['GET', 'POST'])
@token_required
def handle_components(current_user, project_id):
    project = Project.query.get_or_404(project_id)
    
    if project.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    if request.method == 'GET':
        components = Component.query.filter_by(project_id=project_id).all()
        return jsonify([{
            'id': c.id,
            'name': c.name,
            'component_type': c.component_type,
            'content': c.content,
            'position_x': c.position_x,
            'position_y': c.position_y
        } for c in components])
    
    data = request.json
    component = Component(
        name=data['name'],
        component_type=data['component_type'],
        content=data['content'],
        project_id=project_id,
        position_x=data.get('position_x', 0),
        position_y=data.get('position_y', 0)
    )
    db.session.add(component)
    db.session.commit()
    
    return jsonify({
        'id': component.id,
        'name': component.name,
        'component_type': component.component_type,
        'content': component.content
    }), 201

@app.route('/generate-code', methods=['POST'])
@token_required
def generate_code(current_user):
    data = request.json
    prompt = data.get('prompt', '')
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates high-quality, modern code based on user requirements."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        return jsonify({
            "generated_code": response.choices[0].message.content,
            "remaining_edits": current_user.get_edit_limit() - current_user.daily_edits
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/upload-asset', methods=['POST'])
@token_required
def upload_asset(current_user):
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
        
    file = request.files['file']
    project_id = request.form.get('project_id')
    
    if not project_id:
        return jsonify({"error": "Project ID is required"}), 400
    
    project = Project.query.get_or_404(project_id)
    if project.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        
        # Process image if it's an image file
        if file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
            img = Image.open(file)
            # Resize if needed
            if img.size[0] > 1200 or img.size[1] > 1200:
                img.thumbnail((1200, 1200))
            
            # Save to BytesIO
            img_io = io.BytesIO()
            img.save(img_io, format=img.format)
            img_io.seek(0)
            
            # Upload to S3
            s3.upload_fileobj(
                img_io,
                app.config['AWS_BUCKET_NAME'],
                f"projects/{project_id}/assets/{filename}",
                ExtraArgs={'ContentType': f'image/{img.format.lower()}'}
            )
        else:
            # Upload original file for non-image assets
            s3.upload_fileobj(
                file,
                app.config['AWS_BUCKET_NAME'],
                f"projects/{project_id}/assets/{filename}"
            )
        
        # Create asset record
        asset = Asset(
            name=filename,
            asset_type='image' if file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')) else 'other',
            url=f"https://{app.config['AWS_BUCKET_NAME']}.s3.amazonaws.com/projects/{project_id}/assets/{filename}",
            project_id=project_id
        )
        db.session.add(asset)
        db.session.commit()
        
        return jsonify({
            "message": "Asset uploaded successfully",
            "asset": {
                "id": asset.id,
                "name": asset.name,
                "url": asset.url
            }
        })
    
    return jsonify({"error": "Invalid file type"}), 400

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
