import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import styled from 'styled-components';
import ComponentEditor from './ComponentEditor';

const ComponentWrapper = styled.div`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  padding: 4px;
  border: 2px solid ${props => props.isSelected ? '#4299e1' : 'transparent'};
  border-radius: 4px;
  cursor: move;
  background: white;
  box-shadow: ${props => props.isDragging ? '0 8px 16px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0, 0, 0, 0.05)'};
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
  
  &:hover {
    border-color: #4299e1;
  }
`;

const ResizeHandle = styled.div`
  position: absolute;
  width: 8px;
  height: 8px;
  background: #4299e1;
  border-radius: 50%;
  
  ${props => props.position === 'nw' && `
    top: -4px;
    left: -4px;
    cursor: nw-resize;
  `}
  
  ${props => props.position === 'ne' && `
    top: -4px;
    right: -4px;
    cursor: ne-resize;
  `}
  
  ${props => props.position === 'sw' && `
    bottom: -4px;
    left: -4px;
    cursor: sw-resize;
  `}
  
  ${props => props.position === 'se' && `
    bottom: -4px;
    right: -4px;
    cursor: se-resize;
  `}
`;

const DraggableComponent = ({ component, onMove, onResize, onSelect, isSelected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const { id, type, position, content } = component;

  const [{ isDragging }, drag] = useDrag({
    type: 'component',
    item: { id, type, isNew: false },
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(id);
  };

  return (
    <ComponentWrapper
      ref={drag}
      x={position.x}
      y={position.y}
      isDragging={isDragging}
      isSelected={isSelected}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {content}
      
      {isSelected && (
        <>
          <ResizeHandle position="nw" />
          <ResizeHandle position="ne" />
          <ResizeHandle position="sw" />
          <ResizeHandle position="se" />
        </>
      )}
      
      {isEditing && (
        <ComponentEditor
          component={component}
          onClose={() => setIsEditing(false)}
          onSave={(updatedContent) => {
            // Handle save
            setIsEditing(false);
          }}
        />
      )}
    </ComponentWrapper>
  );
};

export default DraggableComponent;
