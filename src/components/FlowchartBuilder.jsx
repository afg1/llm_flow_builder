import React, { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';

const FlowchartBuilder = () => {
  const [nodes, setNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [nameError, setNameError] = useState('');

  const addNode = () => {
    setShowNamePrompt(true);
    setNewNodeName('');
    setNameError('');
  };

  const handleCreateNode = () => {
    if (!newNodeName.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    
    if (nodes[newNodeName]) {
      setNameError('A node with this name already exists');
      return;
    }
    
    const newNode = {
      type: 'conditional_boolean',
      position: { x: 50, y: 50 },
      connections: {
        yes: '',
        no: ''
      },
      prompt: ''
    };
    
    setNodes(prev => ({ ...prev, [newNodeName]: newNode }));
    setShowNamePrompt(false);
    setNewNodeName('');
    setNameError('');
  };

  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleNodeDragStart = (e, nodeId) => {
    const node = nodes[nodeId];
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDraggedNodeId(nodeId);
  };

  const handleNodeDrag = (e) => {
    if (!draggedNodeId) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    
    setNodes(prev => ({
      ...prev,
      [draggedNodeId]: {
        ...prev[draggedNodeId],
        position: { x, y }
      }
    }));
  };

  const handleNodeDragEnd = () => {
    setDraggedNodeId(null);
  };

  const handleNodeSelect = (nodeId) => {
    setSelectedNode(nodeId);
  };

  const updateNodeMetadata = (nodeId, field, value) => {
    console.log(`Updating node ${nodeId}, field ${field}:`, value);
    setNodes(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        [field]: value
      }
    }));
  };

  const exportToJson = () => {
    const exportData = {
      nodes: {},
      startNode: Object.keys(nodes)[0] || null
    };

    Object.entries(nodes).forEach(([id, node]) => {
      // Convert camelCase to snake_case for the condition
      const snakeCaseId = id.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      exportData.nodes[id] = {
        type: node.type === 'conditional_boolean' ? 'decision' : 'terminal',
        data: {
          desc: node.name || id,
          condition: snakeCaseId.charAt(0) === '_' ? snakeCaseId.slice(1) : snakeCaseId
        },
        transitions: {
          true: node.connections.yes || null,
          false: node.connections.no || null
        }
      };
    });

    // Create and trigger download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowchart.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const drawConnections = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    Object.values(nodes).forEach(node => {
      if (node.connections.yes) {
        const targetNode = nodes[node.connections.yes];
        if (targetNode) {
          ctx.beginPath();
          ctx.strokeStyle = '#22c55e';
          ctx.moveTo(node.position.x + 75, node.position.y + 25);
          ctx.lineTo(targetNode.position.x + 75, targetNode.position.y + 25);
          ctx.stroke();
        }
      }
      if (node.connections.no) {
        const targetNode = nodes[node.connections.no];
        if (targetNode) {
          ctx.beginPath();
          ctx.strokeStyle = '#ef4444';
          ctx.moveTo(node.position.x + 75, node.position.y + 25);
          ctx.lineTo(targetNode.position.x + 75, targetNode.position.y + 25);
          ctx.stroke();
        }
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size to match display size
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    console.log('Current nodes:', nodes);
    
    // Draw all connections
    Object.entries(nodes).forEach(([nodeId, node]) => {
      console.log(`Checking connections for node "${nodeId}":`, node.connections);
      
      // Draw 'yes' connections
      const yesTargetId = node.connections.yes;
      if (yesTargetId && yesTargetId.trim() !== '') {
        const targetNode = nodes[yesTargetId];
        console.log(`Looking for yes connection "${yesTargetId}" in nodes:`, Object.keys(nodes));
        
        if (targetNode) {
          console.log('Drawing yes connection from', nodeId, 'to', yesTargetId);
          ctx.beginPath();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          
          const startX = node.position.x + 75;
          const startY = node.position.y + 25;
          const endX = targetNode.position.x + 75;
          const endY = targetNode.position.y + 25;
          
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Draw arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const arrowLength = 10;
          
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowLength * Math.cos(angle - Math.PI / 6),
            endY - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowLength * Math.cos(angle + Math.PI / 6),
            endY - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        } else {
          console.log(`Target node "${yesTargetId}" not found in`, nodes);
        }
      }
      
      // Draw 'no' connections
      const noTargetId = node.connections.no;
      if (noTargetId && noTargetId.trim() !== '') {
        const targetNode = nodes[noTargetId];
        console.log(`Looking for no connection "${noTargetId}" in nodes:`, Object.keys(nodes));
        
        if (targetNode) {
          console.log('Drawing no connection from', nodeId, 'to', noTargetId);
          ctx.beginPath();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          
          const startX = node.position.x + 75;
          const startY = node.position.y + 25;
          const endX = targetNode.position.x + 75;
          const endY = targetNode.position.y + 25;
          
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Draw arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const arrowLength = 10;
          
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowLength * Math.cos(angle - Math.PI / 6),
            endY - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowLength * Math.cos(angle + Math.PI / 6),
            endY - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        } else {
          console.log(`Target node "${noTargetId}" not found in`, nodes);
        }
      }
    });
  }, [nodes]);

  const handleContainerClick = (e) => {
    if (e.target === e.currentTarget) {
      setSelectedNode(null);
    }
  };

  return (
    <div className="w-full h-full relative" onClick={handleContainerClick}>
      <div className="absolute top-4 left-4 z-30 space-y-2">
        <button
          onClick={addNode}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          <Plus size={16} /> Add Node
        </button>
        <button
          onClick={exportToJson}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Export JSON
        </button>
      </div>
      
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">New Node Name</h3>
            <input
              type="text"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
              placeholder="e.g., hasExperimentalEvidence"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateNode();
                }
              }}
              autoFocus
            />
            {nameError && (
              <p className="text-red-500 text-sm mb-2">{nameError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNamePrompt(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNode}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-10"
        width={800}
        height={600}
      />
      
      <div 
        className="relative"
        onMouseMove={handleNodeDrag}
        onMouseUp={handleNodeDragEnd}
        onMouseLeave={handleNodeDragEnd}
      >
        {Object.entries(nodes).map(([id, node]) => (
          <div
            key={id}
            className="absolute bg-white border-2 border-gray-300 rounded p-4 cursor-move shadow-lg text-gray-900 z-20"
            style={{
              left: node.position.x,
              top: node.position.y,
              minWidth: '150px',
              maxWidth: '300px',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleNodeDragStart(e, id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleNodeSelect(id);
            }}
          >
            <div className="text-sm font-medium mb-2">{node.name}</div
          >
            <div className="text-sm font-medium mb-2 break-words">
              {id}
            </div>
            {selectedNode === id && (
              <div className="absolute top-0 left-full ml-2 bg-white border border-gray-200 p-4 rounded shadow-lg w-64 z-30">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(null);
                  }}
                >
                  <X size={16} />
                </button>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={node.name}
                      onChange={(e) => updateNodeMetadata(id, 'name', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select
                      value={node.type}
                      onChange={(e) => updateNodeMetadata(id, 'type', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="conditional_boolean">Conditional Boolean</option>
                      <option value="terminal">Terminal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Yes Connection</label>
                    <input
                      type="text"
                      value={node.connections.yes}
                      onChange={(e) => updateNodeMetadata(id, 'connections', { ...node.connections, yes: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">No Connection</label>
                    <input
                      type="text"
                      value={node.connections.no}
                      onChange={(e) => updateNodeMetadata(id, 'connections', { ...node.connections, no: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prompt</label>
                    <textarea
                        value={node.prompt || ''}
                        onChange={(e) => updateNodeMetadata(id, 'prompt', e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 min-h-[100px] resize-y"
                        placeholder="Enter prompt text..."
                    />
                    </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlowchartBuilder;