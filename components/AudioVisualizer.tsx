import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
    isConnected: boolean;
    volume: number; // 0 to 1
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isConnected, volume }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const timeRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Retina display support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const draw = () => {
            timeRef.current += 0.05;
            ctx.clearRect(0, 0, rect.width, rect.height);

            if (!isConnected) {
                // Idle state: straight line
                ctx.beginPath();
                ctx.moveTo(0, rect.height / 2);
                ctx.lineTo(rect.width, rect.height / 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 2;
                ctx.stroke();
                animationRef.current = requestAnimationFrame(draw);
                return;
            }

            const centerY = rect.height / 2;
            const barCount = 40;
            const spacing = rect.width / barCount;
            
            // Smoothed volume for animation
            const amplitude = Math.max(10, volume * 150); 

            // Draw fluid wave
            ctx.beginPath();
            
            for(let i = 0; i <= rect.width; i+= 5) {
                const x = i;
                // Complex wave function for organic look
                const wave1 = Math.sin(x * 0.01 + timeRef.current) * amplitude * 0.5;
                const wave2 = Math.sin(x * 0.02 - timeRef.current * 1.5) * amplitude * 0.3;
                const y = centerY + wave1 + wave2;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            ctx.strokeStyle = `rgba(100, 180, 255, ${0.3 + volume})`;
            ctx.lineWidth = 3 + (volume * 5);
            ctx.lineCap = 'round';
            ctx.stroke();

            // Glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
            ctx.stroke();
            ctx.shadowBlur = 0;

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [isConnected, volume]);

    return <canvas ref={canvasRef} className="w-full h-full" />;
};
