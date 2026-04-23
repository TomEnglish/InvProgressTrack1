import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SCurveChartProps {
  snapshots: any[];
}

export default function SCurveChart({ snapshots }: SCurveChartProps) {
  // Sort temporally to ensure linear progression
  const sorted = [...snapshots].sort((a,b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
  
  const chartData = {
    labels: sorted.map(s => s.label),
    datasets: [
      {
        label: 'Planned (Cum.)',
        data: sorted.map(s => Number(s.total_budget)),
        borderColor: 'rgba(148, 163, 184, 0.7)',
        borderDash: [5, 5],
        fill: false,
        tension: 0.3
      },
      {
        label: 'Earned Value (Cum.)',
        data: sorted.map(s => Number(s.total_earned)),
        borderColor: '#059669', // Success green indicating progression
        backgroundColor: '#059669',
        tension: 0.3
      },
      {
        label: 'Actual Cost (Cum.)',
        data: sorted.map(s => Number(s.total_actual)),
        borderColor: '#0369a1', // Primary tracker
        backgroundColor: '#0369a1',
        tension: 0.3
      }
    ]
  };

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

  return <Line data={chartData} options={options} />;
}
