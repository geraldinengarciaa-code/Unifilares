// app.js

// Initialize Lucide Icons
lucide.createIcons();

// Elements
const dropzone = document.getElementById('dropzone');
const fileUpload = document.getElementById('fileUpload');
const toolsPanel = document.getElementById('toolsPanel');
const welcomeMessage = document.getElementById('welcomeMessage');
const workspace = document.getElementById('workspace');
const canvasContainer = document.getElementById('canvasContainer');
const btnDelete = document.getElementById('btnDelete');

// Initialize Fabric Canvas
const canvas = new fabric.Canvas('fabricCanvas', {
    selection: true,
    preserveObjectStacking: true,
    fireRightClick: true, // Allow right click if needed
    stopContextMenu: true,
});

// --- Pan & Zoom ---
canvas.on('mouse:wheel', function(opt) {
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) zoom = 20;
    if (zoom < 0.1) zoom = 0.1;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
});

canvas.on('mouse:down', function(opt) {
    const evt = opt.e;
    // 3 in Fabric or 2 in native JS represents the right mouse button (anticlick)
    if (opt.button === 3 || evt.button === 2) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
    }
});

canvas.on('mouse:move', function(opt) {
    if (this.isDragging) {
        const e = opt.e;
        const vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
    }
});

canvas.on('mouse:up', function(opt) {
    this.setViewportTransform(this.viewportTransform);
    this.isDragging = false;
    this.selection = true;
});

// Configure standard controls for ABB Look
fabric.Object.prototype.set({
    transparentCorners: false,
    cornerColor: '#FF000F',
    cornerStrokeColor: '#FF000F',
    borderColor: '#FF000F',
    cornerSize: 10,
    padding: 5,
    cornerStyle: 'circle'
});

window.addEventListener('resize', () => {
    // Optionally resize fabric instance wrapper to fit container if needed, 
    // but the canvas itself stays fixed to image resolution
});

// --- File Handling (Drag & Drop + Click) ---
dropzone.addEventListener('click', () => fileUpload.click());
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-abbred', 'bg-red-50');
});
dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-abbred', 'bg-red-50');
});
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-abbred', 'bg-red-50');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});
fileUpload.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file) return;

    const fileType = file.type;
    
    // Unhide tools
    toolsPanel.classList.remove('opacity-30', 'pointer-events-none');
    welcomeMessage.style.display = 'none';

    if (fileType === 'application/pdf') {
        renderPDFToCanvas(file);
    } else if (fileType === 'text/html' || file.name.endsWith('.html')) {
        renderHTMLToCanvas(file);
    } else if (fileType.startsWith('image/')) {
        renderImageToCanvas(file);
    } else {
        alert('Formato no soportado. Por favor sube un PDF, HTML editable, o una imagen JPG/PNG.');
    }
}

// --- PETS Handling ---
let petsFileBuffer = null;
const btnUploadPets = document.getElementById('btnUploadPets');
const petsUpload = document.getElementById('petsUpload');
const petsStatus = document.getElementById('petsStatus');
const petsFileName = document.getElementById('petsFileName');
const btnRemovePets = document.getElementById('btnRemovePets');

btnUploadPets.addEventListener('click', () => petsUpload.click());

petsUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = function(evt) {
            petsFileBuffer = evt.target.result;
            petsFileName.textContent = file.name;
            petsStatus.classList.remove('hidden');
            btnUploadPets.classList.add('hidden');
        };
        reader.readAsArrayBuffer(file);
    } else if (file) {
        alert("El documento PETS debe ser estrictamente un archivo PDF.");
    }
});

btnRemovePets.addEventListener('click', () => {
    petsFileBuffer = null;
    petsUpload.value = '';
    petsStatus.classList.add('hidden');
    btnUploadPets.classList.remove('hidden');
});

function resetCanvasSize(width, height) {
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.clear();
}

