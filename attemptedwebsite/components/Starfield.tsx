"use client";

import { useEffect, useRef } from "react";

export default function Starfield() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        // Star config
        const stars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
        const STAR_COUNT = 150;

        const initStars = () => {
            stars.length = 0;
            for (let i = 0; i < STAR_COUNT; i++) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.5,
                    alpha: Math.random(),
                    speed: Math.random() * 0.05 + 0.01,
                });
            }
        };

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            initStars();
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#a3a3a3"; // --color-text-muted approx

            stars.forEach((star) => {
                star.y -= star.speed;
                if (star.y < 0) {
                    star.y = height;
                    star.x = Math.random() * width;
                }

                ctx.globalAlpha = star.alpha;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();

                // Twinkle
                if (Math.random() > 0.99) {
                    star.alpha = Math.random();
                }
            });
            requestAnimationFrame(animate);
        };

        window.addEventListener("resize", resize);
        resize();
        animate();

        return () => {
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            id="starCanvas"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 0,
                pointerEvents: "none",
                width: "100%",
                height: "100%",
            }}
        />
    );
}
