'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import type { DailyData } from '@/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ExecutionRateChartProps {
  data: DailyData[];
}

export default function ExecutionRateChart({ data }: ExecutionRateChartProps) {
  // Format date labels (MM/DD or day name)
  const labels = data.map((d) => {
    const date = new Date(d.date + 'T00:00:00');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = dayNames[date.getDay()];
    return data.length <= 7 ? `${dayName} (${month}/${day})` : `${month}/${day}`;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: '계획 시간',
        data: data.map((d) => d.plannedHours),
        backgroundColor: 'rgba(99, 102, 241, 0.35)',
        borderColor: 'rgba(99, 102, 241, 0.8)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: '실제 시간',
        data: data.map((d) => d.actualHours),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: '#e2e8f0',
          usePointStyle: true,
          pointStyleWidth: 12,
          padding: 16,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y ?? 0;
            return ` ${label}: ${value.toFixed(1)}h`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.06)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          maxRotation: 45,
          minRotation: 0,
        },
        border: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.06)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value) => `${value}h`,
        },
        border: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
      },
    },
  };

  if (data.length === 0) {
    return (
      <div
        className="glass-card"
        style={{
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 350,
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)' }}>
          📈 이행률 데이터가 없습니다
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-sm)' }}>
          계획과 기록을 추가하면 차트가 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div
      className="glass-card"
      style={{ padding: 'var(--space-lg)' }}
    >
      <h3
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-md)',
        }}
      >
        📈 계획 vs 실제 학습시간
      </h3>
      <Bar data={chartData} options={options} />
    </div>
  );
}
