import React from 'react';

export default function MobileDashboardDock({
  activeTab,
  tabs,
  setActiveTab,
  renderEditorPanel,
  renderStylePanel,
  renderTimelinePanel,
}) {
  return (
    <div className="lg:hidden shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#090909]/96 shadow-[0_-16px_50px_-35px_rgba(0,0,0,0.95)]">
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-w-fit touch-manipulation items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold transition-colors ${
                active
                  ? 'border-white/25 bg-white text-black'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 active:bg-white/15'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="h-[34dvh] min-h-[210px] max-h-[390px] overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {activeTab === 'style' ? (
          renderStylePanel()
        ) : activeTab === 'timeline' ? (
          <div className="h-full overflow-hidden rounded-[18px]">
            {renderTimelinePanel()}
          </div>
        ) : (
          <div className="h-full rounded-[18px] lekha-panel lekha-panel-corners p-3 overflow-hidden">
            {renderEditorPanel()}
          </div>
        )}
      </div>
    </div>
  );
}
