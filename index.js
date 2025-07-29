import jsPDF from 'https://cdn.skypack.dev/jspdf';

const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const center = { x: canvas.width / 2, y: canvas.height / 2 };

const ringSpacing = 10;

const circleConfig = [
    { id: 'inner', min: 2, max: 10 },
    { id: 'middle', min: 3, max: 30 },  // 👈 Allow up to 30
    { id: 'outer', min: 4, max: 36 }    // 👈 Can be increased too
];

const borderThickness = 4;

function getRingBounds() {
    const totalRingCount = circleConfig.length;
    const borderPadding = borderThickness; // for donut stroke
    const innerGap = 30;

    // Total spacing between rings
    const totalSpacing = (totalRingCount - 1) * ringSpacing;

    // Subtract spacing and padding from available radius
    const maxUsableRadius = Math.min(canvas.width, canvas.height) / 2 - borderPadding;
    const ringWidth = (maxUsableRadius - innerGap - totalSpacing) / totalRingCount;

    let startRadius = innerGap;

    return circleConfig.map(cfg => {
        const bounds = {
            ...cfg,
            innerRadius: startRadius,
            outerRadius: startRadius + ringWidth
        };
        startRadius = bounds.outerRadius + ringSpacing;
        return bounds;
    });
}

function drawRingSegments(strings, innerR, outerR, strokeColor, textColor) {
    const angleStep = (2 * Math.PI) / strings.length;

    strings.forEach((str, i) => {
        const angle = i * angleStep;
        const nextAngle = angle + angleStep;
        const midAngle = angle + angleStep / 2;

        // Ring slice outline
        ctx.beginPath();
        ctx.arc(center.x, center.y, outerR, angle, nextAngle);
        ctx.arc(center.x, center.y, innerR, nextAngle, angle, true);
        ctx.closePath();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = borderThickness;
        ctx.stroke();

        // TEXT DRAWING WITH WRAPPING
        ctx.save();

        ctx.font = '10px sans-serif';
        const lineHeight = 10;

        const midRadius = (innerR + outerR) / 2;
        const tx = center.x + midRadius * Math.cos(midAngle);
        const ty = center.y + midRadius * Math.sin(midAngle);

        const arcLength = angleStep * midRadius;
        const maxTextWidth = Math.min(arcLength * 0.65, outerR - innerR - 10); 

        const maxTextHeight = outerR - innerR - 10;
        const maxLines = Math.floor(maxTextHeight / lineHeight);

        ctx.translate(tx, ty);
        ctx.rotate(midAngle);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;

        const lines = drawWrappedText(ctx, str.trim(), maxTextWidth, maxLines);
        const totalHeight = lines.length * lineHeight;

        lines.forEach((line, i) => {
            ctx.fillText(line, 0, (i - lines.length / 2 + 0.5) * lineHeight);
        });

        ctx.restore();
    });
}

function drawWrappedText(ctx, text, maxWidth, maxLines) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const width = ctx.measureText(testLine).width;
        if (width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) lines.push(currentLine);

    // Trim if too many lines
    if (lines.length > maxLines) {
        lines.length = maxLines;
        const last = lines[lines.length - 1];
        lines[lines.length - 1] = last + '…';
    }

    return lines;
}

function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bounds = getRingBounds();

    bounds.forEach(cfg => {
        const strings = document.getElementById(`text-${cfg.id}`).value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const show = document.getElementById(`show-${cfg.id}`).checked;
        const bgColor = document.getElementById(`bg-${cfg.id}`).value;
        const textColor = document.getElementById(`text-${cfg.id}`).value;

        if (show && strings.length >= cfg.min && strings.length <= cfg.max) {
            drawRingSegments(strings, cfg.innerRadius, cfg.outerRadius, bgColor, textColor);
        }
    });
}

function exportToPDF() {
    const A4_MM = { width: 210, height: 297 };
    const A3_MM = { width: 297, height: 420 };
    const TARGET_SIZE_MM = 280;
    const CANVAS_SIZE_PX = 900;

    // Count visible rings
    const bounds = getRingBounds();
    let visibleRings = 0;
    bounds.forEach(cfg => {
        const show = document.getElementById(`show-${cfg.id}`).checked;
        const strings = document.getElementById(`text-${cfg.id}`).value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        if (show && strings.length >= cfg.min && strings.length <= cfg.max) {
            visibleRings++;
        }
    });

    const paperSize = visibleRings === 1 ? A4_MM : A3_MM;

    // Create the PDF in millimeters
    const pdf = new jsPDF({
        unit: 'mm',
        orientation: 'portrait',
        format: [paperSize.width, paperSize.height]
    });

    // Draw canvas content to temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE_PX;
    tempCanvas.height = CANVAS_SIZE_PX;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    const dataURL = tempCanvas.toDataURL('image/png');

    // Center the drawing
    const xOffset = (paperSize.width - TARGET_SIZE_MM) / 2;
    const yOffset = (paperSize.height - TARGET_SIZE_MM) / 2;

    // Scale canvas from 900px to 280mm
    pdf.addImage(dataURL, 'PNG', xOffset, yOffset, TARGET_SIZE_MM, TARGET_SIZE_MM);
    pdf.save('diagram.pdf');
}


document.getElementById('drawBtn').addEventListener('click', drawAll);
document.getElementById('exportBtn').addEventListener('click', exportToPDF);

drawAll(); // Initial draw