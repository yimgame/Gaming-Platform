export default function ScanlineOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 240, 255, 0.1) 2px,
            rgba(0, 240, 255, 0.1) 4px
          )`,
          animation: "scanline 8s linear infinite",
        }}
      />
      
      <div 
        className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.01] to-transparent opacity-20"
        style={{
          animation: "scanline 8s linear infinite",
        }}
      />
    </div>
  );
}
