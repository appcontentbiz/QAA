import React from 'react';
import { useDrag } from 'react-dnd';
import styled from 'styled-components';
import { FaButton, FaForm, FaImage, FaNavbar, FaTable, FaText } from 'react-icons/fa';

const ToolboxContainer = styled.div`
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 1000;
`;

const ComponentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: ${props => props.isDragging ? '#e9ecef' : 'white'};
  border-radius: 8px;
  cursor: move;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f8f9fa;
    transform: translateY(-1px);
  }
  
  svg {
    font-size: 1.2rem;
    color: #4a5568;
  }
`;

const Label = styled.span`
  font-size: 0.9rem;
  color: #4a5568;
`;

const components = [
  { id: 'button', label: 'Button', icon: FaButton },
  { id: 'form', label: 'Form', icon: FaForm },
  { id: 'image', label: 'Image', icon: FaImage },
  { id: 'navbar', label: 'Navbar', icon: FaNavbar },
  { id: 'table', label: 'Table', icon: FaTable },
  { id: 'text', label: 'Text', icon: FaText },
];

const DraggableComponent = ({ id, label, Icon }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'component',
    item: { id, type: id, isNew: true },
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <ComponentItem ref={drag} isDragging={isDragging}>
      <Icon />
      <Label>{label}</Label>
    </ComponentItem>
  );
};

const ComponentToolbox = () => {
  return (
    <ToolboxContainer>
      {components.map(({ id, label, icon: Icon }) => (
        <DraggableComponent
          key={id}
          id={id}
          label={label}
          Icon={Icon}
        />
      ))}
    </ToolboxContainer>
  );
};

export default ComponentToolbox;