function renderImageToCanvas(file) {
    const reader = new FileReader();
    reader.onload = function(f) {
        const data = f.target.result;
        fabric.Image.fromURL(data, function(img) {
            // Set canvas size to image size
            resetCanvasSize(img.width, img.height);
            // Set background with center origin for easy rotation
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                originX: 'center',
                originY: 'center',
                left: img.width / 2,
                top: img.height / 2,
            });
        });
    };
    reader.readAsDataURL(file);
}

function renderHTMLToCanvas(file) {
    const reader = new FileReader();
    reader.onload = function(f) {
        const text = f.target.result;
        
        // Use Regex to extract the JSON to bypass any strict DOM parsing dropping the data
        const match = text.match(/<script id="unifilar-data" type="application\/json">([\s\S]*?)<\/script>/);
        
        if (match && match[1]) {
            const json = match[1];
            canvas.loadFromJSON(json, function() {
                canvas.renderAll();
                const bg = canvas.backgroundImage;
                if (bg) {
                    resetCanvasSize(bg.width * bg.scaleX, bg.height * bg.scaleY);
                } else if (canvas.width === 0) {
                    // Fallback just in case
                    resetCanvasSize(800, 600);
                }
            });
        } else {
            alert('El archivo HTML aportado no fue generado por esta plataforma o no contiene los datos del lienzo editables.');
        }
    };
    reader.readAsText(file);
}

// PDF.js rendering to Fabric.js Canvas
async function renderPDFToCanvas(file) {
    try {
        const fileURL = URL.createObjectURL(file);
        
        // Use PDF.js to load doc
        const loadingTask = pdfjsLib.getDocument(fileURL);
        const pdf = await loadingTask.promise;
        
        // Load first page (we only support single page for unifilares usually)
        const page = await pdf.getPage(1);
        
        // Scale it up for decent resolution
        const scale = 2.0; 
        const viewport = page.getViewport({scale: scale});
        
        // Prepare temporary canvas using DOM
        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        tempCanvas.height = viewport.height;
        tempCanvas.width = viewport.width;

        // Render PDF page into temp canvas
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Convert temp canvas to Fabric JS Image and set as background
        fabric.Image.fromURL(tempCanvas.toDataURL('image/jpeg', 1.0), function(img) {
            resetCanvasSize(img.width, img.height);
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                originX: 'center',
                originY: 'center',
                left: img.width / 2,
                top: img.height / 2,
            });
        });
        
    } catch (e) {
        console.error(e);
        alert('Error al leer el PDF.');
    }
}

// --- Tools: File Adjustments (Rotate, Flip, Crop) ---
document.getElementById('btnRotateLeft').addEventListener('click', () => rotateBackground(-90));
document.getElementById('btnRotateRight').addEventListener('click', () => rotateBackground(90));
document.getElementById('btnFlipH').addEventListener('click', () => {
    let bg = canvas.backgroundImage;
    if (!bg) return;
    bg.set('flipX', !bg.flipX);
    canvas.renderAll();
});
document.getElementById('btnFlipV').addEventListener('click', () => {
    let bg = canvas.backgroundImage;
    if (!bg) return;
    bg.set('flipY', !bg.flipY);
    canvas.renderAll();
});

function rotateBackground(angleDeg) {
    let bg = canvas.backgroundImage;
    if (!bg) return;
    
    // Calculate new angle
    let newAngle = (bg.angle + angleDeg) % 360;
    
    // Swap canvas dimensions
    let oldW = canvas.width;
    let oldH = canvas.height;
    canvas.setWidth(oldH);
    canvas.setHeight(oldW);
    
    // Update background image position and angle
    bg.set({
        left: canvas.width / 2,
        top: canvas.height / 2,
        angle: newAngle
    });
    
    canvas.renderAll();
}

// Crop Logic
let cropRect = null;
const btnStartCrop = document.getElementById('btnStartCrop');
const cropControls = document.getElementById('cropControls');
const btnApplyCrop = document.getElementById('btnApplyCrop');
const btnCancelCrop = document.getElementById('btnCancelCrop');

