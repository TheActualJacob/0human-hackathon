'use client';

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts';

interface RiskCategory {
  name: string;
  risk: number;
  exposure: number;
}

interface Props {
  riskByCategory: RiskCategory[];
}

export default function PredictiveMaintenanceCharts({ riskByCategory }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-4">12-Month Failure Risk by Category</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={riskByCategory} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#888' }} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#ccc' }} />
            <Tooltip
              formatter={(v) => [`${v ?? 0}%`, 'Risk'] as [string, string]}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '6px' }}
            />
            <Bar dataKey="risk" radius={[0, 4, 4, 0]}>
              {riskByCategory.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.risk >= 70 ? '#ef4444' : entry.risk >= 40 ? '#f97316' : entry.risk >= 20 ? '#eab308' : '#22c55e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-4">Financial Exposure by Category (€)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={riskByCategory} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `€${v}`} tick={{ fontSize: 10, fill: '#888' }} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#ccc' }} />
            <Tooltip
              formatter={(v) => [`€${Number(v ?? 0).toLocaleString()}`, 'Exposure'] as [string, string]}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '6px' }}
            />
            <Bar dataKey="exposure" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
