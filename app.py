from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, List
import jwt
import datetime
from passlib.context import CryptContext

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security configuration
SECRET_KEY = "dev-secret-key"  # In production, use environment variable
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# In-memory storage
users: Dict[str, dict] = {}
projects: Dict[str, dict] = {}
components: Dict[str, dict] = {}

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: Optional[str] = None

class User(BaseModel):
    id: str
    email: EmailStr
    username: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    created_at: str

class ComponentCreate(BaseModel):
    name: str
    type: str
    content: Optional[str] = None
    styles: Optional[dict] = {}
    position: Optional[dict] = {}

# Helper functions
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id not in users:
            raise HTTPException(status_code=401, detail="Invalid user")
        return users[user_id]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Routes
@app.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    if any(u["email"] == user.email for u in users.values()):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(len(users) + 1)
    user_data = {
        "id": user_id,
        "email": user.email,
        "username": user.username or user.email,
        "password_hash": get_password_hash(user.password),
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    users[user_id] = user_data
    
    return {
        "id": user_data["id"],
        "email": user_data["email"],
        "username": user_data["username"]
    }

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = next((u for u in users.values() if u["email"] == form_data.username), None)
    if not user or not pwd_context.verify(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = jwt.encode(
        {"sub": user["id"], "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1)},
        SECRET_KEY
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/projects", response_model=List[Project])
async def get_projects(current_user: dict = Depends(get_current_user)):
    user_projects = {k: v for k, v in projects.items() if v["owner_id"] == current_user["id"]}
    return list(user_projects.values())

@app.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    project_id = str(len(projects) + 1)
    project_data = {
        "id": project_id,
        "name": project.name,
        "description": project.description,
        "owner_id": current_user["id"],
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    projects[project_id] = project_data
    return project_data

@app.get("/projects/{project_id}/components", response_model=List[dict])
async def get_project_components(project_id: str, current_user: dict = Depends(get_current_user)):
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")
    if projects[project_id]["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    project_components = {k: v for k, v in components.items() if v["project_id"] == project_id}
    return list(project_components.values())

@app.post("/projects/{project_id}/components", status_code=status.HTTP_201_CREATED)
async def create_component(
    project_id: str,
    component: ComponentCreate,
    current_user: dict = Depends(get_current_user)
):
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")
    if projects[project_id]["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    component_id = str(len(components) + 1)
    component_data = {
        "id": component_id,
        **component.dict(),
        "project_id": project_id,
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    components[component_id] = component_data
    return component_data

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