btnStartCrop.addEventListener('click', () => {
    if (!canvas.backgroundImage) return;
    
    // Hide start button, show controls
    btnStartCrop.classList.add('hidden');
    cropControls.classList.remove('hidden');
    cropControls.classList.add('flex');
    
    // Initial crop rect
    const w = canvas.width;
    const h = canvas.height;
    
    cropRect = new fabric.Rect({
        left: w * 0.1,
        top: h * 0.1,
        width: w * 0.8,
        height: h * 0.8,
        fill: 'rgba(0,0,0,0.4)',
        cornerColor: '#22C55E',
        borderColor: '#22C55E',
        cornerSize: 12,
        transparentCorners: false,
        lockRotation: true,
        hasRotatingPoint: false
    });
    
    canvas.add(cropRect);
    canvas.setActiveObject(cropRect);
});

btnCancelCrop.addEventListener('click', () => {
    if (cropRect) {
        canvas.remove(cropRect);
        cropRect = null;
    }
    btnStartCrop.classList.remove('hidden');
    cropControls.classList.remove('flex');
    cropControls.classList.add('hidden');
});

btnApplyCrop.addEventListener('click', () => {
    if (!cropRect || !canvas.backgroundImage) return;
    
    // Calculate final rectangle bounds considering object scaling
    // rect coords might be scaled if user resized the rectangle via corners
    const rect = cropRect.getBoundingRect();
    
    // Ensure we don't go outside the canvas bounds
    const cropX = Math.max(0, rect.left);
    const cropY = Math.max(0, rect.top);
    const cropW = Math.min(canvas.width - cropX, rect.width);
    const cropH = Math.min(canvas.height - cropY, rect.height);

    // Hide all foreground objects including the cropRect, so only the background remains
    const objects = canvas.getObjects();
    const visibilityMap = new Map();
    objects.forEach(o => {
        visibilityMap.set(o, o.visible);
        o.set('visible', false);
    });
    
    // Deselect everything
    canvas.discardActiveObject();
    canvas.renderAll();
    
    // Extract the cropped region of the canvas
    const croppedDataURL = canvas.toDataURL({
        left: cropX,
        top: cropY,
        width: cropW,
        height: cropH,
        format: 'jpeg',
        quality: 1
    });
    
    // Restore objects visibility
    objects.forEach(o => o.set('visible', visibilityMap.get(o)));
    canvas.remove(cropRect);
    cropRect = null;
    
    // Load as new background
    fabric.Image.fromURL(croppedDataURL, function(img) {
        resetCanvasSize(img.width, img.height);
        
        img.set({
            originX: 'center',
            originY: 'center',
            left: img.width / 2,
            top: img.height / 2,
        });
        
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        
        // Shift all drawn objects so they stay in relative position
        canvas.getObjects().forEach(o => {
            o.set({
                left: o.left - cropX,
                top: o.top - cropY
            });
            o.setCoords();
        });
        canvas.renderAll();
        
        // Hide controls
        btnStartCrop.classList.remove('hidden');
        cropControls.classList.remove('flex');
        cropControls.classList.add('hidden');
    });
});

// --- Tools: Add Text ---
document.getElementById('addText').addEventListener('click', () => {
    const text = new fabric.IText('Nuevo Texto', {
        left: canvas.width / 2 - 50 || 100,
        top: canvas.height / 2 - 20 || 100,
        fontFamily: '"ABBvoice", "ABB Voice", "Helvetica", Arial, sans-serif',
        fill: '#FF000F',
        fontSize: 24,
        fontWeight: 'bold',
        hasControls: true
    });
    canvas.add(text);
    canvas.setActiveObject(text);
});

