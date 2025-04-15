import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Terminal } from 'lucide-react';
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
  
  // New state for key-value annotation pairs
  const [annotationPairs, setAnnotationPairs] = useState([]);
  const [newAnnotationKey, setNewAnnotationKey] = useState('');
  const [newAnnotationValue, setNewAnnotationValue] = useState('');

  const handleFileImport = async (e, isPromptFile = false) => {
    const file = e.target.files[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        console.log("Imported data:", importedData);
        
        // Determine whether to update nodes or prompts
        if (importedData.nodes) {
          // Import flowchart structure
          const importedNodes = {};
  
          // Process nodes from the flowchart structure
          Object.entries(importedData.nodes).forEach(([id, nodeData]) => {
            
            // Determine node type properly
            let nodeType;
            if (nodeData.type === 'decision') {
              nodeType = 'conditional_prompt_boolean';
            } else {
              console.log("loaded node type: ", nodeData.type);
              nodeType = nodeData.type || 'conditional_prompt_boolean';
              console.log("determined node type: ", nodeType);
            }
            
            // Create the node with all necessary properties
            importedNodes[id] = {
              name: nodeData.data?.desc || id, // Make sure name is set
              type: nodeType,
              position: {
                x: importedData.displayMetadata?.[id]?.x || 50,
                y: importedData.displayMetadata?.[id]?.y || 50
              },
              connections: {
                yes: nodeData.transitions?.true || '',
                no: nodeData.transitions?.false || ''
              },
              prompt: '', // Initialize to empty string
              targetSection: '',
              annotationPairs: nodeData.data?.annotationPairs || {},
              detectorRef: nodeData.data?.detector || ''
            };
  
            // Add any additional properties based on node type
            if (nodeType === 'terminal_conditional' && nodeData.data) {
              importedNodes[id].additionalNodes = nodeData.data.additionalNodes || [];
              importedNodes[id].annotationMap = nodeData.data.annotation_map || {};
            }
          });
  
          // Display warning if no display metadata
          if (!importedData.displayMetadata) {
            console.warn('No display metadata found - using default positions');
          }
  
          // Set the nodes state
          setNodes(importedNodes);
  
          // Set selected node to start node if available
          if (importedData.startNode) {
            setSelectedNode(importedData.startNode);
          }
  
          console.log('Imported flowchart structure:', {
            nodeCount: Object.keys(importedNodes).length
          });
          
          // Force a refresh of the UI by selecting a node and updating its type slightly
          // This is a workaround to trigger the UI to display all properties
          setTimeout(() => {
            const firstNodeId = Object.keys(importedNodes)[0];
            if (firstNodeId) {
              // Select the node
              setSelectedNode(firstNodeId);
              
              // Force a re-render with a small delay
              setTimeout(() => {
                console.log("Forcing UI refresh for node:", firstNodeId);
                // This is a trick to force the component to refresh without changing actual data
                // We'll set the same type to itself, which should trigger the UI update
                const currentNode = importedNodes[firstNodeId];
                updateNodeMetadata(firstNodeId, 'type', currentNode.type);
              }, 100);
            }
          }, 100);
        } 
        // Handle prompt import
        else if (importedData.prompts) {
          console.log('Importing prompts data:', importedData.prompts);
          
          // Create a copy of existing nodes to update
          const updatedNodes = {...nodes};
          
          // Track which nodes were updated
          const updatedNodeIds = [];
          
          importedData.prompts.forEach(promptObj => {
            const nodeName = promptObj.name;
            
            if (updatedNodes[nodeName]) {
              // Update the node with prompt data
              updatedNodes[nodeName] = {
                ...updatedNodes[nodeName],
                prompt: promptObj.prompt || '',
                targetSection: promptObj.target_section || '',
                annotationPairs: promptObj.annotationPairs || {},
                detectorRef: promptObj.detector || ''
              };
              
              // Handle terminal_conditional specific properties
              if (promptObj.type === 'terminal_conditional') {
                updatedNodes[nodeName].additionalNodes = promptObj.additionalNodes || [];
                updatedNodes[nodeName].annotationMap = promptObj.annotation_map || {};
              }
              
              updatedNodeIds.push(nodeName);
            } else {
              console.warn(`Node "${nodeName}" not found in current flowchart`);
            }
          });
          
          // Update the nodes state
          setNodes(updatedNodes);
          
          console.log('Imported prompts:', {
            promptCount: importedData.prompts?.length || 0,
            updatedNodeIds: updatedNodeIds
          });
          
          // Force a refresh if we have updated nodes
          if (updatedNodeIds.length > 0) {
            setTimeout(() => {
              const firstNodeId = updatedNodeIds[0];
              setSelectedNode(firstNodeId);
              
              // Force a re-render with a small delay
              setTimeout(() => {
                console.log("Forcing UI refresh for node:", firstNodeId);
                const currentNode = updatedNodes[firstNodeId];
                updateNodeMetadata(firstNodeId, 'type', currentNode.type);
              }, 100);
            }, 100);
          }
        }
        
        // Import detectors if they exist
        if (importedData.detectors && importedData.detectors.length > 0) {
          setDetectors(importedData.detectors.map(detector => ({
            name: detector.name,
            type: detector.type,
            prompt: detector.prompt
          })));
          console.log('Imported detectors:', importedData.detectors.length);
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
      prompt: '',
      annotationPairs: {}
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
    
    // Initialize annotation pairs state based on the selected node
    const node = nodes[nodeId];
    if (node && node.annotationPairs) {
      const pairs = Object.entries(node.annotationPairs || {}).map(([key, value]) => ({ key, value }));
      setAnnotationPairs(pairs);
    } else {
      setAnnotationPairs([]);
    }
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

  // Add a new function to handle annotation pair updates
  const updateAnnotationPairs = (pairs) => {
    if (!selectedNode) return;
    
    // Convert the array of pairs to an object
    const pairsObject = {};
    pairs.forEach(pair => {
      if (pair.key && pair.key.trim() !== '') {
        pairsObject[pair.key] = pair.value;
      }
    });
    
    // Update the node
    updateNodeMetadata(selectedNode, 'annotationPairs', pairsObject);
  };

  const addAnnotationPair = () => {
    if (newAnnotationKey.trim() === '') return;
    
    const newPairs = [...annotationPairs, { key: newAnnotationKey, value: newAnnotationValue }];
    setAnnotationPairs(newPairs);
    updateAnnotationPairs(newPairs);
    
    // Clear the input fields
    setNewAnnotationKey('');
    setNewAnnotationValue('');
  };

  const removeAnnotationPair = (index) => {
    const newPairs = annotationPairs.filter((_, i) => i !== index);
    setAnnotationPairs(newPairs);
    updateAnnotationPairs(newPairs);
  };

  const updateAnnotationPair = (index, field, value) => {
    const newPairs = [...annotationPairs];
    newPairs[index][field] = value;
    setAnnotationPairs(newPairs);
    updateAnnotationPairs(newPairs);
  };

  const exportToJson = async () => {
    // Create the two JSON objects
    const flowchartData = {
        nodes: {},
        displayMetadata: {},
        startNode: Object.keys(nodes)[0] || null
    };

    const promptsData = {
        prompts: []
    };

    // Populate flowchart data
    Object.entries(nodes).forEach(([id, node]) => {
      console.log(node)
        // Base node structure
        var nodeData = {
            type: node.type,
        };
        
        // Add type-specific data
        if (node.type === 'conditional_boolean') {
            console.log(nodeData)
            // Add target section if it exists
            nodeData.data = {
              desc: node.name || id,
              condition: id
          };
          nodeData.transitions = {
            true: node.connections.yes || null,
            false: node.connections.no || null
        };
        } else if (node.type === 'terminal_full' || node.type === 'terminal_short_circuit' || node.type === 'terminal_conditional') {
            nodeData.data = {
              desc: node.name || id,
              terminal: id,
              annotationPairs: node.annotationPairs || {}
            }
        }
        flowchartData.nodes[id] = nodeData;
        flowchartData.displayMetadata[id] = {
            x: node.position.x,
            y: node.position.y
        };

        // Populate prompts data if prompt exists
        
        if (node.type === 'conditional_boolean') {
          promptsData.prompts.push({
              name: id,
              type: 'condition_prompt_boolean',
              prompt: node.prompt,
              target_section: node.targetSection || null
          });
        } else if (node.type === 'terminal_short_circuit') {
          promptsData.prompts.push({
            name: id,
            type: node.type,
            annotation: null,
            detector: null
          });
        } else if (node.type === 'terminal_full') {
          promptsData.prompts.push({
            name: id,
            type: 'terminal_full', // TODO unify this across the LLM side and here
            annotation: node.annotation,
            annotationPairs: node.annotationPairs || {},
            detector: node.detectorRef
          });
        } else if (node.type === 'terminal_conditional')
        {
          promptsData.prompts.push({
            name: id,
            type: node.type,
            additionalNodes: node.additionalNodes,
            annotation_map: node.annotationMap,
            annotationPairs: node.annotationPairs || {}
          });
        }
        
    });

    // Add detectors to promptsData if they exist
    if (detectors.length > 0) {
        promptsData.detectors = detectors.map(detector => ({
            name: detector.name,
            type: detector.type,
            prompt: detector.prompt
        }));
    }

    // Create a new ZIP archive
    const zip = new JSZip();

    // Add flowchart JSON to zip
    zip.file('flowchart.json', JSON.stringify(flowchartData, null, 2));

    // If there are prompts or detectors to include
    if (promptsData.prompts.length > 0 || promptsData.detectors?.length > 0) {
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
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
          >
            <option value="conditional_boolean">Conditional Boolean</option>
            <option value="terminal_full">Terminal</option>
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
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
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
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
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

        {(node.type === 'terminal_full' || node.type === 'terminal_conditional') && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Detector</label>
              <select
                value={node.detectorRef || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'detectorRef', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
              >
                <option value="">Select a detector</option>
                {detectors.map(detector => (
                  <option key={detector.name} value={detector.name}>
                    {detector.name} ({detector.type})
                  </option>
                ))}
              </select>
            </div>
            
            {/* New Annotation Key-Value Pairs Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Annotations (Key-Value Pairs)</label>
              
              {/* List of existing annotation pairs */}
              <div className="space-y-2 mb-4">
                {annotationPairs.map((pair, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(e) => updateAnnotationPair(index, 'key', e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                      placeholder="Key (e.g., involved_in)"
                    />
                    <input
                      type="text"
                      value={pair.value}
                      onChange={(e) => updateAnnotationPair(index, 'value', e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                      placeholder="Value (e.g., GO0000512)"
                    />
                    <button
                      onClick={() => removeAnnotationPair(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Add new annotation pair */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAnnotationKey}
                  onChange={(e) => setNewAnnotationKey(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                  placeholder="Key (e.g., involved_in)"
                />
                <input
                  type="text"
                  value={newAnnotationValue}
                  onChange={(e) => setNewAnnotationValue(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                  placeholder="Value (e.g., GO0000512)"
                />
                <button
                  onClick={addAnnotationPair}
                  className="text-blue-500 hover:text-blue-700"
                  disabled={!newAnnotationKey.trim()}
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Add key-value pairs for annotating (e.g., involved_in: GO0000512)
              </p>
            </div>
            
            {/* Legacy single annotation field */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Legacy Annotation (Single value)</label>
              <input
                type="text"
                value={node.annotation || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'annotation', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                placeholder="e.g., GO:0035195"
              />
              <p className="text-xs text-gray-500 mt-1">
                This is maintained for backward compatibility. Prefer using key-value pairs above.
              </p>
            </div>
          </>
        )}

        {node.type === 'conditional_boolean' || node.type === 'conditional_prompt_boolean' ? (
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
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
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
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prompt</label>
              <textarea
                value={node.prompt || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'prompt', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 min-h-[100px] resize-y text-gray-900 bg-white"
                placeholder="Enter prompt text..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Section</label>
              <input
                type="text"
                value={node.targetSection || ''}
                onChange={(e) => updateNodeMetadata(selectedNode, 'targetSection', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                placeholder="e.g., abstract, methods, results"
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <h3 className="text-lg font-medium mb-4">New Detector</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={detectorTypeName}
                onChange={(e) => setDetectorTypeName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                placeholder="e.g., target"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <input
                type="text"
                value={detectorTypeType}
                onChange={(e) => setDetectorTypeType(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-gray-900 bg-white"
                placeholder="e.g., AE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prompt</label>
              <textarea
                value={detectorPrompt}
                onChange={(e) => setDetectorPrompt(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 min-h-[100px] resize-y text-gray-900 bg-white"
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
      // console.log(`Checking connections for node "${nodeId}":`, node.connections);
      
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
      };
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
      
      {/* Node creation modal with higher z-index */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 ">
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
                onClick={() => {
                  setShowNamePrompt(false);
                  setNameError('');
                }}
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
          className="absolute top-0 left-0 bg-white border border-gray-200 p-4 rounded shadow-lg w-128 z-40 text-gray-900"
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