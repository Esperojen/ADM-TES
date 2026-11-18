import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Workspace } from './components/Workspace';
import { AppTheme } from './types';
import { db } from './db/db';
import { DEFAULT_METADATA, DEFAULT_JADWAL_TKA1 } from './utils/pdfGenerator';

export function App() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [activeTheme, setActiveTheme] = useState<AppTheme>('calm_slate');

  useEffect(() => {
    // One-time migration to overwrite existing events with the new default metadata
    const migrateData = async () => {
      const events = await db.assessmentEvents.toArray();
      for (const event of events) {
        if (!event.metadata) continue;
        let needsUpdate = false;
        const updatedMeta = { ...event.metadata };

        // Update if it still has old ASTS text
        if (updatedMeta.namaUjian?.includes('ASTS')) {
          Object.assign(updatedMeta, DEFAULT_METADATA);
          needsUpdate = true;
        }

        // Synchronize exam dates from 21-22 to 23-24 September 2026
        if (updatedMeta.tanggalUjian && (updatedMeta.tanggalUjian.includes('21 - 22 September') || updatedMeta.tanggalUjian.includes('21 September'))) {
          updatedMeta.tanggalUjian = '23 - 24 September 2026';
          needsUpdate = true;
        }

        // Synchronize schedule rows from 21/22 to 23/24 September 2026
        if (!updatedMeta.jadwalUjian || updatedMeta.jadwalUjian.some(j => j.hariTanggal.includes('21 September') || j.hariTanggal.includes('22 September'))) {
          updatedMeta.jadwalUjian = DEFAULT_JADWAL_TKA1;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await db.assessmentEvents.update(event.id!, {
            metadata: updatedMeta
          });
        }
      }
    };
    migrateData();
  }, []);

  const themeBgClasses: Record<AppTheme, string> = {
    calm_slate: 'bg-slate-100 text-slate-900',
    warm_paper: 'bg-[#f7f5f0] text-stone-900',
    soft_teal: 'bg-[#f0f7f6] text-slate-900',
    subtle_indigo: 'bg-[#f3f4f9] text-slate-900'
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${themeBgClasses[activeTheme]}`}>
      {!selectedEventId ? (
        <Dashboard onSelectEvent={setSelectedEventId} />
      ) : (
        <Workspace 
          eventId={selectedEventId} 
          onBack={() => setSelectedEventId(null)}
          activeTheme={activeTheme}
          onThemeChange={setActiveTheme}
        />
      )}
    </div>
  );
}

export default App;