// --- Tools: Add Symbols ---
// Since we don't have SVGs yet, we generate vector icons for the user inside the canvas
document.querySelectorAll('.add-symbol').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        let iconGroup;
        let defaultText = '';

        // Create vector equivalents using Fabric.js primitives
        if (type === 'aterramiento') {
            defaultText = 'Tierra';
            // Earth/Ground symbol
            const line = new fabric.Line([20, 0, 20, 30], { fill: '#b45309', stroke: '#b45309', strokeWidth: 3 });
            const p1 = new fabric.Line([0, 30, 40, 30], { fill: '#b45309', stroke: '#b45309', strokeWidth: 3 });
            const p2 = new fabric.Line([8, 38, 32, 38], { fill: '#b45309', stroke: '#b45309', strokeWidth: 3 });
            const p3 = new fabric.Line([16, 46, 24, 46], { fill: '#b45309', stroke: '#b45309', strokeWidth: 3 });
            
            iconGroup = new fabric.Group([line, p1, p2, p3], {
                left: canvas.width / 2 || 100,
                top: canvas.height / 2 || 100,
            });
        } 
        else if (type === 'aislamiento') {
            defaultText = 'Aislamiento';
            // Disconnect/Isolation switch
            const rect = new fabric.Rect({
                left: 0, top: 0, width: 40, height: 40, 
                fill: 'transparent', stroke: '#3b82f6', strokeWidth: 4, rx: 5, ry: 5
            });
            const line1 = new fabric.Line([10, 10, 30, 30], { stroke: '#3b82f6', strokeWidth: 3 });
            const line2 = new fabric.Line([30, 10, 10, 30], { stroke: '#3b82f6', strokeWidth: 3 });
            
            iconGroup = new fabric.Group([rect, line1, line2], {
                left: canvas.width / 2 || 100,
                top: canvas.height / 2 || 100,
            });
        }
        else if (type === 'bloqueo') {
            defaultText = 'Bloqueo LOTO';
            // LOTO Lock symbol
            const lockBody = new fabric.Rect({
                left: 10, top: 20, width: 30, height: 30, rx: 3, ry: 3,
                fill: '#FF000F'
            });
            const shackle = new fabric.Path('M 15 20 L 15 10 A 10 10 0 0 1 35 10 L 35 20', {
                fill: 'transparent', stroke: '#71717a', strokeWidth: 4
            });
            const keyhole = new fabric.Circle({
                radius: 3, fill: 'white', left: 22, top: 28
            });
            const keyholeLine = new fabric.Line([25, 33, 25, 40], {
                stroke: 'white', strokeWidth: 2
            });

            iconGroup = new fabric.Group([shackle, lockBody, keyhole, keyholeLine], {
                left: canvas.width / 2 || 100,
                top: canvas.height / 2 || 100,
            });
        }

        if (iconGroup) {
            const groupCenter = iconGroup.getCenterPoint();
            const textObj = new fabric.Text(defaultText, {
                fontSize: 16,
                fill: '#000000',
                fontFamily: '"ABBvoice", "ABB Voice", "Helvetica", Arial, sans-serif',
                originX: 'center',
                originY: 'top',
                left: groupCenter.x,
                top: groupCenter.y + (iconGroup.height / 2) + 5,
                id: 'symbolLabel'
            });
            
            const realGroup = new fabric.Group([iconGroup, textObj], {
                left: canvas.width / 2 || 100,
                top: canvas.height / 2 || 100,
                isSymbolGroup: true,
                tooltipText: defaultText
            });
            
            canvas.add(realGroup);
            canvas.setActiveObject(realGroup);
        }
    });
});

// --- Delete Selected ---
// Manage delete button state
canvas.on('selection:created', handleSelection);
canvas.on('selection:updated', handleSelection);
canvas.on('selection:cleared', () => {
    btnDelete.disabled = true;
    propertiesPanel.classList.add('hidden');
});

function handleSelection() {
    btnDelete.disabled = false;
    updatePropertiesPanel();
}

// --- Properties Panel (Text & Symbols) ---
const propertiesPanel = document.getElementById('propertiesPanel');
const textOnlyProps = document.getElementById('textOnlyProps');
const propSymbolText = document.getElementById('propSymbolText');
const propFontSize = document.getElementById('propFontSize');
const propFillColor = document.getElementById('propFillColor');

