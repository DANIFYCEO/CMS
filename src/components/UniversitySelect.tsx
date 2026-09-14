"use client";

import { useState, useRef, useEffect } from "react";
import { NIGERIAN_UNIVERSITIES } from "@/lib/universities";

interface UniversitySelectProps {
  value: string;
  onChange: (val: string) => void;
  customValue: string;
  onCustomChange: (val: string) => void;
  required?: boolean;
}

export default function UniversitySelect({
  value,
  onChange,
  customValue,
  onCustomChange,
  required = true,
}: UniversitySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isCustom = value === "Other / Custom Institution";

  // Filter universities based on search query
  const filteredUniversities = NIGERIAN_UNIVERSITIES.filter((uni) =>
    uni.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (uni: string) => {
    onChange(uni);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col gap-2 w-full" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider">
        University / Campus <span className="text-cms-yellow">{required ? "*" : ""}</span>
      </label>

      {/* Main Select Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-black/70 border border-white/20 rounded-xl pl-11 pr-10 py-3.5 text-left text-sm text-white flex items-center justify-between hover:border-cms-yellow/60 transition-colors focus:outline-none focus:border-cms-yellow cursor-pointer"
        >
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </span>

          <span className={`truncate ${value ? "text-white font-medium" : "text-white/40"}`}>
            {value || "Select your university in Nigeria"}
          </span>

          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-cms-yellow" : ""}`}
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </button>

        {/* Dropdown Menu with Instant Search Filter */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121214] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input */}
            <div className="p-2.5 border-b border-white/10 bg-[#18181b] sticky top-0 z-10">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                  </svg>
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search e.g. UNILAG, OAU, Covenant, FUTA..."
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
              {filteredUniversities.length > 0 ? (
                filteredUniversities.map((uni) => {
                  const isSelected = value === uni;
                  return (
                    <button
                      key={uni}
                      type="button"
                      onClick={() => handleSelect(uni)}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-cms-yellow/15 text-cms-yellow font-bold"
                          : "text-white/80 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="truncate pr-2">{uni}</span>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cms-yellow shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center">
                  <p className="text-white/40 text-xs mb-2">No matching Nigerian university found.</p>
                  <button
                    type="button"
                    onClick={() => handleSelect("Other / Custom Institution")}
                    className="text-cms-yellow text-xs font-semibold hover:underline"
                  >
                    Select "Other / Custom Institution"
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Institution Input if "Other" is chosen */}
      {isCustom && (
        <div className="animate-in fade-in duration-200 mt-1">
          <label className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1">
            Type Your Institution Name
          </label>
          <input
            type="text"
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="e.g. Yaba College of Technology, Federal Poly Ilaro"
            required={required}
            className="w-full bg-black/70 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
          />
        </div>
      )}
    </div>
  );
}
