import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scales a fixed-size (mm) print sheet to fit its container while preserving
 * the exact A4 / A5 geometry for the live preview.
 */
export function ScaledSheet({
  widthMm,
  heightMm,
  children,
  className,
}: {
  widthMm: number;
  heightMm: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      const targetPx = widthMm * 3.7795275591;
      if (width > 0) setScale(Math.min(1, width / targetPx));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [widthMm]);

  return (
    <div ref={ref} className={className} style={{ width: "100%" }}>
      <div
        style={{
          width: `${widthMm * scale}mm`,
          height: `${heightMm * scale}mm`,
          position: "relative",
          marginInline: "auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            insetInlineStart: 0,
            width: `${widthMm}mm`,
            height: `${heightMm}mm`,
            transform: `scale(${scale})`,
            transformOrigin: "top right",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