function updatePropertiesPanel() {
    const activeObj = canvas.getActiveObject();
    
    if (activeObj && activeObj.type === 'i-text') {
        // Plain text properties
        propertiesPanel.classList.remove('hidden');
        propertiesPanel.classList.add('block');
        textOnlyProps.classList.remove('hidden');
        textOnlyProps.classList.add('flex');
        
        propSymbolText.value = activeObj.text || '';
        propFontSize.value = activeObj.fontSize;
        
        // Match color strictly to dropdown
        let color = activeObj.fill.toUpperCase();
        propFillColor.value = color;
        // Fallback if not primary
        if (propFillColor.selectedIndex === -1) propFillColor.selectedIndex = 0;
        
    } else if (activeObj && activeObj.isSymbolGroup) {
        // Symbol with tooltip text and visible text
        propertiesPanel.classList.remove('hidden');
        propertiesPanel.classList.add('block');
        textOnlyProps.classList.add('hidden');
        textOnlyProps.classList.remove('flex');
        
        propSymbolText.value = activeObj.tooltipText || '';
        const textObj = activeObj.getObjects().find(o => o.id === 'symbolLabel');
        if (textObj) {
            let color = textObj.fill.toUpperCase();
            propFillColor.value = color;
            if (propFillColor.selectedIndex === -1) propFillColor.selectedIndex = 0;
        } else {
            propFillColor.value = '#000000'; 
        }
    } else {
        propertiesPanel.classList.add('hidden');
        propertiesPanel.classList.remove('block');
    }
}

function applyProperties() {
    const activeObj = canvas.getActiveObject();
    
    if (activeObj && activeObj.type === 'i-text') {
        activeObj.set({
            text: propSymbolText.value,
            fontSize: parseInt(propFontSize.value, 10),
            fill: propFillColor.value
        });
        canvas.renderAll();
    } else if (activeObj && activeObj.isSymbolGroup) {
        activeObj.set('tooltipText', propSymbolText.value);
        const textObj = activeObj.getObjects().find(o => o.id === 'symbolLabel');
        if (textObj) {
            textObj.set({
                text: propSymbolText.value,
                fill: propFillColor.value
            });
            activeObj.addWithUpdate(); // Recalculate group bounding box since text changed
            canvas.renderAll();
        }
    }
}

propSymbolText.addEventListener('input', applyProperties);
propFontSize.addEventListener('input', applyProperties);
propFillColor.addEventListener('change', applyProperties);

btnDelete.addEventListener('click', () => {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
        canvas.discardActiveObject();
        activeObjects.forEach(function(object) {
            canvas.remove(object);
        });
    }
});

// Bind Delete key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent deleting if typing inside text
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            btnDelete.click();
        }
    }
});

