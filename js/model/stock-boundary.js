class BoundaryStock extends Stock {
    constructor(configuration) {
        super(configuration);
    }

    get showValue() { return false; }
    get isContentDark() { return false; }

    drawHighlight(context, r) {
        context.beginPath();
        context.arc(0, 0, r + 40, 0, Math.TAU, false);
        context.fillStyle = HIGHLIGHT_COLOR;
        context.fill();
    }

    drawShape(context, color, r) {
        context.beginPath();
        context.arc(0, 0, r - 2, 0, Math.TAU, false);
        
        // Dashed border for BoundaryStock
        context.setLineDash([15, 10]); 
        context.lineWidth = 4;
        context.strokeStyle = color;
        context.stroke();
        
        // Subtle fill
        context.globalAlpha = 0.05;
        context.fillStyle = color;
        context.fill();
        context.globalAlpha = 1.0;
        context.setLineDash([]); // Reset dash
    }

    drawValue(context, color, r) {
        // No value level drawn for BoundaryStock as it is "infinite/inapplicable"
    }

    isPointInStock(context, x, y, buffer) {
        return _isPointInCircle(x, y, this.x, this.y, this.radius + (buffer || 0));
    };

    kill(silent) {
        super.kill(silent);
    }
}
