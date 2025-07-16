import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Shield, AlertTriangle } from 'lucide-react';

interface SecurityAlertsChartProps {
  data: any[];
}

export const SecurityAlertsChart: React.FC<SecurityAlertsChartProps> = ({ data }) => {
  // Process data to group by type and severity
  const alertData = Array.isArray(data) ? data.reduce((acc: any, alert: any) => {
    const type = alert.type || 'unknown';
    const severity = alert.severity || 'low';
    
    if (!acc[type]) {
      acc[type] = {
        type: type.replace('_', ' ').toUpperCase(),
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      };
    }
    
    acc[type][severity] += 1;
    acc[type].total += 1;
    return acc;
  }, {}) : {};

  const chartData = Object.values(alertData);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-red-600">Critical: {data.critical}</p>
            <p className="text-sm text-orange-600">High: {data.high}</p>
            <p className="text-sm text-yellow-600">Medium: {data.medium}</p>
            <p className="text-sm text-green-600">Low: {data.low}</p>
            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-900">Total: {data.total}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // If there's no data, show a message
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Security Alerts by Type</h3>
              <p className="text-sm text-gray-500">Alert distribution by severity level</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center h-80 text-gray-500">
          <Shield className="w-12 h-12 mb-4" />
          <p className="text-lg font-medium">No Security Alerts</p>
          <p className="text-sm">All systems operating normally</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Security Alerts by Type</h3>
            <p className="text-sm text-gray-500">Alert distribution by severity level</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span className="text-gray-600">Critical</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
            <span className="text-gray-600">High</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
            <span className="text-gray-600">Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span className="text-gray-600">Low</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="type" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="critical" 
              stackId="a" 
              fill="#dc2626"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              dataKey="high" 
              stackId="a" 
              fill="#ea580c"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              dataKey="medium" 
              stackId="a" 
              fill="#d97706"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              dataKey="low" 
              stackId="a" 
              fill="#65a30d"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center h-80 text-gray-500">
          <Shield className="w-12 h-12 mb-4" />
          <p className="text-lg font-medium">No Security Alerts</p>
          <p className="text-sm">All systems operating normally</p>
        </div>
      )}
    </div>
  );
};