from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import jwt
import datetime
from functools import wraps
import os
import git

app = Flask(__name__)
CORS(app)

# OpenAI API Key (store securely in production)
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', 'your-api-key-here')
openai.api_key = OPENAI_API_KEY

# Secret key for JWT authentication
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key')

# Mock database
projects_db = []
users_db = {"admin": "password123"}  # Replace with actual database

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({"error": "Token is missing!"}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['user']
        except:
            return jsonify({"error": "Token is invalid!"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/')
def home():
    return jsonify({"message": "Welcome to the Web & Mobile App Builder API"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if users_db.get(username) == password:
        token = jwt.encode(
            {'user': username, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
            app.config['SECRET_KEY'],
            algorithm="HS256"
        )
        return jsonify({'token': token})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/generate-code', methods=['POST'])
@token_required
def generate_code(current_user):
    data = request.json
    prompt = data.get("prompt", "")
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
    
    try:
        response = openai.Completion.create(
            model="code-davinci-002",
            prompt=prompt,
            max_tokens=150
        )
        return jsonify({"generated_code": response.choices[0].text.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/create-project', methods=['POST'])
@token_required
def create_project(current_user):
    data = request.json
    project_name = data.get("project_name")
    project_type = data.get("project_type")
    
    if not project_name or not project_type:
        return jsonify({"error": "Project name and type are required"}), 400
    
    project = {
        "id": len(projects_db) + 1,
        "name": project_name,
        "type": project_type,
        "status": "created",
        "created_by": current_user
    }
    projects_db.append(project)
    
    return jsonify({"message": "Project created successfully", "project": project})

@app.route('/list-projects', methods=['GET'])
@token_required
def list_projects(current_user):
    user_projects = [proj for proj in projects_db if proj["created_by"] == current_user]
    return jsonify({"projects": user_projects})

@app.route('/delete-project', methods=['DELETE'])
@token_required
def delete_project(current_user):
    data = request.json
    project_id = data.get("project_id")
    
    if not project_id:
        return jsonify({"error": "Project ID is required"}), 400
    
    global projects_db
    projects_db = [proj for proj in projects_db if not (proj["id"] == project_id and proj["created_by"] == current_user)]
    return jsonify({"message": "Project deleted successfully", "project_id": project_id})

@app.route('/push-to-github', methods=['POST'])
@token_required
def push_to_github(current_user):
    data = request.json
    repo_path = data.get("repo_path")
    commit_message = data.get("commit_message", "Auto-commit from platform")
    
    if not repo_path:
        return jsonify({"error": "Repository path is required"}), 400
    
    try:
        repo = git.Repo(repo_path)
        if repo.is_dirty(untracked_files=True):
            repo.git.add(A=True)
            repo.index.commit(commit_message)
            origin = repo.remote(name='origin')
            origin.push()
            return jsonify({"message": "Changes pushed to GitHub successfully"})
        else:
            return jsonify({"message": "No changes to commit"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
