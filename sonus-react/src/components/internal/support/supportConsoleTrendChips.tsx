import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function TrendDelta({ deltaPct }: { deltaPct: number }) {
  const safeDelta = Number.isFinite(deltaPct) ? deltaPct : 0;
  const rounded = Math.round(safeDelta * 10) / 10;
  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
        <ArrowUpRight className="h-3.5 w-3.5" />+{rounded}%
      </span>
    );
  }
  if (rounded < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {rounded}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
      <Minus className="h-3.5 w-3.5" />
      0%
    </span>
  );
}

export function MissTrendDelta({ deltaPct }: { deltaPct: number }) {
  const safeDelta = Number.isFinite(deltaPct) ? deltaPct : 0;
  const rounded = Math.round(safeDelta * 10) / 10;
  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
        <ArrowUpRight className="h-3.5 w-3.5" />+{rounded}%
      </span>
    );
  }
  if (rounded < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {rounded}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
      <Minus className="h-3.5 w-3.5" />
      0%
    </span>
  );
}

