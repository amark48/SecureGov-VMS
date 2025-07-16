import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon, Target } from 'lucide-react';

interface VisitorPurposeChartProps {
  data: any[];
}

export const VisitorPurposeChart: React.FC<VisitorPurposeChartProps> = ({ data }) => {
  // Colors for the pie chart
  const COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Orange
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange-600
  ];

  // Process data to group by purpose
  const purposeData = Array.isArray(data) ? data.reduce((acc: any, visit: any) => {
    const purpose = visit.purpose || 'Other';
    const key = purpose.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    if (!acc[key]) {
      acc[key] = {
        name: purpose,
        value: 0,
        percentage: 0
      };
    }
    acc[key].value += 1;
    return acc;
  }, {}) : {};

  const chartData = Object.values(purposeData).map((item: any, index: number) => ({
    ...item,
    percentage: ((item.value / (Array.isArray(data) ? data.length : 1)) * 100).toFixed(1),
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            {data.value} visits ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // If there's no data or empty array, show a message
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Visit Purposes</h3>
              <p className="text-sm text-gray-500">Distribution of visitor purposes</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            No data available
          </div>
        </div>
        
        <div className="flex items-center justify-center h-80">
          <p className="text-gray-500">No visit data available to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Visit Purposes</h3>
            <p className="text-sm text-gray-500">Distribution of visitor purposes</p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Total: {data.length} visits
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center">
        <div className="h-80 w-full lg:w-2/3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full lg:w-1/3 lg:pl-6">
          <div className="space-y-3">
            {chartData.slice(0, 6).map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500">{item.percentage}%</div>
                </div>
              </div>
            ))}
            {chartData.length > 6 && (
              <div className="text-center pt-2">
                <span className="text-xs text-gray-500">
                  +{chartData.length - 6} more purposes
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};