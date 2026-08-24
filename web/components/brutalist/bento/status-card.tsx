"use client";

import { useEffect, useState } from "react";

const APIS = [
  { name: "COLLECTIONS", status: "READY", latency: "ok" },
  { name: "DOCUMENTS", status: "READY", latency: "ok" },
  { name: "KEY-VALUE", status: "READY", latency: "ok" },
  { name: "FILES", status: "READY", latency: "ok" },
];

export function StatusCard() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          studio.status
        </span>
        <span className="text-[10px] tracking-widest text-muted-foreground">
          {`TICK:${String(tick).padStart(4, "0")}`}
        </span>
      </div>
      <div className="flex-1 flex flex-col p-4 gap-0">
        <div className="grid grid-cols-3 gap-2 border-b border-border pb-2 mb-2">
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
            Surface
          </span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
            State
          </span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground text-right">
            Local
          </span>
        </div>
        {APIS.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-none"
          >
            <span className="text-xs font-mono text-foreground">{row.name}</span>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5"
                style={{ backgroundColor: "#ea580c" }}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {row.status}
              </span>
            </div>
            <span className="text-xs font-mono text-foreground text-right">
              {row.latency}
            </span>
          </div>
        ))}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
              Token stays local
            </span>
            <span className="text-[9px] font-mono text-foreground">100%</span>
          </div>
          <div className="h-2 w-full border border-foreground">
            <div className="h-full bg-foreground" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