// --- Export/Download ---
document.getElementById('btnExport').addEventListener('click', async () => {
    if (canvas.getObjects().length === 0 && !canvas.backgroundImage) {
        alert('No hay documento para descargar.');
        return;
    }
    
    const format = document.getElementById('exportFormat').value;

    // Deselect objects so selection handles aren't exported
    canvas.discardActiveObject();
    canvas.renderAll();
    
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1
    });

    if (format === 'png') {
        const link = document.createElement('a');
        link.download = 'Diagrama_Unifilar_ABB_Editado.png';
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } 
    else if (format === 'pdf') {
        // Use PDFLib to merge PETS text and Canvas
        const { PDFDocument } = PDFLib;
        let pdfDoc;

        if (petsFileBuffer) {
            try {
                pdfDoc = await PDFDocument.load(petsFileBuffer);
            } catch(e) {
                alert("Error al leer el PETS adjunto. Creando PDF estándar.");
                pdfDoc = await PDFDocument.create();
            }
        } else {
            pdfDoc = await PDFDocument.create();
        }

        // Convert base64 DataURL to Uint8Array for PDFLib
        const base64Data = dataURL.split(',')[1];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        
        const pngImage = await pdfDoc.embedPng(bytes);

        // Add a new page exactly the size of the canvas at the END
        const page = pdfDoc.addPage([canvas.width, canvas.height]);
        page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
        });

        // Try to append form annotation tooltips to this specific page
        try {
            const form = pdfDoc.getForm();
            canvas.getObjects().forEach(obj => {
                if (obj.isSymbolGroup && obj.tooltipText) {
                    let rect = obj.getBoundingRect();
                    const fieldName = "Symbol_" + Math.random().toString(36).substr(2, 9);
                    const textField = form.createTextField(fieldName);
                    textField.setText(obj.tooltipText);
                    
                    // Coordinates translation (Fabric origin is top-left, PDF is bottom-left)
                    const bottomY = canvas.height - rect.top - rect.height;
                    
                    textField.addToPage(page, { 
                        x: rect.left, 
                        y: bottomY, 
                        width: rect.width, 
                        height: rect.height,
                        borderWidth: 0
                    });
                    textField.enableReadOnly();
                }
            });
        } catch(e) {
            console.log("No se pudieron inyectar tooltips debido a estructura existente del PETS u otro factor.", e);
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Unifilar_Consolidado_ABB.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    else if (format === 'html') {
        let tooltipsHTML = '';
        canvas.getObjects().forEach(obj => {
            if (obj.isSymbolGroup && obj.tooltipText) {
                let rect = obj.getBoundingRect();
                tooltipsHTML += `
                <div class="tooltip-zone" 
                     data-title="${obj.tooltipText}"
                     style="left: ${rect.left}px; top: ${rect.top}px; width: ${rect.width}px; height: ${rect.height}px;">
                </div>`;
            }
        });

        const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Diagrama Unifilar Interactivo</title>
<style>
  body { 
    margin: 0; background: #e5e7eb; display: flex; justify-content: center; 
    align-items: center; min-height: 100vh; font-family: "Helvetica Neue", Arial, sans-serif; 
    padding: 20px; box-sizing: border-box;
  }
  .canvas-wrapper { 
    position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
    background: #fff; 
    width: ${canvas.width}px; 
    height: ${canvas.height}px;
    max-width: 100%;
  }
  img { 
    display: block; width: 100%; height: 100%; object-fit: contain;
  }
  .tooltip-zone {
    position: absolute;
    cursor: pointer;
  }
  .tooltip-zone::after {
    content: attr(data-title);
    position: absolute;
    bottom: 100%; left: 50%;
    transform: translateX(-50%);
    background: #222222;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    margin-bottom: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10;
  }
  .tooltip-zone::before {
    content: '';
    position: absolute;
    bottom: 100%; left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: #222222 transparent transparent transparent;
    opacity: 0;
    transition: opacity 0.2s;
    margin-bottom: -4px;
  }
  .tooltip-zone:hover::after, .tooltip-zone:hover::before {
    opacity: 1;
  }
</style>
</head>
<body>
  <div class="canvas-wrapper">
    <img src="${dataURL}" alt="Diagrama Unifilar">
    ${tooltipsHTML}
  </div>
  <script id="unifilar-data" type="application/json">${JSON.stringify(canvas.toJSON(['isSymbolGroup', 'tooltipText', 'id']))}</script>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Diagrama_Unifilar_ABB_Editado.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
});

// --- Tooltips for Canvas Objects ---
const canvasTooltip = document.createElement('div');
canvasTooltip.className = 'absolute bg-gray-800 text-white text-xs px-2 py-1 rounded pointer-events-none opacity-0 transition-opacity z-50';
document.body.appendChild(canvasTooltip);

canvas.on('mouse:over', function(e) {
    if (e.target && e.target.tooltipText) {
        canvasTooltip.innerHTML = e.target.tooltipText;
        canvasTooltip.style.opacity = '1';
    }
});

canvas.on('mouse:out', function(e) {
    canvasTooltip.style.opacity = '0';
});

canvas.on('mouse:move', function(e) {
    if (canvasTooltip.style.opacity === '1') {
        canvasTooltip.style.left = (e.e.clientX + 15) + 'px';
        canvasTooltip.style.top = (e.e.clientY + 15) + 'px';
    }
});
