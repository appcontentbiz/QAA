import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DragDropCanvas from './DragDropCanvas';
import { motion } from 'framer-motion';

const WorkspaceContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7fafc;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  color: #2d3748;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.primary ? `
    background: #4299e1;
    color: white;
    
    &:hover {
      background: #3182ce;
    }
  ` : `
    background: #e2e8f0;
    color: #4a5568;
    
    &:hover {
      background: #cbd5e0;
    }
  `}
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
`;

const ViewControls = styled.div`
  display: flex;
  gap: 1rem;
`;

const ViewButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: ${props => props.active ? '#e2e8f0' : 'transparent'};
  color: #4a5568;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #e2e8f0;
  }
`;

const PreviewFrame = styled(motion.iframe)`
  width: 100%;
  height: 100%;
  border: none;
  background: white;
`;

const ProjectWorkspace = ({ project }) => {
  const [components, setComponents] = useState([]);
  const [currentView, setCurrentView] = useState('design'); // design, preview, code
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    // Load project components
    if (project) {
      // Fetch components from API
    }
  }, [project]);

  const handleComponentAdd = (component) => {
    setComponents([...components, {
      ...component,
      id: Date.now().toString()
    }]);
  };

  const handleComponentMove = (id, newPosition) => {
    setComponents(components.map(comp => 
      comp.id === id ? { ...comp, position: newPosition } : comp
    ));
  };

  const handleSave = async () => {
    try {
      // Save project to backend
      // await api.saveProject(project.id, components);
      // Show success notification
    } catch (error) {
      // Show error notification
    }
  };

  const handlePreview = async () => {
    try {
      // Generate preview URL
      // const url = await api.generatePreview(project.id);
      // setPreviewUrl(url);
      setCurrentView('preview');
    } catch (error) {
      // Show error notification
    }
  };

  const handlePublish = async () => {
    try {
      // Publish project
      // await api.publishProject(project.id);
      // Show success notification
    } catch (error) {
      // Show error notification
    }
  };

  return (
    <WorkspaceContainer>
      <Header>
        <Title>{project?.name || 'Untitled Project'}</Title>
        <ActionButtons>
          <Button onClick={handleSave}>Save</Button>
          <Button onClick={handlePreview}>Preview</Button>
          <Button primary onClick={handlePublish}>Publish</Button>
        </ActionButtons>
      </Header>
      
      <Toolbar>
        <ViewControls>
          <ViewButton 
            active={currentView === 'design'} 
            onClick={() => setCurrentView('design')}
          >
            Design
          </ViewButton>
          <ViewButton 
            active={currentView === 'preview'} 
            onClick={() => setCurrentView('preview')}
          >
            Preview
          </ViewButton>
          <ViewButton 
            active={currentView === 'code'} 
            onClick={() => setCurrentView('code')}
          >
            Code
          </ViewButton>
        </ViewControls>
      </Toolbar>
      
      <DndProvider backend={HTML5Backend}>
        {currentView === 'design' && (
          <DragDropCanvas
            components={components}
            onComponentAdd={handleComponentAdd}
            onComponentMove={handleComponentMove}
          />
        )}
        
        {currentView === 'preview' && previewUrl && (
          <PreviewFrame
            src={previewUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}
        
        {currentView === 'code' && (
          // Add code editor component here
          <div>Code Editor Coming Soon</div>
        )}
      </DndProvider>
    </WorkspaceContainer>
  );
};

export default ProjectWorkspace;
