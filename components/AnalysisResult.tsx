import React from 'react';
import { IncidentAnalysis, IncidentCategory, Sentiment, Language } from '../types';
import { translations } from '../translations';

interface AnalysisResultProps {
  analysis: IncidentAnalysis;
  originalText: string;
  webhookStatus: 'idle' | 'success' | 'error';
  language: Language;
}

const getUrgencyColor = (level: number) => {
  if (level >= 5) return 'bg-red-600 text-white animate-pulse';
  if (level === 4) return 'bg-orange-500 text-white';
  if (level === 3) return 'bg-yellow-400 text-gray-900';
  return 'bg-emerald-500 text-white';
};

const getCategoryIcon = (category: IncidentCategory) => {
  switch (category) {
    case IncidentCategory.Mantenimiento: return '🔧';
    case IncidentCategory.Limpieza: return '🧹';
    case IncidentCategory.Internet: return '📶';
    case IncidentCategory.Administracion: return '📋';
    case IncidentCategory.Emergencia: return '🚨';
    default: return '📝';
  }
};

const getSentimentIcon = (sentiment: Sentiment) => {
  switch (sentiment) {
    case Sentiment.Positivo: return '😊';
    case Sentiment.Neutro: return '😐';
    case Sentiment.Enfadado: return '😡';
    default: return '😐';
  }
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, originalText, webhookStatus, language }) => {
  const t = translations[language];
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(analysis.suggested_reply);
    const btn = document.getElementById('copy-btn');
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = t.ar_copied;
        setTimeout(() => btn.innerText = originalText, 2000);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-8 animate-fade-in-up">
      {/* Header with Urgency and Category */}
      <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl bg-white p-2 rounded-full shadow-sm">
            {getCategoryIcon(analysis.category)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{analysis.category}</h2>
            <p className="text-sm text-gray-500 font-medium">{t.ar_category}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
            <div className={`px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 ${getUrgencyColor(analysis.urgency_level)}`}>
              <span>{t.ar_urgency}: {analysis.urgency_level}/5</span>
            </div>
            {/* Automatic Webhook Status Badge */}
            <div className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${webhookStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {webhookStatus === 'success' ? (
                    <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        {t.ar_synced}
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        {t.ar_error}
                    </>
                )}
            </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Action Summary */}
        <div className="col-span-1 md:col-span-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.ar_summary}</label>
          <div className="mt-1 p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-100 font-semibold text-lg flex items-center justify-between">
            {analysis.action_summary}
            <span className="text-2xl" title={`Sentimiento: ${analysis.sentiment}`}>
              {getSentimentIcon(analysis.sentiment)}
            </span>
          </div>
        </div>

        {/* Suggested Reply */}
        <div className="col-span-1 md:col-span-2">
           <div className="flex justify-between items-end mb-1">
             <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.ar_reply}</label>
             <button 
                id="copy-btn"
                onClick={copyToClipboard}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t.ar_copy}
             </button>
           </div>
           <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 italic relative group">
             "{analysis.suggested_reply}"
           </div>
        </div>

        {/* Raw Data Accordion */}
        <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-gray-100">
            <details className="text-xs text-gray-400 cursor-pointer w-full">
                <summary className="hover:text-gray-600 transition-colors">{t.ar_tech_data}</summary>
                <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto font-mono text-xs max-w-full">
                    {JSON.stringify({ ...analysis, original_message: originalText }, null, 2)}
                </pre>
            </details>
        </div>
      </div>
    </div>
  );
};