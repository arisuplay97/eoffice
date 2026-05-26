"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "#1d4ed8",
  "#0284c7",
  "#0891b2",
  "#059669",
  "#ca8a04",
  "#dc2626",
  "#7c3aed",
  "#4338ca",
];

const STATUS_LABEL: Record<string, string> = {
  BARU: "Baru",
  DIBACA: "Dibaca",
  DIPROSES: "Diproses",
  DITINDAKLANJUTI: "Ditindaklanjuti",
  SELESAI: "Selesai",
  DITOLAK: "Ditolak",
};

export function Tren({ data }: { data: { bulan: string; masuk: number; keluar: number }[] }) {
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="bulan"
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#cbd5e1" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Line
            type="monotone"
            dataKey="masuk"
            name="Surat Masuk"
            stroke="#1d4ed8"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="keluar"
            name="Surat Keluar"
            stroke="#0891b2"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DisposisiStatus({ data }: { data: { status: string; total: number }[] }) {
  const display = data.map((d) => ({
    name: STATUS_LABEL[d.status] || d.status,
    value: d.total,
  }));
  if (display.length === 0) {
    return <p className="text-sm text-ink-500 py-10 text-center">Belum ada data.</p>;
  }
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={display}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {display.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ByUnit({ data }: { data: { unit: string; total: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-500 py-10 text-center">Belum ada data distribusi unit.</p>;
  }
  return (
    <div style={{ width: "100%", height: Math.max(240, data.length * 38) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="unit"
            width={170}
            tick={{ fontSize: 12, fill: "#334155" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Bar dataKey="total" fill="#1d4ed8" radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
