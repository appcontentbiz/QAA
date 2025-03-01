from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os
import json
from functools import wraps

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# Simple in-memory storage (replace with database in production)
users = {}
projects = {}
components = {}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token.split(' ')[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            if data['user_id'] not in users:
                raise Exception('User not found')
            current_user = users[data['user_id']]
        except Exception as e:
            return jsonify({'error': 'Token is invalid', 'details': str(e)}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing required fields'}), 400
        
    if any(u['email'] == data['email'] for u in users.values()):
        return jsonify({'error': 'User already exists'}), 400
        
    user_id = str(len(users) + 1)
    user = {
        'id': user_id,
        'email': data['email'],
        'username': data.get('username', data['email']),
        'password_hash': generate_password_hash(data['password']),
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    
    users[user_id] = user
    
    return jsonify({'message': 'User created successfully', 'user_id': user_id}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    user = next((u for u in users.values() if u['email'] == data['email']), None)
    
    if not user or not check_password_hash(user['password_hash'], data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    token = jwt.encode({
        'user_id': user['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
    }, app.config['SECRET_KEY'])
    
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'username': user['username']
        }
    })

@app.route('/projects', methods=['GET', 'POST'])
@token_required
def handle_projects(current_user):
    if request.method == 'GET':
        user_projects = {k: v for k, v in projects.items() 
                        if v['owner_id'] == current_user['id']}
        return jsonify(list(user_projects.values()))
    
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Project name is required'}), 400
    
    project_id = str(len(projects) + 1)
    project = {
        'id': project_id,
        'name': data['name'],
        'description': data.get('description', ''),
        'owner_id': current_user['id'],
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    
    projects[project_id] = project
    
    return jsonify(project), 201

@app.route('/projects/<project_id>/components', methods=['GET', 'POST'])
@token_required
def handle_project_components(current_user, project_id):
    if project_id not in projects:
        return jsonify({'error': 'Project not found'}), 404
        
    if projects[project_id]['owner_id'] != current_user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if request.method == 'GET':
        project_components = {k: v for k, v in components.items() 
                            if v['project_id'] == project_id}
        return jsonify(list(project_components.values()))
    
    data = request.get_json()
    if not data or not data.get('name') or not data.get('type'):
        return jsonify({'error': 'Component name and type are required'}), 400
    
    component_id = str(len(components) + 1)
    component = {
        'id': component_id,
        'name': data['name'],
        'type': data['type'],
        'content': data.get('content'),
        'styles': data.get('styles', {}),
        'position': data.get('position', {}),
        'project_id': project_id,
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    
    components[component_id] = component
    
    return jsonify(component), 201

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.datetime.utcnow().isoformat()})

if __name__ == '__main__':
    # Add some error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({'error': 'Internal server error'}), 500

    app.run(debug=True)
