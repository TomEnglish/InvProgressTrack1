import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

interface HalfGaugeProps {
  earned: number;
  total: number;
  label: string;
  color?: string;
  trackColor?: string;
}

export default function HalfGauge({ earned, total, label, color = '#10b981', trackColor = '#e5e7eb' }: HalfGaugeProps) {
  const safeTotal = Math.max(total, earned);
  const remaining = Math.max(0, safeTotal - earned);
  const data = {
    datasets: [{
      data: [earned, remaining || 1],
      backgroundColor: [color, trackColor],
      borderWidth: 0,
      circumference: 180,
      rotation: 270,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    }
  };

  return (
    <div className="relative h-[110px] w-full">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
        <div className="text-2xl font-bold text-text tabular-nums">{Math.round(earned).toLocaleString()}</div>
        <div className="flex justify-between w-full px-1 text-[10px] text-text-muted tabular-nums">
          <span>0</span>
          <span>{Math.round(safeTotal / 2).toLocaleString()}</span>
          <span>{Math.round(safeTotal).toLocaleString()}</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mt-1">{label}</div>
      </div>
    </div>
  );
}
