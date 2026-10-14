"use client";
// Client leaf (Day 46): orders per day as a line — a line is the right shape for "how has
// it changed?", and unlike a bar chart its axis may start anywhere; this one starts at
// zero anyway. Every day in the range is a point (quiet days are zeros, not gaps), each
// point is a dot and the Y axis counts whole orders. The same rows are in a table below.
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function OrdersChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={28} tickMargin={8} tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, "auto"]}
            allowDecimals={false}
            width={44}
            tick={{ fontSize: 12 }}
            label={{ value: "Orders", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip formatter={(value) => [value, "Orders"]} labelFormatter={(label) => `${label} (Addis Ababa time)`} />
          <Line
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke="#c1440e"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
