import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const EditorOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const EditorPanel = styled(motion.div)`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  margin: 0;
  color: #2d3748;
  font-size: 1.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #a0aec0;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s ease;
  
  &:hover {
    color: #2d3748;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.9rem;
  color: #4a5568;
  font-weight: 500;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
  }
`;

const TextArea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 1rem;
  min-height: 100px;
  resize: vertical;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
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

const ComponentEditor = ({ component, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    content: component.content || '',
    styles: component.styles || {},
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <AnimatePresence>
      <EditorOverlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <EditorPanel
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <Header>
            <Title>Edit {component.type}</Title>
            <CloseButton onClick={onClose}>&times;</CloseButton>
          </Header>
          
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <Label>Content</Label>
              <TextArea
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                placeholder={`Enter ${component.type} content...`}
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Styles</Label>
              <Input
                type="text"
                value={formData.styles.color || ''}
                onChange={e => setFormData({
                  ...formData,
                  styles: { ...formData.styles, color: e.target.value }
                })}
                placeholder="Color (e.g., #000000)"
              />
            </FormGroup>
            
            <ButtonGroup>
              <Button type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" primary>Save Changes</Button>
            </ButtonGroup>
          </Form>
        </EditorPanel>
      </EditorOverlay>
    </AnimatePresence>
  );
};

export default ComponentEditor;
