import { deliveryGeometry } from './projectDelivery'

export default function DeliveryControls({ style, onChange, tracks = [], activeTrackId }) {
  const geometry = deliveryGeometry(style)
  const update = (patch) => onChange({ ...style, ...patch })
  return (
    <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200">
      <summary className="cursor-pointer font-semibold">Frame, bilingual captions and safe area</summary>
      <div className="mt-3 grid gap-3">
        <div role="group" aria-label="Output aspect ratio" className="flex gap-2">
          {['9:16', '1:1', '16:9'].map((aspect) => <button type="button" key={aspect} aria-pressed={geometry.aspect === aspect} onClick={() => update({ export_aspect_ratio: aspect })} className="rounded border border-white/20 px-3 py-2 aria-pressed:bg-amber-300 aria-pressed:text-black">{aspect === '1:1' ? '1:1 Square' : aspect}</button>)}
        </div>
        <label>Framing <select aria-label="Framing" value={geometry.fit} onChange={(event) => update({ frame_fit: event.target.value })} className="ml-2 rounded bg-zinc-900 p-2"><option value="cover">Fill / crop</option><option value="contain">Fit / letterbox</option></select></label>
        {['x', 'y'].map((axis) => <label key={axis} className="flex items-center gap-2">{axis === 'x' ? 'Horizontal' : 'Vertical'} framing<input aria-label={`${axis === 'x' ? 'Horizontal' : 'Vertical'} framing`} type="range" min="0" max="100" value={geometry[axis]} onChange={(event) => update({ [`frame_${axis}`]: Number(event.target.value) })} className="min-w-0 flex-1" /><span>{geometry[axis]}%</span></label>)}
        <label className="flex gap-2"><input type="checkbox" checked={!!style.show_safe_area} onChange={(event) => update({ show_safe_area: event.target.checked })} />Show safe-area guide (preview only)</label>
        {style.show_safe_area && ['x', 'y'].map((axis) => <label key={axis} className="flex gap-2">{axis === 'x' ? 'Side' : 'Top / bottom'} margin<input aria-label={`Safe area ${axis} margin`} type="range" min="0" max="30" value={axis === 'x' ? geometry.safeX : geometry.safeY} onChange={(event) => update({ [`safe_area_${axis}`]: Number(event.target.value) })} /></label>)}
        <p className="text-[10px] text-slate-400">Guides are adjustable references; check the destination app’s controls before publishing.</p>
        <label>Bilingual output <select aria-label="Bilingual output" value={style.bilingual_track_id === activeTrackId ? '' : (style.bilingual_track_id || '')} onChange={(event) => update({ bilingual_track_id: event.target.value })} className="mt-1 w-full rounded bg-zinc-900 p-2"><option value="">Selected language only</option>{tracks.filter((track) => track.id !== activeTrackId).map((track) => <option key={track.id} value={track.id}>{track.label || track.language}</option>)}</select></label>
        {style.bilingual_track_id && <div className="grid grid-cols-2 gap-2">
          <label>Second line size<input aria-label="Second language font size" type="number" min="8" max="60" value={style.bilingual_font_size ?? 17} onChange={(event) => update({ bilingual_font_size: Number(event.target.value) })} className="w-full rounded bg-zinc-900 p-2" /></label>
          <label>Second line color<input aria-label="Second language color" type="color" value={style.bilingual_color || '#ffffff'} onChange={(event) => update({ bilingual_color: event.target.value })} /></label>
          <label className="col-span-2">Second line vertical position<input aria-label="Second language vertical position" type="range" min="5" max="95" value={style.bilingual_position_y ?? 88} onChange={(event) => update({ bilingual_position_y: Number(event.target.value) })} className="w-full" /></label>
          {Math.abs((style.bilingual_position_y ?? 88) - (style.position_y ?? 75)) < 14 && <p role="status" className="col-span-2 text-[11px] text-amber-200">The two caption lines are close together. Move the second line and check long translations for overlap.</p>}
          <p className="col-span-2 text-[10px] text-slate-400">Both tracks appear in preview and downloads. Edit the second language by selecting its track. Keep the two lines apart.</p>
        </div>}
      </div>
    </details>
  )
}
