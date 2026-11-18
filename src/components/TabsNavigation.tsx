import React from 'react';
import { 
  Users, 
  Settings, 
  LayoutGrid, 
  FileText, 
  BarChart3
} from 'lucide-react';
import { ActiveTab } from '../types';

interface TabsNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  studentCount: number;
  roomCount: number;
  violationsCount: number;
}

export const TabsNavigation: React.FC<TabsNavigationProps> = ({
  activeTab,
  onSelectTab,
  studentCount,
  roomCount,
  violationsCount
}) => {
  const tabs = [
    {
      id: 'students' as ActiveTab,
      label: 'Data Siswa',
      icon: Users,
      badge: studentCount.toString(),
      tooltip: 'Kelola data siswa & import'
    },
    {
      id: 'config' as ActiveTab,
      label: 'Aturan',
      icon: Settings,
      badge: `${roomCount} R`,
      tooltip: 'Aturan, kapasitas, dan kop dokumen'
    },
    {
      id: 'seating' as ActiveTab,
      label: 'Denah',
      icon: LayoutGrid,
      badge: violationsCount > 0 ? `${violationsCount} Isu` : 'OK',
      badgeColor: violationsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800',
      tooltip: 'Visualisasi denah & swap kursi'
    },
    {
      id: 'documents' as ActiveTab,
      label: 'PDF',
      icon: FileText,
      tooltip: 'Cetak denah & daftar hadir'
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Statistik',
      icon: BarChart3,
      tooltip: 'Analisis & rekapitulasi ruang'
    }
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-none justify-center sm:justify-start">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                title={tab.tooltip}
                className={`group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'
                }`} />
                <span className="hidden md:inline-block">{tab.label}</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-tight ${
                    isActive 
                      ? 'bg-teal-100 text-teal-800' 
                      : (tab.badgeColor || 'bg-slate-100 text-slate-500')
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
