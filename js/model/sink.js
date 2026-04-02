class Sink extends Node {
    constructor(configuration) {
        super(configuration);
    }

    drawHighlight(context, r) {
        var radius = this.width / 2;
        context.beginPath();
        context.arc(0, 0, (radius + 10) * 2, 0, Math.PI * 2, false); 
        context.fillStyle = HIGHLIGHT_COLOR;
        context.fill();
    }

    drawShape(context, color, r) {
        context.beginPath();
        context.arc(0, 0, r - 2, 0, Math.PI * 2, false);

        // Dashed border for Sink (Boundary)
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

    isPointInNode(context, x, y, buffer) {
        return _isPointInCircle(x, y, this.x, this.y, this.radius + (buffer || 0));
    };

    kill(silent) {
        super.kill(silent);
    }
}
