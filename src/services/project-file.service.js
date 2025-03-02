const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { Octokit } = require('@octokit/rest');
const NetlifyAPI = require('netlify');

class ProjectFileService {
  constructor() {
    this.autoSaveInterval = 30000; // 30 seconds
    this.activeProjects = new Map();
  }

  async initializeProject(projectData) {
    try {
      const { userId, projectId, projectName } = projectData;
      
      // Create project directory structure
      const projectBasePath = path.join(process.env.PROJECTS_ROOT_DIR, userId, projectId);
      const directories = [
        projectBasePath,
        path.join(projectBasePath, 'src'),
        path.join(projectBasePath, 'assets'),
        path.join(projectBasePath, 'docs'),
        path.join(projectBasePath, 'build')
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Initialize git repository
      await execAsync('git init', { cwd: projectBasePath });
      
      // Create initial project files
      await this.createProjectFiles(projectBasePath, projectData);

      // Set up auto-save
      this.setupAutoSave(projectId, projectBasePath);

      return {
        projectPath: projectBasePath,
        gitInitialized: true
      };
    } catch (error) {
      console.error('Project initialization error:', error);
      throw new Error('Failed to initialize project files');
    }
  }

  async createProjectFiles(projectPath, projectData) {
    const { projectName, description, template } = projectData;

    // Create package.json
    const packageJson = {
      name: projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description,
      scripts: {
        start: 'node src/index.js',
        dev: 'nodemon src/index.js',
        build: 'webpack --mode production',
        test: 'jest'
      },
      dependencies: {},
      devDependencies: {}
    };

    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create README.md
    const readme = `# ${projectName}\n\n${description}\n\n## Getting Started\n`;
    await fs.writeFile(path.join(projectPath, 'README.md'), readme);

    // Create .gitignore
    const gitignore = `node_modules/\n.env\ndist/\nbuild/\n.DS_Store\n`;
    await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);

    // Apply template if specified
    if (template) {
      await this.applyProjectTemplate(projectPath, template);
    }
  }

  setupAutoSave(projectId, projectPath) {
    if (this.activeProjects.has(projectId)) {
      clearInterval(this.activeProjects.get(projectId));
    }

    const intervalId = setInterval(async () => {
      try {
        await this.saveProjectState(projectId, projectPath);
      } catch (error) {
        console.error(`Auto-save failed for project ${projectId}:`, error);
      }
    }, this.autoSaveInterval);

    this.activeProjects.set(projectId, intervalId);
  }

  async saveProjectState(projectId, projectPath) {
    try {
      // Get current project state
      const state = await this.getCurrentProjectState(projectId);

      // Save to local filesystem
      await this.saveToFilesystem(projectPath, state);

      // Create git commit
      await this.createGitCommit(projectPath, 'Auto-save commit');

      return true;
    } catch (error) {
      console.error('Save project state error:', error);
      throw error;
    }
  }

  async deployToGitHub(projectPath, githubConfig) {
    try {
      const { token, repo, owner } = githubConfig;
      const octokit = new Octokit({ auth: token });

      // Create repository if it doesn't exist
      try {
        await octokit.repos.createForAuthenticatedUser({
          name: repo,
          private: true
        });
      } catch (error) {
        if (error.status !== 422) throw error; // 422 means repo already exists
      }

      // Set up remote and push
      await execAsync(`git remote add origin https://github.com/${owner}/${repo}.git`, { cwd: projectPath });
      await execAsync('git add .', { cwd: projectPath });
      await execAsync('git commit -m "Initial commit"', { cwd: projectPath });
      await execAsync('git push -u origin main', { cwd: projectPath });

      return {
        success: true,
        repoUrl: `https://github.com/${owner}/${repo}`
      };
    } catch (error) {
      console.error('GitHub deployment error:', error);
      throw new Error('Failed to deploy to GitHub');
    }
  }

  async deployToNetlify(projectPath, netlifyConfig) {
    try {
      const { token, siteName } = netlifyConfig;
      const netlify = new NetlifyAPI(token);

      // Create new site if name provided
      let site;
      if (siteName) {
        site = await netlify.createSite({
          name: siteName,
          custom_domain: `${siteName}.netlify.app`
        });
      }

      // Deploy site
      const deployment = await netlify.deploy(projectPath, {
        siteId: site.id,
        dir: 'build',
        prod: true
      });

      return {
        success: true,
        url: deployment.url,
        deployId: deployment.id
      };
    } catch (error) {
      console.error('Netlify deployment error:', error);
      throw new Error('Failed to deploy to Netlify');
    }
  }

  async cleanupProject(projectId) {
    if (this.activeProjects.has(projectId)) {
      clearInterval(this.activeProjects.get(projectId));
      this.activeProjects.delete(projectId);
    }
  }

  // Helper methods
  async getCurrentProjectState(projectId) {
    // Implementation to get current state from database
    // This would include all project components, assets, and configurations
  }

  async saveToFilesystem(projectPath, state) {
    // Implementation to save state to filesystem
    // This would write all project files and assets
  }

  async createGitCommit(projectPath, message) {
    try {
      await execAsync('git add .', { cwd: projectPath });
      await execAsync(`git commit -m "${message}"`, { cwd: projectPath });
    } catch (error) {
      console.error('Git commit error:', error);
      throw error;
    }
  }

  async applyProjectTemplate(projectPath, template) {
    // Implementation to apply project template
    // This would copy template files and configure them
  }
}

module.exports = new ProjectFileService();
