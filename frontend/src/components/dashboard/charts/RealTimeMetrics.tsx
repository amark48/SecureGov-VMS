import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, Wifi } from 'lucide-react';

interface RealTimeMetricsProps {
  data: any[];
}

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({ data }) => {
  const [realTimeData, setRealTimeData] = useState<any[]>([]);

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      const now = new Date();
      const newDataPoint = {
        time: now.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        activeUsers: Math.floor(Math.random() * 50) + 20,
        systemLoad: Math.floor(Math.random() * 30) + 40,
        networkActivity: Math.floor(Math.random() * 100) + 50,
        timestamp: now.getTime()
      };

      setRealTimeData(prev => {
        const updated = [...prev, newDataPoint];
        // Keep only last 20 data points
        return updated.slice(-20);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'systemLoad' && '%'}
              {entry.dataKey === 'networkActivity' && ' Mbps'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Real-Time System Metrics</h3>
            <p className="text-sm text-gray-500">Live system performance monitoring</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Active Users</p>
              <p className="text-2xl font-bold text-blue-900">
                {realTimeData.length > 0 ? realTimeData[realTimeData.length - 1].activeUsers : 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">System Load</p>
              <p className="text-2xl font-bold text-green-900">
                {realTimeData.length > 0 ? realTimeData[realTimeData.length - 1].systemLoad : 0}%
              </p>
            </div>
            <Zap className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Network</p>
              <p className="text-2xl font-bold text-purple-900">
                {realTimeData.length > 0 ? realTimeData[realTimeData.length - 1].networkActivity : 0} Mbps
              </p>
            </div>
            <Wifi className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={realTimeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorNetwork" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
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
            <Area
              type="monotone"
              dataKey="activeUsers"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorUsers)"
              strokeWidth={2}
              name="Active Users"
            />
            <Area
              type="monotone"
              dataKey="systemLoad"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorLoad)"
              strokeWidth={2}
              name="System Load"
            />
            <Area
              type="monotone"
              dataKey="networkActivity"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorNetwork)"
              strokeWidth={2}
              name="Network Activity"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};