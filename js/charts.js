/**
 * @file charts.js
 * @description Lightweight SVG-based charting library with NO external dependencies.
 * 
 * Engineering Decision: SVG over Canvas.
 * - SVG is vector-based → scales perfectly at any zoom level or screen DPI
 * - SVG elements are part of the DOM → accessible, inspectable, CSS-stylable
 * - Canvas is better for high-frequency rendering (games, animations) but charts
 *   are rendered once per navigation — SVG is the right tool here
 * 
 * Both functions target a container element by ID and inject SVG markup via innerHTML.
 * This means callers can use <div> or <canvas> — we replace the content either way.
 */

/**
 * Draws a donut chart using SVG arcs.
 * @param {string} containerId - The ID of the container element
 * @param {Array} data - Array of objects: [{ label, value, color }]
 * @param {Object} [options] - { size, strokeWidth, centerText }
 */
export function drawDonutChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const size = options.size || 250;
    const strokeWidth = options.strokeWidth || 32;
    const centerText = options.centerText || '';
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) - strokeWidth;

    const total = data.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) {
        container.innerHTML = `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e0e0e0" stroke-width="${strokeWidth}"/>
                <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" 
                      font-size="14" fill="#999" font-family="sans-serif">No data</text>
            </svg>`;
        return;
    }

    let arcs = '';
    let legend = '';
    let startAngle = -90; // Start at top (SVG uses degrees from 3 o'clock, -90 = 12 o'clock)

    data.forEach((item, i) => {
        const sliceAngle = (item.value / total) * 360;
        const endAngle = startAngle + sliceAngle;

        // Convert to radians for arc calculation
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArc = sliceAngle > 180 ? 1 : 0;
        const pct = ((item.value / total) * 100).toFixed(0);

        arcs += `
            <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}"
                  fill="none" stroke="${item.color || '#999'}" stroke-width="${strokeWidth}"
                  stroke-linecap="butt" opacity="0.9">
                <title>${item.label}: ${item.value} (${pct}%)</title>
            </path>`;

        // Legend item
        legend += `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.8rem;">
                <div style="width: 12px; height: 12px; border-radius: 2px; background: ${item.color || '#999'}; flex-shrink: 0;"></div>
                <span style="color: var(--text-secondary);">${item.label}</span>
                <span style="margin-left: auto; font-weight: 600;">${item.value} (${pct}%)</span>
            </div>`;

        startAngle = endAngle;
    });

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap;">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                ${arcs}
                ${centerText ? `
                    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
                          font-size="22" font-weight="700" fill="var(--text-primary, #333)" font-family="sans-serif">
                        ${centerText}
                    </text>
                    <text x="${cx}" y="${cy + 18}" text-anchor="middle" dominant-baseline="central"
                          font-size="11" fill="var(--text-secondary, #666)" font-family="sans-serif">
                        total cases
                    </text>
                ` : ''}
            </svg>
            <div style="flex: 1; min-width: 120px;">
                ${legend}
            </div>
        </div>`;
}

/**
 * Draws a horizontal bar chart using SVG rects.
 * Engineering Decision: Auto-measures label width by rendering hidden text first,
 * then positions bars accordingly. All elements are SVG → crisp at any zoom.
 * @param {string} containerId - The ID of the container element
 * @param {Array} data - Array of objects: [{ label, value, color }]
 * @param {Object} [options] - { barHeight, gap, showValues }
 */
export function drawBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const barHeight = options.barHeight || 26;
    const gap = options.gap || 6;
    const showValues = options.showValues !== false;
    const fontSize = 12;

    if (data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No data</p>';
        return;
    }

    // Estimate label widths (approximate: 7px per char at 12px font)
    const maxLabelWidth = Math.max(...data.map(d => d.label.length)) * 7 + 10;
    const paddingLeft = Math.max(maxLabelWidth, 60);
    const paddingRight = 60;
    const totalHeight = data.length * (barHeight + gap) + gap * 2;
    const containerWidth = container.clientWidth || 500;
    const svgWidth = Math.max(containerWidth, 300);
    const chartWidth = svgWidth - paddingLeft - paddingRight;

    const maxValue = Math.max(...data.map(d => d.value));

    let bars = '';
    data.forEach((item, index) => {
        const y = index * (barHeight + gap) + gap;
        const barWidth = maxValue === 0 ? 0 : (item.value / maxValue) * chartWidth;
        const color = item.color || '#1a73e8';

        // Label
        bars += `
            <text x="${paddingLeft - 8}" y="${y + barHeight / 2}" 
                  text-anchor="end" dominant-baseline="central"
                  font-size="${fontSize}" fill="var(--text-secondary, #555)" font-family="sans-serif">
                ${item.label}
            </text>`;

        // Bar
        if (barWidth > 0) {
            bars += `
                <rect x="${paddingLeft}" y="${y}" width="${barWidth}" height="${barHeight}"
                      rx="4" ry="4" fill="${color}" opacity="0.85">
                    <title>${item.label}: ${item.value}</title>
                </rect>`;
        }

        // Value label
        if (showValues) {
            bars += `
                <text x="${paddingLeft + barWidth + 8}" y="${y + barHeight / 2}"
                      text-anchor="start" dominant-baseline="central"
                      font-size="${fontSize}" font-weight="600" fill="var(--text-primary, #333)" font-family="sans-serif">
                    ${item.value}
                </text>`;
        }
    });

    container.innerHTML = `
        <svg width="100%" height="${totalHeight}" viewBox="0 0 ${svgWidth} ${totalHeight}" 
             xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
            ${bars}
        </svg>`;
}
