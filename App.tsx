import React, { useState, useEffect, useMemo } from 'react';
import { analyzeIncident } from './services/geminiService';
import { IncidentRecord, IncidentStatus, Language } from './types';
import { sendToWebhook } from './services/webhookService';
import { subscribeToIncidents, addIncidentToDb, updateIncidentStatusInDb } from './services/firebase';
import { translations, EXAMPLE_TEXTS } from './translations';

type ViewMode = 'login' | 'tenant' | 'staff';
type StaffTab = 'list' | 'analytics';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  
  // Language State
  const [language, setLanguage] = useState<Language>('es');
  const t = translations[language];
  
  // Dashboard Tabs
  const [staffTab, setStaffTab] = useState<StaffTab>('list');

  // Form Inputs
  const [tenantName, setTenantName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [inputText, setInputText] = useState('');
  
  // Test Mode State
  const [isTestMode, setIsTestMode] = useState(true);
  
  // Real-time Database State
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);

  // Tenant State
  const [tenantStatus, setTenantStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  // Login State
  const [loginRole, setLoginRole] = useState<'tenant' | 'staff'>('tenant');
  const [staffPassword, setStaffPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Load data from Firebase on mount
  useEffect(() => {
    // This function returns an unsubscribe function
    const unsubscribe = subscribeToIncidents((data) => {
      setIncidents(data);
    });

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, []);

  // Handle Test Mode Data Population
  useEffect(() => {
      if (view === 'tenant') {
          if (isTestMode) {
              setTenantName('James Bond');
              setRoomNumber('007');
          } else {
              setTenantName('');
              setRoomNumber('');
          }
      }
  }, [isTestMode, view]);

  // Auto-redirect to Login after 15 seconds of success
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (tenantStatus === 'success') {
      timer = setTimeout(() => {
        setTenantStatus('idle');
        setView('login');
        setInputText('');
      }, 15000);
    }
    return () => clearTimeout(timer);
  }, [tenantStatus]);

  // Logic for Tenant (Analyze -> Webhook -> Save to Firebase)
  const handleTenantSubmit = async () => {
    if (!inputText.trim() || !tenantName.trim() || !roomNumber.trim()) return;
    setTenantStatus('submitting');

    try {
      const contextMessage = `Inquilino: ${tenantName}, Habitación: ${roomNumber}. Mensaje: ${inputText}`;

      // Pass the selected language to the AI service
      const result = await analyzeIncident(contextMessage, language);
      
      const newIncidentData: Omit<IncidentRecord, 'id'> = {
          ...result,
          tenantName: tenantName,
          room: roomNumber,
          description: inputText,
          status: 'open',
          source: 'tenant_portal',
          coliving: 'Bali Coliving',
          createdAt: new Date(),
          updatedAt: new Date()
      };

      // Pass user details explicitly for Make mapping
      sendToWebhook(
          result, 
          contextMessage, 
          { name: tenantName, room: roomNumber }
      ).catch(err => console.error("Webhook failed but continuing", err));

      await addIncidentToDb(newIncidentData);

      setTenantStatus('success');
      setInputText('');
      if (!isTestMode) {
          setTenantName('');
          setRoomNumber('');
      }
    } catch (err) {
      console.error(err);
      setTenantStatus('error');
    }
  };

  const handleStatusChange = async (id: string, newStatus: IncidentStatus) => {
    try {
        await updateIncidentStatusInDb(id, newStatus);
    } catch (error) {
        console.error("Failed to update status", error);
        alert("No se pudo actualizar el estado. Verifica tu conexión.");
    }
  };

  const loadExample = (text: string) => {
    setInputText(text);
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (staffPassword === 'admin123') {
        setView('staff');
        setStaffPassword('');
        setLoginError('');
    } else {
        setLoginError('Contraseña incorrecta');
    }
  };

  const formatDuration = (start: Date, end: Date) => {
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const days = Math.floor(diffHours / 24);

      if (days > 0) return `${days}d ${diffHours % 24}h`;
      if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
      return `${diffMins}m`;
  };

  const getUrgencyBadge = (level: number) => {
      if (level >= 5) return <span className="px-2 py-1 rounded bg-red-100 text-red-700 font-bold text-xs">Crítica ({level})</span>;
      if (level === 4) return <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 font-bold text-xs">Alta ({level})</span>;
      if (level === 3) return <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-bold text-xs">Media ({level})</span>;
      return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-bold text-xs">Baja ({level})</span>;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'Mantenimiento': return '🔧';
        case 'Limpieza': return '🧹';
        case 'Internet': return '📶';
        case 'Administración': return '📋';
        case 'Emergencia': return '🚨';
        default: return '📝';
    }
  };

  const getStatusBadgeColor = (status: IncidentStatus) => {
      switch(status) {
          case 'open': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'resolved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          case 'canceled': return 'bg-gray-100 text-gray-500 border-gray-200';
          default: return 'bg-gray-100 text-gray-800';
      }
  };

  const getStatusLabel = (status: IncidentStatus) => {
    switch(status) {
        case 'open': return t.open;
        case 'in_progress': return 'En Proceso';
        case 'resolved': return 'Resuelto';
        case 'canceled': return 'Cancelado';
        default: return status;
    }
  };

  const getChannelIcon = (source?: string) => {
      const s = source?.toLowerCase() || '';
      if (s.includes('whatsapp')) return <span title="WhatsApp" className="text-green-500 text-lg">📱</span>;
      if (s.includes('email')) return <span title="Email" className="text-blue-500 text-lg">📧</span>;
      return <span title="Portal Web" className="text-emerald-500 text-lg">🌐</span>;
  };

  // --- ANALYTICS HELPERS ---
  const calculateStats = useMemo(() => {
      if (incidents.length === 0) return null;

      const total = incidents.length;
      const resolvedIncidents = incidents.filter(i => i.status === 'resolved' && i.resolvedAt);
      const resolvedCount = incidents.filter(i => i.status === 'resolved').length;
      const completionRate = Math.round((resolvedCount / total) * 100);

      // Calculate Average Resolution Time (Global)
      let totalResolutionTimeMs = 0;
      resolvedIncidents.forEach(i => {
          if (i.resolvedAt) {
              totalResolutionTimeMs += (i.resolvedAt.getTime() - i.createdAt.getTime());
          }
      });
      const avgResolutionTimeMs = resolvedIncidents.length > 0 ? totalResolutionTimeMs / resolvedIncidents.length : 0;
      
      const formatMsToTime = (ms: number) => {
          if (ms === 0) return 'N/A';
          const mins = Math.floor(ms / 60000);
          const hours = Math.floor(mins / 60);
          if (hours > 24) return `${Math.floor(hours/24)}d ${hours%24}h`;
          if (hours > 0) return `${hours}h ${mins%60}m`;
          return `${mins}m`;
      };

      const avgResolutionTimeStr = formatMsToTime(avgResolutionTimeMs);

      // Category breakdown
      const byCategory: Record<string, { count: number, totalUrgency: number, totalResTime: number, resCount: number }> = {};
      
      incidents.forEach(i => {
          if (!byCategory[i.category]) {
              byCategory[i.category] = { count: 0, totalUrgency: 0, totalResTime: 0, resCount: 0 };
          }
          byCategory[i.category].count += 1;
          byCategory[i.category].totalUrgency += i.urgency_level;

          if (i.status === 'resolved' && i.resolvedAt) {
              byCategory[i.category].totalResTime += (i.resolvedAt.getTime() - i.createdAt.getTime());
              byCategory[i.category].resCount += 1;
          }
      });

      // Sort categories by count
      const sortedCategories = Object.entries(byCategory)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([name, data]) => ({
            name,
            count: data.count,
            percentage: Math.round((data.count / total) * 100),
            avgUrgency: (data.totalUrgency / data.count).toFixed(1),
            avgTime: formatMsToTime(data.resCount > 0 ? data.totalResTime / data.resCount : 0)
        }));

      // High impact (highest urgency average)
      const highImpact = [...sortedCategories].sort((a, b) => parseFloat(b.avgUrgency) - parseFloat(a.avgUrgency))[0];

      // Last 7 days trend
      const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split('T')[0]; // YYYY-MM-DD
      }).reverse();

      const dailyCounts = last7Days.map(dateStr => {
          const count = incidents.filter(i => {
              // Handle both Date objects and Timestamps converted to Date
              const d = new Date(i.createdAt); 
              return d.toISOString().split('T')[0] === dateStr;
          }).length;
          // Format date for display (e.g., "29 Nov")
          const displayDate = new Date(dateStr).toLocaleDateString(
              language === 'en' ? 'en-US' : language === 'id' ? 'id-ID' : 'es-ES', 
              { day: 'numeric', month: 'short' }
          );
          return { date: displayDate, count };
      });

      return {
          total,
          completionRate,
          avgResolutionTimeStr,
          sortedCategories,
          highImpact,
          dailyCounts
      };
  }, [incidents, language]);

  // Language Selector Component
  const LanguageSelector = () => (
      <div className="flex gap-2 bg-black/10 p-1 rounded-lg">
          <button onClick={() => setLanguage('es')} className={`px-2 py-1 rounded text-xs font-bold transition-all ${language === 'es' ? 'bg-white text-emerald-700 shadow' : 'text-white/70 hover:text-white'}`}>🇪🇸 ES</button>
          <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded text-xs font-bold transition-all ${language === 'en' ? 'bg-white text-emerald-700 shadow' : 'text-white/70 hover:text-white'}`}>🇬🇧 EN</button>
          <button onClick={() => setLanguage('id')} className={`px-2 py-1 rounded text-xs font-bold transition-all ${language === 'id' ? 'bg-white text-emerald-700 shadow' : 'text-white/70 hover:text-white'}`}>🇮🇩 ID</button>
      </div>
  );


  // --- RENDER FUNCTIONS ---

  const renderLoginPage = () => (
    <div className="flex flex-col items-center justify-center min-h-[85vh] animate-fade-in-up px-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <span className="text-5xl mb-4 block">🌴</span>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Bali Coliving</h2>
                    <p className="text-gray-400 mt-2 text-sm">IncidenBot Manager</p>
                    <div className="mt-4">
                         <LanguageSelector />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
                <button 
                    onClick={() => { setLoginRole('tenant'); setLoginError(''); }}
                    className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${loginRole === 'tenant' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    {t.login_tenant}
                </button>
                <button 
                    onClick={() => { setLoginRole('staff'); setLoginError(''); }}
                    className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${loginRole === 'staff' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    {t.login_staff}
                </button>
            </div>

            {/* Content */}
            <div className="p-8">
                {loginRole === 'tenant' ? (
                    <div className="space-y-6 text-center">
                        <div className="p-4 bg-emerald-50 rounded-lg text-emerald-800 text-sm">
                            <p>{t.welcome_tenant}</p>
                        </div>
                        <button 
                            onClick={() => setView('tenant')}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {t.report_incident} 
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleStaffLogin} className="space-y-4">
                         <div className="p-4 bg-blue-50 rounded-lg text-blue-800 text-sm mb-4 text-center">
                            <p>{t.restricted_area}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.password_label}</label>
                            <input 
                                type="password" 
                                value={staffPassword}
                                onChange={(e) => setStaffPassword(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        {loginError && <p className="text-red-500 text-sm font-medium">{loginError}</p>}
                        <button 
                            type="submit"
                            className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            {t.enter_dashboard}
                        </button>
                    </form>
                )}
            </div>
            
            <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                <p className="text-xs text-gray-400">© 2024 IncidenBot System v1.0</p>
            </div>
        </div>
    </div>
  );

  const renderTenantView = () => (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
            <button onClick={() => setView('login')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                ← {t.exit}
            </button>
            {/* Language Selector visible here too */}
            <div className="md:hidden">
                 <div className="flex gap-1">
                    <button onClick={() => setLanguage('es')} className={`px-2 py-1 rounded text-xs font-bold ${language === 'es' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>ES</button>
                    <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded text-xs font-bold ${language === 'en' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>EN</button>
                    <button onClick={() => setLanguage('id')} className={`px-2 py-1 rounded text-xs font-bold ${language === 'id' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>ID</button>
                </div>
            </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    👋
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{t.report_incident}</h2>
                <p className="text-gray-500 text-sm mt-1">{t.report_desc}</p>
            </div>

            {tenantStatus === 'success' ? (
                <div className="text-center py-8">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-emerald-600">{t.report_success_title}</h3>
                    <p className="text-gray-600 mt-2">{t.report_success_msg}</p>
                    <p className="text-xs text-gray-400 mt-6 animate-pulse">{t.redirecting}</p>
                    <button 
                        onClick={() => setTenantStatus('idle')}
                        className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                        {t.report_another}
                    </button>
                </div>
            ) : (
                <>
                    {/* Examples Section */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">
                        {t.quick_examples}
                        </label>
                        <div className="flex flex-wrap justify-center gap-2">
                            {EXAMPLE_TEXTS[language].map((ex, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => loadExample(ex.text)}
                                    className={`text-xs px-3 py-2 rounded-full border font-medium transition-all active:scale-95 bg-gray-50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200`}
                                >
                                    {ex.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Test Mode Toggle */}
                    <div className="flex justify-end mb-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={isTestMode} 
                                onChange={(e) => setIsTestMode(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                            />
                            <span className="text-xs font-semibold text-gray-600">{t.test_mode}</span>
                        </label>
                    </div>

                    {/* Personal Info Fields */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.name_label} <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder={t.placeholder_name}
                                value={tenantName}
                                onChange={(e) => setTenantName(e.target.value)}
                                disabled={tenantStatus === 'submitting' || isTestMode}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.room_label} <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder={t.placeholder_room}
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                disabled={tenantStatus === 'submitting' || isTestMode}
                            />
                        </div>
                    </div>

                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t.desc_label} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={5}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all"
                            placeholder={t.placeholder_desc}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={tenantStatus === 'submitting'}
                        />
                    </div>
                    
                    {tenantStatus === 'error' && (
                        <p className="text-red-500 text-sm mt-3 text-center">{t.error_msg}</p>
                    )}

                    <button
                        onClick={handleTenantSubmit}
                        disabled={tenantStatus === 'submitting' || !inputText.trim() || !tenantName.trim() || !roomNumber.trim()}
                        className={`w-full mt-4 py-3.5 rounded-xl font-bold text-white shadow-md transition-all flex justify-center items-center gap-2
                            ${tenantStatus === 'submitting' || !inputText.trim() || !tenantName.trim() || !roomNumber.trim()
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                            }`}
                    >
                        {tenantStatus === 'submitting' ? (
                             <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t.analyzing}
                             </>
                        ) : t.submit_btn}
                    </button>
                </>
            )}
        </div>
    </div>
  );

  const renderAnalytics = () => {
    if (!calculateStats) return <div className="p-10 text-center text-gray-500">Cargando datos...</div>;
    const { total, completionRate, sortedCategories, highImpact, dailyCounts, avgResolutionTimeStr } = calculateStats;

    return (
        <div className="animate-fade-in-up space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">{t.total_incidents}</p>
                        <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{total}</h3>
                    </div>
                    <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-xl">📊</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">{t.resolution_rate}</p>
                        <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{completionRate}%</h3>
                    </div>
                    <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-xl">✅</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">{t.avg_time}</p>
                        <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">{avgResolutionTimeStr}</h3>
                    </div>
                    <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-xl">⏱️</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">{t.major_issue}</p>
                        <h3 className="text-lg font-bold text-orange-600 mt-1 truncate max-w-[120px]" title={highImpact?.name}>{highImpact?.name || 'N/A'}</h3>
                        <p className="text-[10px] text-gray-400">{t.avg_urgency}: {highImpact?.avgUrgency || 0}/5</p>
                    </div>
                    <div className="h-10 w-10 bg-orange-50 rounded-full flex items-center justify-center text-xl">⚠️</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h4 className="text-lg font-bold text-gray-800 mb-6">{t.cat_classification}</h4>
                    <div className="space-y-4">
                        {sortedCategories.map((cat) => (
                            <div key={cat.name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700 flex items-center gap-2">
                                        {getCategoryIcon(cat.name)} {cat.name}
                                    </span>
                                    <div className="text-right">
                                        <span className="text-gray-900 font-bold">{cat.count}</span>
                                        <span className="text-gray-400 text-xs ml-2">({cat.percentage}%)</span>
                                        <div className="text-[10px] text-gray-500">{t.avg}: {cat.avgTime}</div>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                                        style={{ width: `${cat.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Daily Trend Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                    <h4 className="text-lg font-bold text-gray-800 mb-6">{t.daily_trend}</h4>
                    {/* Updated chart container: h-80 (320px) fixed height and thicker bars */}
                    <div className="flex-1 flex items-end justify-between gap-2 h-80 border-b border-gray-200 pb-2">
                        {dailyCounts.map((day, idx) => {
                             // Find max for scaling
                             const max = Math.max(...dailyCounts.map(d => d.count), 1);
                             const heightPct = (day.count / max) * 100;
                             
                             return (
                                 <div key={idx} className="flex flex-col items-center w-full group relative h-full justify-end">
                                     {/* Tooltip */}
                                     <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity mb-1 z-10 pointer-events-none whitespace-nowrap">
                                         {day.count} {t.incidents_tooltip}
                                     </div>
                                     <div 
                                         className="w-full max-w-[60px] bg-emerald-500 hover:bg-emerald-600 rounded-t-md transition-all duration-500"
                                         style={{ height: `${heightPct}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                                     ></div>
                                     <span className="text-[10px] text-gray-400 mt-2 font-medium">{day.date}</span>
                                 </div>
                             );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderStaffDashboard = () => {
    // Basic Stats for Header
    const openCount = incidents.filter(i => i.status === 'open').length;
    const progressCount = incidents.filter(i => i.status === 'in_progress').length;
    const urgentCount = incidents.filter(i => i.urgency_level >= 4 && i.status === 'open').length;

    return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in-up pb-10">
        <div className="flex justify-between items-center mb-6">
             <button onClick={() => setView('login')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                ← {t.exit}
            </button>
            <div className="flex items-center gap-4">
                 <LanguageSelector />
                 <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-medium text-gray-500">{t.live_firebase}</span>
                 </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
            <div>
                <h2 className="text-3xl font-extrabold text-gray-900">{t.dashboard_title}</h2>
                <p className="text-gray-500 mt-1">
                    {staffTab === 'list' ? t.dash_subtitle_list : t.dash_subtitle_analytics}
                </p>
            </div>
            
            {/* Quick Stats Summary (Always Visible in List Mode) */}
            {staffTab === 'list' && (
                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                        <span className="text-2xl font-bold text-yellow-600 leading-none">{openCount}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-bold">{t.open}</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                        <span className="text-2xl font-bold text-red-600 leading-none">{urgentCount}</span>
                        <span className="text-[10px] text-red-600 uppercase font-bold">{t.urgent}</span>
                    </div>
                </div>
            )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex space-x-1 bg-gray-200/50 p-1 rounded-xl w-fit">
            <button
                onClick={() => setStaffTab('list')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    staffTab === 'list' 
                    ? 'bg-white text-blue-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                {t.tab_list}
            </button>
            <button
                onClick={() => setStaffTab('analytics')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                    staffTab === 'analytics' 
                    ? 'bg-white text-blue-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                {t.tab_analytics}
            </button>
        </div>

        {/* Conditional Content */}
        {staffTab === 'analytics' ? (
            renderAnalytics()
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {incidents.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <div className="text-4xl mb-3">📭</div>
                        <p>{t.empty_state}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-10 text-center">{t.th_source}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t.th_created}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t.th_tenant}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t.th_category}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t.th_urgency}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">{t.th_summary}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t.th_suggestion}</th>
                                    <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{t.th_status}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {incidents.map((incident) => (
                                    <tr key={incident.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-4 text-center align-top">
                                            {getChannelIcon(incident.source)}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap align-top">
                                            {incident.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            <div className="text-xs text-gray-400">{incident.createdAt.toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="font-semibold text-gray-900 text-sm">{incident.tenantName || 'Desconocido'}</div>
                                            <div className="text-xs text-emerald-600 font-medium">Hab: {incident.room || 'N/A'}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">{incident.coliving}</div>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg" title={incident.category}>{getCategoryIcon(incident.category)}</span>
                                                <span className="text-xs font-medium text-gray-700">{incident.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            {getUrgencyBadge(incident.urgency_level)}
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="text-sm font-bold text-gray-800 mb-1">{incident.action_summary}</div>
                                            <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded border border-gray-100">
                                                "{incident.description || incident.original_message}"
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 align-top max-w-xs">
                                            <p className="text-xs text-gray-500 line-clamp-3 hover:line-clamp-none cursor-help" title={incident.suggested_reply}>
                                                "{incident.suggested_reply}"
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 align-top text-center">
                                            <div className="flex flex-col gap-2">
                                                <span className={`inline-flex justify-center px-2 py-1 rounded-full text-xs font-bold border ${getStatusBadgeColor(incident.status)}`}>
                                                    {getStatusLabel(incident.status)}
                                                </span>
                                                {/* Resolved Time Badge */}
                                                {incident.status === 'resolved' && incident.resolvedAt && (
                                                    <span className="text-[10px] text-gray-500 flex items-center justify-center gap-1 font-mono">
                                                        ⏱️ {formatDuration(incident.createdAt, incident.resolvedAt)}
                                                    </span>
                                                )}
                                                
                                                {/* Quick Actions based on status */}
                                                <div className="flex justify-center gap-1">
                                                    {incident.status !== 'in_progress' && incident.status !== 'resolved' && (
                                                        <button onClick={() => handleStatusChange(incident.id, 'in_progress')} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 border border-blue-200">
                                                            Iniciar
                                                        </button>
                                                    )}
                                                    {incident.status !== 'resolved' && (
                                                        <button onClick={() => handleStatusChange(incident.id, 'resolved')} className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-100 border border-emerald-200">
                                                            Resolver
                                                        </button>
                                                    )}
                                                    {incident.status === 'resolved' && (
                                                         <button onClick={() => handleStatusChange(incident.id, 'open')} className="text-[10px] bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 border border-gray-200">
                                                            Reabrir
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans">
      {/* Navbar (Only show when logged in to a specific view, clean look for login) */}
      {view !== 'login' && (
        <nav className={`text-white shadow-lg sticky top-0 z-50 transition-colors ${view === 'tenant' ? 'bg-emerald-600' : 'bg-blue-900'}`}>
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('login')}>
                <span className="text-2xl">🌴</span>
                <h1 className="text-xl font-bold tracking-tight">IncidenBot <span className="font-light opacity-80">| Bali Coliving</span></h1>
            </div>
            <div className="text-xs font-mono bg-black/20 px-2 py-1 rounded hidden sm:block">
                {view === 'tenant' ? t.portal_tenant : t.dashboard_admin}
            </div>
            </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className={`${view === 'login' ? 'flex items-center justify-center min-h-screen bg-gray-100' : 'max-w-7xl mx-auto px-4 pt-10'}`}>
        {view === 'login' && renderLoginPage()}
        {view === 'tenant' && renderTenantView()}
        {view === 'staff' && renderStaffDashboard()}
      </main>
    </div>
  );
};

export default App;