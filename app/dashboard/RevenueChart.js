"use client";
// Client leaf (Day 46): charting libraries measure the DOM, so the PAGE stays a server
// component and only this chart is client code. It receives five summarised rows —
// plain objects, because anything crossing the boundary must serialise.
//
// Honest by construction: the bar axis starts at zero, the axis names its unit (ETB),
// every bar carries its value as a label (readable without colour), and the same numbers
// are in a table beneath the chart.
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from "recharts";
import { etb } from "@/lib/format";

export default function RevenueChart({ data }) {
  return (
    // A real height, in CSS and on the container: it reserves the space so nothing jumps
    // when the chart appears, and a percentage height would collapse to nothing.
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="area" interval={0} tickMargin={8} tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, "auto"]}
            allowDecimals={false}
            tickFormatter={(value) => etb.format(value)}
            width={84}
            tick={{ fontSize: 12 }}
          />
          <Tooltip formatter={(value) => [etb.format(value), "Revenue"]} />
          <Bar dataKey="revenue" name="Revenue" fill="#c1440e" isAnimationActive={false}>
            <LabelList dataKey="revenue" position="top" formatter={(value) => etb.format(value)} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
