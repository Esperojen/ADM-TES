import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(startDate || new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (startDate && !isOpen) {
      setViewDate(startDate);
    }
  }, [startDate, isOpen]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  const padding = Array.from({ length: firstDay }, () => null);

  const handleDayClick = (day: Date) => {
    if (!startDate || (startDate && endDate)) {
      onChange(day, null);
    } else {
      if (day < startDate) {
        onChange(day, null);
      } else {
        onChange(startDate, day);
        setIsOpen(false);
      }
    }
  };

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isSelected = (day: Date) => {
    if (!day) return false;
    if (startDate && day.getTime() === startDate.getTime()) return true;
    if (endDate && day.getTime() === endDate.getTime()) return true;
    return false;
  };

  const isInRange = (day: Date) => {
    if (!day || !startDate) return false;
    if (startDate && endDate) {
      return day > startDate && day < endDate;
    }
    if (startDate && hoverDate && !endDate) {
      return day > startDate && day < hoverDate;
    }
    return false;
  };

  const formatDisplay = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
    } else if (startDate) {
      return `${startDate.toLocaleDateString('id-ID')} - (Pilih tanggal selesai)`;
    }
    return 'Pilih rentang tanggal';
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors hover:bg-slate-50"
      >
        <CalendarIcon className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-slate-700 font-medium truncate">{formatDisplay()}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="font-bold text-slate-800 text-sm">
              {MONTHS[month]} {year}
            </div>
            <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {DAYS.map(d => (
              <div key={d} className="text-[10px] font-bold text-slate-400">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {padding.map((_, i) => (
              <div key={`pad-${i}`} className="w-8 h-8" />
            ))}
            {days.map(day => {
              const selected = isSelected(day);
              const inRange = isInRange(day);
              
              // Helper to detect if day is the start or end of range for border radius
              const isStart = startDate && day.getTime() === startDate.getTime();
              const isEnd = endDate && day.getTime() === endDate.getTime();
              
              return (
                <div
                  key={day.toISOString()}
                  className={`relative flex items-center justify-center h-8 cursor-pointer`}
                  onMouseEnter={() => setHoverDate(day)}
                  onClick={() => handleDayClick(day)}
                >
                  {/* Range Highlight Background */}
                  {inRange && <div className="absolute inset-0 bg-teal-50" />}
                  {(selected && startDate && endDate) && (
                    <>
                      {isStart && <div className="absolute right-0 w-1/2 h-full bg-teal-50" />}
                      {isEnd && <div className="absolute left-0 w-1/2 h-full bg-teal-50" />}
                    </>
                  )}
                  
                  {/* Day Button */}
                  <div
                    className={`relative w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors z-10
                      ${selected ? 'bg-teal-600 text-white font-bold shadow-sm' : 
                        inRange ? 'text-teal-900 font-medium' : 'text-slate-700 hover:bg-slate-100'}
                    `}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
