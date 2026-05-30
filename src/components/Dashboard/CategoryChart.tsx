'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type Plugin,
} from 'chart.js';
import { getCategoryColor } from '@/types';
import type { CategoryBreakdown } from '@/types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryChartProps {
  data: CategoryBreakdown[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
  const totalHours = data.reduce((sum, d) => sum + d.hours, 0);

  const chartData = {
    labels: data.map((d) => d.category),
    datasets: [
      {
        data: data.map((d) => d.hours),
        backgroundColor: data.map((d) => getCategoryColor(d.category)),
        borderColor: 'rgba(10, 14, 26, 0.8)',
        borderWidth: 3,
        hoverBorderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  // Center text plugin
  const centerTextPlugin: Plugin<'doughnut'> = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save();

      // Total hours - large
      ctx.font = `700 ${Math.min(width, height) * 0.08}px sans-serif`;
      ctx.fillStyle = '#f1f5f9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${totalHours.toFixed(1)}`, width / 2, height / 2 + 2);

      // Label - small
      ctx.font = `400 ${Math.min(width, height) * 0.04}px sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.textBaseline = 'top';
      ctx.fillText('시간', width / 2, height / 2 + 6);

      ctx.restore();
    },
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#e2e8f0',
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 12,
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
            const item = data[context.dataIndex];
            return ` ${item.category}: ${item.hours.toFixed(1)}h (${item.percentage}%)`;
          },
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
          📊 카테고리 데이터가 없습니다
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-sm)' }}>
          학습 기록을 추가하면 차트가 표시됩니다
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
        📊 카테고리별 학습 분포
      </h3>
      <div style={{ maxWidth: 320, margin: '0 auto' }}>
        <Doughnut data={chartData} options={options} plugins={[centerTextPlugin]} />
      </div>
    </div>
  );
}
