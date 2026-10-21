'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type SCurvePoint = { week: string; planned: number; actual: number };

export function SCurveChart({ data }: { data: SCurvePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="border border-line rounded-sm bg-panel p-6 text-center text-sm text-ink-muted">
        Data Kurva S belum tersedia.
      </div>
    );
  }

  return (
    <section className="mb-6 border border-line rounded-sm bg-panel p-4">
      <h2 className="text-base font-semibold mb-3">Kurva S Portofolio</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              stroke="var(--canal)"
              name="Rencana"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="var(--ews-green)"
              name="Aktual"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
