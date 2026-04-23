import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DisciplineChartProps {
  data: any[];
}

export default function DisciplineChart({ data }: DisciplineChartProps) {
  const chartData = {
    labels: data.map(d => d.discipline_name),
    datasets: [
      {
        label: 'Budget Hours',
        data: data.map(d => Number(d.total_budget)),
        backgroundColor: 'rgba(148, 163, 184, 0.35)', // subtle gray layout
        borderRadius: 4,
      },
      {
        label: 'Earned Hours',
        data: data.map(d => Number(d.total_earned)),
        backgroundColor: '#0369a1', // brand primary
        borderRadius: 4,
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

  return <Bar data={chartData} options={options} />;
}
