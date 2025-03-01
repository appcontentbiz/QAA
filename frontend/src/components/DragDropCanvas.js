import React, { useState, useRef } from 'react';
import { useDrop } from 'react-dnd';
import styled from 'styled-components';
import ComponentToolbox from './ComponentToolbox';
import DraggableComponent from './DraggableComponent';

const CanvasContainer = styled.div`
  width: 100%;
  height: calc(100vh - 100px);
  background: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
`;

const Canvas = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background: ${props => props.isDragging ? '#e9ecef' : '#ffffff'};
  transition: background 0.3s ease;
`;

const Grid = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-size: 20px 20px;
  background-image: 
    linear-gradient(to right, #f1f3f5 1px, transparent 1px),
    linear-gradient(to bottom, #f1f3f5 1px, transparent 1px);
  pointer-events: none;
`;

const DragDropCanvas = ({ components, onComponentAdd, onComponentMove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef(null);

  const [, drop] = useDrop({
    accept: 'component',
    drop: (item, monitor) => {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dropOffset = monitor.getClientOffset();
      
      const x = dropOffset.x - canvasRect.left;
      const y = dropOffset.y - canvasRect.top;
      
      if (item.isNew) {
        onComponentAdd({
          ...item,
          position: { x, y }
        });
      } else {
        onComponentMove(item.id, { x, y });
      }
    },
    hover: (item, monitor) => {
      setIsDragging(true);
    }
  });

  return (
    <CanvasContainer>
      <ComponentToolbox />
      <Canvas ref={drop(canvasRef)} isDragging={isDragging}>
        <Grid />
        {components.map(component => (
          <DraggableComponent
            key={component.id}
            component={component}
            onMove={onComponentMove}
          />
        ))}
      </Canvas>
    </CanvasContainer>
  );
};

export default DragDropCanvas;
