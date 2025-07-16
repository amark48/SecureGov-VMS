import React, { useState } from 'react';
import { 
  Shield, 
  Users, 
  Lock, 
  Eye, 
  CheckCircle, 
  ArrowRight,
  Building,
  Clock,
  FileText,
  AlertTriangle,
  Zap,
  Globe,
  Award,
  Star,
  TrendingUp,
  BarChart3,
  Activity
} from 'lucide-react';
import { LoginForm } from '../auth/LoginForm';
import { APP_NAME } from '../../utils/constants';

export const LandingPage: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{APP_NAME}</h1>
                <p className="text-xs text-blue-600">Enterprise Security Platform</p>
              </div>
            </div>
            <button
              onClick={() => setShowLogin(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-indigo-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <Shield className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Star className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Enterprise Visitor
              <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Management System
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Secure, compliant, and intelligent visitor management for government agencies, 
              defense contractors, and regulated industries. Built with <span className="font-semibold text-blue-600">FICAM</span>, <span className="font-semibold text-green-600">FIPS 140</span>, 
              <span className="font-semibold text-orange-600">HIPAA</span>, and <span className="font-semibold text-purple-600">FERPA</span> compliance at its core.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <button
                onClick={() => setShowLogin(true)}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white px-10 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 flex items-center group"
              >
                Access Secure Portal
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center text-gray-600 text-sm bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50">
                <Lock className="w-4 h-4 mr-2 text-blue-600" />
                Zero Trust Architecture
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <span>SOC 2 Certified</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <span>FedRAMP Ready</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Award className="w-4 h-4 text-purple-600" />
                </div>
                <span>ISO 27001</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Mission-Critical Security Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive visitor management with enterprise-grade security and compliance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Advanced Security Screening',
                description: 'Real-time watchlist screening, background checks, and threat assessment with multi-level security clearance support.',
                color: 'from-red-500 to-pink-500',
                features: ['Watchlist Integration', 'Background Checks', 'Threat Assessment']
              },
              {
                icon: Users,
                title: 'Intelligent Visitor Management',
                description: 'Streamlined registration, check-in/out processes, and automated badge generation with QR codes.',
                color: 'from-blue-500 to-cyan-500',
                features: ['Digital Registration', 'QR Code Badges', 'Automated Workflows']
              },
              {
                icon: BarChart3,
                title: 'Advanced Analytics',
                description: 'Real-time dashboards, visitor traffic analysis, and comprehensive reporting with data visualization.',
                color: 'from-green-500 to-emerald-500',
                features: ['Real-time Dashboards', 'Traffic Analysis', 'Custom Reports']
              },
              {
                icon: Eye,
                title: 'Comprehensive Audit Trail',
                description: 'Complete activity logging with compliance flags for FICAM, FIPS 140, HIPAA, and FERPA requirements.',
                color: 'from-purple-500 to-indigo-500',
                features: ['Activity Logging', 'Compliance Flags', 'Audit Reports']
              },
              {
                icon: Building,
                title: 'Multi-Facility Support',
                description: 'Manage multiple secure facilities with customizable security levels and operating procedures.',
                color: 'from-orange-500 to-red-500',
                features: ['Multiple Locations', 'Custom Security Levels', 'Centralized Management']
              },
              {
                icon: AlertTriangle,
                title: 'Emergency Management',
                description: 'Instant evacuation lists, emergency contacts, and lockdown procedures with real-time notifications.',
                color: 'from-teal-500 to-blue-500',
                features: ['Evacuation Lists', 'Emergency Contacts', 'Lockdown Procedures']
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative bg-white rounded-3xl p-8 border border-gray-200/50 hover:border-gray-300/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r ${feature.color} rounded-2xl mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.features.map((item, idx) => (
                    <li key={idx} className="flex items-center text-sm text-gray-500">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-indigo-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/5 rounded-3xl transition-all duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Government-Grade Compliance
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built to meet the highest security and compliance standards for government and enterprise
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { 
                name: 'FICAM', 
                description: 'Federal Identity, Credential, and Access Management',
                color: 'from-blue-500 to-blue-600',
                percentage: 100
              },
              { 
                name: 'FIPS 140', 
                description: 'Federal Information Processing Standards',
                color: 'from-green-500 to-green-600',
                percentage: 100
              },
              { 
                name: 'HIPAA', 
                description: 'Health Insurance Portability and Accountability Act',
                color: 'from-orange-500 to-orange-600',
                percentage: 100
              },
              { 
                name: 'FERPA', 
                description: 'Family Educational Rights and Privacy Act',
                color: 'from-purple-500 to-purple-600',
                percentage: 100
              }
            ].map((standard, index) => (
              <div key={index} className="text-center group">
                <div className="bg-white rounded-3xl p-8 border border-gray-200/50 group-hover:border-gray-300/50 shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:transform group-hover:-translate-y-2">
                  <div className={`w-16 h-16 bg-gradient-to-r ${standard.color} rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg`}>
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{standard.name}</h3>
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full bg-gradient-to-r ${standard.color} transition-all duration-1000`}
                        style={{ width: `${standard.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 mt-2 block">{standard.percentage}% Compliant</span>
                  </div>
                  <p className="text-sm text-gray-600">{standard.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Trusted by Organizations Worldwide
            </h2>
            <p className="text-xl text-blue-100">
              Powering secure operations across government and enterprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            {[
              { number: '99.9%', label: 'System Uptime', icon: Zap, description: 'Enterprise reliability' },
              { number: '< 2s', label: 'Average Check-in Time', icon: Clock, description: 'Lightning fast processing' },
              { number: '100%', label: 'Compliance Coverage', icon: Globe, description: 'Full regulatory compliance' },
              { number: '24/7', label: 'Security Monitoring', icon: Activity, description: 'Continuous protection' }
            ].map((stat, index) => (
              <div key={index} className="group">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 group-hover:bg-white/15 transition-all duration-300 group-hover:transform group-hover:-translate-y-2">
                  <stat.icon className="w-12 h-12 text-white mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
                  <div className="text-4xl font-bold text-white mb-2">{stat.number}</div>
                  <div className="text-blue-100 font-medium mb-2">{stat.label}</div>
                  <div className="text-sm text-blue-200">{stat.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Secure Your Facility?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join government agencies and enterprises worldwide who trust SecureGov VMS 
            for their most critical security operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => setShowLogin(true)}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white px-12 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
            >
              Access Secure Portal
            </button>
            <div className="flex items-center text-gray-500 text-sm">
              <Shield className="w-4 h-4 mr-2" />
              Enterprise-grade security included
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-white font-semibold text-lg">{APP_NAME}</span>
                <p className="text-gray-400 text-sm">Enterprise Security Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-8 text-sm text-gray-400">
              <span>© 2025 SecureGov VMS. All rights reserved.</span>
              <span>•</span>
              <span>Built for Government & Enterprise</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};