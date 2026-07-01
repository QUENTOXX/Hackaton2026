'use client'

// Graphiques du dashboard (recharts). Importé dynamiquement (ssr:false).
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts'
import { THREAT_LABELS } from '@/lib/labels'

const COLORS = ['#FF1493', '#A855F7', '#22D3EE', '#F59E0B']

export function ThreatPieChart({ data }: { data: { type: string; count: number }[] }) {
  const safe = (data ?? []).filter((d) => (d?.count ?? 0) > 0)
  if (safe.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Aucune menace enregistrée pour le moment.
      </div>
    )
  }
  const chartData = safe.map((d) => ({ name: THREAT_LABELS[d.type] ?? d.type, value: d.count }))
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={55} outerRadius={90} paddingAngle={3}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Legend verticalAlign="top" align="right" layout="vertical" wrapperStyle={{ fontSize: 11 }} />
          <Tooltip wrapperStyle={{ fontSize: 11 }} contentStyle={{ background: '#1a1320', border: '1px solid #3a2740', borderRadius: 8, color: '#fff' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TimelineChart({ data }: { data: { day: string; count: number }[] }) {
  const chartData = data ?? []
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: -16 }}>
          <XAxis dataKey="day" tickLine={false} tick={{ fontSize: 10, fill: '#a89bb5' }} axisLine={{ stroke: '#3a2740' }} />
          <YAxis allowDecimals={false} tickLine={false} tick={{ fontSize: 10, fill: '#a89bb5' }} axisLine={{ stroke: '#3a2740' }} />
          <Tooltip wrapperStyle={{ fontSize: 11 }} cursor={{ fill: '#FF149315' }}
            contentStyle={{ background: '#1a1320', border: '1px solid #3a2740', borderRadius: 8, color: '#fff' }} />
          <Bar dataKey="count" name="Menaces" fill="#FF1493" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
