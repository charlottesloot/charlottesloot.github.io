import jsPDF from 'https://cdn.skypack.dev/jspdf';

const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const center = { x: canvas.width / 2, y: canvas.height / 2 };

const canvasPRINT = document.getElementById('hiResCanvas');
const ctxPRINT = canvasPRINT.getContext('2d');
const centerPRINT = { x: canvasPRINT.width / 2, y: canvasPRINT.height / 2 };

const ringSpacing = 10;
const borderThickness = 4;

const circleConfig = [
    // Circle will not render if values are not between min and max values.
    { id: 'inner', min: 2, max: 20 }, // 👈 Allow up to 30
    { id: 'middle', min: 2, max: 30 }, // 👈 Allow up to 30
    { id: 'outer', min: 2, max: 45 }  // 👈 Allow up to 45
];

function getRingBounds(targetCanvas, scale = 1) {
    const totalRingCount = circleConfig.length;
    const innerGap = 30 * scale;
    const ringSpacing = 10 * scale;

    // const maxUsableRadius = Math.min(targetCanvas.width, targetCanvas.height) / 2;
    const margin = 10 * scale;  // ⬅ Add a 10px margin on all sides (scaled!)
    const maxUsableRadius = Math.min(targetCanvas.width, targetCanvas.height) / 2 - margin;
    const totalSpacing = (totalRingCount - 1) * ringSpacing;
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

function drawRingSegments(ctx, center, scale, strings, innerR, outerR, strokeColor, textColor) {
    const angleStep = (2 * Math.PI) / strings.length;
    const fontSize = 10 * scale;
    const lineHeight = fontSize;
    const strokeWidth = 4 * scale;

    strings.forEach((str, i) => {
        const angle = i * angleStep;
        const nextAngle = angle + angleStep;
        const midAngle = angle + angleStep / 2;

        ctx.beginPath();
        ctx.arc(center.x, center.y, outerR, angle, nextAngle);
        ctx.arc(center.x, center.y, innerR, nextAngle, angle, true);
        ctx.closePath();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        ctx.save();
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;

        const midRadius = (innerR + outerR) / 2;
        const tx = center.x + midRadius * Math.cos(midAngle);
        const ty = center.y + midRadius * Math.sin(midAngle);

        const arcLength = angleStep * midRadius;
        const maxTextWidth = Math.min(arcLength * 0.65, outerR - innerR - 10 * scale);
        const maxTextHeight = outerR - innerR - 10 * scale;
        const maxLines = Math.floor(maxTextHeight / lineHeight);

        ctx.translate(tx, ty);
        ctx.rotate(midAngle);

        const lines = drawWrappedText(ctx, str.trim(), maxTextWidth, maxLines);
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
    ctxPRINT.clearRect(0, 0, canvasPRINT.width, canvasPRINT.height);

    const boundsNormal = getRingBounds(canvas, 1);
    const boundsHiRes = getRingBounds(canvasPRINT, 4);  // scale factor = 4

    boundsNormal.forEach((cfg, i) => {
        const hiResCfg = boundsHiRes[i];

        const strings = document.getElementById(`text-${cfg.id}`).value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const show = document.getElementById(`show-${cfg.id}`).checked;
        const bgColor = document.getElementById(`bg-${cfg.id}`).value;
        const textColor = document.getElementById(`text-${cfg.id}`).value;

        if (show && strings.length >= cfg.min && strings.length <= cfg.max) {
            drawRingSegments(ctx, center, 1, strings, cfg.innerRadius, cfg.outerRadius, bgColor, textColor);
            drawRingSegments(ctxPRINT, centerPRINT, 4, strings, hiResCfg.innerRadius, hiResCfg.outerRadius, bgColor, textColor);
        }
    });
}

function exportToPDF() {
    const A4_MM = { width: 210, height: 297 };
    const A3_MM = { width: 297, height: 420 };
    const TARGET_SIZE_MM = 280;

    // Count visible rings
    const bounds = getRingBounds(canvasPRINT);
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
    const dataURL = canvasPRINT.toDataURL('image/png');
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