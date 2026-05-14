import React, { useState, useEffect } from 'react';

export default function AuctionTimer({ endDate }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!endDate) return;

        const tick = () => {
            const now = new Date();
            const end = new Date(endDate);
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('Scaduta');
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / (1000 * 60) % 60));
            const s = Math.floor((diff / 1000) % 60);

            // Formato: 2g 04h 15m 10s
            setTimeLeft(`${d}g ${h}h ${m}m ${s}s`);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [endDate]);

    return <span className="font-mono text-[10px] font-bold text-amber-400 ml-2">{timeLeft}</span>;
}