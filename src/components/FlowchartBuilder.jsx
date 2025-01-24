import React, { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import JSZip from 'jszip';

const FlowchartBuilder = () => {
  const [nodes, setNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [nameError, setNameError] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [promptFileInput, setPromptFileInput] = useState(null);
  // New state for detectors
  const [detectors, setDetectors] = useState([]);
  const [showDetectorPrompt, setShowDetectorPrompt] = useState(false);
  const [detectorTypeName, setDetectorTypeName] = useState('');
  const [detectorTypeType, setDetectorTypeType] = useState('');
  const [detectorPrompt, setDetectorPrompt] = useState('');

  const handleFileImport = async (e, isPromptFile = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        console.log(importedData)
        // Determine whether to update nodes or prompts
        if (importedData.nodes) {
          // Import flowchart structure
          const importedNodes = {};

          if (importedData.nodes) {
            Object.entries(importedData.nodes).forEach(([id, nodeData]) => {
              importedNodes[id] = {
                name: nodeData.data?.desc || id,
                type: nodeData.type === 'decision' ? 'conditional_boolean' : nodeData.type || 'conditional_boolean',
                position: {
                  x: importedData.displayMetadata?.[id]?.x || 50,
                  y: importedData.displayMetadata?.[id]?.y || 50
                },
                connections: {
                  yes: nodeData.transitions?.true || '',
                  no: nodeData.transitions?.false || ''
                },
                prompt: '' // Initialize to empty string
              };
            });
          }

          // Display warning if no display metadata
          if (!importedData.displayMetadata) {
            console.warn('No display metadata found - using default positions');
          }

          setNodes(importedNodes);

          // Set selected node to start node if available
          if (importedData.startNode) {
            setSelectedNode(importedData.startNode);
          }

          console.log('Imported flowchart structure:', {
            nodeCount: Object.keys(importedNodes).length
          });
        } else if (importedData.prompts) {
          // Import prompts only
          importedData.prompts.forEach(promptObj => {
            if (nodes[promptObj.name]) {
              setNodes(prevNodes => ({
                ...prevNodes,
                [promptObj.name]: {
                  ...prevNodes[promptObj.name],
                  prompt: promptObj.prompt
                }
              }));
            }
          });

          console.log('Imported prompts:', {
            promptCount: importedData.prompts?.length || 0
          });
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }
    };
    reader.readAsText(file);
  };

  const addNode = () => {
    setShowNamePrompt(true);
    setNewNodeName('');
    setNameError('');
  };

  const addDetector = () => {
    setShowNamePrompt(false);
    setShowDetectorPrompt(true);
    setDetectorTypeName('');
    setDetectorTypeType('');
    setDetectorPrompt('');
  };

  const handleCreateDetector = () => {
    if (!detectorTypeName.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    
    if (detectors.some(d => d.name === detectorTypeName)) {
      setNameError('A detector with this name already exists');
      return;
    }
  
    const newDetector = {
      name: detectorTypeName,
      type: detectorTypeType,
      prompt: detectorPrompt
    };
  
    setDetectors(prev => [...prev, newDetector]);
    setShowDetectorPrompt(false);
    setDetectorTypeName('');
    setDetectorTypeType('');
    setDetectorPrompt('');
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
      position: { x: 200, y: 150 },
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

  const exportToJson = async () => {
    // Create the two JSON objects
    const flowchartData = {
        nodes: {},
        displayMetadata: {},
        startNode: Object.keys(nodes)[0] || null
    };

    const promptsData = {
        prompts: [],
        detectors: detectors
    };

    // Populate flowchart data
    Object.entries(nodes).forEach(([id, node]) => {
      if (node.type === 'conditional_boolean' && node.prompt) {
        promptsData.prompts.push({
          name: id,
          type: 'condition_prompt_boolean',
          prompt: node.prompt,
          target_section: 'methods'
        });
      } else if (node.type === 'terminal' && node.detectorRef) {
        promptsData.prompts.push({
          name: id,
          type: 'terminal_full',
          annotation: 'GO:0035195',
          detector: node.detectorRef
        });
      }
    });

    // Create a new ZIP archive
    const zip = new JSZip();

    // Add flowchart JSON to zip
    zip.file('flowchart.json', JSON.stringify(flowchartData, null, 2));

    // If there are prompts to include
    if (promptsData.prompts.length > 0) {
        zip.file('prompts.json', JSON.stringify(promptsData, null, 2));
    }

    // Generate the ZIP file and trigger download
    zip.generateAsync({ type: 'blob' })
        .then(function(content) {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flowchart_export_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(function(err) {
            console.error('Error creating zip file:', err);
        });
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

  // Modify the node editing interface when type is 'terminal'
  const renderNodeEditingFields = () => {
    if (!selectedNode) return null;

    const node = nodes[selectedNode];
    const nodeType = node.type;
    const popupWidth = nodeType === 'terminal_conditional' ? 'w-96' : '';
    return (
      <div className={`space-y-4 ${popupWidth}`}>
        {/* <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => updateNodeMetadata(selectedNode, 'name', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 bg-white text-gray-900"
          />
        </div> */}
        <div className='mt-6'>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <select
            value={node.type}
            onChange={(e) => {
              const newType = e.target.value;
              updateNodeMetadata(selectedNode, 'type', newType);
              
              // Clear detector and annotation for terminal_short_circuit
              if (newType === 'terminal_short_circuit') {
                updateNodeMetadata(selectedNode, 'detectorRef', '');
                updateNodeMetadata(selectedNode, 'annotation', '');
              }
            }}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
          >
            <option value="conditional_boolean">Conditional Boolean</option>
            <option value="terminal">Terminal</option>
            <option value="terminal_short_circuit">Terminal Short Circuit</option>
            <option value="terminal_conditional">Terminal Conditional</option>
          </select>
        </div>
        
        {node.type === 'terminal_conditional' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Additional Nodes</label>
              <input
                type="text"
                defaultValue={node.additionalNodes ? node.additionalNodes.join(', ') : ''}
                onChange={(e) => {
                  const inputText = e.target.value;
                  const nodeList = inputText.split(',').map(n => n.trim()).filter(n => n !== '');
                  
                  // Update the additional nodes
                  updateNodeMetadata(selectedNode, 'additionalNodes', nodeList);
                  
                  // Update all annotation map arrays to match the new length
                  if (node.annotationMap) {
                    const newMap = Object.fromEntries(
                      Object.entries(node.annotationMap).map(([key, value]) => [
                        key,
                        Array(nodeList.length).fill(false).map((_, i) => value[i] || false)
                      ])
                    );
                    updateNodeMetadata(selectedNode, 'annotationMap', newMap);
                  }
                }}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="Enter node IDs, comma-separated"
              />
              <p className="mt-1 text-sm text-gray-500">Available nodes: {Object.keys(nodes).filter(id => id !== selectedNode).join(', ')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Annotation Mappings</label>
              <div className="space-y-2">
                {Object.entries(node.annotationMap || {}).map(([key, value], index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newMap = { ...node.annotationMap };
                        delete newMap[key];
                        newMap[e.target.value] = value;
                        updateNodeMetadata(selectedNode, 'annotationMap', newMap);
                      }}
                      className="flex-1 rounded border border-gray-300 px-2 py-1"
                      placeholder="Key"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {Array(node.additionalNodes?.length || 0).fill(false).map((_, boolIndex) => (
                          <input
                            key={boolIndex}
                            type="checkbox"
                            checked={value[boolIndex] || false}
                            onChange={(e) => {
                              const newMap = { ...node.annotationMap };
                              newMap[key][boolIndex] = e.target.checked;
                              updateNodeMetadata(selectedNode, 'annotationMap', newMap);
                            }}
                            className="rounded border-gray-300"
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newMap = { ...node.annotationMap };
                        delete newMap[key];
                        updateNodeMetadata(selectedNode, 'annotationMap', newMap);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newMap = { ...node.annotationMap };
                    newMap[`key${Object.keys(newMap).length + 1}`] = Array(node.additionalNodes?.length || 0).fill(false);
                    updateNodeMetadata(selectedNode, 'annotationMap', newMap);
                  }}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  Add Mapping
                </button>
              </div>
            </div>
          </>
        )}

        {(node.type === 'terminal' ) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Detector</label>
              <select
                value={node.detectorRef || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'detectorRef', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
              >
                <option value="">Select a detector</option>
                {detectors.map(detector => (
                  <option key={detector.name} value={detector.name}>
                    {detector.name} ({detector.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Annotation</label>
              <input
                type="text"
                value={node.annotation || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'annotation', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="e.g., GO:0035195"
              />
            </div>
          </>
        )}

        {node.type === 'conditional_boolean' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Yes Connection</label>
              <input
                type="text"
                value={node.connections.yes}
                onChange={(e) => updateNodeMetadata(selectedNode, 'connections', { 
                  ...node.connections, 
                  yes: e.target.value 
                })}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No Connection</label>
              <input
                type="text"
                value={node.connections.no}
                onChange={(e) => updateNodeMetadata(selectedNode, 'connections', { 
                  ...node.connections, 
                  no: e.target.value 
                })}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prompt</label>
              <textarea
                value={node.prompt || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'prompt', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 min-h-[100px] resize-y"
                placeholder="Enter prompt text..."
              />
            </div>
          </>
        ) : null}
      </div>
    );
  };

  // Add the detector creation popup
  const renderDetectorPrompt = () => {
    if (!showDetectorPrompt) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
        <div className="bg-white rounded-lg p-6 w-96">
          <h3 className="text-lg font-medium mb-4">New Detector</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={detectorTypeName}
                onChange={(e) => setDetectorTypeName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="e.g., target"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <input
                type="text"
                value={detectorTypeType}
                onChange={(e) => setDetectorTypeType(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="e.g., AE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prompt</label>
              <textarea
                value={detectorPrompt}
                onChange={(e) => setDetectorPrompt(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 min-h-[100px] resize-y"
                placeholder="Enter detector prompt..."
              />
            </div>
          </div>
          {nameError && (
            <p className="text-red-500 text-sm mt-2">{nameError}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowDetectorPrompt(false);
                setNameError('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDetector}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    Object.entries(nodes).forEach(([nodeId, node]) => {
      console.log(`Checking connections for node "${nodeId}":`, node.connections);
      
      const yesTargetId = node.connections.yes;
      if (yesTargetId && yesTargetId.trim() !== '') {
        const targetNode = nodes[yesTargetId];
        if (targetNode) {
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
        }
      }
      
      const noTargetId = node.connections.no;
      if (noTargetId && noTargetId.trim() !== '') {
        const targetNode = nodes[noTargetId];
        if (targetNode) {
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
          onClick={addDetector}
          className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          <Plus size={16} /> Add Detector
        </button>
        <button
          onClick={exportToJson}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Export JSON
        </button>
        <button
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          onClick={() => fileInput?.click()}
        >
          Import JSON
        </button>
        <input
          type="file"
          accept=".json"
          className="hidden"
          ref={(ref) => setFileInput(ref)}
          onChange={handleFileImport}
        />
        <button
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            onClick={() => promptFileInput?.click()}
          >
            Import Prompts
          </button>
          <input
            type="file"
            accept=".json"
            className="hidden"
            ref={(ref) => setPromptFileInput(ref)}
            onChange={(e) => handleFileImport(e, true)}
          />
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
      
      {renderDetectorPrompt()}

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
            <div className="text-sm font-medium mb-2">{node.name}</div>
            <div className="text-sm font-medium mb-2 break-words">
              {id}
            </div>
          </div>
        ))}
      </div>

      {selectedNode && (
        <div
          className="absolute top-0 left-0 bg-white border border-gray-200 p-4 rounded shadow-lg w-128 z-50"
          style={{
            left: nodes[selectedNode].position.x + 150,
            top: nodes[selectedNode].position.y
          }}
        >
          <button
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(null);
            }}
          >
            <X size={16} />
          </button>
          {renderNodeEditingFields()}
        </div>
      )}
    </div>
  );
};

export default FlowchartBuilder;