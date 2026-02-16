interface WordProgressRailProps {
  total: number;
  currentIndex: number;
  resultsByIndex?: Record<number, boolean>;
}

function nodeClasses(
  index: number,
  currentIndex: number,
  resultsByIndex: Record<number, boolean> | undefined
) {
  const hasResult = resultsByIndex ? Object.prototype.hasOwnProperty.call(resultsByIndex, index) : false;
  if (hasResult) {
    return resultsByIndex?.[index]
      ? 'bg-[#3E5648] border-[#3E5648]'
      : 'bg-[#E5E7EB] border-[#D1D5DB]';
  }
  if (index === currentIndex) {
    return 'bg-white border-[#186E95] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]';
  }
  if (index < currentIndex) {
    return 'bg-[rgba(55,65,81,0.26)] border-[rgba(55,65,81,0.34)]';
  }
  return 'bg-[rgba(255,255,255,0.7)] border-[rgba(148,163,184,0.45)]';
}

function connectorClasses() {
  // Keep connectors neutral; only nodes communicate correct/wrong state.
  return 'bg-[rgba(148,163,184,0.5)]';
}

export default function WordProgressRail({
  total,
  currentIndex,
  resultsByIndex,
}: WordProgressRailProps) {
  const clampedTotal = Math.max(1, total);
  const clampedIndex = Math.min(Math.max(0, currentIndex), clampedTotal - 1);
  const nodes = Array.from({ length: clampedTotal }, (_, index) => index);

  return (
    <div className="mb-2 rounded-2xl border border-white/85 bg-white/68 px-3 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <div className="flex items-center">
        {nodes.map((index) => (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <div
              className={`h-3 w-3 rounded-full border transition-colors duration-200 ${nodeClasses(
                index,
                clampedIndex,
                resultsByIndex
              )}`}
            />
            {index < nodes.length - 1 ? (
              <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors duration-200 ${connectorClasses()}`} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
