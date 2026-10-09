import { getTextElementDisplayMetrics, getTextElementEffectCSS, getAnimationStyle } from './videoPlayerTemplateRendering.jsx'
import { X, RotateCw, Move } from 'lucide-react'

export default function TextElementLayer({
  activeTextElements,
  isEditing,
  setCaptions,
  selectedCaptionId,
  setSelectedCaptionId,
  wordPopup,
  setWordPopup,
  setIsEditing,
  setEditText,
  draggedElementId,
  previewRenderScale,
  handleTextElementMouseDown,
  handleCaptionDoubleClick,
  handleTextElementResizeDown,
  inputRef,
  handleEditInput,
  handleEditComplete,
  handleEditKeyDown,
  editText,
  getWordRenderOffset,
  draggingWord,
  handleWordMouseDown,
  lastDragDropTime,
  handleTextElementRotateStart,
}) {
  return <>
          {activeTextElements.map((element) => {
            const style = element.customStyle || {}
            const isEditingThis = isEditing === element.id
            const textElementMetrics = getTextElementDisplayMetrics(style)
            const textElementEffects = getTextElementEffectCSS(style)

            const handleDeleteElement = (e) => {
              e.stopPropagation()
              e.preventDefault()
              if (!setCaptions || element.readOnly) return
              setCaptions(prev => prev.filter(c => c.id !== element.id))
              if (selectedCaptionId === element.id) setSelectedCaptionId?.(null)
              if (wordPopup?.elementId === element.id) setWordPopup?.(null)
              if (isEditingThis) {
                setIsEditing(false)
                setEditText('')
              }
            }

            return (
              <div
                key={element.id}
                dir="auto"
                inert={element.readOnly ? "" : undefined}
                data-text-element-layer="true"
                className={`absolute group ${draggedElementId === element.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  top: `${style.top ?? 50}%`,
                  left: `${style.left ?? 50}%`,
                  transform: `translate(-50%, -50%)${style.rotation ? ` rotate(${style.rotation}deg)` : ''}`,
                  transformOrigin: 'center center',
                  width: `${(style.width || 300) * previewRenderScale}px`,
                  zIndex: style.zIndex || 50
                }}
                onPointerDown={(e) => {
                  if (!isEditingThis) {
                    // Set this text element as selected
                    if (setSelectedCaptionId) setSelectedCaptionId(element.id)
                    handleTextElementMouseDown(e, element.id, style)
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (setSelectedCaptionId) setSelectedCaptionId(element.id)
                }}
                onDoubleClick={(e) => handleCaptionDoubleClick(e, element)}
              >
                <div
                  className={`border border-solid ${selectedCaptionId === element.id ? 'border-[#b76cff]' : 'border-transparent hover:border-[#b76cff]'} relative ${draggedElementId === element.id ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : 'cursor-grab'}`}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: style.textAlign || 'center',
                    maxWidth: '90vw',
                    position: 'relative',
                    display: 'inline-block',
                  }}
                >
                  {style.hasBackground !== false && element.type !== 'textbox' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${textElementMetrics.backgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: style.backgroundColor
                          ? `rgba(${parseInt(style.backgroundColor.slice(1, 3), 16)}, ${parseInt(style.backgroundColor.slice(3, 5), 16)}, ${parseInt(style.backgroundColor.slice(5, 7), 16)}, ${style.backgroundOpacity ?? 0.7})`
                          : `rgba(0, 0, 0, ${style.backgroundOpacity ?? 0.7})`,
                        borderRadius: `${style.borderRadius || 6}px`,
                        width: `${100 * textElementMetrics.backgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * textElementMetrics.backgroundPadding}px)`,
                      }}
                    />
                  )}

                {/* Keep removal available without hover, including while editing.
                    Near the top of the frame the button sits below the box so the
                    preview's scroll area cannot clip it. */}
                {setCaptions && !element.readOnly && (
                  <button
                    type="button"
                    className={`absolute ${Number(style.top ?? 50) < 20 ? 'top-full mt-2' : '-top-9'} -right-3 z-[60] flex h-7 w-7 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-white/30 bg-zinc-900 text-white shadow-xl transition-colors hover:border-red-400 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                    data-text-element-close="true"
                    aria-label="Remove text box"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={handleDeleteElement}
                    title="Remove text box"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Resize handles - show for all active text elements */}
                {!isEditingThis && (
                  <>
                    {[
                      ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize w-3 h-3 rounded-full'],
                      ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize w-3 h-3 rounded-full'],
                      ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize w-3 h-3 rounded-full'],
                      ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize w-3 h-3 rounded-full'],
                      ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize w-2 h-4.5 rounded-full'],
                      ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize w-2 h-4.5 rounded-full'],
                    ].map(([edge, positionAndShapeClass]) => (
                      <div
                        key={edge}
                        className={`text-resize-handle absolute z-50 border border-[#b76cff] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.7)] ${positionAndShapeClass} transition-opacity ${selectedCaptionId === element.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        data-resize-edge={edge}
                        onPointerDown={(e) => handleTextElementResizeDown(e, element.id, style)}
                        style={{ touchAction: 'none' }}
                      />
                    ))}
                  </>
                )}

                {isEditingThis ? (
                  <div
                    ref={inputRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditInput}
                    onBlur={() => handleEditComplete(element.id)}
                    onKeyDown={handleEditKeyDown}
                    className="bg-transparent border-none outline-none text-center relative z-10"
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textTransform: style.textTransform || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'normal',
                      overflowWrap: 'anywhere',
                      minHeight: '40px',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        display: 'block',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {editText}
                  </div>
                ) : (
                  <div
                    className={element.animation ? `animate-${element.animation}` : ''}
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      textTransform: style.textTransform || 'none',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      textDecoration: style.textDecoration || 'none',
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'normal',
                      overflowWrap: 'anywhere',
                      animation: element.animation && element.animation !== 'none' ? getAnimationStyle(element.animation, element.animationSpeed) : 'none',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {/* Render words individually with per-word styling */}
                    {Number(style.width || 0) < 80 ? (element.text || '') : (element.text || '').split(/(\s+|\n)/).map((part, i, parts) => {
                      if (part === '\n') return <br key={i} />
                      if (part.match(/^\s+$/)) return <span key={i}>{part}</span>

                      const wordIndex = parts.slice(0, i).filter(token => token.trim()).length
                      const wordStyle = element.wordStyles?.[`${element.id}-${wordIndex}`] || {}
                      const isWordClicked = wordPopup?.type === 'element' && wordPopup?.elementId === element.id && wordPopup?.wordIndex === wordIndex
                      // Extract transform to parent - ensures text + background move together
                      const { animation, ...restWordStyle } = wordStyle
                      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(wordStyle)

                      return (
                        <span
                          key={i}
                          data-word-key={`${element.id}-${wordIndex}`}
                          style={{
                            display: 'inline-block',
                            position: 'relative',
                            transform: `translate(${renderOffsetX}px, ${renderOffsetY}px)`,
                            transition: draggingWord ? 'none' : 'transform 0.1s ease',
                            cursor: draggingWord?.captionId === element.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
                            height: `${(style.fontSize || 18) * 1.4}px`,
                            verticalAlign: 'top',
                          }}
                          onPointerDown={(e) => handleWordMouseDown(e, element, wordIndex, true)}
                          onClick={(e) => {
                            if (Date.now() - lastDragDropTime.current < 150) return
                            if (setWordPopup) {
                              e.stopPropagation()
                              setWordPopup({
                                type: 'element',
                                word: part,
                                elementId: element.id,
                                position: { x: e.clientX, y: e.clientY },
                                caption: null,
                                wordIndex
                              })
                            }
                          }}
                        >
                          {/* Spacer: reserves original space based on element's base font */}
                          <span
                            style={{
                              visibility: 'hidden',
                              fontFamily: style.fontFamily || 'Inter',
                              fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                              fontWeight: style.fontWeight || 'normal',
                              whiteSpace: 'pre',
                            }}
                          >
                            {part}
                          </span>

                          {/* Absolute container centers text + background group */}
                          <span
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            {/* UNIFIED GROUP: Background wraps text - both move with parent transform */}
                            <span
                              className={animation ? `animate-${animation}` : ''}
                              style={{
                                pointerEvents: 'auto',
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: animation && animation !== 'none' ? getAnimationStyle(animation, wordStyle.animationSpeed) : 'none',
                              }}
                            >
                              {/* BACKGROUND LAYER - Fixed padding, independent of text size */}
                              <span
                                style={{
                                  position: 'absolute',
                                  top: -2,
                                  left: -4,
                                  right: -4,
                                  bottom: -2,
                                  zIndex: -1,
                                  borderRadius: restWordStyle.backgroundColor || isWordClicked ? '4px' : undefined,
                                  backgroundColor: restWordStyle.backgroundColor
                                    ? `rgba(${parseInt(restWordStyle.backgroundColor.slice(1, 3), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(3, 5), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(5, 7), 16)}, ${restWordStyle.backgroundOpacity ?? 0.6})`
                                    : (isWordClicked ? 'rgba(245, 166, 35, 0.24)' : undefined),
                                  border: isWordClicked ? '1px solid rgba(245, 166, 35, 0.9)' : '1px solid transparent',
                                }}
                              />

                              {/* TEXT LAYER */}
                              <span
                                style={{
                                  fontFamily: restWordStyle.fontFamily || style.fontFamily || 'Inter',
                                  fontSize: restWordStyle.fontSize ? `${restWordStyle.fontSize * previewRenderScale}px` : `${(style.fontSize || 18) * previewRenderScale}px`,
                                  fontWeight: restWordStyle.fontWeight || style.fontWeight || 'normal',
                                  fontStyle: restWordStyle.fontStyle || style.fontStyle || 'normal',
                                  textDecoration: restWordStyle.textDecoration || style.textDecoration || 'none',
                                  textTransform: restWordStyle.textTransform || style.textTransform || 'none',
                                  color: restWordStyle.color || style.color || '#ffffff',
                                  padding: restWordStyle.backgroundPadding ? `${restWordStyle.backgroundPadding}px` : (isWordClicked ? '2px 4px' : undefined),
                                  whiteSpace: 'pre',
                                  ...(style.hasStroke ? { WebkitTextStroke: `${style.strokeWidth || 1}px ${style.strokeColor || '#000000'}` } : {}),
                                  ...(style.hasShadow ? { textShadow: `${style.shadowOffsetX ?? 0}px ${style.shadowOffsetY ?? 2}px ${style.shadowBlur ?? 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` } : {}),
                                  ...(restWordStyle.textGradient ? {
                                    background: restWordStyle.textGradient,
                                    backgroundImage: restWordStyle.textGradient,
                                    backgroundSize: '100% 100%',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                  } : {}),
                                }}
                              >
                                {part}
                              </span>
                            </span>
                          </span>
                        </span>
                      )
                    })}
                  </div>
                )}
              {/* Action buttons below the bounding box */}
              {selectedCaptionId === element.id && !isEditingThis && (
                <div
                  className="absolute left-1/2 top-full z-50 mt-3.5 flex -translate-x-1/2 items-center gap-2"
                  style={{ pointerEvents: 'auto' }}
                  data-video-control
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => handleTextElementRotateStart(e, element.id, style)}
                    title="Rotate text"
                    data-video-control
                  >
                    <RotateCw className="h-3.5 w-3.5 text-[#4f4f5a]" strokeWidth={2} />
                  </span>
                  <span
                    className="text-element-move-btn flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
                    style={{ cursor: 'move' }}
                    onPointerDown={(e) => {
                      handleTextElementMouseDown(e, element.id, style)
                    }}
                    title="Move text"
                    data-video-control
                  >
                    <Move className="h-3.5 w-3.5 text-[#4f4f5a]" strokeWidth={2} />
                  </span>
                </div>
              )}
              </div>
              </div>
            )
          })}


  </>
}
