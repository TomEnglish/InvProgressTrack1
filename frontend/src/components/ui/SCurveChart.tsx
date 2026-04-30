import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SCurveSnapshot {
  kind?: string;
  snapshot_date: string;
  week_ending?: string | null;
  label: string;
  total_budget: number;
  total_earned: number;
  total_actual: number;
}

interface SCurveChartProps {
  snapshots: SCurveSnapshot[];
}

export default function SCurveChart({ snapshots }: SCurveChartProps) {
  const baseline = snapshots.find(s => s.kind === 'baseline_first_audit');
  const weekly = [...snapshots]
    .filter(s => s.kind !== 'baseline_first_audit')
    .sort((a, b) => {
      const ad = new Date(a.week_ending ?? a.snapshot_date).getTime();
      const bd = new Date(b.week_ending ?? b.snapshot_date).getTime();
      return ad - bd;
    });

  const labels = weekly.map(s => s.label);

  const datasets: any[] = [
    {
      label: 'Planned (Cum.)',
      data: weekly.map(s => Number(s.total_budget)),
      borderColor: 'rgba(148, 163, 184, 0.7)',
      borderDash: [5, 5],
      fill: false,
      tension: 0.3,
      pointRadius: 2,
    },
  ];

  if (baseline) {
    datasets.push({
      label: 'Baseline – 1st Audit',
      data: weekly.map(() => Number(baseline.total_earned)),
      borderColor: 'rgba(217, 119, 6, 0.55)',
      borderWidth: 1.5,
      fill: false,
      tension: 0,
      pointRadius: 0,
    });
  }

  datasets.push(
    {
      label: 'Earned Value (Cum.)',
      data: weekly.map(s => Number(s.total_earned)),
      borderColor: '#059669',
      backgroundColor: '#059669',
      tension: 0.3,
    },
    {
      label: 'Actual Cost (Cum.)',
      data: weekly.map(s => Number(s.total_actual)),
      borderColor: '#0369a1',
      backgroundColor: '#0369a1',
      tension: 0.3,
    }
  );

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  return <Line data={{ labels, datasets }} options={options} />;
}
